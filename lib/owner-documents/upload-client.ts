"use client"

// Client uploader for the public owner-document intake. The anon owner can't
// upload straight to S3 (shared-bucket CORS) or through an API route (Vercel's
// ~4.5MB body limit), so: mint a server-side signed upload URL, PUT the file to
// the private Supabase bucket with XHR (real progress — lib/upload/signed-upload),
// then the submit route relocates it to S3.

import { putFileToSignedUpload, type SignedUploadMint } from "@/lib/upload/signed-upload"

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
  let mint: SignedUploadMint
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

  // 2. PUT the file to the private bucket (XHR with progress, SDK fallback).
  const { error } = await putFileToSignedUpload(BUCKET, mint, file, onProgress)
  if (error) return { data: null, error }
  return { data: uploaded, error: null }
}
