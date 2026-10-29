"use client"

// Browser uploader for A2A agreement documents. Three steps, so a 25 MB scan
// never passes through an API route (Vercel's ~4.5 MB body limit) and never
// goes straight to the shared S3 bucket (its CORS is GET-only):
//   1. ask the API for a signed upload URL — it picks the path;
//   2. PUT the file to the private transit bucket with progress;
//   3. ask the API to move it to S3 and record it.
// Images are not compressed: ID scans must stay legible.

import { putFileToSignedUpload, type SignedUploadMint } from "@/lib/upload/signed-upload"
import type { A2AAgreementFile } from "@/lib/a2a-agreements-service"
import {
  A2A_ALLOWED_MIME,
  A2A_DOCS_BUCKET,
  A2A_MAX_FILE_BYTES,
  A2A_MAX_FILE_MB,
  type A2ADocType,
  type A2APartyKey,
} from "./shared"

/** Why a picked file can't be attached, or null when it can. */
export function a2aFileProblem(file: File): string | null {
  if (!A2A_ALLOWED_MIME.includes(file.type)) return `"${file.name}" isn't a JPG, PNG or PDF.`
  if (file.size > A2A_MAX_FILE_BYTES) return `"${file.name}" is over ${A2A_MAX_FILE_MB} MB.`
  return null
}

export async function uploadA2ADocument(
  agreementId: string,
  party: A2APartyKey | null,
  docType: A2ADocType,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ data: A2AAgreementFile | null; error: string | null }> {
  const problem = a2aFileProblem(file)
  if (problem) return { data: null, error: problem }

  // 1. A one-time upload URL for a path the server chose.
  let mint: SignedUploadMint
  try {
    const res = await fetch(`/api/a2a-agreements/${agreementId}/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ party, docType, mime: file.type }),
    })
    const json = (await res.json().catch(() => ({}))) as Partial<SignedUploadMint> & { error?: string }
    if (!res.ok || !json.signedUrl || !json.token || !json.path) {
      return { data: null, error: json.error ?? "The upload couldn't start. Please try again." }
    }
    mint = { signedUrl: json.signedUrl, token: json.token, path: json.path }
  } catch {
    return { data: null, error: "The upload couldn't start. Please try again." }
  }

  // 2. The file itself, to the private transit bucket.
  const { error: putError } = await putFileToSignedUpload(A2A_DOCS_BUCKET, mint, file, onProgress)
  if (putError) return { data: null, error: putError }

  // 3. Move it to S3 and attach it to the agreement.
  try {
    const res = await fetch(`/api/a2a-agreements/${agreementId}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: mint.path, fileName: file.name }),
    })
    const json = (await res.json().catch(() => ({}))) as { file?: A2AAgreementFile; error?: string }
    if (!res.ok || !json.file) return { data: null, error: json.error ?? "Couldn't attach the file. Please try again." }
    return { data: json.file, error: null }
  } catch {
    return { data: null, error: "Couldn't attach the file. Please try again." }
  }
}
