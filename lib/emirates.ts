/**
 * The seven emirates and how the free-text `projects.city` column maps onto
 * them. The column holds a typo of Ras Al Khaimah and a couple of Dubai
 * districts, so a city string is matched by substring rather than equality.
 * Shared by the homepage counters and the UAE map.
 */

export type Emirate = {
  /** ISO 3166-2 suffix: AE-DU → "DU". Matches lib/uae-emirates.ts. */
  code: string
  name: string
  /** Lower-case substrings of a city value that mean this emirate. */
  keys: string[]
  /** Exact `projects.city` value used by /projects?city= for this emirate. */
  cityParam: string
}

export const EMIRATES: Emirate[] = [
  { code: "AZ", name: "Abu Dhabi", keys: ["abu dhabi"], cityParam: "Abu Dhabi" },
  { code: "DU", name: "Dubai", keys: ["dubai"], cityParam: "Dubai" },
  { code: "SH", name: "Sharjah", keys: ["sharjah"], cityParam: "Sharjah" },
  { code: "AJ", name: "Ajman", keys: ["ajman"], cityParam: "Ajman" },
  { code: "UQ", name: "Umm Al Quwain", keys: ["umm al quwain", "umm al qaiwain"], cityParam: "Umm Al Quwain" },
  { code: "RK", name: "Ras Al Khaimah", keys: ["ras al khaimah", "ras al kaimah", "rak"], cityParam: "Ras Al Khaimah" },
  { code: "FU", name: "Fujairah", keys: ["fujairah"], cityParam: "Fujairah" },
]

/** Emirate code for a free-text city value, or null when it names none. */
export function emirateCodeForCity(city: string | null | undefined): string | null {
  const c = (city ?? "").toLowerCase()
  if (!c) return null
  const hit = EMIRATES.find((e) => e.keys.some((k) => c.includes(k)))
  return hit ? hit.code : null
}

/** Count rows per emirate code. Rows whose city matches no emirate are skipped. */
export function countByEmirate(rows: { city: string | null }[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const r of rows) {
    const code = emirateCodeForCity(r.city)
    if (code) counts[code] = (counts[code] ?? 0) + 1
  }
  return counts
}
