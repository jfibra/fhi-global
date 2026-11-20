import "server-only"

import { createHash, randomInt } from "node:crypto"
import type { createAdminSupabase } from "@/lib/admin-supabase"
import { authEmailsFor } from "@/lib/auth-emails"
import { SITE_URL } from "@/lib/seo"
import { titleCaseName } from "@/lib/public-profile"
import {
  AGENT_INCENTIVE_AED,
  AGENT_PAY_DAY,
  MERCHANT_AGREEMENT_MONTHS,
  MERCHANT_DOCUMENT_KINDS,
  MERCHANT_INCENTIVE_AED,
  MERCHANT_PAY_DAY,
  dubaiDay,
  merchantQrPath,
  monthLabel,
  payDateLabel,
  type MerchantDocumentKind,
  type MerchantStatus,
} from "@/lib/merchant/rules"
import { maskIban } from "@/lib/merchant/secrets"
import type {
  MerchantChecklist,
  MerchantDeal,
  MerchantDocumentRow,
  MerchantFigures,
  MerchantListRow,
  MerchantPeriodFigures,
  MerchantPerson,
  MerchantQr,
  MerchantRecord,
} from "@/lib/merchant/types"

/**
 * Reads and the small writes of the Merchant Partnership Programme, on the
 * service-role client (the three tables of migration 092 are service role
 * only). The routes decide WHO may see a merchant; this file builds what
 * they see. Accepting, declining and uploads live in their routes.
 */

type Admin = ReturnType<typeof createAdminSupabase>

export const MERCHANT_COLUMNS =
  "id, profile_id, agent_id, business_name, category, address, emirate, website, signatory_name, signatory_title, emirates_id_number, emirates_id_expires_on, trade_licence_number, trade_licence_authority, trade_licence_expires_on, bank_account_name, bank_name, iban_sealed, iban_last4, voucher_offer, code, status, submitted_at, accepted_at, accepted_by, declined_at, declined_by, decline_reason, agreement_starts_on, agreement_ends_on, ended_at, notes, created_at, updated_at"

export type MerchantRow = Omit<MerchantRecord, "iban_masked"> & { iban_sealed: string | null; iban_last4: string | null; accepted_by: string | null; declined_by: string | null }

export function toRecord(row: MerchantRow): MerchantRecord {
  const { iban_sealed, iban_last4, accepted_by: _a, declined_by: _d, ...rest } = row
  void _a
  void _d
  return { ...rest, iban_masked: maskIban(iban_sealed ? "AE" : null, iban_last4) }
}

export async function loadMerchantByProfile(admin: Admin, profileId: string): Promise<MerchantRow | null> {
  const { data, error } = await admin.from("merchants").select(MERCHANT_COLUMNS).eq("profile_id", profileId).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as MerchantRow | null) ?? null
}

export async function loadMerchantById(admin: Admin, id: string): Promise<MerchantRow | null> {
  const { data, error } = await admin.from("merchants").select(MERCHANT_COLUMNS).eq("id", id).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as MerchantRow | null) ?? null
}

export async function loadMerchantByCode(admin: Admin, code: string): Promise<MerchantRow | null> {
  const { data, error } = await admin.from("merchants").select(MERCHANT_COLUMNS).eq("code", code).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as MerchantRow | null) ?? null
}

// ─── Documents and the checklist ─────────────────────────────────────────────

type DocRow = Omit<MerchantDocumentRow, "uploaded_by_name"> & { merchant_id: string }

export async function loadDocuments(admin: Admin, merchantIds: string[]): Promise<Map<string, MerchantDocumentRow[]>> {
  const out = new Map<string, MerchantDocumentRow[]>()
  if (merchantIds.length === 0) return out
  const { data, error } = await admin
    .from("merchant_documents")
    .select("id, merchant_id, kind, file_name, file_url, file_type, uploaded_by, uploaded_role, note, verified_at, created_at")
    .in("merchant_id", merchantIds)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as DocRow[]
  const uploaderIds = [...new Set(rows.map((r) => r.uploaded_by).filter((x): x is string => !!x))]
  const names = new Map<string, string | null>()
  if (uploaderIds.length) {
    const { data: people } = await admin.from("profiles").select("id, fullname").in("id", uploaderIds)
    for (const p of people ?? []) names.set(p.id, p.fullname ? titleCaseName(p.fullname) : null)
  }
  for (const r of rows) {
    const { merchant_id, ...doc } = r
    out.set(merchant_id, [...(out.get(merchant_id) ?? []), { ...doc, uploaded_by_name: doc.uploaded_by ? names.get(doc.uploaded_by) ?? null : null }])
  }
  return out
}

/** Which of the four requirements are in: the newest file of each kind; the bank counts when an IBAN was typed in too. */
export function checklistFor(merchant: Pick<MerchantRow, "iban_last4">, documents: MerchantDocumentRow[]): MerchantChecklist {
  const out = {} as MerchantChecklist
  for (const { kind } of MERCHANT_DOCUMENT_KINDS) {
    const doc = documents.find((d) => d.kind === kind) ?? null
    const present = !!doc || (kind === "bank" && !!merchant.iban_last4)
    out[kind] = { present, verified: !!doc?.verified_at, document: doc }
  }
  return out
}

export const checklistComplete = (c: MerchantChecklist) => MERCHANT_DOCUMENT_KINDS.every(({ kind }) => c[kind].present)

/**
 * Onboarding ↔ submitted follows the checklist: the moment the fourth
 * requirement is in, the merchant is "under review"; take one away and it is
 * back to onboarding. Accepted, declined and ended never move from here.
 */
export async function refreshStatus(admin: Admin, merchantId: string): Promise<MerchantStatus> {
  const merchant = await loadMerchantById(admin, merchantId)
  if (!merchant) throw new Error("Merchant not found")
  if (merchant.status !== "onboarding" && merchant.status !== "submitted") return merchant.status
  const docs = (await loadDocuments(admin, [merchantId])).get(merchantId) ?? []
  const complete = checklistComplete(checklistFor(merchant, docs))
  const next: MerchantStatus = complete ? "submitted" : "onboarding"
  if (next !== merchant.status) {
    const { error } = await admin
      .from("merchants")
      .update({ status: next, submitted_at: complete ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
      .eq("id", merchantId)
    if (error) throw new Error(error.message)
  }
  return next
}

// ─── People ──────────────────────────────────────────────────────────────────

type ProfileRow = { id: string; fullname: string | null; role: string | null; profile_url: string | null; metadata: Record<string, unknown> | null }

function phoneOf(meta: Record<string, unknown>, codeKey: string, numberKey: string): string | null {
  const code = typeof meta[codeKey] === "string" ? (meta[codeKey] as string).trim() : ""
  const num = typeof meta[numberKey] === "string" ? (meta[numberKey] as string).replace(/\D/g, "") : ""
  if (!num) return null
  return code ? `${code}${num}` : num
}

export async function peopleFor(admin: Admin, ids: string[]): Promise<Map<string, MerchantPerson>> {
  const unique = [...new Set(ids.filter(Boolean))]
  const out = new Map<string, MerchantPerson>()
  if (unique.length === 0) return out
  const [{ data }, emails] = await Promise.all([
    admin.from("profiles").select("id, fullname, role, profile_url, metadata").in("id", unique),
    authEmailsFor(admin, unique),
  ])
  for (const p of (data ?? []) as ProfileRow[]) {
    const meta = p.metadata ?? {}
    out.set(p.id, {
      id: p.id,
      name: p.fullname ? titleCaseName(p.fullname) : null,
      role: p.role,
      email: emails.get(p.id) ?? null,
      phone: phoneOf(meta, "phone_country_code", "phone_number"),
      whatsapp: phoneOf(meta, "whatsapp_country_code", "whatsapp_number") ?? phoneOf(meta, "phone_country_code", "phone_number"),
      avatar_url: p.profile_url,
    })
  }
  return out
}

// ─── Scans, deals and figures ────────────────────────────────────────────────

type SaleRow = {
  id: string
  merchant_id: string
  agent_id: string
  validation_status: string | null
  reservation_date: string | null
  created_at: string
  contract_price: number | string | null
  property_type: string | null
  property_address: string | null
  unit_number: string | null
}

const SALE_COLUMNS = "id, merchant_id, agent_id, validation_status, reservation_date, created_at, contract_price, property_type, property_address, unit_number"

const businessDate = (s: SaleRow) => s.reservation_date ?? dubaiDay(s.created_at)

const unitLabel = (s: SaleRow) =>
  [s.property_type, s.unit_number ? `Unit ${s.unit_number}` : null, s.property_address].filter((v) => typeof v === "string" && v.trim()).join(" · ") || "Rental"

function emptyPeriod(): MerchantPeriodFigures {
  return { validated: 0, pending: 0, invalid: 0, merchant_incentive: 0, agent_incentive: 0 }
}

function addToPeriod(p: MerchantPeriodFigures, status: string) {
  if (status === "validated") {
    p.validated++
    p.merchant_incentive += MERCHANT_INCENTIVE_AED
    p.agent_incentive += AGENT_INCENTIVE_AED
  } else if (status === "invalid") p.invalid++
  else p.pending++
}

/** The month before a YYYY-MM key. */
function previousMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 2, 1))
  return d.toISOString().slice(0, 7)
}

async function loadSales(admin: Admin, merchantIds: string[]): Promise<SaleRow[]> {
  if (merchantIds.length === 0) return []
  const { data, error } = await admin.from("sales_reports").select(SALE_COLUMNS).in("merchant_id", merchantIds).eq("sale_type", "rental").limit(5000)
  if (error) throw new Error(error.message)
  return (data ?? []) as SaleRow[]
}

async function scanCounts(admin: Admin, merchantIds: string[], sinceIso: string | null): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (merchantIds.length === 0) return out
  if (sinceIso) {
    // Bounded: one month or one week of scans, grouped here.
    const { data, error } = await admin.from("merchant_scans").select("merchant_id").in("merchant_id", merchantIds).gte("scanned_at", sinceIso).limit(50000)
    if (error) throw new Error(error.message)
    for (const r of (data ?? []) as Array<{ merchant_id: string }>) out.set(r.merchant_id, (out.get(r.merchant_id) ?? 0) + 1)
    return out
  }
  await Promise.all(
    merchantIds.map(async (id) => {
      const { count, error } = await admin.from("merchant_scans").select("id", { count: "exact", head: true }).eq("merchant_id", id)
      if (error) throw new Error(error.message)
      out.set(id, count ?? 0)
    }),
  )
  return out
}

/** The current Dubai month's first instant and the last seven days, as ISO. */
function windows(now = new Date()) {
  const today = dubaiDay(now)
  const monthKey = today.slice(0, 7)
  const monthStart = `${monthKey}-01T00:00:00+04:00`
  const weekStart = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  return { today, monthKey, monthStart, weekStart }
}

export async function figuresFor(admin: Admin, merchant: Pick<MerchantRow, "id">): Promise<MerchantFigures> {
  const { monthKey, monthStart, weekStart } = windows()
  const lastKey = previousMonthKey(monthKey)
  const [sales, month, week, total] = await Promise.all([
    loadSales(admin, [merchant.id]),
    scanCounts(admin, [merchant.id], monthStart),
    scanCounts(admin, [merchant.id], weekStart),
    scanCounts(admin, [merchant.id], null),
  ])
  const agentIds = [...new Set(sales.map((s) => s.agent_id))]
  const names = new Map<string, string | null>()
  if (agentIds.length) {
    const { data } = await admin.from("profiles").select("id, fullname").in("id", agentIds)
    for (const p of data ?? []) names.set(p.id, p.fullname ? titleCaseName(p.fullname) : null)
  }

  const periods = { month: emptyPeriod(), last_month: emptyPeriod(), all_time: emptyPeriod() }
  const deals: MerchantDeal[] = []
  for (const s of sales) {
    const date = businessDate(s)
    const status = s.validation_status ?? "pending"
    addToPeriod(periods.all_time, status)
    if (date.startsWith(monthKey)) addToPeriod(periods.month, status)
    else if (date.startsWith(lastKey)) addToPeriod(periods.last_month, status)
    deals.push({
      id: s.id,
      date,
      recorded_at: s.created_at,
      unit: unitLabel(s),
      validation_status: status,
      contract_price: Number(s.contract_price ?? 0),
      agent: { id: s.agent_id, name: names.get(s.agent_id) ?? null },
      merchant_incentive: status === "validated" ? MERCHANT_INCENTIVE_AED : 0,
      agent_incentive: status === "validated" ? AGENT_INCENTIVE_AED : 0,
    })
  }
  deals.sort((a, b) => b.date.localeCompare(a.date) || b.recorded_at.localeCompare(a.recorded_at))

  return {
    month_key: monthKey,
    scans: { month: month.get(merchant.id) ?? 0, week: week.get(merchant.id) ?? 0, total: total.get(merchant.id) ?? 0 },
    month: periods.month,
    last_month: periods.last_month,
    all_time: periods.all_time,
    recent: deals.slice(0, 25),
    statement: {
      month_key: monthKey,
      label: monthLabel(monthKey),
      validated: periods.month.validated,
      merchant_amount: periods.month.merchant_incentive,
      agent_amount: periods.month.agent_incentive,
      merchant_pay_date: payDateLabel(monthKey, MERCHANT_PAY_DAY),
      agent_pay_date: payDateLabel(monthKey, AGENT_PAY_DAY),
    },
  }
}

/** The rows of a list page (an agent's merchants, or every merchant for the admins). */
export async function listRows(admin: Admin, merchants: MerchantRow[]): Promise<MerchantListRow[]> {
  if (merchants.length === 0) return []
  const ids = merchants.map((m) => m.id)
  const { monthKey, monthStart } = windows()
  const [docs, people, sales, scansMonth, scansTotal] = await Promise.all([
    loadDocuments(admin, ids),
    peopleFor(admin, merchants.flatMap((m) => [m.profile_id, m.agent_id ?? ""])),
    loadSales(admin, ids),
    scanCounts(admin, ids, monthStart),
    scanCounts(admin, ids, null),
  ])
  const dealsMonth = new Map<string, number>()
  const dealsTotal = new Map<string, number>()
  for (const s of sales) {
    if ((s.validation_status ?? "pending") !== "validated") continue
    dealsTotal.set(s.merchant_id, (dealsTotal.get(s.merchant_id) ?? 0) + 1)
    if (businessDate(s).startsWith(monthKey)) dealsMonth.set(s.merchant_id, (dealsMonth.get(s.merchant_id) ?? 0) + 1)
  }
  return merchants.map((m) => {
    const dm = dealsMonth.get(m.id) ?? 0
    return {
      merchant: toRecord(m),
      account: people.get(m.profile_id) ?? { id: m.profile_id, name: m.signatory_name, role: "merchant", email: null, phone: null, whatsapp: null, avatar_url: null },
      agent: m.agent_id ? people.get(m.agent_id) ?? null : null,
      checklist: checklistFor(m, docs.get(m.id) ?? []),
      scans_month: scansMonth.get(m.id) ?? 0,
      scans_total: scansTotal.get(m.id) ?? 0,
      deals_month: dm,
      deals_total: dealsTotal.get(m.id) ?? 0,
      merchant_incentive_month: dm * MERCHANT_INCENTIVE_AED,
      agent_incentive_month: dm * AGENT_INCENTIVE_AED,
    }
  })
}

// ─── The QR, the code and the agreement dates ────────────────────────────────

/** Where a scan lands: rentsouq.ae with the merchant's code, so the rental is credited. */
export function merchantLandingUrl(code: string | null): string | null {
  if (!code) return null
  const base = (process.env.MERCHANT_LANDING_URL ?? "https://rentsouq.ae/").trim()
  const sep = base.includes("?") ? "&" : "?"
  return `${base}${sep}ref=${encodeURIComponent(code)}`
}

export function merchantQr(merchant: Pick<MerchantRow, "code" | "status">): MerchantQr {
  if (!merchant.code) return { url: null, landing: null }
  return { url: `${SITE_URL.replace(/\/$/, "")}${merchantQrPath(merchant.code)}`, landing: merchantLandingUrl(merchant.code) }
}

/** M-4K7Q: four letters or digits nobody mistakes for one another, unique in the table. */
export async function newMerchantCode(admin: Admin): Promise<string> {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  for (let attempt = 0; attempt < 20; attempt++) {
    const len = attempt < 10 ? 4 : 5
    let code = "M-"
    for (let i = 0; i < len; i++) code += alphabet[randomInt(alphabet.length)]
    const { data } = await admin.from("merchants").select("id").eq("code", code).maybeSingle()
    if (!data) return code
  }
  throw new Error("Couldn't find a free merchant code")
}

/** A one-year agreement from today (Dubai): 20 Nov 2026 → 19 Nov 2027. */
export function agreementDates(today = dubaiDay()): { starts_on: string; ends_on: string } {
  const [y, m, d] = today.split("-").map(Number)
  const end = new Date(Date.UTC(y, m - 1 + MERCHANT_AGREEMENT_MONTHS, d - 1))
  return { starts_on: today, ends_on: end.toISOString().slice(0, 10) }
}

/** One scan of the merchant's QR; the IP is kept as a salted hash only. */
export async function recordScan(admin: Admin, merchantId: string, req: { ip: string; userAgent: string | null; referer: string | null }): Promise<void> {
  const salt = process.env.SITE_CHAT_IP_SALT || process.env.CRON_SECRET || "fhi"
  const ipHash = createHash("sha256").update(`${salt}:${req.ip}`).digest("hex").slice(0, 32)
  const { error } = await admin.from("merchant_scans").insert({
    merchant_id: merchantId,
    ip_hash: ipHash,
    user_agent: req.userAgent ? req.userAgent.slice(0, 300) : null,
    referer: req.referer ? req.referer.slice(0, 500) : null,
  })
  if (error) throw new Error(error.message)
}

export const DOCUMENT_KIND_LABEL = (kind: MerchantDocumentKind) => MERCHANT_DOCUMENT_KINDS.find((d) => d.kind === kind)?.label ?? kind
