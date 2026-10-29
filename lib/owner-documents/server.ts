import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { deleteS3ObjectsByUrl, moveTransitFileToS3 } from "@/lib/s3-transit"

// Server-only shared helpers for the public owner-document intake flow: the
// private Supabase transit bucket, doc/type validation, the request-token
// lookup + open-state check, and the Supabase→S3 relocation (the shared
// transit in lib/s3-transit.ts — downloads from the PRIVATE bucket via the
// service role, unlike the construction-updates route's public-URL fetch).

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

/**
 * Download a just-uploaded file from the private owner-documents bucket, put it
 * on S3 under fhi_global/owner-documents/<path>, and delete the transient
 * Supabase copy. Returns the S3 public URL, or null on any failure (caller
 * decides how to handle a failed move).
 */
export async function moveOwnerDocToS3(admin: SupabaseClient, path: string): Promise<string | null> {
  const moved = await moveTransitFileToS3(admin, {
    bucket: OWNER_DOCS_BUCKET,
    path,
    keyPrefix: "fhi_global/owner-documents",
  })
  return moved.url ?? null
}

/**
 * Best-effort delete of owner-document files from S3 by their public URL (used
 * when an admin deletes a request). Only touches objects under our S3_PUBLIC_URL
 * — signed Supabase fallback URLs are left alone.
 */
export function deleteOwnerDocFilesFromS3(urls: string[]): Promise<void> {
  return deleteS3ObjectsByUrl(urls)
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
