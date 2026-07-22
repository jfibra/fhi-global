// Client-side data layer for the admin Contact Inbox. Calls the service-role
// admin API routes (contact_submissions has no client-side write path). Every
// function returns a typed result and never throws into the caller's UI path.

export type ContactStatus = "new" | "read" | "archived"

export type ContactSubmission = {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
  subject: string | null
  message: string
  status: ContactStatus
  source: string
  ip_address?: string | null
  user_agent?: string | null
  created_at: string
  read_at: string | null
  updated_at?: string
  deleted_at: string | null
}

export type ContactInboxSummary = { total: number; unread: number }

export type ContactInboxQuery = {
  page: number
  perPage: number
  search?: string
  status?: string
  subject?: string
  showDeleted?: boolean
}

export type ContactInboxResult = {
  data: ContactSubmission[]
  total: number
  summary: ContactInboxSummary | null
  error: string | null
}

async function readError(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { error?: string }
    return json.error ?? `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

export async function fetchContactInbox(query: ContactInboxQuery): Promise<ContactInboxResult> {
  const sp = new URLSearchParams({ page: String(query.page), perPage: String(query.perPage) })
  if (query.search) sp.set("search", query.search)
  if (query.status) sp.set("status", query.status)
  if (query.subject) sp.set("subject", query.subject)
  if (query.showDeleted) sp.set("showDeleted", "true")

  try {
    const res = await fetch(`/api/admin/contact-inbox?${sp.toString()}`, { cache: "no-store" })
    if (!res.ok) return { data: [], total: 0, summary: null, error: await readError(res) }
    const json = (await res.json()) as {
      rows: ContactSubmission[]
      total: number
      summary: ContactInboxSummary
    }
    return { data: json.rows ?? [], total: json.total ?? 0, summary: json.summary ?? null, error: null }
  } catch (error) {
    return { data: [], total: 0, summary: null, error: (error as Error).message }
  }
}

/** Fetch one submission. Server-side this marks a 'new' submission as read. */
export async function fetchContactSubmission(
  id: string,
): Promise<{ data: ContactSubmission | null; error: string | null }> {
  try {
    const res = await fetch(`/api/admin/contact-inbox/${id}`, { cache: "no-store" })
    if (!res.ok) return { data: null, error: await readError(res) }
    const json = (await res.json()) as { submission: ContactSubmission }
    return { data: json.submission ?? null, error: null }
  } catch (error) {
    return { data: null, error: (error as Error).message }
  }
}

export async function setContactStatus(
  id: string,
  status: ContactStatus,
): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`/api/admin/contact-inbox/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) return { error: await readError(res) }
    return { error: null }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

/** deleted=true soft-deletes; deleted=false restores. */
export async function setContactDeleted(
  id: string,
  deleted: boolean,
): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`/api/admin/contact-inbox/${id}${deleted ? "" : "?restore=1"}`, {
      method: "DELETE",
    })
    if (!res.ok) return { error: await readError(res) }
    return { error: null }
  } catch (error) {
    return { error: (error as Error).message }
  }
}
