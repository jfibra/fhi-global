import { createClient } from "@/lib/supabase/client"

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaxType = "vat" | "non_vat"

export type TaxEntityOption = {
  id: string
  registered_name: string
  tax_registration_number: string
  country_code: string
}

export type CategoryOption = {
  id: string
  category_name: string
  category_type: string
}

export type PurchaseAttachment = {
  id: string
  purchase_id: string
  file_name: string
  file_url: string
  file_type: string | null
  uploaded_by: string | null
  uploaded_at: string
  metadata: Record<string, unknown>
  profiles: { fullname: string | null } | null
}

export type Purchase = {
  id: string
  tax_entity_id: string
  tax_month: string          // YYYY-MM-01
  tax_type: TaxType
  invoice_number: string
  gross_taxable: number | null
  total_actual_amount: number
  category_id: string | null
  currency_code: string
  notes: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  // joined
  company_tax_entities: { registered_name: string | null } | null
  purchase_categories: { category_name: string | null } | null
  profiles: { fullname: string | null } | null
  attachments_count: number
}

export type PurchaseFormData = {
  tax_entity_id: string
  tax_month: string          // YYYY-MM-01
  tax_type: TaxType
  invoice_number: string
  gross_taxable: string      // string for controlled input
  total_actual_amount: string
  category_id: string
  currency_code: string
  notes: string
}

export type PurchasesListResponse = {
  data: Purchase[] | null
  total: number | null
  error: string | null
}

type SortField = "invoice_number" | "tax_month" | "total_actual_amount" | "created_at"
type SortDir = "asc" | "desc"

// ─── Normalizer ───────────────────────────────────────────────────────────────

function normalizePurchase(row: unknown): Purchase {
  const raw = row as Record<string, unknown>

  const taxEntity = (() => {
    const rel = raw.company_tax_entities as
      | { registered_name?: string | null }
      | Array<{ registered_name?: string | null }>
      | null
    const item = Array.isArray(rel) ? (rel[0] ?? null) : rel
    return item ? { registered_name: item.registered_name ?? null } : null
  })()

  const category = (() => {
    const rel = raw.purchase_categories as
      | { category_name?: string | null }
      | Array<{ category_name?: string | null }>
      | null
    const item = Array.isArray(rel) ? (rel[0] ?? null) : rel
    return item ? { category_name: item.category_name ?? null } : null
  })()

  const profile = (() => {
    const rel = raw.profiles as
      | { fullname?: string | null }
      | Array<{ fullname?: string | null }>
      | null
    const item = Array.isArray(rel) ? (rel[0] ?? null) : rel
    return item ? { fullname: item.fullname ?? null } : null
  })()

  const attachmentsRaw = raw.purchase_attachments
  const attachmentsCount = Array.isArray(attachmentsRaw) ? attachmentsRaw.length : 0

  return {
    id: String(raw.id ?? ""),
    tax_entity_id: String(raw.tax_entity_id ?? ""),
    tax_month: String(raw.tax_month ?? ""),
    tax_type: raw.tax_type === "non_vat" ? "non_vat" : "vat",
    invoice_number: String(raw.invoice_number ?? ""),
    gross_taxable: raw.gross_taxable != null ? Number(raw.gross_taxable) : null,
    total_actual_amount: Number(raw.total_actual_amount ?? 0),
    category_id: typeof raw.category_id === "string" ? raw.category_id : null,
    currency_code: String(raw.currency_code ?? "AED"),
    notes: typeof raw.notes === "string" ? raw.notes : null,
    created_by: typeof raw.created_by === "string" ? raw.created_by : null,
    updated_by: typeof raw.updated_by === "string" ? raw.updated_by : null,
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
    deleted_at: typeof raw.deleted_at === "string" ? raw.deleted_at : null,
    company_tax_entities: taxEntity,
    purchase_categories: category,
    profiles: profile,
    attachments_count: attachmentsCount,
  }
}

function normalizeAttachment(row: unknown): PurchaseAttachment {
  const raw = row as Record<string, unknown>
  const profile = (() => {
    const rel = raw.profiles as
      | { fullname?: string | null }
      | Array<{ fullname?: string | null }>
      | null
    const item = Array.isArray(rel) ? (rel[0] ?? null) : rel
    return item ? { fullname: item.fullname ?? null } : null
  })()

  return {
    id: String(raw.id ?? ""),
    purchase_id: String(raw.purchase_id ?? ""),
    file_name: String(raw.file_name ?? ""),
    file_url: String(raw.file_url ?? ""),
    file_type: typeof raw.file_type === "string" ? raw.file_type : null,
    uploaded_by: typeof raw.uploaded_by === "string" ? raw.uploaded_by : null,
    uploaded_at: String(raw.uploaded_at ?? ""),
    metadata: (raw.metadata as Record<string, unknown>) ?? {},
    profiles: profile,
  }
}

// ─── Reference data ───────────────────────────────────────────────────────────

export async function fetchTaxEntitiesForPurchase(): Promise<{
  data: TaxEntityOption[] | null
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("company_tax_entities")
    .select("id, registered_name, tax_registration_number, country_code")
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("registered_name", { ascending: true })

  if (error) return { data: null, error: error.message }

  return {
    data: (data ?? []).map((row) => ({
      id: String(row.id),
      registered_name: String(row.registered_name ?? ""),
      tax_registration_number: String(row.tax_registration_number ?? ""),
      country_code: String(row.country_code ?? ""),
    })),
    error: null,
  }
}

export async function fetchCategoriesForPurchase(): Promise<{
  data: CategoryOption[] | null
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("purchase_categories")
    .select("id, category_name, category_type")
    .eq("is_active", true)
    .order("category_name", { ascending: true })

  if (error) return { data: null, error: error.message }

  return {
    data: (data ?? []).map((row) => ({
      id: String(row.id),
      category_name: String(row.category_name ?? ""),
      category_type: String(row.category_type ?? ""),
    })),
    error: null,
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function fetchPurchases(params: {
  page: number
  perPage: number
  search?: string
  taxType?: TaxType
  taxMonth?: string
  categoryId?: string
  taxEntityId?: string
  showDeleted?: boolean
  sortField: SortField
  sortDir: SortDir
}): Promise<PurchasesListResponse> {
  const supabase = createClient()
  const {
    page, perPage, search, taxType, taxMonth, categoryId,
    taxEntityId, showDeleted, sortField, sortDir,
  } = params

  const from = (page - 1) * perPage
  const to = from + perPage - 1

  let query = supabase
    .from("purchases")
    .select(
      `*,
      company_tax_entities(registered_name),
      purchase_categories(category_name),
      profiles:created_by(fullname),
      purchase_attachments(id)`,
      { count: "exact" },
    )

  if (!showDeleted) {
    query = query.is("deleted_at", null)
  }

  if (search) {
    query = query.or(`invoice_number.ilike.%${search}%,notes.ilike.%${search}%`)
  }

  if (taxType) {
    query = query.eq("tax_type", taxType)
  }

  if (taxMonth) {
    query = query.eq("tax_month", taxMonth)
  }

  if (categoryId) {
    query = query.eq("category_id", categoryId)
  }

  if (taxEntityId) {
    query = query.eq("tax_entity_id", taxEntityId)
  }

  query = query.order(sortField, { ascending: sortDir === "asc" }).range(from, to)

  const { data, count, error } = await query

  if (error) return { data: null, total: null, error: error.message }

  return {
    data: (data ?? []).map(normalizePurchase),
    total: count ?? 0,
    error: null,
  }
}

export async function createPurchase(
  form: PurchaseFormData,
  createdBy: string,
): Promise<{ data: Purchase | null; error: string | null }> {
  const supabase = createClient()

  const payload = {
    tax_entity_id: form.tax_entity_id,
    tax_month: form.tax_month,
    tax_type: form.tax_type,
    invoice_number: form.invoice_number.trim(),
    gross_taxable: form.gross_taxable ? Number(form.gross_taxable) : null,
    total_actual_amount: Number(form.total_actual_amount),
    category_id: form.category_id || null,
    currency_code: form.currency_code || "AED",
    notes: form.notes.trim() || null,
    created_by: createdBy,
    updated_by: createdBy,
  }

  const { data, error } = await supabase
    .from("purchases")
    .insert(payload)
    .select(
      `*, company_tax_entities(registered_name), purchase_categories(category_name),
      profiles:created_by(fullname), purchase_attachments(id)`,
    )
    .single()

  if (error) return { data: null, error: error.message }
  return { data: normalizePurchase(data), error: null }
}

export async function updatePurchase(
  id: string,
  form: PurchaseFormData,
  updatedBy: string,
): Promise<{ data: Purchase | null; error: string | null }> {
  const supabase = createClient()

  const payload = {
    tax_entity_id: form.tax_entity_id,
    tax_month: form.tax_month,
    tax_type: form.tax_type,
    invoice_number: form.invoice_number.trim(),
    gross_taxable: form.gross_taxable ? Number(form.gross_taxable) : null,
    total_actual_amount: Number(form.total_actual_amount),
    category_id: form.category_id || null,
    currency_code: form.currency_code || "AED",
    notes: form.notes.trim() || null,
    updated_by: updatedBy,
  }

  const { data, error } = await supabase
    .from("purchases")
    .update(payload)
    .eq("id", id)
    .select(
      `*, company_tax_entities(registered_name), purchase_categories(category_name),
      profiles:created_by(fullname), purchase_attachments(id)`,
    )
    .single()

  if (error) return { data: null, error: error.message }
  return { data: normalizePurchase(data), error: null }
}

export async function softDeletePurchase(
  id: string,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("purchases")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)

  return { error: error ? error.message : null }
}

// ─── Attachments ──────────────────────────────────────────────────────────────

export async function fetchAttachments(
  purchaseId: string,
): Promise<{ data: PurchaseAttachment[] | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("purchase_attachments")
    .select("*, profiles:uploaded_by(fullname)")
    .eq("purchase_id", purchaseId)
    .order("uploaded_at", { ascending: false })

  if (error) return { data: null, error: error.message }
  return { data: (data ?? []).map(normalizeAttachment), error: null }
}

export async function insertAttachment(attachment: {
  purchase_id: string
  file_name: string
  file_url: string
  file_type: string | null
  uploaded_by: string
}): Promise<{ data: PurchaseAttachment | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("purchase_attachments")
    .insert(attachment)
    .select("*, profiles:uploaded_by(fullname)")
    .single()

  if (error) return { data: null, error: error.message }
  return { data: normalizeAttachment(data), error: null }
}

export async function deleteAttachment(
  id: string,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("purchase_attachments")
    .delete()
    .eq("id", id)

  return { error: error ? error.message : null }
}
