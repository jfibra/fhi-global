import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { EMAIL_RE, ISO_DAY, UUID_RE, pageParams, requireExternalKey } from "@/lib/external-api"
import { saleCredits, type SaleRow } from "@/lib/fhi-chat-tools"

/**
 * GET /api/external/sales — the company's recorded sales for FHI's own
 * systems (the cross-company AI chat for admins and agents, boss via Juliecor
 * 2026-11-17). Keyed (lib/external-api.ts). Read-only.
 *
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD   by the sale's business date (reservation date, else the day it was recorded)
 *   ?status=validated|pending|invalid|all   default validated — what the leaderboards count
 *   ?agent=<profile id or email>     sales credited to that agent (own or as a partner on a shared deal)
 *   ?developer=<id>  ?project=<id or slug>
 *   ?since=<ISO timestamp>           rows changed since then (updated_at) — for incremental syncs
 *   ?page=1&limit=50                 limit ≤ 100; newest first
 *
 * → { success, data: sale[], summary: { count, value }, meta: { total, page, limit, filters } }
 * A sale carries its agent and partners (with shares), developer, project,
 * unit, prices, statuses, the client's NAME only (no contact details), and
 * remarks. Amounts are AED.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const COLUMNS =
  "id, agent_id, developer_id, project_id, project_unit_id, unit_number, block_number, lot_number, client_id, contract_price, reservation_date, payment_plan, payment_terms, price_per_sqft, total_area_sqft, commission_status, validation_status, remarks, partners, created_at, updated_at, leader_confirmed_at, sale_type, property_type, property_address, merchant_id"

type Row = SaleRow & {
  sale_type: string | null
  property_type: string | null
  property_address: string | null
  /** A rental that came through a merchant's QR (the Merchant Partnership Programme). */
  merchant_id: string | null
  project_unit_id: string | null
  unit_number: string | null
  block_number: string | null
  lot_number: string | null
  client_id: string | null
  payment_plan: string | null
  payment_terms: string | null
  price_per_sqft: number | string | null
  total_area_sqft: number | string | null
  commission_status: string | null
  remarks: string | null
  updated_at: string | null
  leader_confirmed_at: string | null
}

const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? null : Number(v))
const shiftDay = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400e3).toISOString().slice(0, 10)

export async function GET(req: NextRequest) {
  const denied = requireExternalKey(req)
  if (denied) return denied

  const q = req.nextUrl.searchParams
  const admin = createAdminSupabase()
  const { page, limit, from: rangeFrom, to: rangeTo } = pageParams(q)
  const from = q.get("from") ?? ""
  const to = q.get("to") ?? ""
  if ((from && !ISO_DAY.test(from)) || (to && !ISO_DAY.test(to))) return NextResponse.json({ error: "from and to must be YYYY-MM-DD." }, { status: 400 })
  const status = (q.get("status") ?? "validated").toLowerCase()
  if (!["validated", "pending", "invalid", "all"].includes(status)) return NextResponse.json({ error: "status must be validated, pending, invalid or all." }, { status: 400 })

  // The agent filter: an id or an email; shared deals count for every agent on them.
  let agentId: string | null = null
  const agentParam = (q.get("agent") ?? "").trim()
  if (agentParam) {
    if (UUID_RE.test(agentParam)) agentId = agentParam
    else if (EMAIL_RE.test(agentParam)) {
      for (let p = 1; p <= 25 && !agentId; p++) {
        const { data, error } = await admin.auth.admin.listUsers({ page: p, perPage: 200 })
        if (error) return NextResponse.json({ error: "Couldn't look the agent up." }, { status: 500 })
        agentId = data.users.find((u) => u.email?.toLowerCase() === agentParam.toLowerCase())?.id ?? null
        if (data.users.length < 200) break
      }
      if (!agentId) return NextResponse.json({ success: true, data: [], summary: { count: 0, value: 0 }, meta: { total: 0, page, limit, filters: { agent: agentParam } } })
    } else return NextResponse.json({ error: "agent must be a profile id or an email." }, { status: 400 })
  }

  let projectId: number | null = null
  const projectParam = (q.get("project") ?? "").trim()
  if (projectParam) {
    if (/^\d+$/.test(projectParam)) projectId = Number(projectParam)
    else {
      const { data } = await admin.from("projects").select("id").eq("slug", projectParam).maybeSingle()
      projectId = (data?.id as number | undefined) ?? -1
    }
  }
  const developerId = (q.get("developer") ?? "").trim()
  if (developerId && !UUID_RE.test(developerId)) return NextResponse.json({ error: "developer must be an id." }, { status: 400 })
  const since = (q.get("since") ?? "").trim()
  if (since && Number.isNaN(Date.parse(since))) return NextResponse.json({ error: "since must be an ISO timestamp." }, { status: 400 })
  // The merchant filter: an id or a code (M-4K7Q) — the rentals that came through its QR.
  let merchantId: string | null = null
  const merchantParam = (q.get("merchant") ?? "").trim()
  if (merchantParam) {
    if (UUID_RE.test(merchantParam)) merchantId = merchantParam
    else {
      const { data } = await admin.from("merchants").select("id").eq("code", merchantParam.toUpperCase()).maybeSingle()
      merchantId = (data?.id as string | undefined) ?? "00000000-0000-0000-0000-000000000000"
    }
  }
  const saleType = (q.get("type") ?? "").trim().toLowerCase()
  if (saleType && !["project", "brokerage", "rental"].includes(saleType)) return NextResponse.json({ error: "type must be project, brokerage or rental." }, { status: 400 })

  const build = (select: string, opts?: { count?: "exact"; head?: boolean }) => {
    let s = admin.from("sales_reports").select(select, opts)
    if (status !== "all") s = s.eq("validation_status", status)
    if (merchantId) s = s.eq("merchant_id", merchantId)
    if (saleType) s = s.eq("sale_type", saleType)
    // Business date = reservation_date, else the day it was recorded.
    if (from) s = s.or(`reservation_date.gte.${from},and(reservation_date.is.null,created_at.gte.${from}T00:00:00+04:00)`)
    if (to) s = s.or(`reservation_date.lte.${to},and(reservation_date.is.null,created_at.lt.${shiftDay(to, 1)}T00:00:00+04:00)`)
    if (agentId) s = s.or(`agent_id.eq.${agentId},partner_agent_ids.cs.{${agentId}}`)
    if (developerId) s = s.eq("developer_id", developerId)
    if (projectId !== null) s = s.eq("project_id", projectId)
    if (since) s = s.gte("updated_at", since)
    return s
  }

  const [pageRes, sumRes] = await Promise.all([
    build(COLUMNS, { count: "exact" }).order("reservation_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).range(rangeFrom, rangeTo),
    build("contract_price").limit(10000),
  ])
  if (pageRes.error) return NextResponse.json({ error: pageRes.error.message }, { status: 500 })
  const rows = (pageRes.data ?? []) as unknown as Row[]
  const value = ((sumRes.data ?? []) as unknown as Array<{ contract_price: number | string | null }>).reduce((a, r) => a + (num(r.contract_price) ?? 0), 0)

  // Names for everything the page refers to.
  const agentIds = [...new Set(rows.flatMap((s) => [s.agent_id, ...saleCredits(s).map((c) => c.agentId)]))]
  const devIds = [...new Set(rows.map((s) => s.developer_id).filter(Boolean))]
  const projIds = [...new Set(rows.map((s) => s.project_id).filter((x) => x !== null))]
  const clientIds = [...new Set(rows.map((s) => s.client_id).filter((x): x is string => !!x))]
  const merchantIds = [...new Set(rows.map((s) => s.merchant_id).filter((x): x is string => !!x))]
  const [agents, devs, projs, clients, merchants] = await Promise.all([
    agentIds.length ? admin.from("profiles").select("id, fullname").in("id", agentIds) : Promise.resolve({ data: [] as { id: string; fullname: string | null }[] }),
    devIds.length ? admin.from("developers").select("id, name").in("id", devIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    projIds.length ? admin.from("projects").select("id, name, slug").in("id", projIds) : Promise.resolve({ data: [] as { id: number; name: string; slug: string }[] }),
    clientIds.length ? admin.from("clients").select("id, first_name, last_name").in("id", clientIds) : Promise.resolve({ data: [] as { id: string; first_name: string | null; last_name: string | null }[] }),
    merchantIds.length ? admin.from("merchants").select("id, business_name, code").in("id", merchantIds) : Promise.resolve({ data: [] as { id: string; business_name: string; code: string | null }[] }),
  ])
  const merchantById = new Map((merchants.data ?? []).map((m) => [m.id, m]))
  const agentName = new Map((agents.data ?? []).map((a) => [a.id, (a.fullname ?? "Unknown agent").trim().replace(/\s+/g, " ")]))
  const devName = new Map((devs.data ?? []).map((d) => [d.id, d.name]))
  const proj = new Map((projs.data ?? []).map((p) => [Number(p.id), p]))
  const clientName = new Map((clients.data ?? []).map((c) => [c.id, [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || null]))

  const data = rows.map((s) => {
    const credits = saleCredits(s)
    const p = proj.get(Number(s.project_id))
    return {
      id: s.id,
      business_date: s.reservation_date ?? s.created_at.slice(0, 10),
      reservation_date: s.reservation_date,
      recorded_at: s.created_at,
      updated_at: s.updated_at,
      validation_status: s.validation_status ?? "pending",
      commission_status: s.commission_status ?? "pending",
      leader_confirmed_at: s.leader_confirmed_at,
      currency: "AED",
      /** project (default), brokerage or rental. */
      sale_type: s.sale_type ?? "project",
      contract_price: num(s.contract_price),
      unit: { number: s.unit_number, block: s.block_number, lot: s.lot_number, area_sqft: num(s.total_area_sqft), price_per_sqft: num(s.price_per_sqft), project_unit_id: s.project_unit_id },
      /** Brokerage and rental deals describe the property instead of a project. */
      property: s.sale_type && s.sale_type !== "project" ? { type: s.property_type, address: s.property_address } : null,
      /** A rental that came through a merchant's QR (the Merchant Partnership Programme), else null. */
      merchant: s.merchant_id ? { id: s.merchant_id, name: merchantById.get(s.merchant_id)?.business_name ?? null, code: merchantById.get(s.merchant_id)?.code ?? null } : null,
      payment: { plan: s.payment_plan, terms: s.payment_terms },
      developer: s.developer_id ? { id: s.developer_id, name: devName.get(s.developer_id) ?? null } : null,
      project: p ? { id: p.id, name: p.name, slug: p.slug } : s.project_id !== null ? { id: s.project_id, name: null, slug: null } : null,
      agent: { id: s.agent_id, name: agentName.get(s.agent_id) ?? null },
      /** Everyone credited, with their share of the price (a solo sale = the agent at 100). */
      credits: credits.map((c) => ({ id: c.agentId, name: agentName.get(c.agentId) ?? null, share_percent: c.share, value: Math.round(c.value) })),
      client: s.client_id ? { id: s.client_id, name: clientName.get(s.client_id) ?? null } : null,
      remarks: s.remarks,
    }
  })

  return NextResponse.json(
    {
      success: true,
      data,
      summary: { count: pageRes.count ?? data.length, value: Math.round(value), currency: "AED" },
      meta: { total: pageRes.count ?? data.length, page, limit, filters: { from: from || null, to: to || null, status, agent: agentId, developer: developerId || null, project: projectId, merchant: merchantId, type: saleType || null, since: since || null } },
    },
    { headers: { "cache-control": "no-store" } },
  )
}
