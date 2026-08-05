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
 * (browser → Supabase, so it bypasses Vercel's request-body limit) and return
 * its public URL. The bucket is public; per-project discovery is still gated by
 * the construction_updates row policy.
 */
export async function uploadConstructionFile(
  file: File,
  developerSlug: string,
  projectSlug: string,
): Promise<{ url: string | null; error: string | null }> {
  try {
    const supabase = createClient()
    const ext = (file.name.split(".").pop() ?? "bin").toLowerCase()
    const safeDev = (developerSlug || "unknown").replace(/[^a-z0-9._-]/gi, "-")
    const safeProj = (projectSlug || "general").replace(/[^a-z0-9._-]/gi, "-")
    const path = `${safeDev}/${safeProj}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    })
    if (error) return { url: null, error: error.message || "Upload to storage failed. Please try again." }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
    return { url: data.publicUrl, error: null }
  } catch {
    return { url: null, error: "File upload failed." }
  }
}
