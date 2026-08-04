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
  updated_at?: string
  deleted_at: string | null
}

export type InquiriesSummary = { total: number; new: number }

export type InquiriesQuery = {
  page: number
  perPage: number
  search?: string
  status?: string
  category?: string
  showDeleted?: boolean
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

/** Fetch one lead. Opening a lead does NOT change its status. */
export async function fetchInquiry(
  id: string,
): Promise<{ data: Inquiry | null; error: string | null }> {
  try {
    const res = await fetch(`/api/admin/inquiries/${id}`, { cache: "no-store" })
    if (!res.ok) return { data: null, error: await readError(res) }
    const json = (await res.json()) as { inquiry: Inquiry }
    return { data: json.inquiry ?? null, error: null }
  } catch (error) {
    return { data: null, error: (error as Error).message }
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
