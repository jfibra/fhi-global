import { fetchPropertyTypesForBuyFilters } from "@/lib/buy/property-types"
import { BuyFiltersBar } from "@/components/buy/buy-filters-bar"

export async function BuyFiltersLoader() {
  const propertyTypes = await fetchPropertyTypesForBuyFilters()
  return <BuyFiltersBar propertyTypes={propertyTypes} />
}
