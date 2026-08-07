import "server-only"
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import type { SupabaseClient } from "@supabase/supabase-js"

// Server-only shared helpers for the public owner-document intake flow: the
// private Supabase transit bucket, doc/type validation, the request-token
// lookup + open-state check, and the Supabase→S3 relocation (mirrors
// moveSupabaseFileToS3 in the construction-updates route, but downloads from a
// PRIVATE bucket via the service role instead of fetching a public URL).

export const OWNER_DOCS_BUCKET = "owner-documents"

export const OWNER_DOC_TYPES = ["title_deed", "emirates_id", "passport", "signed_noc", "other"] as const
export type OwnerDocType = (typeof OWNER_DOC_TYPES)[number]

export const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "application/pdf"])
export const MAX_FILE_BYTES = 25 * 1024 * 1024 // 25 MB
export const TOKEN_RE = /^[0-9a-f]{32,128}$/i

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
}
const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg", jpeg: "image/jpeg",
  png: "image/png", webp: "image/webp",
}

export function extForMime(mime: string): string | null {
  return EXT_BY_MIME[mime] ?? null
}
export function fileTypeCategory(mime: string): "pdf" | "image" {
  return mime === "application/pdf" ? "pdf" : "image"
}
export function isOwnerDocType(v: unknown): v is OwnerDocType {
  return typeof v === "string" && (OWNER_DOC_TYPES as readonly string[]).includes(v)
}

/** A storage path is only acceptable if it lives directly under this token's
 *  folder and has no traversal segments — prevents a caller moving/reading any
 *  other object in the bucket. */
export function isPathInToken(path: string, token: string): boolean {
  return (
    typeof path === "string" &&
    path.startsWith(`${token}/`) &&
    !path.includes("..") &&
    path.length <= 256
  )
}

const s3 = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

/**
 * Download a just-uploaded file from the private owner-documents bucket, put it
 * on S3 under fhi_global/owner-documents/<path>, and delete the transient
 * Supabase copy. Returns the S3 public URL, or null on any failure (caller
 * decides how to handle a failed move).
 */
export async function moveOwnerDocToS3(admin: SupabaseClient, path: string): Promise<string | null> {
  try {
    const { data, error } = await admin.storage.from(OWNER_DOCS_BUCKET).download(path)
    if (error || !data) return null
    const buffer = Buffer.from(await data.arrayBuffer())
    const ext = path.split(".").pop()?.toLowerCase() ?? "bin"
    const key = `fhi_global/owner-documents/${path}`
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: key,
        Body: buffer,
        ContentType: CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream",
        CacheControl: "private, max-age=31536000",
      }),
    )
    try {
      await admin.storage.from(OWNER_DOCS_BUCKET).remove([path])
    } catch {
      /* orphan in the private bucket is harmless */
    }
    return `${process.env.S3_PUBLIC_URL}/${key}`
  } catch {
    return null
  }
}

/**
 * Best-effort delete of owner-document files from S3 by their public URL (used
 * when an admin deletes a request). Only touches objects under our S3_PUBLIC_URL
 * — signed Supabase fallback URLs are left alone.
 */
export async function deleteOwnerDocFilesFromS3(urls: string[]): Promise<void> {
  const base = process.env.S3_PUBLIC_URL
  if (!base) return
  for (const url of urls) {
    if (typeof url !== "string" || !url.startsWith(`${base}/`)) continue
    const key = url.slice(base.length + 1)
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME!, Key: key }))
    } catch {
      /* best-effort — orphaned object is harmless */
    }
  }
}

export type OwnerRequestRow = {
  id: string
  token: string
  agent_id: string
  status: string
  expires_at: string | null
  deleted_at: string | null
}

const TOKEN_LOOKUP_SELECT = "id, token, agent_id, status, expires_at, deleted_at"

/** Look up a request by its token (service-role; public flow). */
export async function getRequestByToken(
  admin: SupabaseClient,
  token: string,
): Promise<OwnerRequestRow | null> {
  if (!TOKEN_RE.test(token)) return null
  const { data } = await admin
    .from("owner_document_requests")
    .select(TOKEN_LOOKUP_SELECT)
    .eq("token", token)
    .is("deleted_at", null)
    .maybeSingle<OwnerRequestRow>()
  return data ?? null
}

export type RequestOpenState = "open" | "invalid" | "cancelled" | "submitted" | "expired"

/** Whether an owner may still fill/upload against this request. */
export function requestOpenState(req: OwnerRequestRow | null): RequestOpenState {
  if (!req || req.deleted_at) return "invalid"
  if (req.status === "cancelled") return "cancelled"
  if (req.status === "submitted") return "submitted"
  if (req.expires_at && new Date(req.expires_at).getTime() < Date.now()) return "expired"
  return "open"
}
