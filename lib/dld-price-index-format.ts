import type { DldPriceIndexPoint, DldPriceIndexSeries } from "@/lib/dld-open-data"

/**
 * Formatting and aggregation for the DLD Property Price Index, so the server-rendered
 * latest-readings table on /open-data and the chart speak one vocabulary. Pure; type-only
 * imports, safe anywhere.
 */

/** "2025.4" → "Q4 2025"; an annual label ("2025") is returned as is. */
export const periodLabel = (x: string): string => x.replace(/^(\d{4})\.(\d)$/, "Q$2 $1")

/** "+5.2%" / "-1.0%" / "—" — the values are already percentages. */
export function signedPct(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`
}

export type LatestReading = {
  subCategory: string
  /** The newest quarterly point with a value. */
  quarter: DldPriceIndexPoint | null
  /** The newest annual point with a value. */
  annual: DldPriceIndexPoint | null
}

export type CategoryReadings = { category: string; rows: LatestReading[] }

// "2025.4" and "2025" both sort correctly as numbers (quarters are 1–4).
const byPeriod = (a: DldPriceIndexPoint, b: DldPriceIndexPoint) => Number(a.x) - Number(b.x)

function newestWithValue(series: DldPriceIndexSeries | undefined): DldPriceIndexPoint | null {
  const points = (series?.points ?? []).filter((p) => p.actual !== null).sort(byPeriod)
  return points.length > 0 ? points[points.length - 1] : null
}

/**
 * The latest published reading for every sub-index, grouped by category in the order the gateway
 * lists them. A sub-index with neither a quarterly nor an annual value is dropped.
 */
export function latestReadings(series: DldPriceIndexSeries[] | null): CategoryReadings[] {
  if (!series) return []
  const categories = new Map<string, CategoryReadings>()
  const order: string[] = []
  const seen = new Set<string>()
  for (const s of series) {
    const key = `${s.categoryCode}|${s.subCategoryCode}`
    if (seen.has(key)) continue
    seen.add(key)
    const quarter = newestWithValue(series.find((x) => x.categoryCode === s.categoryCode && x.subCategoryCode === s.subCategoryCode && x.period === "Quarterly"))
    const annual = newestWithValue(series.find((x) => x.categoryCode === s.categoryCode && x.subCategoryCode === s.subCategoryCode && x.period === "Annual"))
    if (!quarter && !annual) continue
    if (!categories.has(s.categoryCode)) {
      categories.set(s.categoryCode, { category: s.category, rows: [] })
      order.push(s.categoryCode)
    }
    categories.get(s.categoryCode)?.rows.push({ subCategory: s.subCategory, quarter, annual })
  }
  return order.map((code) => categories.get(code) as CategoryReadings)
}

/** The newest quarter any sub-index has a value for, as "Q4 2025" (null when there is none). */
export function latestQuarterLabel(series: DldPriceIndexSeries[] | null): string | null {
  let newest: DldPriceIndexPoint | null = null
  for (const s of series ?? []) {
    if (s.period !== "Quarterly") continue
    const point = newestWithValue(s)
    if (point && (!newest || byPeriod(point, newest) > 0)) newest = point
  }
  return newest ? periodLabel(newest.x) : null
}
