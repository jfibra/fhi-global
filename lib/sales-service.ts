import { createClient } from "@/lib/supabase/client"

// ─── Types ────────────────────────────────────────────────────────────────────

export type CommissionStatus = "pending" | "processing" | "approved" | "released" | "rejected"
export type ValidationStatus = "pending" | "under_review" | "validated" | "invalid_sale"

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
  developer_id: string
  project_id: number
  project_unit_id: number | null
  unit_number: string | null
  block_number: string | null
  lot_number: string | null
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
  clients: { first_name: string; last_name: string; email: string | null; phone: string | null } | null
  profiles: { fullname: string | null } | null
  attachments_count: number
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
  // property
  developer_id: string
  project_id: string
  project_unit_id: string
  unit_number: string
  block_number: string
  lot_number: string
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
      last_name: String(r.last_name ?? ""),
      email: typeof r.email === "string" ? r.email : null,
      phone: typeof r.phone === "string" ? r.phone : null,
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
    developer_id: String(raw.developer_id ?? ""),
    project_id: Number(raw.project_id ?? 0),
    project_unit_id: raw.project_unit_id != null ? Number(raw.project_unit_id) : null,
    unit_number: typeof raw.unit_number === "string" ? raw.unit_number : null,
    block_number: typeof raw.block_number === "string" ? raw.block_number : null,
    lot_number: typeof raw.lot_number === "string" ? raw.lot_number : null,
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
    .in("role", ["agent", "team_leader", "unit_manager"])
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
      clients(first_name,last_name,email,phone),
      profiles:agent_id(fullname),
      sales_attachments(id)
    `, { count: "exact" })
    .range(from, to)
    .order(sortField, { ascending: sortDir === "asc" })

  // Agent, team leader, and unit manager can only see their own sales
  if (["agent", "team_leader", "unit_manager"].includes(String(currentRole ?? "")) && currentUserId) {
    query = query.eq("agent_id", currentUserId)
  } else if (agentId) {
    query = query.eq("agent_id", agentId)
  }

  if (developerId) query = query.eq("developer_id", developerId)
  if (projectId) query = query.eq("project_id", Number(projectId))
  if (commissionStatus) query = query.eq("commission_status", commissionStatus)
  if (validationStatus) query = query.eq("validation_status", validationStatus)
  if (reservationDateFrom) query = query.gte("reservation_date", reservationDateFrom)
  if (reservationDateTo) query = query.lte("reservation_date", reservationDateTo)

  const { data, count, error } = await query
  if (error) return { data: null, total: null, error: error.message }

  return {
    data: (data ?? []).map(normalizeSale),
    total: count ?? 0,
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
): Promise<{ data: SaleRecord | null; error: string | null }> {
  const supabase = createClient()

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

  // 2. Insert sale
  const salePayload = {
    agent_id: currentUserId,
    developer_id: form.developer_id,
    project_id: Number(form.project_id),
    project_unit_id: form.project_unit_id ? Number(form.project_unit_id) : null,
    unit_number: form.unit_number.trim() || null,
    block_number: form.block_number.trim() || null,
    lot_number: form.lot_number.trim() || null,
    client_id: clientData.id,
    contract_price: Number(form.contract_price),
    reservation_date: form.reservation_date || null,
    payment_plan: form.payment_plan.trim() || null,
    payment_terms: form.payment_terms.trim() || null,
    price_per_sqm: form.price_per_sqm ? Number(form.price_per_sqm) : null,
    total_area_sqm: form.total_area_sqm ? Number(form.total_area_sqm) : null,
    commission_status: form.commission_status,
    validation_status: form.validation_status,
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
      clients(first_name,last_name,email,phone),
      profiles:agent_id(fullname),
      sales_attachments(id)
    `)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: normalizeSale(data), error: null }
}

export async function updateSale(
  id: string,
  form: SaleFormData,
  currentUserId: string,
): Promise<{ data: SaleRecord | null; error: string | null }> {
  const supabase = createClient()

  // Update client record
  const { data: saleForClient } = await supabase
    .from("sales_reports")
    .select("client_id")
    .eq("id", id)
    .single()

  if (saleForClient?.client_id) {
    await supabase
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
  }

  const { data, error } = await supabase
    .from("sales_reports")
    .update({
      developer_id: form.developer_id,
      project_id: Number(form.project_id),
      project_unit_id: form.project_unit_id ? Number(form.project_unit_id) : null,
      unit_number: form.unit_number.trim() || null,
      block_number: form.block_number.trim() || null,
      lot_number: form.lot_number.trim() || null,
      contract_price: Number(form.contract_price),
      reservation_date: form.reservation_date || null,
      payment_plan: form.payment_plan.trim() || null,
      payment_terms: form.payment_terms.trim() || null,
      price_per_sqm: form.price_per_sqm ? Number(form.price_per_sqm) : null,
      total_area_sqm: form.total_area_sqm ? Number(form.total_area_sqm) : null,
      commission_status: form.commission_status,
      validation_status: form.validation_status,
      remarks: form.remarks.trim() || null,
      updated_by: currentUserId,
    })
    .eq("id", id)
    .select(`
      *,
      developers(name),
      projects(name),
      project_units(unit_type),
      clients(first_name,last_name,email,phone),
      profiles:agent_id(fullname),
      sales_attachments(id)
    `)
    .single()

  if (error) return { data: null, error: error.message }
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
}): Promise<{ data: SaleAttachment | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("sales_attachments")
    .insert(payload)
    .select("*, profiles:uploaded_by(fullname)")
    .single()

  if (error) return { data: null, error: error.message }
  return { data: normalizeAttachment(data), error: null }
}

export async function deleteSaleAttachment(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.from("sales_attachments").delete().eq("id", id)
  return { error: error?.message ?? null }
}
