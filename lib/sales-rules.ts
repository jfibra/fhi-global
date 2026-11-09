// Sale shapes and the rules every sale save follows — what a sale needs, how a
// partnership splits, which columns a save writes and what counts as a change.
// Pure on purpose (no Supabase client, no browser APIs): the browser service
// (lib/sales-service.ts, which re-exports all of this) and the team leader's
// server routes (app/api/team/sales) validate and build a save the same way,
// so an admin's edit and a team leader's edit can never drift apart.

// ─── Types ────────────────────────────────────────────────────────────────────

export type CommissionStatus = "pending" | "processing" | "approved" | "released" | "rejected"
export type ValidationStatus = "pending" | "under_review" | "validated" | "invalid_sale"

/** What kind of deal this is. Brokerage/rental have no developer or project. */
export type SaleType = "project" | "brokerage" | "rental"

export const SALE_TYPE_LABELS: Record<SaleType, string> = {
  project: "Project Sale",
  brokerage: "Brokerage Sale",
  rental: "Rental",
}

/** Property kinds for brokerage/rental deals (free-text friendly list). */
export const SALE_PROPERTY_TYPES = [
  "Apartment", "Villa", "Townhouse", "Penthouse", "Studio",
  "Office", "Retail", "Warehouse", "Land", "Other",
] as const

export type DeveloperOption = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  is_verified: boolean
}

export type ProjectOption = {
  id: number
  name: string
  slug: string
  developer_id: string
}

export type ProjectUnitOption = {
  id: number
  unit_type: string
  layout_name: string | null
  bedrooms: number | null
  price_from: number | null
}

export type AgentOption = {
  id: string
  fullname: string | null
}

/** An agent's part in a shared sale — the agreement's "role in the deal". */
export type SaleDealRole = "lead" | "co_agent"

export const SALE_DEAL_ROLE_LABELS: Record<SaleDealRole, string> = {
  lead: "Lead Agent",
  co_agent: "Co-Agent",
}

/**
 * One agent on a shared (partnership) sale — a snapshot of what they agreed
 * when the sale was recorded (migration 055). The recording agent is always
 * one of them. The database trigger re-validates it and overwrites `name`
 * with the profile's own, so treat it as authoritative on read.
 */
export type SalePartner = {
  agent_id: string
  name: string
  role: SaleDealRole
  /** Percent of the deal; every agent on a sale totals exactly 100. */
  share: number
  brn: string | null
}

/** Partner agents besides the recording one — three agents on a deal at most. */
export const MAX_SALE_PARTNERS = 2

/** A partner-search suggestion from /api/sales/partner-agents. */
export type PartnerAgentOption = {
  id: string
  name: string
  avatar: string | null
  role_label: string
  phone: string | null
}

/**
 * NULL (every pre-055 row) and "proof" are proof of transaction;
 * "partnership_agreement" is the signed A2A that proves a shared sale.
 */
export type SaleAttachmentCategory = "proof" | "partnership_agreement"

export type SaleAttachment = {
  id: string
  sales_report_id: string
  file_name: string
  file_url: string
  file_type: string | null
  category: SaleAttachmentCategory | null
  uploaded_by: string | null
  uploaded_at: string
  profiles: { fullname: string | null } | null
}

/** A sale owned by the current user that has no proof-of-transaction file yet. */
export type SaleMissingProof = {
  id: string
  sale_type: SaleType
  client_name: string
  location: string
  contract_price: number
  reservation_date: string | null
  validation_status: ValidationStatus
}

export type SaleRecord = {
  id: string
  agent_id: string
  sale_type: SaleType
  developer_id: string
  project_id: number
  project_unit_id: number | null
  unit_number: string | null
  block_number: string | null
  lot_number: string | null
  property_type: string | null
  property_address: string | null
  client_id: string
  contract_price: number
  reservation_date: string | null
  payment_plan: string | null
  payment_terms: string | null
  // Area / price-per-area are in SQUARE FEET (Dubai SPAs are stated in sqft).
  price_per_sqft: number | null
  total_area_sqft: number | null
  commission_status: CommissionStatus
  validation_status: ValidationStatus
  // Who last changed the validation status (migration 024). The name is a
  // snapshot taken at the moment of the change — deliberately not a join, so
  // the audit stamp survives profile renames. Null until 024 is applied or
  // until the status is first changed.
  validation_changed_by: string | null
  validation_changed_by_name: string | null
  validation_changed_at: string | null
  // Last change to the sale's details, client or partners (migration 084), by
  // an admin or the team leader — a snapshot like the validation stamp. Status
  // changes don't count: they have their own stamp above.
  edited_at: string | null
  edited_by: string | null
  edited_by_name: string | null
  // The team leader's confirmation — a second check beside the admin's
  // validation, in either order, when the team asks for it
  // (teams.leader_confirms_sales). Null = not confirmed.
  leader_confirmed_at: string | null
  leader_confirmed_by: string | null
  leader_confirmed_by_name: string | null
  proof_of_transaction_url: string | null
  remarks: string | null
  /** Every agent on a shared sale, the owner included; [] for a solo sale. */
  partners: SalePartner[]
  /** The agents in `partners` other than agent_id — they may read the sale. */
  partner_agent_ids: string[]
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  // joined
  developers: { name: string | null } | null
  projects: { name: string | null } | null
  project_units: { unit_type: string | null } | null
  clients: {
    first_name: string
    middle_name: string | null
    last_name: string
    email: string | null
    phone: string | null
    age: number | null
    gender: string | null
    occupation: string | null
    street: string | null
    city: string | null
    state_province: string | null
    country: string | null
  } | null
  profiles: { fullname: string | null } | null
  attachments_count: number
}

export type SaleActivityLog = {
  id: string
  sales_report_id: string
  action_type: string
  field_name: string | null
  old_value: unknown
  new_value: unknown
  description: string | null
  performed_by: string | null
  performed_role: string | null
  created_at: string
  profiles: { fullname: string | null } | null
}

export type SaleValidationComment = {
  id: string
  sales_report_id: string
  parent_comment_id: string | null
  comment: string
  commented_by: string
  commenter_role: string | null
  is_admin_comment: boolean
  created_at: string
  updated_at: string
  profiles: { fullname: string | null; profile_url: string | null } | null
}

export type ClientFormData = {
  first_name: string
  middle_name: string
  last_name: string
  email: string
  phone: string
  age: string
  gender: string
  occupation: string
  street: string
  city: string
  state_province: string
  country: string
}

export type SaleFormData = {
  // deal type
  sale_type: SaleType
  // property (project sales)
  developer_id: string
  project_id: string
  project_unit_id: string
  unit_number: string
  block_number: string
  lot_number: string
  // property (brokerage / rental)
  property_type: string
  property_address: string
  // client
  client: ClientFormData
  // contract
  contract_price: string
  reservation_date: string
  payment_plan: string
  payment_terms: string
  price_per_sqft: string
  total_area_sqft: string
  remarks: string
  // workflow
  commission_status: CommissionStatus
  validation_status: ValidationStatus
}

// ─── Validation ───────────────────────────────────────────────────────────────

const REQUIRED_FIELDS: Array<{ key: string; valid: (form: SaleFormData) => boolean; message: string }> = [
  // Project sales: developer + project mandatory. Brokerage/rental skip them.
  { key: "developer_id", valid: (form) => form.sale_type !== "project" || Boolean(form.developer_id), message: "Developer is required" },
  { key: "project_id", valid: (form) => form.sale_type !== "project" || Boolean(form.project_id), message: "Project is required" },
  // Brokerage/rental: describe the property instead.
  {
    key: "property_type",
    valid: (form) => form.sale_type === "project" || Boolean(form.property_type.trim()),
    message: "Property type is required",
  },
  {
    key: "unit_information",
    valid: (form) =>
      form.sale_type === "project"
        ? [form.project_unit_id, form.unit_number, form.block_number, form.lot_number].some((v) => Boolean(String(v ?? "").trim()))
        : [form.property_address, form.unit_number, form.block_number, form.lot_number].some((v) => Boolean(String(v ?? "").trim())),
    message: "Unit / property information is required",
  },
  { key: "client.first_name", valid: (form) => Boolean(form.client.first_name.trim()), message: "Client first name is required" },
  { key: "client.last_name", valid: (form) => Boolean(form.client.last_name.trim()), message: "Client last name is required" },
  { key: "client.phone", valid: (form) => Boolean(form.client.phone.trim()), message: "Client phone is required" },
  {
    key: "client_address",
    valid: (form) => [form.client.street, form.client.city, form.client.state_province, form.client.country].some((v) => Boolean(v.trim())),
    message: "Client address is required",
  },
  {
    key: "contract_price",
    valid: (form) => Boolean(form.contract_price) && Number(form.contract_price) > 0,
    message: "Contract price must be greater than 0",
  },
  { key: "reservation_date", valid: (form) => Boolean(form.reservation_date), message: "Reservation date is required" },
  { key: "payment_plan", valid: (form) => Boolean(form.payment_plan.trim()), message: "Payment plan is required" },
  { key: "payment_terms", valid: (form) => Boolean(form.payment_terms.trim()), message: "Payment terms are required" },
]

export function validateSaleFormData(form: SaleFormData) {
  const errors: Record<string, string> = {}
  for (const field of REQUIRED_FIELDS) {
    if (!field.valid(form)) errors[field.key] = field.message
  }
  return errors
}

/** Sum of shares, rounded to cents so 33.33 + 33.33 + 33.34 reads as 100. */
export function totalPartnerShare(partners: SalePartner[]) {
  return Math.round(partners.reduce((sum, p) => sum + (Number.isFinite(p.share) ? p.share : 0), 0) * 100) / 100
}

/**
 * Rules for a shared sale's agents (the owner included). Mirrors the migration
 * 055 trigger so the agent sees the problem before submitting; the trigger is
 * still the authority.
 */
export function validateSalePartners(
  partners: SalePartner[],
  ownerId: string,
  /** Editing a recorded sale: the owner is "the agent who recorded it", not "you". */
  opts: { editing?: boolean } = {},
) {
  const errors: Record<string, string> = {}
  const others = partners.filter((p) => p.agent_id !== ownerId)
  if (others.length === 0) {
    errors.partners = opts.editing
      ? "Add the partner agent, or switch the sale back to solo"
      : "Add the partner agent you worked this sale with"
    return errors
  }
  if (others.length > MAX_SALE_PARTNERS) {
    errors.partners = `A sale can have up to ${MAX_SALE_PARTNERS} partner agents`
  }
  if (!partners.some((p) => p.agent_id === ownerId)) {
    errors.partners = opts.editing
      ? "The agent who recorded the sale must stay on it"
      : "You must be one of the agents on the sale"
  }
  if (partners.filter((p) => p.role === "lead").length !== 1) {
    errors.partner_lead = "Choose exactly one Lead Agent (the client source)"
  }
  if (partners.some((p) => !Number.isFinite(p.share) || p.share <= 0 || p.share > 100)) {
    errors.partner_share = "Every agent needs a share above 0%"
  } else {
    const total = totalPartnerShare(partners)
    if (Math.abs(total - 100) > 0.01) errors.partner_share = `Shares must total 100% — they total ${total}%`
  }
  return errors
}

/** Parse a raw sales_reports.partners value (for pages that select rows directly). */
export function normalizePartners(raw: unknown): SalePartner[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const r = item as Record<string, unknown>
    if (typeof r.agent_id !== "string" || !r.agent_id) return []
    return [{
      agent_id: r.agent_id,
      name: typeof r.name === "string" ? r.name : "",
      role: r.role === "lead" ? "lead" : "co_agent",
      share: Number(r.share ?? 0),
      brn: typeof r.brn === "string" && r.brn.trim() ? r.brn : null,
    } satisfies SalePartner]
  })
}

// ─── Select ───────────────────────────────────────────────────────────────────

/** Every column of a sale plus the joins the report and the dialogs show. */
export const SALE_SELECT = `
  *,
  developers(name),
  projects(name),
  project_units(unit_type),
  clients(first_name,middle_name,last_name,email,phone,age,gender,occupation,street,city,state_province,country),
  profiles:agent_id(fullname),
  sales_attachments(id)
`

// ─── Team leader access ───────────────────────────────────────────────────────

/**
 * What the signed-in team leader may do with their team's sales — from
 * app/api/team/sales-access, built on team_leader_scope() (migration 084).
 * `members` is everyone the leader's teams cover, subteams included, the
 * leader too; a leader always has the team view, and each member's flags say
 * whether their sales get Edit / Confirm. The server routes re-check all of
 * it; this only decides which buttons to show.
 */
export type TeamSalesAccess = {
  leads: boolean
  teamNames: string[]
  canEdit: boolean
  canConfirm: boolean
  members: Array<{ id: string; name: string; canEdit: boolean; canConfirm: boolean }>
  /** Team sales still waiting for this leader's confirmation, per sale type. */
  waitingToConfirm: Record<SaleType, number>
}

/**
 * Statuses a team leader may confirm a sale in, or take the confirmation back:
 * any but an invalid one. The two checks — the leader's confirmation and the
 * admin's validation — come in either order (owner, 2026-11-09), so a sale the
 * admin already validated can still get the leader's ✓, and neither waits.
 */
export const LEADER_CONFIRMABLE: readonly ValidationStatus[] = ["pending", "under_review", "validated"]

// ─── Save payloads & changes ──────────────────────────────────────────────────

/**
 * The sale columns a details save writes. Status, the agent and the stamps are
 * the caller's to add — a team leader's save never carries them.
 * Brokerage/rental deals carry no developer or project.
 */
export function saleDetailsPayload(form: SaleFormData) {
  const isProjectSale = form.sale_type === "project"
  return {
    sale_type: form.sale_type,
    developer_id: isProjectSale ? form.developer_id : null,
    project_id: isProjectSale ? Number(form.project_id) : null,
    project_unit_id: isProjectSale && form.project_unit_id ? Number(form.project_unit_id) : null,
    unit_number: form.unit_number.trim() || null,
    block_number: form.block_number.trim() || null,
    lot_number: form.lot_number.trim() || null,
    property_type: !isProjectSale ? form.property_type.trim() || null : null,
    property_address: !isProjectSale ? form.property_address.trim() || null : null,
    contract_price: Number(form.contract_price),
    reservation_date: form.reservation_date || null,
    payment_plan: form.payment_plan.trim() || null,
    payment_terms: form.payment_terms.trim() || null,
    price_per_sqft: form.price_per_sqft ? Number(form.price_per_sqft) : null,
    total_area_sqft: form.total_area_sqft ? Number(form.total_area_sqft) : null,
    remarks: form.remarks.trim() || null,
  }
}
export type SaleDetailsPayload = ReturnType<typeof saleDetailsPayload>

/** The client row a save writes. */
export function clientPayload(form: SaleFormData) {
  return {
    first_name: form.client.first_name.trim(),
    middle_name: form.client.middle_name.trim() || null,
    last_name: form.client.last_name.trim(),
    email: form.client.email.trim() || null,
    phone: form.client.phone.trim() || null,
    age: form.client.age ? Number(form.client.age) : null,
    gender: form.client.gender || null,
    occupation: form.client.occupation.trim() || null,
    street: form.client.street.trim() || null,
    city: form.client.city.trim() || null,
    state_province: form.client.state_province.trim() || null,
    country: form.client.country.trim() || null,
  }
}
export type ClientPayload = ReturnType<typeof clientPayload>

const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "")

/**
 * Whether a stored value and a typed one are the same: blank is blank ("" and
 * null alike), and a number compares by value — Postgres can hand back
 * "2016960.00" for what the form sends as 2016960.
 */
function sameValue(a: unknown, b: unknown): boolean {
  if (isBlank(a) || isBlank(b)) return isBlank(a) && isBlank(b)
  if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b)
  return String(a).trim() === String(b).trim()
}

export type FieldChanges = { before: Record<string, unknown>; after: Record<string, unknown> }

/**
 * Only the fields whose value really changed, before and after — what the
 * activity log records, so the history reads "Contract price: A → B" instead
 * of the whole row. Null when nothing changed.
 */
export function changedFields(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown>,
): FieldChanges | null {
  const out: FieldChanges = { before: {}, after: {} }
  for (const key of Object.keys(after)) {
    const was = before?.[key] ?? null
    const now = after[key] ?? null
    if (!sameValue(was, now)) {
      out.before[key] = was
      out.after[key] = now
    }
  }
  return Object.keys(out.after).length ? out : null
}

/** The partners snapshot as it is stored (migration 055's shape). */
export function partnersForWrite(partners: SalePartner[]) {
  return partners.map((p) => ({
    agent_id: p.agent_id,
    name: p.name.trim(),
    role: p.role,
    share: Math.round(p.share * 100) / 100,
    brn: p.brn?.trim() || null,
  }))
}

/** Whether two partner lists differ in who is on the deal, their role, share or BRN. */
export function partnersChanged(a: SalePartner[], b: SalePartner[]): boolean {
  const key = (list: SalePartner[]) =>
    JSON.stringify(
      [...list]
        .sort((x, y) => x.agent_id.localeCompare(y.agent_id))
        .map((p) => [p.agent_id, p.role, Math.round(p.share * 100) / 100, p.brn?.trim() || null]),
    )
  return key(a) !== key(b)
}
