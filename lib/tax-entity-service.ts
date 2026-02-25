import { createClient } from "@/lib/supabase/client"

type EntityType = "sale" | "purchase"

export type TaxEntityDeveloper = {
  id: string
  name: string
  logo_url: string | null
}

export type TaxEntity = {
  id: string
  registered_name: string
  trade_name: string | null
  tax_registration_number: string
  entity_type: EntityType
  developer_id: string | null
  company_type: string | null
  country_code: string
  state_province: string | null
  city: string | null
  street_address: string | null
  building: string | null
  postal_code: string | null
  vat_registered: boolean
  vat_rate: number
  currency_code: string
  metadata: Record<string, unknown> | null
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
  developers: {
    name: string | null
    logo_url: string | null
  } | null
}

export type TaxEntityFormData = {
  registered_name: string
  trade_name: string
  tax_registration_number: string
  entity_type: EntityType
  developer_id: string | null
  company_type: string
  country_code: string
  state_province: string
  city: string
  street_address: string
  building: string
  postal_code: string
  vat_registered: boolean
  vat_rate: number
  currency_code: string
  is_active: boolean
}

export type TaxEntitiesListResponse = {
  data: TaxEntity[] | null
  total: number | null
  error: string | null
}

type TaxEntitySortField = "registered_name" | "created_at" | "entity_type" | "country_code"
type TaxEntitySortDir = "asc" | "desc"

function normalizeEntity(row: unknown): TaxEntity {
  const raw = row as Record<string, unknown>
  const relation = raw.developers as
    | { name?: string | null; logo_url?: string | null }
    | Array<{ name?: string | null; logo_url?: string | null }>
    | null

  const developer = Array.isArray(relation) ? relation[0] ?? null : relation

  return {
    id: String(raw.id ?? ""),
    registered_name: String(raw.registered_name ?? ""),
    trade_name: typeof raw.trade_name === "string" ? raw.trade_name : null,
    tax_registration_number: String(raw.tax_registration_number ?? ""),
    entity_type: raw.entity_type === "purchase" ? "purchase" : "sale",
    developer_id: typeof raw.developer_id === "string" ? raw.developer_id : null,
    company_type: typeof raw.company_type === "string" ? raw.company_type : null,
    country_code: String(raw.country_code ?? ""),
    state_province: typeof raw.state_province === "string" ? raw.state_province : null,
    city: typeof raw.city === "string" ? raw.city : null,
    street_address: typeof raw.street_address === "string" ? raw.street_address : null,
    building: typeof raw.building === "string" ? raw.building : null,
    postal_code: typeof raw.postal_code === "string" ? raw.postal_code : null,
    vat_registered: raw.vat_registered !== false,
    vat_rate: Number(raw.vat_rate ?? 0),
    currency_code: String(raw.currency_code ?? "AED"),
    metadata: (raw.metadata as Record<string, unknown> | null) ?? null,
    is_active: raw.is_active !== false,
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
    deleted_at: typeof raw.deleted_at === "string" ? raw.deleted_at : null,
    developers: developer
      ? {
          name: developer.name ?? null,
          logo_url: developer.logo_url ?? null,
        }
      : null,
  }
}

export async function fetchTaxEntityDevelopers(): Promise<{ data: TaxEntityDeveloper[] | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("developers")
    .select("id, name, logo_url")
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (error) return { data: null, error: error.message }

  const mapped = (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    logo_url: typeof row.logo_url === "string" ? row.logo_url : null,
  }))

  return { data: mapped, error: null }
}

export async function fetchTaxEntities(params: {
  page?: number
  perPage?: number
  search?: string
  entityType?: EntityType
  country?: string
  status?: boolean
  developerId?: string
  showDeleted?: boolean
  sortField?: TaxEntitySortField
  sortDir?: TaxEntitySortDir
}): Promise<TaxEntitiesListResponse> {
  const supabase = createClient()
  const page = params.page ?? 1
  const perPage = params.perPage ?? 10
  const from = (page - 1) * perPage
  const to = from + perPage - 1
  const sortField = params.sortField ?? "created_at"
  const ascending = params.sortDir === "asc"

  let query = supabase
    .from("company_tax_entities")
    .select("*, developers(name, logo_url)", { count: "exact" })

  if (params.showDeleted) {
    query = query.not("deleted_at", "is", null)
  } else {
    query = query.is("deleted_at", null)
  }

  if (params.search) {
    const q = `%${params.search.trim()}%`
    query = query.or(
      `registered_name.ilike.${q},trade_name.ilike.${q},tax_registration_number.ilike.${q},city.ilike.${q}`,
    )
  }

  if (params.entityType) query = query.eq("entity_type", params.entityType)
  if (params.country) query = query.eq("country_code", params.country.toUpperCase())
  if (params.status !== undefined) query = query.eq("is_active", params.status)
  if (params.developerId) query = query.eq("developer_id", params.developerId)

  query = query.order(sortField, { ascending }).range(from, to)

  const { data, count, error } = await query
  if (error) return { data: null, total: null, error: error.message }

  return {
    data: (data ?? []).map(normalizeEntity),
    total: count ?? 0,
    error: null,
  }
}

function buildPayload(form: TaxEntityFormData) {
  return {
    registered_name: form.registered_name.trim(),
    trade_name: form.trade_name.trim() || null,
    tax_registration_number: form.tax_registration_number.trim(),
    entity_type: form.entity_type,
    developer_id: form.entity_type === "sale" ? form.developer_id : null,
    company_type: form.company_type.trim() || null,
    country_code: form.country_code.trim().toUpperCase(),
    state_province: form.state_province.trim() || null,
    city: form.city.trim() || null,
    street_address: form.street_address.trim() || null,
    building: form.building.trim() || null,
    postal_code: form.postal_code.trim() || null,
    vat_registered: form.vat_registered,
    vat_rate: Number(form.vat_rate),
    currency_code: form.currency_code.trim().toUpperCase(),
    is_active: form.is_active,
  }
}

export async function createTaxEntity(form: TaxEntityFormData): Promise<{ data: TaxEntity | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("company_tax_entities")
    .insert(buildPayload(form))
    .select("*, developers(name, logo_url)")
    .single()

  if (error) return { data: null, error: error.message }
  return { data: normalizeEntity(data), error: null }
}

export async function updateTaxEntity(id: string, form: TaxEntityFormData): Promise<{ data: TaxEntity | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("company_tax_entities")
    .update({ ...buildPayload(form), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*, developers(name, logo_url)")
    .single()

  if (error) return { data: null, error: error.message }
  return { data: normalizeEntity(data), error: null }
}

export async function toggleTaxEntityActive(id: string, currentValue: boolean): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("company_tax_entities")
    .update({ is_active: !currentValue, updated_at: new Date().toISOString() })
    .eq("id", id)

  return { error: error?.message ?? null }
}

export async function softDeleteTaxEntity(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("company_tax_entities")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)

  return { error: error?.message ?? null }
}