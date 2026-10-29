import "server-only"
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import type { SupabaseClient } from "@supabase/supabase-js"

// Server-only helpers for the Supabase → S3 transit. Browsers can't upload to
// the shared S3 bucket (its CORS allows GET only) and API routes can't take
// large bodies (Vercel's ~4.5 MB limit), so a file is first uploaded to a
// PRIVATE Supabase bucket through a server-minted signed URL, then moved here:
// downloaded with the service role, PUT to S3, and the transit copy deleted.
// Used by Owner Documents (lib/owner-documents/server.ts) and the A2A agreement
// documents (lib/a2a-agreements/server.ts).

const s3 = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg", jpeg: "image/jpeg",
  png: "image/png", webp: "image/webp",
}

export type TransitMove =
  | { url: string; size: number; error?: undefined }
  /** missing: the transit copy couldn't be read · rejected: `check` refused the
   *  bytes (the transit copy is deleted) · upload: the S3 PUT failed. */
  | { url?: undefined; size?: undefined; error: "missing" | "rejected" | "upload" }

/** Delete a transit copy. An orphan in a private bucket is harmless, so failures are ignored. */
export async function removeTransitFile(admin: SupabaseClient, bucket: string, path: string): Promise<void> {
  try {
    await admin.storage.from(bucket).remove([path])
  } catch {
    /* best-effort */
  }
}

/**
 * Move a just-uploaded file from a private transit bucket to S3 under
 * `<keyPrefix>/<path>` and delete the transit copy. `check` (optional) sees the
 * bytes before anything is stored — return false to refuse the file.
 */
export async function moveTransitFileToS3(
  admin: SupabaseClient,
  opts: { bucket: string; path: string; keyPrefix: string; check?: (bytes: Buffer) => boolean },
): Promise<TransitMove> {
  const { bucket, path, keyPrefix, check } = opts

  let buffer: Buffer
  try {
    const { data, error } = await admin.storage.from(bucket).download(path)
    if (error || !data) return { error: "missing" }
    buffer = Buffer.from(await data.arrayBuffer())
  } catch {
    return { error: "missing" }
  }

  if (check && !check(buffer)) {
    await removeTransitFile(admin, bucket, path)
    return { error: "rejected" }
  }

  const ext = path.split(".").pop()?.toLowerCase() ?? "bin"
  const key = `${keyPrefix}/${path}`
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: key,
        Body: buffer,
        ContentType: CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream",
        CacheControl: "private, max-age=31536000",
      }),
    )
  } catch {
    return { error: "upload" }
  }

  await removeTransitFile(admin, bucket, path)
  return { url: `${process.env.S3_PUBLIC_URL}/${key}`, size: buffer.length }
}

/**
 * Best-effort delete of S3 objects by their public URL. Only touches objects
 * under our S3_PUBLIC_URL — anything else (e.g. a signed Supabase fallback URL)
 * is left alone.
 */
export async function deleteS3ObjectsByUrl(urls: string[]): Promise<void> {
  const base = process.env.S3_PUBLIC_URL
  if (!base) return
  await Promise.all(
    urls
      .filter((url) => typeof url === "string" && url.startsWith(`${base}/`))
      .map(async (url) => {
        try {
          await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME!, Key: url.slice(base.length + 1) }))
        } catch {
          /* best-effort — an orphaned object is harmless */
        }
      }),
  )
}
