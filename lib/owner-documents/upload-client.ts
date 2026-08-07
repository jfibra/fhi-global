"use client"

// Client uploader for the public owner-document intake. The anon owner can't
// upload straight to S3 (shared-bucket CORS) or through an API route (Vercel's
// ~4.5MB body limit), so: mint a server-side signed upload URL, PUT the file to
// the private Supabase bucket with XHR (real progress), then the submit route
// relocates it to S3. Falls back to the storage SDK's uploadToSignedUrl (no
// progress) if the XHR request fails for any reason.

import { createClient } from "@/lib/supabase/client"

const BUCKET = "owner-documents"

export type UploadedDoc = {
  path: string
  fileName: string
  fileType: "pdf" | "image"
  fileSize: number
}

export async function uploadOwnerDoc(
  requestToken: string,
  docType: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ data: UploadedDoc | null; error: string | null }> {
  // 1. Mint a one-time signed upload URL scoped to this request's folder.
  let mint: { signedUrl: string; token: string; path: string }
  try {
    const res = await fetch(`/api/owner-documents/${requestToken}/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docType, mime: file.type }),
    })
    const json = (await res.json()) as { signedUrl?: string; token?: string; path?: string; error?: string }
    if (!res.ok || !json.signedUrl || !json.token || !json.path) {
      return { data: null, error: json.error ?? "Upload could not start. Please try again." }
    }
    mint = { signedUrl: json.signedUrl, token: json.token, path: json.path }
  } catch {
    return { data: null, error: "Upload could not start. Please try again." }
  }

  const uploaded: UploadedDoc = {
    path: mint.path,
    fileName: file.name,
    fileType: file.type === "application/pdf" ? "pdf" : "image",
    fileSize: file.size,
  }

  // 2a. Primary: XHR PUT to the signed URL so upload.onprogress reports a real
  // percentage. Replicates storage-js's multipart request to the sign endpoint.
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
    return { data: uploaded, error: null }
  }

  // 2b. Fallback: the storage SDK (correct, but no progress).
  try {
    const supabase = createClient()
    const { error } = await supabase.storage.from(BUCKET).uploadToSignedUrl(mint.path, mint.token, file)
    if (error) return { data: null, error: error.message || "Upload failed. Please try again." }
    onProgress?.(100)
    return { data: uploaded, error: null }
  } catch {
    return { data: null, error: "Upload failed. Please try again." }
  }
}
