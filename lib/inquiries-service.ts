// Client-side data layer for the admin Leads Inquiries page. Calls the
// service-role admin API routes (the inquiries table has no client-side write
// path). Every function returns a typed result and never throws into the
// caller's UI path.

export type InquiryStatus = "new" | "contacted" | "closed"
export type InquiryCategory = "off_plan" | "ready" | "rent"
export type InquiryLookingFor = "myself" | "agent"

export type Inquiry = {
  id: string
  name: string
  email: string
  phone_country_code: string
  phone: string
  looking_for: InquiryLookingFor
  property_category: InquiryCategory
  project_id: number | null
  project_name: string | null
  developer_name: string | null
  status: InquiryStatus
  source: string
  ip_address?: string | null
  user_agent?: string | null
  created_at: string
  contacted_at: string | null
  read_at?: string | null
  starred_at?: string | null
  updated_at?: string
  deleted_at: string | null
}

/**
 * One email on a thread. Outbound = sent from the dashboard (a reply or a
 * compose); inbound = a lead's reply pulled from the company mailbox by the
 * IMAP sync (status "received").
 */
export type SentEmail = {
  id: string
  inquiry_id: string | null
  to_email: string
  to_name: string | null
  subject: string
  body_text: string
  sent_by: string | null
  sent_by_name: string | null
  status: "sent" | "failed" | "received"
  error: string | null
  direction?: "outbound" | "inbound"
  from_email?: string | null
  from_name?: string | null
  /** Inbound only: NULL until its correspondence is opened. */
  read_at?: string | null
  created_at: string
}

export type InquiriesSummary = {
  total: number
  new: number
  unread?: number
  starred?: number
  sent?: number
  /** Unread replies to composed mail — the attention badge on Sent. */
  sentUnread?: number
  /** Per-category counts (not archived) for the mailbox rail. */
  categories?: Record<InquiryCategory, number>
}

export type InquiriesQuery = {
  page: number
  perPage: number
  search?: string
  status?: string
  category?: string
  showDeleted?: boolean
  /** Archived folder — only soft-deleted rows. */
  archivedOnly?: boolean
  unreadOnly?: boolean
  /** Starred folder — only flagged rows. */
  starredOnly?: boolean
}

export type InquiriesResult = {
  data: Inquiry[]
  total: number
  summary: InquiriesSummary | null
  error: string | null
}

export const LOOKING_FOR_LABELS: Record<InquiryLookingFor, string> = {
  myself: "Looking for myself",
  agent: "I'm an agent",
}

export const CATEGORY_LABELS: Record<InquiryCategory, string> = {
  off_plan: "Off Plan",
  ready: "Ready",
  rent: "Rent",
}

async function readError(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { error?: string }
    return json.error ?? `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

export async function fetchInquiries(query: InquiriesQuery): Promise<InquiriesResult> {
  const sp = new URLSearchParams({ page: String(query.page), perPage: String(query.perPage) })
  if (query.search) sp.set("search", query.search)
  if (query.status) sp.set("status", query.status)
  if (query.category) sp.set("category", query.category)
  if (query.showDeleted) sp.set("showDeleted", "true")
  if (query.archivedOnly) sp.set("archived", "only")
  if (query.unreadOnly) sp.set("unread", "true")
  if (query.starredOnly) sp.set("starred", "true")

  try {
    const res = await fetch(`/api/admin/inquiries?${sp.toString()}`, { cache: "no-store" })
    if (!res.ok) return { data: [], total: 0, summary: null, error: await readError(res) }
    const json = (await res.json()) as {
      rows: Inquiry[]
      total: number
      summary: InquiriesSummary
    }
    return { data: json.rows ?? [], total: json.total ?? 0, summary: json.summary ?? null, error: null }
  } catch (error) {
    return { data: [], total: 0, summary: null, error: (error as Error).message }
  }
}

/** Fetch one lead plus its sent-email thread. Opening does NOT change status. */
export async function fetchInquiry(
  id: string,
): Promise<{ data: Inquiry | null; emails: SentEmail[]; error: string | null }> {
  try {
    const res = await fetch(`/api/admin/inquiries/${id}`, { cache: "no-store" })
    if (!res.ok) return { data: null, emails: [], error: await readError(res) }
    const json = (await res.json()) as { inquiry: Inquiry; emails?: SentEmail[] }
    return { data: json.inquiry ?? null, emails: json.emails ?? [], error: null }
  } catch (error) {
    return { data: null, emails: [], error: (error as Error).message }
  }
}

/** Gmail-style read/unread — inbox state only, no status change, no audit row. */
export async function setInquiryRead(id: string, read: boolean): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`/api/admin/inquiries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read }),
    })
    if (!res.ok) return { error: await readError(res) }
    return { error: null }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

/** Star/unstar a conversation — pins it to the Starred folder. */
export async function setInquiryStarred(id: string, starred: boolean): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`/api/admin/inquiries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred }),
    })
    if (!res.ok) return { error: await readError(res) }
    return { error: null }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

/** Send a real email reply to a lead; the message is recorded on its thread. */
export async function sendInquiryReply(
  id: string,
  subject: string,
  message: string,
): Promise<{ email: SentEmail | null; error: string | null }> {
  try {
    const res = await fetch(`/api/admin/inquiries/${id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, message }),
    })
    const json = (await res.json().catch(() => ({}))) as { email?: SentEmail; error?: string }
    if (!res.ok) return { email: json.email ?? null, error: json.error ?? `Request failed (${res.status})` }
    return { email: json.email ?? null, error: null }
  } catch (error) {
    return { email: null, error: (error as Error).message }
  }
}

/** Compose — send a standalone email to any address (Sent folder). */
export async function sendComposedEmail(input: {
  to: string
  toName?: string
  subject: string
  message: string
}): Promise<{ email: SentEmail | null; error: string | null }> {
  try {
    const res = await fetch(`/api/admin/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    const json = (await res.json().catch(() => ({}))) as { email?: SentEmail; error?: string }
    if (!res.ok) return { email: json.email ?? null, error: json.error ?? `Request failed (${res.status})` }
    return { email: json.email ?? null, error: null }
  } catch (error) {
    return { email: null, error: (error as Error).message }
  }
}

/**
 * Pull new lead replies from the company mailbox into their threads. A 503
 * means the server has no IMAP config — treated as "nothing to sync", so the
 * page works identically with the feature unconfigured.
 */
export async function syncInbox(): Promise<{ ingested: number; error: string | null }> {
  try {
    const res = await fetch(`/api/admin/emails/sync`, { method: "POST" })
    if (res.status === 503) return { ingested: 0, error: null }
    if (!res.ok) return { ingested: 0, error: await readError(res) }
    const json = (await res.json()) as { ingested?: number }
    return { ingested: json.ingested ?? 0, error: null }
  } catch (error) {
    return { ingested: 0, error: (error as Error).message }
  }
}

/** Full correspondence with one address (composed mail + its replies). */
export async function fetchEmailThread(
  address: string,
): Promise<{ rows: SentEmail[]; error: string | null }> {
  try {
    const res = await fetch(`/api/admin/emails/thread?address=${encodeURIComponent(address)}`, {
      cache: "no-store",
    })
    if (!res.ok) return { rows: [], error: await readError(res) }
    const json = (await res.json()) as { rows: SentEmail[] }
    return { rows: json.rows ?? [], error: null }
  } catch (error) {
    return { rows: [], error: (error as Error).message }
  }
}

/** Permanently remove a sent-email record (the delivered email is unaffected). */
export async function deleteSentEmail(id: string): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`/api/admin/emails/${id}`, { method: "DELETE" })
    if (!res.ok) return { error: await readError(res) }
    return { error: null }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

/** The Sent folder — every email sent from the dashboard, newest first. */
export async function fetchSentEmails(query: {
  page: number
  perPage: number
  search?: string
}): Promise<{
  data: SentEmail[]
  total: number
  /** Unread replies per correspondent (lowercased address → count). */
  unreadByAddress: Record<string, number>
  error: string | null
}> {
  const sp = new URLSearchParams({ page: String(query.page), perPage: String(query.perPage) })
  if (query.search) sp.set("search", query.search)
  try {
    const res = await fetch(`/api/admin/emails?${sp.toString()}`, { cache: "no-store" })
    if (!res.ok) return { data: [], total: 0, unreadByAddress: {}, error: await readError(res) }
    const json = (await res.json()) as {
      rows: SentEmail[]
      total: number
      unreadByAddress?: Record<string, number>
    }
    return {
      data: json.rows ?? [],
      total: json.total ?? 0,
      unreadByAddress: json.unreadByAddress ?? {},
      error: null,
    }
  } catch (error) {
    return { data: [], total: 0, unreadByAddress: {}, error: (error as Error).message }
  }
}

/** Opening a correspondence marks its replies read. */
export async function markEmailThreadRead(address: string): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`/api/admin/emails/thread`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    })
    if (!res.ok) return { error: await readError(res) }
    return { error: null }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function setInquiryStatus(
  id: string,
  status: InquiryStatus,
): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`/api/admin/inquiries/${id}`, {
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

/** deleted=true soft-deletes (archives); deleted=false restores. */
export async function setInquiryDeleted(
  id: string,
  deleted: boolean,
): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`/api/admin/inquiries/${id}${deleted ? "" : "?restore=1"}`, {
      method: "DELETE",
    })
    if (!res.ok) return { error: await readError(res) }
    return { error: null }
  } catch (error) {
    return { error: (error as Error).message }
  }
}
