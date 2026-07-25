import { createClient } from "@/lib/supabase/client"
import {
  isAdminStaffRole,
  isSalesPipelineRole,
  isSecretaryLikeRole,
  ROLES_SALE_AGENT_PROFILES,
} from "@/lib/app-roles"

// ─── Types ────────────────────────────────────────────────────────────────────

export type CommissionStatus = "pending" | "processing" | "approved" | "released" | "rejected"
export type ValidationStatus = "pending" | "under_review" | "validated" | "invalid_sale"

/** What kind of deal this is. Brokerage/rental have no developer or project. */
export type SaleType = "project" | "brokerage" | "rental"

export const SALE_TYPE_LABELS: Record<SaleType, string> = {
  project: "Project Sale",
  brokerage: "Brokerage Sale",
  rental: "Rental",
}

/** Property kinds for brokerage/rental deals (free-text friendly list). */
export const SALE_PROPERTY_TYPES = [
  "Apartment", "Villa", "Townhouse", "Penthouse", "Studio",
  "Office", "Retail", "Warehouse", "Land", "Other",
] as const

export type DeveloperOption = {
  id: string
  name: string
  slug: string
}

export type ProjectOption = {
  id: number
  name: string
  slug: string
  developer_id: string
}

export type ProjectUnitOption = {
  id: number
  unit_type: string
  layout_name: string | null
  bedrooms: number | null
  price_from: number | null
}

export type AgentOption = {
  id: string
  fullname: string | null
}

export type SaleAttachment = {
  id: string
  sales_report_id: string
  file_name: string
  file_url: string
  file_type: string | null
  uploaded_by: string | null
  uploaded_at: string
  profiles: { fullname: string | null } | null
}

export type SaleRecord = {
  id: string
  agent_id: string
  sale_type: SaleType
  developer_id: string
  project_id: number
  project_unit_id: number | null
  unit_number: string | null
  block_number: string | null
  lot_number: string | null
  property_type: string | null
  property_address: string | null
  client_id: string
  contract_price: number
  reservation_date: string | null
  payment_plan: string | null
  payment_terms: string | null
  price_per_sqm: number | null
  total_area_sqm: number | null
  commission_status: CommissionStatus
  validation_status: ValidationStatus
  proof_of_transaction_url: string | null
  remarks: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  // joined
  developers: { name: string | null } | null
  projects: { name: string | null } | null
  project_units: { unit_type: string | null } | null
  clients: {
    first_name: string
    middle_name: string | null
    last_name: string
    email: string | null
    phone: string | null
    age: number | null
    gender: string | null
    occupation: string | null
    street: string | null
    city: string | null
    state_province: string | null
    country: string | null
  } | null
  profiles: { fullname: string | null } | null
  attachments_count: number
}

export type SaleActivityLog = {
  id: string
  sales_report_id: string
  action_type: string
  field_name: string | null
  old_value: unknown
  new_value: unknown
  description: string | null
  performed_by: string | null
  performed_role: string | null
  created_at: string
  profiles: { fullname: string | null } | null
}

export type SaleValidationComment = {
  id: string
  sales_report_id: string
  parent_comment_id: string | null
  comment: string
  commented_by: string
  commenter_role: string | null
  is_admin_comment: boolean
  created_at: string
  updated_at: string
  profiles: { fullname: string | null; profile_url: string | null } | null
}

export type ClientFormData = {
  first_name: string
  middle_name: string
  last_name: string
  email: string
  phone: string
  age: string
  gender: string
  occupation: string
  street: string
  city: string
  state_province: string
  country: string
}

export type SaleFormData = {
  // deal type
  sale_type: SaleType
  // property (project sales)
  developer_id: string
  project_id: string
  project_unit_id: string
  unit_number: string
  block_number: string
  lot_number: string
  // property (brokerage / rental)
  property_type: string
  property_address: string
  // client
  client: ClientFormData
  // contract
  contract_price: string
  reservation_date: string
  payment_plan: string
  payment_terms: string
  price_per_sqm: string
  total_area_sqm: string
  remarks: string
  // workflow
  commission_status: CommissionStatus
  validation_status: ValidationStatus
}

type SortField = "reservation_date" | "contract_price" | "created_at"
type SortDir = "asc" | "desc"

const EDITABLE_REVIEW_STATUSES: ValidationStatus[] = ["invalid_sale", "under_review"]

const REQUIRED_FIELDS: Array<{ key: string; valid: (form: SaleFormData) => boolean; message: string }> = [
  // Project sales: developer + project mandatory. Brokerage/rental skip them.
  { key: "developer_id", valid: (form) => form.sale_type !== "project" || Boolean(form.developer_id), message: "Developer is required" },
  { key: "project_id", valid: (form) => form.sale_type !== "project" || Boolean(form.project_id), message: "Project is required" },
  // Brokerage/rental: describe the property instead.
  {
    key: "property_type",
    valid: (form) => form.sale_type === "project" || Boolean(form.property_type.trim()),
    message: "Property type is required",
  },
  {
    key: "unit_information",
    valid: (form) =>
      form.sale_type === "project"
        ? [form.project_unit_id, form.unit_number, form.block_number, form.lot_number].some((v) => Boolean(String(v ?? "").trim()))
        : [form.property_address, form.unit_number, form.block_number, form.lot_number].some((v) => Boolean(String(v ?? "").trim())),
    message: "Unit / property information is required",
  },
  { key: "client.first_name", valid: (form) => Boolean(form.client.first_name.trim()), message: "Client first name is required" },
  { key: "client.last_name", valid: (form) => Boolean(form.client.last_name.trim()), message: "Client last name is required" },
  { key: "client.phone", valid: (form) => Boolean(form.client.phone.trim()), message: "Client phone is required" },
  {
    key: "client_address",
    valid: (form) => [form.client.street, form.client.city, form.client.state_province, form.client.country].some((v) => Boolean(v.trim())),
    message: "Client address is required",
  },
  {
    key: "contract_price",
    valid: (form) => Boolean(form.contract_price) && Number(form.contract_price) > 0,
    message: "Contract price must be greater than 0",
  },
  { key: "reservation_date", valid: (form) => Boolean(form.reservation_date), message: "Reservation date is required" },
  { key: "payment_plan", valid: (form) => Boolean(form.payment_plan.trim()), message: "Payment plan is required" },
  { key: "payment_terms", valid: (form) => Boolean(form.payment_terms.trim()), message: "Payment terms are required" },
]

function normalizeRole(role: string | undefined | null) {
  return String(role ?? "").toLowerCase().trim()
}

export function isAdminRole(role: string | undefined | null) {
  return isAdminStaffRole(role)
}

export function isAgentScopedRole(role: string | undefined | null) {
  return isSalesPipelineRole(role)
}

export function canEditSaleForRole(role: string | undefined | null, sale: SaleRecord | null) {
  if (!sale) return false
  return isAdminRole(role)
}

export function canManageSaleAttachmentsForRole(role: string | undefined | null, sale: SaleRecord | null) {
  if (!sale) return false
  if (isAdminRole(role)) return true
  if (isSecretaryLikeRole(role) && EDITABLE_REVIEW_STATUSES.includes(sale.validation_status)) return true
  return isAgentScopedRole(role) && EDITABLE_REVIEW_STATUSES.includes(sale.validation_status)
}

export function validateSaleFormData(form: SaleFormData) {
  const errors: Record<string, string> = {}
  for (const field of REQUIRED_FIELDS) {
    if (!field.valid(form)) errors[field.key] = field.message
  }
  return errors
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

function normalizeSale(row: unknown): SaleRecord {
  const raw = row as Record<string, unknown>

  const pick = <T,>(rel: unknown, key: string): T | null => {
    if (!rel) return null
    const item = Array.isArray(rel) ? (rel[0] ?? null) : rel
    if (!item) return null
    return (item as Record<string, unknown>)[key] as T
  }

  const developers = (() => {
    const rel = raw.developers as unknown
    const item = Array.isArray(rel) ? (rel[0] ?? null) : rel
    return item ? { name: (item as Record<string, unknown>).name as string ?? null } : null
  })()

  const projects = (() => {
    const rel = raw.projects as unknown
    const item = Array.isArray(rel) ? (rel[0] ?? null) : rel
    return item ? { name: (item as Record<string, unknown>).name as string ?? null } : null
  })()

  const project_units = (() => {
    const rel = raw.project_units as unknown
    const item = Array.isArray(rel) ? (rel[0] ?? null) : rel
    return item ? { unit_type: (item as Record<string, unknown>).unit_type as string ?? null } : null
  })()

  const clients = (() => {
    const rel = raw.clients as unknown
    const item = Array.isArray(rel) ? (rel[0] ?? null) : rel
    if (!item) return null
    const r = item as Record<string, unknown>
    return {
      first_name: String(r.first_name ?? ""),
      middle_name: typeof r.middle_name === "string" ? r.middle_name : null,
      last_name: String(r.last_name ?? ""),
      email: typeof r.email === "string" ? r.email : null,
      phone: typeof r.phone === "string" ? r.phone : null,
      age: r.age != null ? Number(r.age) : null,
      gender: typeof r.gender === "string" ? r.gender : null,
      occupation: typeof r.occupation === "string" ? r.occupation : null,
      street: typeof r.street === "string" ? r.street : null,
      city: typeof r.city === "string" ? r.city : null,
      state_province: typeof r.state_province === "string" ? r.state_province : null,
      country: typeof r.country === "string" ? r.country : null,
    }
  })()

  const profiles = (() => {
    const rel = raw.profiles as unknown
    const item = Array.isArray(rel) ? (rel[0] ?? null) : rel
    return item ? { fullname: (item as Record<string, unknown>).fullname as string ?? null } : null
  })()

  const attachmentsRaw = raw.sales_attachments
  const attachmentsCount = Array.isArray(attachmentsRaw) ? attachmentsRaw.length : 0

  return {
    id: String(raw.id ?? ""),
    agent_id: String(raw.agent_id ?? ""),
    sale_type: (raw.sale_type === "brokerage" || raw.sale_type === "rental" ? raw.sale_type : "project") as SaleType,
    developer_id: String(raw.developer_id ?? ""),
    project_id: Number(raw.project_id ?? 0),
    project_unit_id: raw.project_unit_id != null ? Number(raw.project_unit_id) : null,
    unit_number: typeof raw.unit_number === "string" ? raw.unit_number : null,
    block_number: typeof raw.block_number === "string" ? raw.block_number : null,
    lot_number: typeof raw.lot_number === "string" ? raw.lot_number : null,
    property_type: typeof raw.property_type === "string" ? raw.property_type : null,
    property_address: typeof raw.property_address === "string" ? raw.property_address : null,
    client_id: String(raw.client_id ?? ""),
    contract_price: Number(raw.contract_price ?? 0),
    reservation_date: typeof raw.reservation_date === "string" ? raw.reservation_date : null,
    payment_plan: typeof raw.payment_plan === "string" ? raw.payment_plan : null,
    payment_terms: typeof raw.payment_terms === "string" ? raw.payment_terms : null,
    price_per_sqm: raw.price_per_sqm != null ? Number(raw.price_per_sqm) : null,
    total_area_sqm: raw.total_area_sqm != null ? Number(raw.total_area_sqm) : null,
    commission_status: (raw.commission_status as CommissionStatus) ?? "pending",
    validation_status: (raw.validation_status as ValidationStatus) ?? "pending",
    proof_of_transaction_url: typeof raw.proof_of_transaction_url === "string" ? raw.proof_of_transaction_url : null,
    remarks: typeof raw.remarks === "string" ? raw.remarks : null,
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
    created_by: typeof raw.created_by === "string" ? raw.created_by : null,
    updated_by: typeof raw.updated_by === "string" ? raw.updated_by : null,
    developers,
    projects,
    project_units,
    clients,
    profiles,
    attachments_count: attachmentsCount,
  }
}

function normalizeActivityLog(row: unknown): SaleActivityLog {
  const raw = row as Record<string, unknown>
  const profileRel = raw.profiles as unknown
  const profileItem = Array.isArray(profileRel) ? (profileRel[0] ?? null) : profileRel

  return {
    id: String(raw.id ?? ""),
    sales_report_id: String(raw.sales_report_id ?? ""),
    action_type: String(raw.action_type ?? ""),
    field_name: typeof raw.field_name === "string" ? raw.field_name : null,
    old_value: raw.old_value ?? null,
    new_value: raw.new_value ?? null,
    description: typeof raw.description === "string" ? raw.description : null,
    performed_by: typeof raw.performed_by === "string" ? raw.performed_by : null,
    performed_role: typeof raw.performed_role === "string" ? raw.performed_role : null,
    created_at: String(raw.created_at ?? ""),
    profiles: profileItem ? { fullname: (profileItem as Record<string, unknown>).fullname as string ?? null } : null,
  }
}

function normalizeValidationComment(row: unknown): SaleValidationComment {
  const raw = row as Record<string, unknown>
  const profileRel = raw.profiles as unknown
  const profileItem = Array.isArray(profileRel) ? (profileRel[0] ?? null) : profileRel

  return {
    id: String(raw.id ?? ""),
    sales_report_id: String(raw.sales_report_id ?? ""),
    parent_comment_id: typeof raw.parent_comment_id === "string" ? raw.parent_comment_id : null,
    comment: String(raw.comment ?? ""),
    commented_by: String(raw.commented_by ?? ""),
    commenter_role: typeof raw.commenter_role === "string" ? raw.commenter_role : null,
    is_admin_comment: Boolean(raw.is_admin_comment),
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
    profiles: profileItem
      ? {
          fullname: (profileItem as Record<string, unknown>).fullname as string ?? null,
          profile_url: (profileItem as Record<string, unknown>).profile_url as string ?? null,
        }
      : null,
  }
}

async function logActivity(payload: {
  sales_report_id: string
  action_type: string
  field_name?: string | null
  old_value?: unknown
  new_value?: unknown
  description?: string | null
  performed_by: string
  performed_role: string
}) {
  const supabase = createClient()
  await supabase.from("sales_activity_logs").insert({
    sales_report_id: payload.sales_report_id,
    action_type: payload.action_type,
    field_name: payload.field_name ?? null,
    old_value: payload.old_value ?? null,
    new_value: payload.new_value ?? null,
    description: payload.description ?? null,
    performed_by: payload.performed_by,
    performed_role: payload.performed_role,
  })
}

function shouldForceUnderReview(currentRole: string, previousStatus: ValidationStatus) {
  return isAgentScopedRole(currentRole) && EDITABLE_REVIEW_STATUSES.includes(previousStatus)
}

function normalizeAttachment(row: unknown): SaleAttachment {
  const raw = row as Record<string, unknown>
  const profiles = (() => {
    const rel = raw.profiles as unknown
    const item = Array.isArray(rel) ? (rel[0] ?? null) : rel
    return item ? { fullname: (item as Record<string, unknown>).fullname as string ?? null } : null
  })()

  return {
    id: String(raw.id ?? ""),
    sales_report_id: String(raw.sales_report_id ?? ""),
    file_name: String(raw.file_name ?? ""),
    file_url: String(raw.file_url ?? ""),
    file_type: typeof raw.file_type === "string" ? raw.file_type : null,
    uploaded_by: typeof raw.uploaded_by === "string" ? raw.uploaded_by : null,
    uploaded_at: String(raw.uploaded_at ?? ""),
    profiles,
  }
}

// ─── Reference data ───────────────────────────────────────────────────────────

export async function fetchDevelopersForSale(): Promise<{ data: DeveloperOption[] | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("developers")
    .select("id, name, slug")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name", { ascending: true })

  if (error) return { data: null, error: error.message }
  return {
    data: (data ?? []).map((r) => ({ id: String(r.id), name: String(r.name), slug: String(r.slug) })),
    error: null,
  }
}

export async function fetchProjectsForDeveloper(developerId: string): Promise<{
  data: ProjectOption[] | null
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, slug, developer_id")
    .eq("developer_id", developerId)
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (error) return { data: null, error: error.message }
  return {
    data: (data ?? []).map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      slug: String(r.slug),
      developer_id: String(r.developer_id),
    })),
    error: null,
  }
}

export async function fetchUnitsForProject(projectId: number): Promise<{
  data: ProjectUnitOption[] | null
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("project_units")
    .select("id, unit_type, layout_name, bedrooms, price_from")
    .eq("project_id", projectId)
    .eq("is_available", true)
    .order("unit_type", { ascending: true })

  if (error) return { data: null, error: error.message }
  return {
    data: (data ?? []).map((r) => ({
      id: Number(r.id),
      unit_type: String(r.unit_type ?? ""),
      layout_name: typeof r.layout_name === "string" ? r.layout_name : null,
      bedrooms: r.bedrooms != null ? Number(r.bedrooms) : null,
      price_from: r.price_from != null ? Number(r.price_from) : null,
    })),
    error: null,
  }
}

export async function fetchAgentsForSale(): Promise<{ data: AgentOption[] | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, fullname")
    .in("role", [...ROLES_SALE_AGENT_PROFILES])
    .order("fullname", { ascending: true })

  if (error) return { data: null, error: error.message }
  return {
    data: (data ?? []).map((r) => ({ id: String(r.id), fullname: typeof r.fullname === "string" ? r.fullname : null })),
    error: null,
  }
}

// ─── Sales CRUD ───────────────────────────────────────────────────────────────

export async function fetchSales(opts: {
  page: number
  perPage: number
  search?: string
  saleType?: SaleType
  agentId?: string
  developerId?: string
  projectId?: string
  commissionStatus?: CommissionStatus
  validationStatus?: ValidationStatus
  reservationDateFrom?: string
  reservationDateTo?: string
  sortField?: SortField
  sortDir?: SortDir
  currentRole?: string
  currentUserId?: string
}): Promise<{ data: SaleRecord[] | null; total: number | null; error: string | null }> {
  const supabase = createClient()
  const {
    page,
    perPage,
    search,
    saleType,
    agentId,
    developerId,
    projectId,
    commissionStatus,
    validationStatus,
    reservationDateFrom,
    reservationDateTo,
    sortField = "created_at",
    sortDir = "desc",
    currentRole,
    currentUserId,
  } = opts

  const from = (page - 1) * perPage
  const to = from + perPage - 1

  let query = supabase
    .from("sales_reports")
    .select(`
      *,
      developers(name),
      projects(name),
      project_units(unit_type),
      clients(first_name,middle_name,last_name,email,phone,age,gender,occupation,street,city,state_province,country),
      profiles:agent_id(fullname),
      sales_attachments(id)
    `, { count: "exact" })
    .range(from, to)
    .order(sortField, { ascending: sortDir === "asc" })

  // Agent, team leader, and unit manager can only see their own sales
  if (isSalesPipelineRole(currentRole) && currentUserId) {
    query = query.eq("agent_id", currentUserId)
  } else if (agentId) {
    query = query.eq("agent_id", agentId)
  }

  if (saleType) query = query.eq("sale_type", saleType)
  if (developerId) query = query.eq("developer_id", developerId)
  if (projectId) query = query.eq("project_id", Number(projectId))
  if (commissionStatus) query = query.eq("commission_status", commissionStatus)
  if (validationStatus) query = query.eq("validation_status", validationStatus)
  if (reservationDateFrom) query = query.gte("reservation_date", reservationDateFrom)
  if (reservationDateTo) query = query.lte("reservation_date", reservationDateTo)

  // Free-text search. PostgREST .or() can't span embedded relations, so joined
  // names (client/project/developer) are resolved to ids first, then folded into
  // one .or() alongside the top-level property columns. Sanitize the term first —
  // commas/parens/quotes are .or() grammar and would corrupt the filter. The whole
  // .or() is ANDed with the agent force-scope above, so an agent's search still
  // only ever matches their own sales.
  if (search) {
    const s = search.replace(/[,()"%*\\]/g, " ").replace(/\s+/g, " ").trim()
    if (s) {
      const [cRes, pRes, dRes] = await Promise.all([
        supabase.from("clients").select("id").or(`first_name.ilike.%${s}%,middle_name.ilike.%${s}%,last_name.ilike.%${s}%`),
        supabase.from("projects").select("id").ilike("name", `%${s}%`),
        supabase.from("developers").select("id").ilike("name", `%${s}%`),
      ])
      const clauses = [
        `unit_number.ilike.%${s}%`,
        `property_type.ilike.%${s}%`,
        `property_address.ilike.%${s}%`,
        `block_number.ilike.%${s}%`,
        `lot_number.ilike.%${s}%`,
        `remarks.ilike.%${s}%`,
      ]
      const cIds = (cRes.data ?? []).map((r: { id: string }) => r.id)
      if (cIds.length) clauses.push(`client_id.in.(${cIds.join(",")})`)
      const pIds = (pRes.data ?? []).map((r: { id: number }) => r.id)
      if (pIds.length) clauses.push(`project_id.in.(${pIds.join(",")})`)
      const dIds = (dRes.data ?? []).map((r: { id: string }) => r.id)
      if (dIds.length) clauses.push(`developer_id.in.(${dIds.join(",")})`)
      query = query.or(clauses.join(","))
    }
  }

  const { data, count, error } = await query
  if (error) return { data: null, total: null, error: error.message }

  return {
    data: (data ?? []).map(normalizeSale),
    total: count ?? 0,
    error: null,
  }
}

export type SaleTypeSummary = { dealCount: number; totalValue: number; pendingCount: number }

// Aggregate for the Sales Reports summary tiles / tab badges — deal count, total
// contract value, and pending-validation count for a single sale type. Backed by
// the sales_summary() RPC (server-side SUM; a client-side sum would hit
// PostgREST's row cap and undercount). Role-scoped identically to fetchSales:
// sales-pipeline roles are forced to their own agent_id, admins may narrow by agentId.
export async function fetchSalesSummary(opts: {
  saleType: SaleType
  agentId?: string
  currentRole?: string
  currentUserId?: string
}): Promise<{ data: SaleTypeSummary | null; error: string | null }> {
  const supabase = createClient()
  const { saleType, agentId, currentRole, currentUserId } = opts
  const pAgent = isSalesPipelineRole(currentRole) && currentUserId ? currentUserId : (agentId || null)
  const { data, error } = await supabase.rpc("sales_summary", { p_sale_type: saleType, p_agent_id: pAgent })
  if (error) return { data: null, error: error.message }
  const row = Array.isArray(data) ? data[0] : data
  return {
    data: {
      dealCount: Number(row?.deal_count ?? 0),
      totalValue: Number(row?.total_value ?? 0),
      pendingCount: Number(row?.pending_count ?? 0),
    },
    error: null,
  }
}

export async function fetchSaleById(id: string): Promise<{ data: SaleRecord | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("sales_reports")
    .select(`
      *,
      developers(name),
      projects(name),
      project_units(unit_type),
      clients(first_name,middle_name,last_name,email,phone,age,gender,occupation,street,city,state_province,country),
      profiles:agent_id(fullname),
      sales_attachments(id)
    `)
    .eq("id", id)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: normalizeSale(data), error: null }
}

export async function createSale(
  form: SaleFormData,
  currentUserId: string,
  currentRole: string,
): Promise<{ data: SaleRecord | null; error: string | null }> {
  const supabase = createClient()

  const validationErrors = validateSaleFormData(form)
  const firstError = Object.values(validationErrors)[0]
  if (firstError) return { data: null, error: firstError }

  if (!isAdminStaffRole(currentRole) && !isSalesPipelineRole(currentRole)) {
    return { data: null, error: "You are not allowed to record new sales" }
  }

  // 1. Upsert client
  const clientPayload = {
    first_name: form.client.first_name.trim(),
    middle_name: form.client.middle_name.trim() || null,
    last_name: form.client.last_name.trim(),
    email: form.client.email.trim() || null,
    phone: form.client.phone.trim() || null,
    age: form.client.age ? Number(form.client.age) : null,
    gender: form.client.gender || null,
    occupation: form.client.occupation.trim() || null,
    street: form.client.street.trim() || null,
    city: form.client.city.trim() || null,
    state_province: form.client.state_province.trim() || null,
    country: form.client.country.trim() || null,
  }

  const { data: clientData, error: clientError } = await supabase
    .from("clients")
    .insert(clientPayload)
    .select("id")
    .single()

  if (clientError) return { data: null, error: clientError.message }

  // 2. Insert sale (brokerage/rental deals carry no developer or project)
  const isProjectSale = form.sale_type === "project"
  const salePayload = {
    agent_id: currentUserId,
    sale_type: form.sale_type,
    developer_id: isProjectSale ? form.developer_id : null,
    project_id: isProjectSale ? Number(form.project_id) : null,
    project_unit_id: isProjectSale && form.project_unit_id ? Number(form.project_unit_id) : null,
    unit_number: form.unit_number.trim() || null,
    block_number: form.block_number.trim() || null,
    lot_number: form.lot_number.trim() || null,
    property_type: !isProjectSale ? form.property_type.trim() || null : null,
    property_address: !isProjectSale ? form.property_address.trim() || null : null,
    client_id: clientData.id,
    contract_price: Number(form.contract_price),
    reservation_date: form.reservation_date || null,
    payment_plan: form.payment_plan.trim() || null,
    payment_terms: form.payment_terms.trim() || null,
    price_per_sqm: form.price_per_sqm ? Number(form.price_per_sqm) : null,
    total_area_sqm: form.total_area_sqm ? Number(form.total_area_sqm) : null,
    commission_status: isAdminRole(currentRole) ? form.commission_status : "pending",
    validation_status: isAdminRole(currentRole) ? form.validation_status : "pending",
    remarks: form.remarks.trim() || null,
    created_by: currentUserId,
    updated_by: currentUserId,
  }

  const { data, error } = await supabase
    .from("sales_reports")
    .insert(salePayload)
    .select(`
      *,
      developers(name),
      projects(name),
      project_units(unit_type),
      clients(first_name,middle_name,last_name,email,phone,age,gender,occupation,street,city,state_province,country),
      profiles:agent_id(fullname),
      sales_attachments(id)
    `)
    .single()

  if (error) {
    // The client row was inserted first — clean it up so a failed submit that
    // gets retried doesn't leave orphaned duplicate clients behind.
    await supabase.from("clients").delete().eq("id", clientData.id)
    return { data: null, error: error.message }
  }

  await logActivity({
    sales_report_id: String(data.id),
    action_type: "sale_created",
    performed_by: currentUserId,
    performed_role: normalizeRole(currentRole),
    new_value: {
      developer_id: salePayload.developer_id,
      project_id: salePayload.project_id,
      unit_number: salePayload.unit_number,
      contract_price: salePayload.contract_price,
      validation_status: salePayload.validation_status,
      commission_status: salePayload.commission_status,
    },
  })

  return { data: normalizeSale(data), error: null }
}

export async function updateSale(
  id: string,
  form: SaleFormData,
  currentUserId: string,
  currentRole: string,
): Promise<{ data: SaleRecord | null; error: string | null }> {
  const supabase = createClient()

  const validationErrors = validateSaleFormData(form)
  const firstError = Object.values(validationErrors)[0]
  if (firstError) return { data: null, error: firstError }

  const { data: existingSaleRaw, error: existingSaleError } = await supabase
    .from("sales_reports")
    .select(`
      *,
      clients(first_name,middle_name,last_name,email,phone,age,gender,occupation,street,city,state_province,country)
    `)
    .eq("id", id)
    .single()

  if (existingSaleError || !existingSaleRaw) {
    return { data: null, error: existingSaleError?.message ?? "Sale not found" }
  }

  const existingSale = normalizeSale(existingSaleRaw)

  if (!canEditSaleForRole(currentRole, existingSale)) {
    return { data: null, error: "You are not allowed to edit this sale in its current validation status" }
  }

  // Update client record
  const { data: saleForClient } = await supabase
    .from("sales_reports")
    .select("client_id")
    .eq("id", id)
    .single()

  if (saleForClient?.client_id) {
    const { error: clientUpdateError } = await supabase
      .from("clients")
      .update({
        first_name: form.client.first_name.trim(),
        middle_name: form.client.middle_name.trim() || null,
        last_name: form.client.last_name.trim(),
        email: form.client.email.trim() || null,
        phone: form.client.phone.trim() || null,
        age: form.client.age ? Number(form.client.age) : null,
        gender: form.client.gender || null,
        occupation: form.client.occupation.trim() || null,
        street: form.client.street.trim() || null,
        city: form.client.city.trim() || null,
        state_province: form.client.state_province.trim() || null,
        country: form.client.country.trim() || null,
      })
      .eq("id", saleForClient.client_id)

    if (clientUpdateError) return { data: null, error: clientUpdateError.message }
  }

  const nextValidationStatus = shouldForceUnderReview(currentRole, existingSale.validation_status)
    ? "under_review"
    : (isAdminRole(currentRole) ? form.validation_status : existingSale.validation_status)

  const nextCommissionStatus = isAdminRole(currentRole)
    ? form.commission_status
    : existingSale.commission_status

  const isProjectSaleUpdate = form.sale_type === "project"
  const saleUpdatePayload = {
    sale_type: form.sale_type,
    developer_id: isProjectSaleUpdate ? form.developer_id : null,
    project_id: isProjectSaleUpdate ? Number(form.project_id) : null,
    project_unit_id: isProjectSaleUpdate && form.project_unit_id ? Number(form.project_unit_id) : null,
    unit_number: form.unit_number.trim() || null,
    block_number: form.block_number.trim() || null,
    lot_number: form.lot_number.trim() || null,
    property_type: !isProjectSaleUpdate ? form.property_type.trim() || null : null,
    property_address: !isProjectSaleUpdate ? form.property_address.trim() || null : null,
    contract_price: Number(form.contract_price),
    reservation_date: form.reservation_date || null,
    payment_plan: form.payment_plan.trim() || null,
    payment_terms: form.payment_terms.trim() || null,
    price_per_sqm: form.price_per_sqm ? Number(form.price_per_sqm) : null,
    total_area_sqm: form.total_area_sqm ? Number(form.total_area_sqm) : null,
    commission_status: nextCommissionStatus,
    validation_status: nextValidationStatus,
    remarks: form.remarks.trim() || null,
    updated_by: currentUserId,
  }

  const { data, error } = await supabase
    .from("sales_reports")
    .update(saleUpdatePayload)
    .eq("id", id)
    .select(`
      *,
      developers(name),
      projects(name),
      project_units(unit_type),
      clients(first_name,middle_name,last_name,email,phone,age,gender,occupation,street,city,state_province,country),
      profiles:agent_id(fullname),
      sales_attachments(id)
    `)
    .single()

  if (error) return { data: null, error: error.message }

  const currentRoleNormalized = normalizeRole(currentRole)
  const clientBefore = existingSale.clients
  const clientAfter = {
    first_name: form.client.first_name.trim() || null,
    middle_name: form.client.middle_name.trim() || null,
    last_name: form.client.last_name.trim() || null,
    email: form.client.email.trim() || null,
    phone: form.client.phone.trim() || null,
    age: form.client.age ? Number(form.client.age) : null,
    gender: form.client.gender || null,
    occupation: form.client.occupation.trim() || null,
    street: form.client.street.trim() || null,
    city: form.client.city.trim() || null,
    state_province: form.client.state_province.trim() || null,
    country: form.client.country.trim() || null,
  }

  const beforeSummary = {
    developer_id: existingSale.developer_id,
    project_id: existingSale.project_id,
    project_unit_id: existingSale.project_unit_id,
    unit_number: existingSale.unit_number,
    block_number: existingSale.block_number,
    lot_number: existingSale.lot_number,
    contract_price: existingSale.contract_price,
    reservation_date: existingSale.reservation_date,
    payment_plan: existingSale.payment_plan,
    payment_terms: existingSale.payment_terms,
    price_per_sqm: existingSale.price_per_sqm,
    total_area_sqm: existingSale.total_area_sqm,
    commission_status: existingSale.commission_status,
    validation_status: existingSale.validation_status,
    remarks: existingSale.remarks,
  }

  if (JSON.stringify(beforeSummary) !== JSON.stringify(saleUpdatePayload)) {
    await logActivity({
      sales_report_id: id,
      action_type: "sale_updated",
      performed_by: currentUserId,
      performed_role: currentRoleNormalized,
      old_value: beforeSummary,
      new_value: saleUpdatePayload,
    })
  }

  if (existingSale.commission_status !== nextCommissionStatus) {
    await logActivity({
      sales_report_id: id,
      action_type: "commission_status_changed",
      field_name: "commission_status",
      old_value: existingSale.commission_status,
      new_value: nextCommissionStatus,
      performed_by: currentUserId,
      performed_role: currentRoleNormalized,
    })
  }

  if (existingSale.validation_status !== nextValidationStatus) {
    await logActivity({
      sales_report_id: id,
      action_type: "validation_status_changed",
      field_name: "validation_status",
      old_value: existingSale.validation_status,
      new_value: nextValidationStatus,
      performed_by: currentUserId,
      performed_role: currentRoleNormalized,
    })
  }

  if (JSON.stringify(clientBefore) !== JSON.stringify(clientAfter)) {
    await logActivity({
      sales_report_id: id,
      action_type: "client_information_updated",
      field_name: "client",
      old_value: clientBefore,
      new_value: clientAfter,
      performed_by: currentUserId,
      performed_role: currentRoleNormalized,
    })
  }

  return { data: normalizeSale(data), error: null }
}

export async function deleteSale(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("sales_reports")
    .delete()
    .eq("id", id)

  return { error: error?.message ?? null }
}

// ─── Attachments ──────────────────────────────────────────────────────────────

export async function fetchSaleAttachments(saleId: string): Promise<{
  data: SaleAttachment[] | null
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("sales_attachments")
    .select("*, profiles:uploaded_by(fullname)")
    .eq("sales_report_id", saleId)
    .order("uploaded_at", { ascending: false })

  if (error) return { data: null, error: error.message }
  return { data: (data ?? []).map(normalizeAttachment), error: null }
}

export async function insertSaleAttachment(payload: {
  sales_report_id: string
  file_name: string
  file_url: string
  file_type: string | null
  uploaded_by: string
  uploaded_role: string
}): Promise<{ data: SaleAttachment | null; error: string | null }> {
  const supabase = createClient()

  const { data: saleRaw, error: saleError } = await supabase
    .from("sales_reports")
    .select("id, agent_id, validation_status")
    .eq("id", payload.sales_report_id)
    .single()

  if (saleError || !saleRaw) return { data: null, error: saleError?.message ?? "Sale not found" }

  if (isAgentScopedRole(payload.uploaded_role)) {
    const isOwner = String(saleRaw.agent_id) === payload.uploaded_by
    const canManage = EDITABLE_REVIEW_STATUSES.includes(String(saleRaw.validation_status) as ValidationStatus)
    if (!isOwner || !canManage) {
      return { data: null, error: "You can only manage attachments while this sale is Invalid Sale or Under Review" }
    }
  } else if (isSecretaryLikeRole(payload.uploaded_role)) {
    const canManage = EDITABLE_REVIEW_STATUSES.includes(String(saleRaw.validation_status) as ValidationStatus)
    if (!canManage) {
      return { data: null, error: "You can only add attachments while this sale is Invalid Sale or Under Review" }
    }
  }

  const { data, error } = await supabase
    .from("sales_attachments")
    .insert({
      sales_report_id: payload.sales_report_id,
      file_name: payload.file_name,
      file_url: payload.file_url,
      file_type: payload.file_type,
      uploaded_by: payload.uploaded_by,
    })
    .select("*, profiles:uploaded_by(fullname)")
    .single()

  if (error) return { data: null, error: error.message }

  await logActivity({
    sales_report_id: payload.sales_report_id,
    action_type: "attachment_uploaded",
    field_name: "attachment",
    new_value: { file_name: payload.file_name, file_type: payload.file_type, file_url: payload.file_url },
    performed_by: payload.uploaded_by,
    performed_role: normalizeRole(payload.uploaded_role),
  })

  return { data: normalizeAttachment(data), error: null }
}

export async function deleteSaleAttachment(
  id: string,
  currentUserId: string,
  currentRole: string,
): Promise<{ error: string | null }> {
  const supabase = createClient()

  const currentRoleNormalized = normalizeRole(currentRole)

  const { data: attachment, error: attachmentError } = await supabase
    .from("sales_attachments")
    .select("id, sales_report_id, file_name, file_type, file_url")
    .eq("id", id)
    .single()

  if (attachmentError || !attachment) return { error: attachmentError?.message ?? "Attachment not found" }

  if (!isAdminRole(currentRoleNormalized)) {
    if (isSecretaryLikeRole(currentRoleNormalized)) {
      const { data: saleRaw, error: saleError } = await supabase
        .from("sales_reports")
        .select("agent_id, validation_status")
        .eq("id", attachment.sales_report_id)
        .single()

      if (saleError || !saleRaw) return { error: saleError?.message ?? "Sale not found" }

      const canManage = EDITABLE_REVIEW_STATUSES.includes(String(saleRaw.validation_status) as ValidationStatus)
      if (!canManage) {
        return { error: "You can only manage attachments while this sale is Invalid Sale or Under Review" }
      }
    } else if (isAgentScopedRole(currentRoleNormalized)) {
      const { data: saleRaw, error: saleError } = await supabase
        .from("sales_reports")
        .select("agent_id, validation_status")
        .eq("id", attachment.sales_report_id)
        .single()

      if (saleError || !saleRaw) return { error: saleError?.message ?? "Sale not found" }

      const isOwner = String(saleRaw.agent_id) === currentUserId
      const canManage = EDITABLE_REVIEW_STATUSES.includes(String(saleRaw.validation_status) as ValidationStatus)

      if (!isOwner || !canManage) {
        return { error: "You can only manage attachments while this sale is Invalid Sale or Under Review" }
      }
    } else {
      return { error: "You are not allowed to delete attachments" }
    }
  }

  const { error } = await supabase.from("sales_attachments").delete().eq("id", id)
  if (error) return { error: error.message }

  await logActivity({
    sales_report_id: String(attachment.sales_report_id),
    action_type: "attachment_deleted",
    field_name: "attachment",
    old_value: {
      id: attachment.id,
      file_name: attachment.file_name,
      file_type: attachment.file_type,
      file_url: attachment.file_url,
    },
    performed_by: currentUserId,
    performed_role: currentRoleNormalized,
  })

  return { error: null }
}

export async function updateSaleValidationStatus(
  saleId: string,
  nextStatus: ValidationStatus,
  currentUserId: string,
  currentRole: string,
): Promise<{ data: SaleRecord | null; error: string | null }> {
  const supabase = createClient()

  if (!isAdminRole(currentRole)) {
    return { data: null, error: "Only admin users can change validation status" }
  }

  const { data: existingRaw, error: existingError } = await supabase
    .from("sales_reports")
    .select("id, validation_status")
    .eq("id", saleId)
    .single()

  if (existingError || !existingRaw) {
    return { data: null, error: existingError?.message ?? "Sale not found" }
  }

  const { data, error } = await supabase
    .from("sales_reports")
    .update({ validation_status: nextStatus, updated_by: currentUserId })
    .eq("id", saleId)
    .select(`
      *,
      developers(name),
      projects(name),
      project_units(unit_type),
      clients(first_name,middle_name,last_name,email,phone,age,gender,occupation,street,city,state_province,country),
      profiles:agent_id(fullname),
      sales_attachments(id)
    `)
    .single()

  if (error) return { data: null, error: error.message }

  if (String(existingRaw.validation_status) !== nextStatus) {
    await logActivity({
      sales_report_id: saleId,
      action_type: "validation_status_changed",
      field_name: "validation_status",
      old_value: existingRaw.validation_status,
      new_value: nextStatus,
      performed_by: currentUserId,
      performed_role: normalizeRole(currentRole),
    })
  }

  return { data: normalizeSale(data), error: null }
}

export async function fetchSaleActivityLogs(saleId: string): Promise<{ data: SaleActivityLog[] | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("sales_activity_logs")
    .select("*, profiles:performed_by(fullname)")
    .eq("sales_report_id", saleId)
    .order("created_at", { ascending: false })

  if (error) return { data: null, error: error.message }
  return { data: (data ?? []).map(normalizeActivityLog), error: null }
}

export async function fetchValidationComments(saleId: string): Promise<{ data: SaleValidationComment[] | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("sales_validation_comments")
    .select("*, profiles:commented_by(fullname, profile_url)")
    .eq("sales_report_id", saleId)
    .order("created_at", { ascending: true })

  if (error) return { data: null, error: error.message }
  return { data: (data ?? []).map(normalizeValidationComment), error: null }
}

export async function insertValidationComment(payload: {
  sales_report_id: string
  comment: string
  commented_by: string
  commenter_role: string
  parent_comment_id?: string | null
}): Promise<{ data: SaleValidationComment | null; error: string | null }> {
  const supabase = createClient()

  const role = normalizeRole(payload.commenter_role)

  const { data: saleRaw, error: saleError } = await supabase
    .from("sales_reports")
    .select("validation_status")
    .eq("id", payload.sales_report_id)
    .single()

  if (saleError || !saleRaw) return { data: null, error: saleError?.message ?? "Sale not found" }

  const status = String(saleRaw.validation_status) as ValidationStatus
  const body = payload.comment.trim()
  if (!body) return { data: null, error: "Comment is required" }

  const { data, error } = await supabase
    .from("sales_validation_comments")
    .insert({
      sales_report_id: payload.sales_report_id,
      parent_comment_id: payload.parent_comment_id ?? null,
      comment: body,
      commented_by: payload.commented_by,
      commenter_role: role,
      is_admin_comment: isAdminRole(role),
    })
    .select("*, profiles:commented_by(fullname, profile_url)")
    .single()

  if (error) return { data: null, error: error.message }
  return { data: normalizeValidationComment(data), error: null }
}
