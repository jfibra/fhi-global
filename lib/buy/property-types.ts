import { unstable_cache } from "next/cache"
import { createPublicSupabaseClient } from "@/lib/supabase/public"

export type BuyPropertyTypeOption = { id: number; name: string }

// The filter bar's property types change a few times a year, so they are cached for an hour. The failure
// is thrown INSIDE the cache function (a failed read is never stored), and the wrapper below turns it into
// an empty list, which the filter bar replaces with its built-in fallback.
const getPropertyTypesCached = unstable_cache(
  async (): Promise<BuyPropertyTypeOption[]> => {
    const supabase = createPublicSupabaseClient()
    const { data, error } = await supabase.from("property_types").select("id, name").order("name")
    if (error) throw new Error("[listings] property-types fetch failed")
    return (data ?? []).map((r) => ({
      id: typeof r.id === "number" ? r.id : Number(r.id),
      name: String(r.name ?? ""),
    }))
  },
  ["buy-property-types-v1"],
  { revalidate: 3600, tags: ["property-types"] },
)

/** Property types for the buy/rent filter dropdown (public read, cached for an hour). */
export async function fetchPropertyTypesForBuyFilters(): Promise<BuyPropertyTypeOption[]> {
  return getPropertyTypesCached().catch(() => [])
}
