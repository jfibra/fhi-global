"use client"

// PUT a file to a Supabase signed upload URL — the browser half of the
// Supabase → S3 transit (lib/s3-transit.ts). The server mints the URL for a
// path it chose in a PRIVATE bucket; the file goes there with XHR so
// upload.onprogress reports a real percentage, and a server route later moves
// it to S3. Falls back to the storage SDK's uploadToSignedUrl (no progress) if
// the XHR request fails for any reason. Used by the owner-document intake and
// the A2A agreement documents.

import { createClient } from "@/lib/supabase/client"

export type SignedUploadMint = { signedUrl: string; token: string; path: string }

export async function putFileToSignedUpload(
  bucket: string,
  mint: SignedUploadMint,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ error: string | null }> {
  // Primary: XHR PUT to the signed URL. Replicates storage-js's multipart
  // request to the sign endpoint (no Authorization header — the token in the
  // URL is the permission).
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const viaXhr = await new Promise<boolean>((resolve) => {
    try {
      const xhr = new XMLHttpRequest()
      xhr.open("PUT", mint.signedUrl)
      if (anonKey) xhr.setRequestHeader("apikey", anonKey)
      xhr.setRequestHeader("x-upsert", "false")
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300)
      xhr.onerror = () => resolve(false)
      const form = new FormData()
      form.append("cacheControl", "3600")
      form.append("", file)
      xhr.send(form)
    } catch {
      resolve(false)
    }
  })
  if (viaXhr) {
    onProgress?.(100)
    return { error: null }
  }

  // Fallback: the storage SDK (correct, but no progress).
  try {
    const supabase = createClient()
    const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(mint.path, mint.token, file)
    if (error) return { error: error.message || "Upload failed. Please try again." }
    onProgress?.(100)
    return { error: null }
  } catch {
    return { error: "Upload failed. Please try again." }
  }
}
