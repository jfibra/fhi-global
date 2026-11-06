// Turns a sale's activity log (sales_activity_logs) into plain words for the
// admin's Activity History: what happened, what changed from what to what.
// The log stores raw values — ids, ISO dates, status keys, and before
// 2026-11-06 a whole-row dump on every save — so this picks out the fields
// that really changed and spells them the way the rest of the report does.
// Pure: names for developer / project / unit ids are looked up by the caller.

import type { SaleActivityLog } from "@/lib/sales-rules"

export type ActivityKind = "created" | "edited" | "client" | "partners" | "status" | "commission" | "file" | "leader" | "other"

/** The history's filter chips. */
export type ActivityFilter = "all" | "edits" | "status" | "files"

export const ACTIVITY_FILTERS: Array<{ key: ActivityFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "edits", label: "Edits" },
  { key: "status", label: "Status" },
  { key: "files", label: "Files" },
]

export function activityKind(action: string): ActivityKind {
  switch (action) {
    case "sale_created": return "created"
    case "sale_updated": return "edited"
    case "client_information_updated": return "client"
    case "partners_updated": return "partners"
    case "validation_status_changed": return "status"
    case "commission_status_changed": return "commission"
    case "attachment_uploaded":
    case "attachment_deleted": return "file"
    case "leader_confirmed":
    case "leader_confirmation_removed": return "leader"
    default: return "other"
  }
}

export function matchesFilter(kind: ActivityKind, filter: ActivityFilter): boolean {
  if (filter === "all") return true
  if (filter === "edits") return kind === "edited" || kind === "client" || kind === "partners" || kind === "created"
  if (filter === "status") return kind === "status" || kind === "commission" || kind === "leader"
  return kind === "file"
}

export const STATUS_WORDS: Record<string, string> = {
  pending: "Pending",
  under_review: "Under Review",
  validated: "Validated",
  invalid_sale: "Invalid Sale",
  processing: "Processing",
  approved: "Approved",
  released: "Released",
  rejected: "Rejected",
}

const statusWord = (v: unknown) => STATUS_WORDS[String(v ?? "")] ?? String(v ?? "—").replace(/_/g, " ")

/** A one-line title for an entry, in plain words. */
export function activityTitle(entry: SaleActivityLog): string {
  switch (entry.action_type) {
    case "sale_created": return "Sale recorded"
    case "sale_updated": return "Sale details edited"
    case "client_information_updated": return "Client details edited"
    case "partners_updated": return "Partnership changed"
    case "attachment_uploaded": return "File uploaded"
    case "attachment_deleted": return "File removed"
    case "leader_confirmed": return "Confirmed by the team leader"
    case "leader_confirmation_removed": return "Team leader took the confirmation back"
    case "commission_status_changed": return `Commission set to ${statusWord(entry.new_value)}`
    case "validation_status_changed": {
      const next = String(entry.new_value ?? "")
      if (next === "validated") return "Validated"
      if (next === "invalid_sale") return "Marked Invalid Sale"
      if (next === "under_review") return "Moved to Under Review"
      if (next === "pending") return "Back to Pending"
      return `Validation set to ${statusWord(next)}`
    }
    default: return entry.action_type.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  }
}

// ─── Field changes ────────────────────────────────────────────────────────────

export type NameLookup = {
  developers: Record<string, string>
  projects: Record<string, string>
  units: Record<string, string>
}

export const EMPTY_NAMES: NameLookup = { developers: {}, projects: {}, units: {} }

const FIELD_LABELS: Record<string, string> = {
  sale_type: "Sale type",
  developer_id: "Developer",
  project_id: "Project",
  project_unit_id: "Unit type",
  unit_number: "Unit number",
  block_number: "Block",
  lot_number: "Lot",
  property_type: "Property type",
  property_address: "Property address",
  contract_price: "Contract price",
  reservation_date: "Reservation date",
  payment_plan: "Payment plan",
  payment_terms: "Payment terms",
  price_per_sqft: "Price per sq ft",
  total_area_sqft: "Area",
  remarks: "Remarks",
  commission_status: "Commission",
  validation_status: "Validation",
  first_name: "First name",
  middle_name: "Middle name",
  last_name: "Last name",
  email: "Email",
  phone: "Phone",
  age: "Age",
  gender: "Gender",
  occupation: "Occupation",
  street: "Street",
  city: "City",
  state_province: "State / province",
  country: "Country",
}

/** Bookkeeping columns old entries carry; never a change anyone made. */
const SKIP_KEYS = new Set(["updated_by", "updated_at", "created_by", "partners"])

const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "")

function same(a: unknown, b: unknown): boolean {
  if (isBlank(a) || isBlank(b)) return isBlank(a) && isBlank(b)
  if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b)
  return String(a).trim() === String(b).trim()
}

const money = (v: unknown) =>
  `${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`

function day(v: unknown): string {
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

/** One value, the way the report would show it. */
export function formatFieldValue(key: string, value: unknown, names: NameLookup = EMPTY_NAMES): string {
  if (isBlank(value)) return "—"
  switch (key) {
    case "contract_price":
    case "price_per_sqft":
      return money(value)
    case "total_area_sqft":
      return `${Number(value).toLocaleString("en-US")} sq ft`
    case "reservation_date":
      return day(value)
    case "developer_id":
      return names.developers[String(value)] ?? "another developer"
    case "project_id":
      return names.projects[String(value)] ?? `project #${value}`
    case "project_unit_id":
      return names.units[String(value)] ?? `unit type #${value}`
    case "commission_status":
    case "validation_status":
      return statusWord(value)
    case "sale_type":
      return value === "project" ? "Project sale" : value === "brokerage" ? "Brokerage sale" : value === "rental" ? "Rental" : String(value)
    default:
      return String(value)
  }
}

export type FieldChange = { key: string; label: string; before: string; after: string }

const asObject = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null

/**
 * The fields that really changed in an edit entry. Only keys present on both
 * sides count: an old entry's "after" carried columns its "before" never had
 * (sale_type, the property fields), which would otherwise all read as changes.
 */
export function fieldChanges(entry: SaleActivityLog, names: NameLookup): FieldChange[] {
  const before = asObject(entry.old_value)
  const after = asObject(entry.new_value)
  if (!before || !after) return []
  const out: FieldChange[] = []
  for (const key of Object.keys(after)) {
    if (SKIP_KEYS.has(key) || !(key in before)) continue
    if (same(before[key], after[key])) continue
    out.push({
      key,
      label: FIELD_LABELS[key] ?? key.replace(/_/g, " "),
      before: formatFieldValue(key, before[key], names),
      after: formatFieldValue(key, after[key], names),
    })
  }
  return out
}

/** The few facts worth showing for a newly recorded sale. */
export function createdSummary(entry: SaleActivityLog, names: NameLookup): Array<{ label: string; value: string }> {
  const v = asObject(entry.new_value)
  if (!v) return []
  const rows: Array<{ label: string; value: string }> = []
  for (const key of ["project_id", "unit_number", "contract_price", "validation_status"]) {
    if (!isBlank(v[key])) rows.push({ label: FIELD_LABELS[key] ?? key, value: formatFieldValue(key, v[key], names) })
  }
  const partners = partnerRows(v.partners)
  if (partners.length) rows.push({ label: "Shared with", value: partners.map((p) => `${p.name} ${p.share}%`).join(", ") })
  return rows
}

export type PartnerRow = { id: string; name: string; role: string; share: number }

/** A partners snapshot (migration 055's shape) as rows; [] for a solo sale. */
export function partnerRows(raw: unknown): PartnerRow[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    const r = asObject(item)
    if (!r) return []
    return [{
      id: String(r.agent_id ?? ""),
      name: String(r.name ?? "Agent").replace(/\s+/g, " ").trim(),
      role: r.role === "lead" ? "Lead Agent" : "Co-Agent",
      share: Number(r.share ?? 0),
    }]
  })
}

/** The file an attachment entry is about. */
export function activityFile(entry: SaleActivityLog): { name: string; url: string | null; type: string | null; isA2A: boolean } | null {
  const v = asObject(entry.new_value) ?? asObject(entry.old_value)
  if (!v) return null
  return {
    name: String(v.file_name ?? "File"),
    url: typeof v.file_url === "string" ? v.file_url : null,
    type: typeof v.file_type === "string" ? v.file_type : null,
    isA2A: v.category === "partnership_agreement",
  }
}

/** Ids the entries mention, so the caller can look their names up in one query each. */
export function idsToResolve(logs: SaleActivityLog[]): { developers: string[]; projects: number[]; units: number[] } {
  const developers = new Set<string>()
  const projects = new Set<number>()
  const units = new Set<number>()
  for (const entry of logs) {
    for (const side of [entry.old_value, entry.new_value]) {
      const v = asObject(side)
      if (!v) continue
      if (typeof v.developer_id === "string" && v.developer_id) developers.add(v.developer_id)
      if (v.project_id != null && Number.isFinite(Number(v.project_id))) projects.add(Number(v.project_id))
      if (v.project_unit_id != null && Number.isFinite(Number(v.project_unit_id))) units.add(Number(v.project_unit_id))
    }
  }
  return { developers: [...developers], projects: [...projects], units: [...units] }
}

/** "5 minutes ago", "3 days ago", "just now". */
export function timeAgo(iso: string, now = Date.now()): string {
  const ms = now - new Date(iso).getTime()
  if (!Number.isFinite(ms)) return ""
  const min = Math.round(ms / 60_000)
  if (min < 1) return "just now"
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`
  const d = Math.round(h / 24)
  if (d < 31) return `${d} day${d === 1 ? "" : "s"} ago`
  const mo = Math.round(d / 30)
  if (mo < 12) return `${mo} month${mo === 1 ? "" : "s"} ago`
  const y = Math.round(d / 365)
  return `${y} year${y === 1 ? "" : "s"} ago`
}

/** "Today", "Yesterday", or "Mon, Oct 3, 2026" — the history's day headers. */
export function dayHeading(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  const key = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`
  if (key(d) === key(now)) return "Today"
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (key(d) === key(yesterday)) return "Yesterday"
  return d.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })
}
