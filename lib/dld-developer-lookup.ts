import "server-only"
import { createAdminSupabase } from "@/lib/admin-supabase"

/**
 * Project name → developer, for the "Top developers" ranking of DLD
 * transactions (app/api/admin/dld/charts, `breakdown()` for Transactions).
 *
 * A transaction row names its project (PROJECT_EN) but never its developer,
 * so the developer is looked up through the project, in three layers:
 *
 *   1. "fhi"  — FHI's own projects + developers tables, matched by normalised
 *               project name. Brand-level names ("Imtiaz Developments"), and
 *               it covers the older projects FHI has catalogued. Checked
 *               first so a brand name wins whenever one is known.
 *   2. "dld"  — the archived DLD projects register (dld_projects, migration
 *               065): PROJECT_EN → DEVELOPER_EN. Exact, but the gateway only
 *               serves the current year's projects, so older ones are absent,
 *               and DLD's developer is the legal entity — usually a per-project
 *               SPV ("IMTIAZ JA REAL ESTATE DEVELOPMENT L.L.C"). When exactly
 *               one developer in FHI's catalogue shares the SPV's leading word,
 *               the SPV is rolled up to that brand for display (the match is
 *               still the register's; only the name is normalised).
 *   3. "name" — the project's leading word matches the leading word of a
 *               developer that IS known (register or catalogue): "Binghatti
 *               Skyflame 1" → "Binghatti Developers". Shown with a "(by
 *               name)" suffix so it is never mistaken for a register match.
 *               A leading word that matches no known developer is NOT a
 *               guess — "Verdana", "Sky", "Boulevard" are project names, not
 *               developers — so the row is "unmatched" instead.
 *
 * No project name at all → "Unknown". A project name nobody recognises →
 * "Unmatched project" (its name is kept so the page can list which projects
 * need adding to the catalogue). The lookup is built once per server
 * instance and refreshed every LOOKUP_TTL_MS; it is a few hundred rows.
 */

export type DeveloperSource = "dld" | "fhi" | "name" | "unmatched" | "unknown"
export type DeveloperMatch = { developer: string; source: DeveloperSource; /** The row's project name, when it had one. */ project: string | null }

const LOOKUP_TTL_MS = 10 * 60 * 1000
export const UNKNOWN_DEVELOPER = "Unknown"
export const UNMATCHED_DEVELOPER = "Unmatched project"

type Lookup = {
  /** normalised project name → developer (fhi first, dld fills gaps) */
  byProject: Map<string, { developer: string; source: "dld" | "fhi" }>
  /** lower-cased first word of a known developer name → that developer name */
  byFirstWord: Map<string, string>
  at: number
}

let cached: Lookup | null = null
let inflight: Promise<Lookup> | null = null

export function normalizeName(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function firstWord(v: string): string {
  const w = normalizeName(v).split(" ")[0] ?? ""
  // Skip articles and single letters — "The Residences", "Al Habtoor" would
  // otherwise all collapse onto "the" / "al".
  return w.length >= 3 && !["the", "al", "one", "new"].includes(w) ? w : ""
}

async function build(): Promise<Lookup> {
  const byProject: Lookup["byProject"] = new Map()
  const byFirstWord: Lookup["byFirstWord"] = new Map()
  const supabase = createAdminSupabase()

  // Layer 1 — FHI catalogue (brand-level developer names).
  // brandByFirstWord: leading word → brand, only when ONE brand owns that
  // word; "dubai" shared by Dubai Properties and Dubai Holding stays unmapped.
  const brandByFirstWord = new Map<string, string | null>()
  try {
    const [{ data: devs }, { data: projects }] = await Promise.all([
      supabase.from("developers").select("id, name").limit(5_000),
      supabase.from("projects").select("name, developer_id").limit(20_000),
    ])
    const devName = new Map<string, string>()
    for (const d of (devs ?? []) as Array<{ id: string; name: string | null }>) {
      const n = d.name?.trim()
      if (!n) continue
      devName.set(String(d.id), n)
      const fw = firstWord(n)
      if (!fw) continue
      byFirstWord.set(fw, n)
      brandByFirstWord.set(fw, brandByFirstWord.has(fw) && brandByFirstWord.get(fw) !== n ? null : n)
    }
    for (const p of (projects ?? []) as Array<{ name: string | null; developer_id: string | null }>) {
      const key = normalizeName(p.name)
      const dev = p.developer_id ? devName.get(String(p.developer_id)) : undefined
      if (!key || !dev) continue
      if (!byProject.has(key)) byProject.set(key, { developer: dev, source: "fhi" })
    }
  } catch {
    /* catalogue unavailable — the register still works */
  }

  // Layer 2 — DLD register, for projects the catalogue doesn't have.
  try {
    const { data } = await supabase.from("dld_projects").select("project_en, developer_en").limit(20_000)
    for (const r of (data ?? []) as Array<{ project_en: string | null; developer_en: string | null }>) {
      const key = normalizeName(r.project_en)
      const legal = r.developer_en?.trim()
      if (!key || !legal) continue
      // SPV → brand when the catalogue has exactly one brand with that leading word.
      const brand = brandByFirstWord.get(firstWord(legal))
      const dev = brand ?? legal
      if (!byProject.has(key)) byProject.set(key, { developer: dev, source: "dld" })
      const fw = firstWord(dev)
      if (fw && !byFirstWord.has(fw)) byFirstWord.set(fw, dev)
    }
  } catch {
    /* archive unavailable — fall through */
  }

  return { byProject, byFirstWord, at: Date.now() }
}

export async function getDeveloperLookup(): Promise<Lookup> {
  if (cached && Date.now() - cached.at < LOOKUP_TTL_MS) return cached
  if (!inflight) {
    inflight = build()
      .then((l) => {
        cached = l
        return l
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

export function resolveDeveloper(lookup: Lookup, projectName: unknown): DeveloperMatch {
  const raw = String(projectName ?? "").trim()
  if (!raw) return { developer: UNKNOWN_DEVELOPER, source: "unknown", project: null }
  const hit = lookup.byProject.get(normalizeName(raw))
  if (hit) return { ...hit, project: raw }
  const known = lookup.byFirstWord.get(firstWord(raw))
  if (known) return { developer: `${known} (by name)`, source: "name", project: raw }
  return { developer: UNMATCHED_DEVELOPER, source: "unmatched", project: raw }
}
