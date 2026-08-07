// Agent-side data service for owner document requests (NOC / Trakheesi intake).
// Runs with the browser client + RLS, so a creating agent only ever sees their
// own requests (admins see all, via the staff read policy in migration 039).
// The public owner submission is written by the service-role API, not here.
//
// Types are exported for reuse; import them with `import type` from server code
// so this browser module is never pulled into a server bundle.

import { createClient } from "@/lib/supabase/client"

export type OwnerDocRequestStatus = "pending" | "submitted" | "cancelled"
export type OwnerDocType = "title_deed" | "emirates_id" | "passport" | "signed_noc" | "other"

export type OwnerDocumentRequest = {
  id: string
  token: string
  agent_id: string
  label: string | null
  status: OwnerDocRequestStatus
  owner_name: string | null
  owner_id_number: string | null
  owner_email: string | null
  owner_mobile: string | null
  property_building: string | null
  unit_number: string | null
  community_area: string | null
  title_deed_number: string | null
  noc_valid_until: string | null
  submitted_at: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type OwnerDocumentFile = {
  id: string
  request_id: string
  doc_type: OwnerDocType
  file_name: string
  file_url: string
  file_type: string | null
  file_size: number | null
  uploaded_at: string
}

/** Admin list row — a request plus the creating agent's public card. */
export type AdminOwnerDocumentRequest = OwnerDocumentRequest & {
  agent_name: string | null
  agent_avatar: string | null
  agent_role: string | null
}

const REQUEST_SELECT =
  "id, token, agent_id, label, status, owner_name, owner_id_number, owner_email, owner_mobile, property_building, unit_number, community_area, title_deed_number, noc_valid_until, submitted_at, expires_at, created_at, updated_at, deleted_at"
const FILE_SELECT = "id, request_id, doc_type, file_name, file_url, file_type, file_size, uploaded_at"

/** Relative share path for an intake link — the client prepends the origin. */
export function ownerDocumentSharePath(token: string): string {
  return `/owner-documents/${token}`
}

/** Unguessable bearer capability for the intake URL: two v4 UUIDs, 64 hex chars. */
function newToken(): string {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "")
}

export async function fetchMyOwnerDocumentRequests(): Promise<{
  data: OwnerDocumentRequest[]
  error: string | null
}> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("owner_document_requests")
      .select(REQUEST_SELECT)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
    if (error) return { data: [], error: error.message }
    return { data: (data ?? []) as OwnerDocumentRequest[], error: null }
  } catch {
    return { data: [], error: "Failed to load owner document requests." }
  }
}

export async function createOwnerDocumentRequest(
  label: string | null,
): Promise<{ data: OwnerDocumentRequest | null; error: string | null }> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { data: null, error: "You must be signed in." }

    const { data, error } = await supabase
      .from("owner_document_requests")
      .insert({ agent_id: user.id, token: newToken(), label: label?.trim() || null })
      .select(REQUEST_SELECT)
      .single()
    if (error) return { data: null, error: error.message }
    return { data: data as OwnerDocumentRequest, error: null }
  } catch {
    return { data: null, error: "Failed to create the request." }
  }
}

/** Files for one request (RLS lets the owning agent or an admin read them). */
export async function fetchOwnerDocumentFiles(
  requestId: string,
): Promise<{ data: OwnerDocumentFile[]; error: string | null }> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("owner_document_files")
      .select(FILE_SELECT)
      .eq("request_id", requestId)
      .order("uploaded_at", { ascending: true })
    if (error) return { data: [], error: error.message }
    return { data: (data ?? []) as OwnerDocumentFile[], error: null }
  } catch {
    return { data: [], error: "Failed to load the documents." }
  }
}

/** Admin: every request with the creating agent's name/avatar (service-role API). */
export async function fetchAllOwnerDocumentRequestsAdmin(): Promise<{
  data: AdminOwnerDocumentRequest[]
  error: string | null
}> {
  try {
    const res = await fetch("/api/admin/owner-documents")
    const json = (await res.json()) as { requests?: AdminOwnerDocumentRequest[]; error?: string }
    if (!res.ok) return { data: [], error: json.error ?? "Failed to load requests." }
    return { data: json.requests ?? [], error: null }
  } catch {
    return { data: [], error: "Failed to load requests." }
  }
}

/** Admin: hard-delete a request + its files (and S3 objects). For test cleanup. */
export async function deleteOwnerDocumentRequestAdmin(id: string): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`/api/admin/owner-documents/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      return { error: json.error ?? "Failed to delete the request." }
    }
    return { error: null }
  } catch {
    return { error: "Failed to delete the request." }
  }
}

export async function cancelOwnerDocumentRequest(id: string): Promise<{ error: string | null }> {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from("owner_document_requests")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", id)
    if (error) return { error: error.message }
    return { error: null }
  } catch {
    return { error: "Failed to cancel the request." }
  }
}
