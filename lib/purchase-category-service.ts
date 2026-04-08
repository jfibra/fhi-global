import { createClient } from "@/lib/supabase/client"

// ─── Types ────────────────────────────────────────────────────────────────────

export type CategoryType = "default" | "custom"

export type PurchaseCategory = {
  id: string
  category_name: string
  category_type: CategoryType
  created_by: string | null
  created_at: string
  is_active: boolean
  profiles: { fullname: string | null } | null
}

export type PurchaseCategoryFormData = {
  category_name: string
  category_type: CategoryType
  is_active: boolean
}

export type PurchaseCategoriesListResponse = {
  data: PurchaseCategory[] | null
  total: number | null
  error: string | null
}

type SortField = "category_name" | "created_at"
type SortDir = "asc" | "desc"

// ─── Normalizer ───────────────────────────────────────────────────────────────

function normalizeCategory(row: unknown): PurchaseCategory {
  const raw = row as Record<string, unknown>
  const relation = raw.profiles as
    | { fullname?: string | null }
    | Array<{ fullname?: string | null }>
    | null

  const profile = Array.isArray(relation) ? (relation[0] ?? null) : relation

  return {
    id: String(raw.id ?? ""),
    category_name: String(raw.category_name ?? ""),
    category_type: raw.category_type === "custom" ? "custom" : "default",
    created_by: typeof raw.created_by === "string" ? raw.created_by : null,
    created_at: String(raw.created_at ?? ""),
    is_active: raw.is_active !== false,
    profiles: profile ? { fullname: profile.fullname ?? null } : null,
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function fetchPurchaseCategories(params: {
  page: number
  perPage: number
  search?: string
  categoryType?: CategoryType
  status?: boolean
  sortField: SortField
  sortDir: SortDir
}): Promise<PurchaseCategoriesListResponse> {
  const supabase = createClient()
  const { page, perPage, search, categoryType, status, sortField, sortDir } = params

  const from = (page - 1) * perPage
  const to = from + perPage - 1

  let query = supabase
    .from("purchase_categories")
    .select("*, profiles:created_by(fullname)", { count: "exact" })

  if (search) {
    query = query.ilike("category_name", `%${search}%`)
  }

  if (categoryType) {
    query = query.eq("category_type", categoryType)
  }

  if (status !== undefined) {
    query = query.eq("is_active", status)
  }

  query = query.order(sortField, { ascending: sortDir === "asc" }).range(from, to)

  const { data, count, error } = await query

  if (error) return { data: null, total: null, error: error.message }

  return {
    data: (data ?? []).map(normalizeCategory),
    total: count ?? 0,
    error: null,
  }
}

export async function createPurchaseCategory(
  form: PurchaseCategoryFormData,
  createdBy: string,
): Promise<{ data: PurchaseCategory | null; error: string | null }> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("purchase_categories")
    .insert({
      category_name: form.category_name.trim(),
      category_type: form.category_type,
      is_active: form.is_active,
      created_by: createdBy,
    })
    .select("*, profiles:created_by(fullname)")
    .single()

  if (error) return { data: null, error: error.message }
  return { data: normalizeCategory(data), error: null }
}

export async function updatePurchaseCategory(
  id: string,
  form: Pick<PurchaseCategoryFormData, "category_name" | "is_active">,
): Promise<{ data: PurchaseCategory | null; error: string | null }> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("purchase_categories")
    .update({
      category_name: form.category_name.trim(),
      is_active: form.is_active,
    })
    .eq("id", id)
    .select("*, profiles:created_by(fullname)")
    .single()

  if (error) return { data: null, error: error.message }
  return { data: normalizeCategory(data), error: null }
}

export async function togglePurchaseCategoryActive(
  id: string,
  currentActive: boolean,
): Promise<{ error: string | null }> {
  const supabase = createClient()

  const { error } = await supabase
    .from("purchase_categories")
    .update({ is_active: !currentActive })
    .eq("id", id)

  if (error) return { error: error.message }
  return { error: null }
}

export async function deletePurchaseCategory(
  id: string,
): Promise<{ error: string | null }> {
  const supabase = createClient()

  const { error } = await supabase
    .from("purchase_categories")
    .delete()
    .eq("id", id)

  if (error) return { error: error.message }
  return { error: null }
}
