import { createClient } from "@/lib/supabase/client"
import {
  canUseSupportPortal,
  isSupportAdminRole,
  normalizeAppRole,
  ROLES_SUPPORT_INTERNAL_ASSIGNEES,
  ROLES_SUPPORT_REPORTER_POOL,
} from "@/lib/app-roles"

export type SupportTicketStatus = "open" | "in_progress" | "waiting_user" | "resolved" | "closed"
export type SupportTicketPriority = "low" | "normal" | "high" | "critical"

export type SupportTicketRecord = {
  id: string
  reported_by: string
  ticket_type: string | null
  priority: SupportTicketPriority
  status: SupportTicketStatus
  title: string
  description: string
  page_url: string | null
  module: string | null
  device_type: string | null
  device_os: string | null
  browser: string | null
  browser_version: string | null
  ip_address: string | null
  location_country: string | null
  location_city: string | null
  user_agent: string | null
  screen_resolution: string | null
  assigned_to: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
  reported_by_profile: { id: string; fullname: string | null; profile_url: string | null } | null
  assigned_to_profile: { id: string; fullname: string | null; profile_url: string | null } | null
  attachments_count: number
}

export type SupportTicketAttachment = {
  id: string
  ticket_id: string
  file_name: string
  file_url: string
  file_type: string | null
  uploaded_by: string | null
  uploaded_at: string
  profiles: { fullname: string | null; profile_url: string | null } | null
}

export type SupportTicketComment = {
  id: string
  ticket_id: string
  comment: string
  commented_by: string
  commenter_role: string | null
  parent_comment_id: string | null
  created_at: string
  profiles: { fullname: string | null; profile_url: string | null } | null
}

export type SupportAssignableUser = {
  id: string
  fullname: string | null
  role: string | null
}

export type SupportTicketFormData = {
  title: string
  description: string
  ticket_type: string
  priority: SupportTicketPriority
  page_url: string
  module: string
  device_type: string
  device_os: string
  browser: string
  browser_version: string
  screen_resolution: string
  ip_address: string
  location_country: string
  location_city: string
  user_agent: string
}

const STATUS_VALUES: SupportTicketStatus[] = ["open", "in_progress", "waiting_user", "resolved", "closed"]
const PRIORITY_VALUES: SupportTicketPriority[] = ["low", "normal", "high", "critical"]
export function canAccessSupportRole(role: string | undefined | null) {
  return canUseSupportPortal(role)
}

export function isSupportAdmin(role: string | undefined | null) {
  return isSupportAdminRole(role)
}

function normalizeTicket(row: unknown): SupportTicketRecord {
  const raw = row as Record<string, unknown>
  const reportedRaw = Array.isArray(raw.reported_by_profile) ? (raw.reported_by_profile[0] ?? null) : raw.reported_by_profile
  const assignedRaw = Array.isArray(raw.assigned_to_profile) ? (raw.assigned_to_profile[0] ?? null) : raw.assigned_to_profile

  return {
    id: String(raw.id ?? ""),
    reported_by: String(raw.reported_by ?? ""),
    ticket_type: typeof raw.ticket_type === "string" ? raw.ticket_type : null,
    priority: (raw.priority as SupportTicketPriority) ?? "normal",
    status: (raw.status as SupportTicketStatus) ?? "open",
    title: String(raw.title ?? ""),
    description: String(raw.description ?? ""),
    page_url: typeof raw.page_url === "string" ? raw.page_url : null,
    module: typeof raw.module === "string" ? raw.module : null,
    device_type: typeof raw.device_type === "string" ? raw.device_type : null,
    device_os: typeof raw.device_os === "string" ? raw.device_os : null,
    browser: typeof raw.browser === "string" ? raw.browser : null,
    browser_version: typeof raw.browser_version === "string" ? raw.browser_version : null,
    ip_address: typeof raw.ip_address === "string" ? raw.ip_address : null,
    location_country: typeof raw.location_country === "string" ? raw.location_country : null,
    location_city: typeof raw.location_city === "string" ? raw.location_city : null,
    user_agent: typeof raw.user_agent === "string" ? raw.user_agent : null,
    screen_resolution: typeof raw.screen_resolution === "string" ? raw.screen_resolution : null,
    assigned_to: typeof raw.assigned_to === "string" ? raw.assigned_to : null,
    resolved_at: typeof raw.resolved_at === "string" ? raw.resolved_at : null,
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
    reported_by_profile: reportedRaw
      ? {
          id: String((reportedRaw as Record<string, unknown>).id ?? ""),
          fullname: (reportedRaw as Record<string, unknown>).fullname as string ?? null,
          profile_url: (reportedRaw as Record<string, unknown>).profile_url as string ?? null,
        }
      : null,
    assigned_to_profile: assignedRaw
      ? {
          id: String((assignedRaw as Record<string, unknown>).id ?? ""),
          fullname: (assignedRaw as Record<string, unknown>).fullname as string ?? null,
          profile_url: (assignedRaw as Record<string, unknown>).profile_url as string ?? null,
        }
      : null,
    attachments_count: Array.isArray(raw.support_ticket_attachments) ? raw.support_ticket_attachments.length : 0,
  }
}

function normalizeAttachment(row: unknown): SupportTicketAttachment {
  const raw = row as Record<string, unknown>
  const profileRaw = Array.isArray(raw.profiles) ? (raw.profiles[0] ?? null) : raw.profiles
  return {
    id: String(raw.id ?? ""),
    ticket_id: String(raw.ticket_id ?? ""),
    file_name: String(raw.file_name ?? ""),
    file_url: String(raw.file_url ?? ""),
    file_type: typeof raw.file_type === "string" ? raw.file_type : null,
    uploaded_by: typeof raw.uploaded_by === "string" ? raw.uploaded_by : null,
    uploaded_at: String(raw.uploaded_at ?? ""),
    profiles: profileRaw
      ? {
          fullname: (profileRaw as Record<string, unknown>).fullname as string ?? null,
          profile_url: (profileRaw as Record<string, unknown>).profile_url as string ?? null,
        }
      : null,
  }
}

function normalizeComment(row: unknown): SupportTicketComment {
  const raw = row as Record<string, unknown>
  const profileRaw = Array.isArray(raw.profiles) ? (raw.profiles[0] ?? null) : raw.profiles
  return {
    id: String(raw.id ?? ""),
    ticket_id: String(raw.ticket_id ?? ""),
    comment: String(raw.comment ?? ""),
    commented_by: String(raw.commented_by ?? ""),
    commenter_role: typeof raw.commenter_role === "string" ? raw.commenter_role : null,
    parent_comment_id: typeof raw.parent_comment_id === "string" ? raw.parent_comment_id : null,
    created_at: String(raw.created_at ?? ""),
    profiles: profileRaw
      ? {
          fullname: (profileRaw as Record<string, unknown>).fullname as string ?? null,
          profile_url: (profileRaw as Record<string, unknown>).profile_url as string ?? null,
        }
      : null,
  }
}

export function validateSupportTicketForm(form: SupportTicketFormData) {
  const errors: Record<string, string> = {}
  if (!form.title.trim()) errors.title = "Title is required"
  if (!form.description.trim()) errors.description = "Description is required"
  if (!PRIORITY_VALUES.includes(form.priority)) errors.priority = "Invalid priority"
  return errors
}

export async function fetchSupportAssignableUsers(): Promise<{ data: SupportAssignableUser[] | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, fullname, role")
    .in("role", [...ROLES_SUPPORT_INTERNAL_ASSIGNEES])
    .order("fullname", { ascending: true })

  if (error) return { data: null, error: error.message }
  return {
    data: (data ?? []).map((row) => ({
      id: String(row.id),
      fullname: typeof row.fullname === "string" ? row.fullname : null,
      role: typeof row.role === "string" ? row.role : null,
    })),
    error: null,
  }
}

export async function fetchSupportReporters(): Promise<{ data: SupportAssignableUser[] | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, fullname, role")
    .in("role", [...ROLES_SUPPORT_REPORTER_POOL])
    .order("fullname", { ascending: true })

  if (error) return { data: null, error: error.message }
  return {
    data: (data ?? []).map((row) => ({
      id: String(row.id),
      fullname: typeof row.fullname === "string" ? row.fullname : null,
      role: typeof row.role === "string" ? row.role : null,
    })),
    error: null,
  }
}

export async function fetchSupportTickets(opts: {
  page: number
  perPage: number
  search?: string
  status?: SupportTicketStatus
  priority?: SupportTicketPriority
  reportedBy?: string
  assignedTo?: string
  createdDate?: string
  sortField?: "created_at" | "updated_at" | "priority" | "status"
  sortDir?: "asc" | "desc"
  currentRole: string
  currentUserId: string
}): Promise<{ data: SupportTicketRecord[] | null; total: number | null; error: string | null }> {
  const supabase = createClient()
  const from = (opts.page - 1) * opts.perPage
  const to = from + opts.perPage - 1

  const sortField = opts.sortField ?? "created_at"
  const sortDir = opts.sortDir ?? "desc"

  let query = supabase
    .from("support_tickets")
    .select(`
      *,
      reported_by_profile:reported_by(id, fullname, profile_url),
      assigned_to_profile:assigned_to(id, fullname, profile_url),
      support_ticket_attachments(id)
    `, { count: "exact" })
    .range(from, to)
    .order(sortField, { ascending: sortDir === "asc" })

  const role = normalizeAppRole(opts.currentRole)
  if (!isSupportAdmin(role)) {
    query = query.eq("reported_by", opts.currentUserId)
  }

  if (opts.status) query = query.eq("status", opts.status)
  if (opts.priority) query = query.eq("priority", opts.priority)
  if (opts.reportedBy) query = query.eq("reported_by", opts.reportedBy)
  if (opts.assignedTo) query = query.eq("assigned_to", opts.assignedTo)
  if (opts.createdDate) query = query.gte("created_at", `${opts.createdDate}T00:00:00`).lte("created_at", `${opts.createdDate}T23:59:59`)

  const { data, error, count } = await query
  if (error) return { data: null, total: null, error: error.message }

  const rows = (data ?? []).map(normalizeTicket)
  const searchValue = (opts.search ?? "").trim().toLowerCase()
  const filteredRows = searchValue
    ? rows.filter((row) =>
        [
          row.id,
          row.title,
          row.description,
          row.reported_by_profile?.fullname,
          row.assigned_to_profile?.fullname,
          row.module,
          row.page_url,
        ].some((value) => String(value ?? "").toLowerCase().includes(searchValue)),
      )
    : rows

  return {
    data: filteredRows,
    total: count ?? filteredRows.length,
    error: null,
  }
}

export async function createSupportTicket(
  form: SupportTicketFormData,
  currentUserId: string,
  currentRole?: string,
): Promise<{ data: SupportTicketRecord | null; error: string | null }> {
  const supabase = createClient()
  const validationErrors = validateSupportTicketForm(form)
  const firstError = Object.values(validationErrors)[0]
  if (firstError) return { data: null, error: firstError }

  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      reported_by: currentUserId,
      ticket_type: form.ticket_type.trim() || null,
      priority: isSupportAdmin(currentRole) ? form.priority : "normal",
      status: "open",
      title: form.title.trim(),
      description: form.description.trim(),
      page_url: form.page_url.trim() || null,
      module: form.module.trim() || null,
      device_type: form.device_type.trim() || null,
      device_os: form.device_os.trim() || null,
      browser: form.browser.trim() || null,
      browser_version: form.browser_version.trim() || null,
      ip_address: form.ip_address.trim() || null,
      location_country: form.location_country.trim() || null,
      location_city: form.location_city.trim() || null,
      user_agent: form.user_agent.trim() || null,
      screen_resolution: form.screen_resolution.trim() || null,
    })
    .select(`
      *,
      reported_by_profile:reported_by(id, fullname, profile_url),
      assigned_to_profile:assigned_to(id, fullname, profile_url),
      support_ticket_attachments(id)
    `)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: normalizeTicket(data), error: null }
}

export async function fetchSupportTicketById(
  id: string,
): Promise<{ data: SupportTicketRecord | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("support_tickets")
    .select(`
      *,
      reported_by_profile:reported_by(id, fullname, profile_url),
      assigned_to_profile:assigned_to(id, fullname, profile_url),
      support_ticket_attachments(id)
    `)
    .eq("id", id)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: normalizeTicket(data), error: null }
}

export async function updateSupportTicketAdmin(
  id: string,
  payload: { status?: SupportTicketStatus; assigned_to?: string | null },
  currentRole: string,
): Promise<{ data: SupportTicketRecord | null; error: string | null }> {
  const role = normalizeAppRole(currentRole)
  if (!isSupportAdmin(role)) return { data: null, error: "Only admin users can update ticket status/assignment" }

  const supabase = createClient()
  const updatePayload: Record<string, unknown> = {}

  if (payload.status) {
    if (!STATUS_VALUES.includes(payload.status)) return { data: null, error: "Invalid status" }
    updatePayload.status = payload.status
    if (payload.status === "resolved") updatePayload.resolved_at = new Date().toISOString()
  }

  if (payload.assigned_to !== undefined) {
    updatePayload.assigned_to = payload.assigned_to || null
  }

  const { data, error } = await supabase
    .from("support_tickets")
    .update(updatePayload)
    .eq("id", id)
    .select(`
      *,
      reported_by_profile:reported_by(id, fullname, profile_url),
      assigned_to_profile:assigned_to(id, fullname, profile_url),
      support_ticket_attachments(id)
    `)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: normalizeTicket(data), error: null }
}

export async function fetchSupportTicketAttachments(ticketId: string): Promise<{ data: SupportTicketAttachment[] | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("support_ticket_attachments")
    .select("*, profiles:uploaded_by(fullname, profile_url)")
    .eq("ticket_id", ticketId)
    .order("uploaded_at", { ascending: false })

  if (error) return { data: null, error: error.message }
  return { data: (data ?? []).map(normalizeAttachment), error: null }
}

export async function insertSupportTicketAttachment(payload: {
  ticket_id: string
  file_name: string
  file_url: string
  file_type: string | null
  uploaded_by: string
}): Promise<{ data: SupportTicketAttachment | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("support_ticket_attachments")
    .insert(payload)
    .select("*, profiles:uploaded_by(fullname, profile_url)")
    .single()

  if (error) return { data: null, error: error.message }
  return { data: normalizeAttachment(data), error: null }
}

export async function deleteSupportTicketAttachment(
  id: string,
  currentRole: string,
): Promise<{ error: string | null }> {
  if (!isSupportAdmin(currentRole)) return { error: "Only admin users can delete ticket attachments" }
  const supabase = createClient()
  const { error } = await supabase
    .from("support_ticket_attachments")
    .delete()
    .eq("id", id)

  return { error: error?.message ?? null }
}

export async function fetchSupportTicketComments(ticketId: string): Promise<{ data: SupportTicketComment[] | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("support_ticket_comments")
    .select("*, profiles:commented_by(fullname, profile_url)")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true })

  if (error) return { data: null, error: error.message }
  return { data: (data ?? []).map(normalizeComment), error: null }
}

export async function insertSupportTicketComment(payload: {
  ticket_id: string
  comment: string
  commented_by: string
  commenter_role: string
  parent_comment_id?: string | null
  currentRole: string
}): Promise<{ data: SupportTicketComment | null; error: string | null }> {
  if (!canAccessSupportRole(payload.currentRole)) return { data: null, error: "You are not allowed to comment" }
  const body = payload.comment.trim()
  if (!body) return { data: null, error: "Comment is required" }

  const supabase = createClient()
  const { data, error } = await supabase
    .from("support_ticket_comments")
    .insert({
      ticket_id: payload.ticket_id,
      comment: body,
      commented_by: payload.commented_by,
      commenter_role: normalizeAppRole(payload.commenter_role),
      parent_comment_id: payload.parent_comment_id ?? null,
    })
    .select("*, profiles:commented_by(fullname, profile_url)")
    .single()

  if (error) return { data: null, error: error.message }
  return { data: normalizeComment(data), error: null }
}
