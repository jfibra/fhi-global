// Client helpers for per-project construction updates. All management goes
// through service-role API routes (ownership-checked server-side) rather than
// the browser Supabase client, so a developer can manage updates on their own
// unpublished projects (which the public read policy would otherwise hide).

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

/** Upload a construction-update file (PDF or image) to S3; returns its public URL. */
export async function uploadConstructionFile(
  file: File,
  developerSlug: string,
  projectSlug: string,
): Promise<{ url: string | null; error: string | null }> {
  try {
    const fd = new FormData()
    fd.append("file", file, file.name)
    fd.append("developer_slug", developerSlug || "unknown")
    fd.append("project_slug", projectSlug || "general")
    const res = await fetch("/api/upload/construction-update", { method: "POST", body: fd })
    const json = (await res.json()) as { url?: string; error?: string }
    if (!res.ok || !json.url) return { url: null, error: json.error ?? "File upload failed." }
    return { url: json.url, error: null }
  } catch {
    return { url: null, error: "File upload failed." }
  }
}
