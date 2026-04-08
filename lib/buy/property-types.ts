import { createPublicSupabaseClient } from "@/lib/supabase/public"

export type BuyPropertyTypeOption = { id: number; name: string }

/** Property types for the buy filter dropdown (public read). */
export async function fetchPropertyTypesForBuyFilters(): Promise<BuyPropertyTypeOption[]> {
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase.from("property_types").select("id, name").order("name")
  if (error || !data?.length) return []
  return data.map((r) => ({
    id: typeof r.id === "number" ? r.id : Number(r.id),
    name: String(r.name ?? ""),
  }))
}
