// Client helpers for per-project construction updates. Row management goes
// through service-role API routes (ownership-checked server-side) so a developer
// can manage updates on their own unpublished projects. The FILE, however, is
// uploaded straight from the browser to Supabase Storage — construction PDFs run
// tens of MB and would exceed the ~4.5 MB Vercel serverless body limit if POSTed
// through an API route (and this avoids touching the shared S3 bucket's CORS).

import { createClient } from "@/lib/supabase/client"

const STORAGE_BUCKET = "construction-updates"

export type ConstructionUpdate = {
  id: string
  project_id: number
  title: string
  file_url: string
  file_type: "pdf" | "image"
  created_at: string | null
}

export async function fetchConstructionUpdates(
  projectId: number,
): Promise<{ data: ConstructionUpdate[]; error: string | null }> {
  try {
    const res = await fetch(`/api/projects/${projectId}/construction-updates`)
    const json = (await res.json()) as { updates?: ConstructionUpdate[]; error?: string }
    if (!res.ok) return { data: [], error: json.error ?? "Failed to load construction updates." }
    return { data: json.updates ?? [], error: null }
  } catch {
    return { data: [], error: "Failed to load construction updates." }
  }
}

export async function createConstructionUpdate(
  projectId: number,
  input: { title: string; file_url: string; file_type: "pdf" | "image" },
): Promise<{ data: ConstructionUpdate | null; error: string | null }> {
  try {
    const res = await fetch(`/api/projects/${projectId}/construction-updates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    const json = (await res.json()) as { update?: ConstructionUpdate; error?: string }
    if (!res.ok) return { data: null, error: json.error ?? "Failed to save construction update." }
    return { data: json.update ?? null, error: null }
  } catch {
    return { data: null, error: "Failed to save construction update." }
  }
}

export async function deleteConstructionUpdate(
  projectId: number,
  updateId: string,
): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`/api/projects/${projectId}/construction-updates/${updateId}`, {
      method: "DELETE",
    })
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      return { error: json.error ?? "Failed to delete construction update." }
    }
    return { error: null }
  } catch {
    return { error: "Failed to delete construction update." }
  }
}

/**
 * Upload a construction-update file (PDF or image) straight to Supabase Storage
 * (browser → Supabase, bypassing Vercel's request-body limit); the server later
 * relocates it to S3. Sent via XMLHttpRequest — replicating storage-js's own
 * multipart request — so `onProgress` can report real upload percentage (the
 * library's fetch-based upload can't). Returns the file's public URL.
 */
export async function uploadConstructionFile(
  file: File,
  developerSlug: string,
  projectSlug: string,
  onProgress?: (percent: number) => void,
): Promise<{ url: string | null; error: string | null }> {
  const supabase = createClient()
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase()
  const safeDev = (developerSlug || "unknown").replace(/[^a-z0-9._-]/gi, "-")
  const safeProj = (projectSlug || "general").replace(/[^a-z0-9._-]/gi, "-")
  const newPath = () => `${safeDev}/${safeProj}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const publicUrl = (path: string) =>
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`

  // Primary: XMLHttpRequest so upload.onprogress can report a real percentage
  // (the SDK's fetch-based upload can't). Replicates storage-js's multipart request.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  if (supabaseUrl && anonKey && token) {
    const path = newPath()
    const form = new FormData()
    form.append("cacheControl", "3600")
    form.append("", file)
    const viaXhr = await new Promise<{ ok: boolean }>((resolve) => {
      const xhr = new XMLHttpRequest()
      xhr.open("POST", `${supabaseUrl}/storage/v1/object/${STORAGE_BUCKET}/${path}`)
      xhr.setRequestHeader("authorization", `Bearer ${token}`)
      xhr.setRequestHeader("apikey", anonKey)
      xhr.setRequestHeader("x-upsert", "false")
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300 })
      xhr.onerror = () => resolve({ ok: false })
      xhr.send(form)
    })
    if (viaXhr.ok) {
      onProgress?.(100)
      return { url: publicUrl(path), error: null }
    }
    // else fall through to the SDK (a fresh path avoids any partial-object clash)
  }

  // Fallback: the SDK upload (no progress) so uploads always work even if the XHR
  // path fails for any reason.
  try {
    onProgress?.(100)
    const path = newPath()
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    })
    if (error) return { url: null, error: error.message || "Upload to storage failed. Please try again." }
    return { url: publicUrl(path), error: null }
  } catch {
    return { url: null, error: "File upload failed." }
  }
}
