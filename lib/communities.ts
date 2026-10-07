/**
 * Render-time tidy-up for `projects.community`, which is free text typed by hand: "Al Jadaf" for
 * Al Jaddaf, "Jumeirah Village Circle (JVC)" beside "Jumeirah Village Circle", "Dubai Investment
 * Park (DIP)", a stray "MIna Rashid", a trailing ", Dubai". The stored value is untouched — this
 * only changes what titles, descriptions, cards and the related-searches linker print and match on,
 * so the same place reads, links and groups as one place. Unknown values pass through unchanged.
 *
 * Pure and client-safe. Extend COMMUNITY_ALIASES from a read-only
 * `select community, count(*) from projects group by 1` when new spellings show up.
 */

export const COMMUNITY_ALIASES: Record<string, string> = {
  "al jadaf": "Al Jaddaf",
  "dubai investment park": "Dubai Investments Park",
  "dubai investment park dip": "Dubai Investments Park",
  "dubailand residence complex": "Dubai Land Residence Complex",
  "dubailand residential complex": "Dubai Land Residence Complex",
  "studio city": "Dubai Studio City",
  "dubai international city": "International City",
  "international city phase 3 (warsan 4)": "International City Phase 3",
  "mina rashid yachts & marina": "Mina Rashid",
  "dubai south - azizi venice": "Dubai South",
}

export function normalizeCommunity(raw: string | null | undefined): string | null {
  let value = (raw ?? "").replace(/\s+/g, " ").trim()
  if (!value) return null
  // "Business Bay, Dubai" → "Business Bay": the city is shown separately.
  value = value.replace(/,\s*dubai$/i, "")
  // A trailing all-caps abbreviation in brackets — "(JVC)", "(JVT)" — duplicates the name before it;
  // longer or mixed-case brackets ("(Warsan 4)") carry information and stay.
  value = value.replace(/\s*\(([A-Z]{2,5})\)$/, "")
  // A double-capital typo: "MIna" → "Mina".
  value = value.replace(/\b([A-Z])([A-Z])([a-z]{2,})\b/g, (_m, a: string, b: string, rest: string) => `${a}${b.toLowerCase()}${rest}`)
  return COMMUNITY_ALIASES[value.toLowerCase()] ?? value
}
