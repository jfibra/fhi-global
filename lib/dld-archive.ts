import "server-only"
import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { DldRow } from "@/lib/dld-open-data"

/**
 * Maps raw Dubai Land Department gateway rows onto the archive tables from
 * migration 065, and writes them.
 *
 * Deliberately NOT modelled on lib/dld-cache.ts. That cache is best-effort and
 * swallows every error, because a miss just means re-asking the gateway. The
 * archive is the opposite: the gateway only serves the current calendar year,
 * so a row dropped here is lost for good. Every failure throws.
 */

/** Paging artifacts the gateway adds to each row — never worth storing. */
const STRIP_KEYS = new Set(["RN", "TOTAL", "DEFAULT_SORT"])

/** Supabase rejects very large payloads; 500 rows keeps a request well inside. */
export const UPSERT_BATCH = 500

/** Case- and whitespace-insensitive join key. The open data mixes
 *  'Madinat Al Mataar' with 'JUMEIRAH VILLAGE CIRCLE'. */
export function normalizeKey(value: unknown): string | null {
  if (typeof value !== "string") return null
  const key = value.trim().toLowerCase().replace(/\s+/g, " ")
  return key || null
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function text(value: unknown): string | null {
  if (typeof value === "number") return String(value)
  if (typeof value !== "string") return null
  const t = value.trim()
  return t || null
}

function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string" && value.trim()) {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function bool(value: unknown): boolean | null {
  if (value === 1 || value === "1") return true
  if (value === 0 || value === "0") return false
  return null
}

/** Gateway dates arrive as 'YYYY-MM-DDTHH:mm:ss' or 'YYYY-MM-DD'. */
function date(value: unknown): string | null {
  const t = text(value)
  if (!t) return null
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(t)
  return m ? m[1] : null
}

/**
 * Timestamp stored exactly as the gateway gives it. The gateway states no
 * timezone, and its date filters do not line up precisely with INSTANCE_DATE
 * (a 09/01–09/02 query returns rows stamped 2026-08-31T15:16), so no offset is
 * invented here — `raw` keeps the original string, and the ingest window
 * overlaps by a week rather than trusting the boundary.
 */
function timestamp(value: unknown): string | null {
  return text(value)
}

export function stripArtifacts(row: DldRow): DldRow {
  const out: DldRow = {}
  for (const [k, v] of Object.entries(row)) {
    if (!STRIP_KEYS.has(k)) out[k] = v
  }
  return out
}

/**
 * Primary key for a transaction. TRANSACTION_NUMBER alone is not unique — a
 * 1,000-row sample held only 997 distinct values, because one transaction can
 * span several properties or parties. Hashing keeps those sibling rows
 * distinct while making a re-ingest of the same window an exact no-op.
 *
 * The hash covers EVERY field except the paging artifacts, rather than a
 * hand-picked subset. An earlier version listed the fields it thought
 * identifying and lost rows to the one it had not thought of: transaction
 * 43-187-2026 is six separate parking bays, identical in every listed field
 * and differing only in PARKING, so four of the six vanished. Hashing the
 * whole row removes the judgement call — any genuine difference yields a
 * different key, and only byte-identical rows collapse.
 *
 * Keys are sorted so the digest does not depend on property order. If the
 * gateway ever adds a column, existing rows re-key and re-insert; that is the
 * intended behaviour, since a schema change warrants a re-archive.
 */
export function transactionHash(row: DldRow): string {
  const clean = stripArtifacts(row)
  const canonical = Object.keys(clean)
    .sort()
    .map((k) => `${k}=${clean[k] ?? ""}`)
    .join("|")
  return createHash("sha256").update(canonical).digest("hex")
}

export interface ArchiveRow {
  [column: string]: string | number | boolean | null | DldRow
}

export function mapTransaction(row: DldRow): ArchiveRow | null {
  const transactionNumber = text(row.TRANSACTION_NUMBER)
  const instanceDate = timestamp(row.INSTANCE_DATE)
  // Both are NOT NULL in the schema; a row missing either is malformed.
  if (!transactionNumber || !instanceDate) return null

  const areaName = text(row.AREA_EN)
  const clean = stripArtifacts(row)
  return {
    row_hash: transactionHash(row),
    transaction_number: transactionNumber,
    instance_date: instanceDate,
    area_name: areaName,
    area_key: normalizeKey(areaName),
    trans_value: num(row.TRANS_VALUE),
    actual_area: num(row.ACTUAL_AREA),
    procedure_area: num(row.PROCEDURE_AREA),
    group_en: text(row.GROUP_EN),
    procedure_en: text(row.PROCEDURE_EN),
    usage_en: text(row.USAGE_EN),
    prop_type_en: text(row.PROP_TYPE_EN),
    prop_sb_type_en: text(row.PROP_SB_TYPE_EN),
    rooms_en: text(row.ROOMS_EN),
    is_offplan: bool(row.IS_OFFPLAN),
    is_free_hold: bool(row.IS_FREE_HOLD),
    project_en: text(row.PROJECT_EN),
    master_project_en: text(row.MASTER_PROJECT_EN),
    nearest_metro_en: text(row.NEAREST_METRO_EN),
    nearest_mall_en: text(row.NEAREST_MALL_EN),
    nearest_landmark_en: text(row.NEAREST_LANDMARK_EN),
    raw: clean,
  }
}

export function mapProject(row: DldRow): ArchiveRow | null {
  const projectNumber = text(row.PROJECT_NUMBER)
  if (!projectNumber) return null

  const areaName = text(row.AREA_EN)
  return {
    project_number: projectNumber,
    project_en: text(row.PROJECT_EN),
    developer_number: text(row.DEVELOPER_NUMBER),
    developer_en: text(row.DEVELOPER_EN),
    project_status: text(row.PROJECT_STATUS),
    prj_type_en: text(row.PRJ_TYPE_EN),
    start_date: date(row.START_DATE),
    end_date: date(row.END_DATE),
    completion_date: date(row.COMPLETION_DATE),
    percent_completed: num(row.PERCENT_COMPLETED),
    project_value: num(row.PROJECT_VALUE),
    escrow_account_number: text(row.ESCROW_ACCOUNT_NUMBER),
    area_name: areaName,
    area_key: normalizeKey(areaName),
    master_project_en: text(row.MASTER_PROJECT_EN),
    cnt_unit: num(row.CNT_UNIT),
    cnt_building: num(row.CNT_BUILDING),
    cnt_villa: num(row.CNT_VILLA),
    raw: stripArtifacts(row),
  }
}

export function mapDeveloper(row: DldRow): ArchiveRow | null {
  const developerNumber = text(row.DEVELOPER_NUMBER)
  if (!developerNumber) return null

  const name = text(row.DEVELOPER_EN)
  return {
    developer_number: developerNumber,
    developer_en: name,
    developer_key: normalizeKey(name),
    registration_date: date(row.REGISTRATION_DATE),
    license_number: text(row.LICENSE_NUMBER),
    license_source_en: text(row.LICENSE_SOURCE_EN),
    license_type_en: text(row.LICENSE_TYPE_EN),
    license_issue_date: date(row.LICENSE_ISSUE_DATE),
    license_expiry_date: date(row.LICENSE_EXPIRY_DATE),
    legal_status_en: text(row.LEGAL_STATUS_EN),
    chamber_of_commerce_no: text(row.CHAMBER_OF_COMMERCE_NO),
    phone: text(row.PHONE),
    fax: text(row.FAX),
    webpage: text(row.WEBPAGE),
    raw: stripArtifacts(row),
  }
}

/** carea-lookup rows are `{ AREA_ID, NAME_EN }`, not a dataset row shape. */
export function mapArea(row: DldRow): ArchiveRow | null {
  const areaId = text(row.AREA_ID)
  const nameEn = text(row.NAME_EN)
  if (!areaId || !nameEn) return null

  const nameKey = normalizeKey(nameEn)
  const slug = slugify(nameEn)
  if (!nameKey || !slug) return null

  return { area_id: areaId, name_en: nameEn, name_key: nameKey, slug, synced_at: new Date().toISOString() }
}

/**
 * Upsert in batches. Throws on the first failed batch — see the note at the
 * top of this file on why this does not swallow errors.
 *
 * Rows are de-duplicated on the conflict target first: Postgres rejects an
 * INSERT ... ON CONFLICT that hits the same key twice in one statement
 * ("cannot affect row a second time"), and the gateway does return repeat
 * rows across overlapping windows.
 */
export async function upsertRows(
  supabase: SupabaseClient,
  table: string,
  rows: ArchiveRow[],
  onConflict: string,
): Promise<number> {
  if (rows.length === 0) return 0

  const seen = new Map<string, ArchiveRow>()
  for (const row of rows) {
    const key = String(row[onConflict] ?? "")
    if (key) seen.set(key, row)
  }
  const unique = [...seen.values()]

  let written = 0
  for (let i = 0; i < unique.length; i += UPSERT_BATCH) {
    const batch = unique.slice(i, i + UPSERT_BATCH)
    const { error } = await supabase.from(table).upsert(batch, { onConflict })
    if (error) {
      throw new Error(`${table}: upsert failed at row ${i} of ${unique.length} — ${error.message}`)
    }
    written += batch.length
  }
  return written
}
