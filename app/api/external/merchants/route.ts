import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { UUID_RE, pageParams, requireExternalKey } from "@/lib/external-api"
import { MERCHANT_CODE_RE, MERCHANT_INCENTIVE_AED, AGENT_INCENTIVE_AED, dubaiDay } from "@/lib/merchant/rules"
import { MERCHANT_COLUMNS, checklistComplete, figuresFor, listRows, merchantQr, type MerchantRow } from "@/lib/merchant/service"

/**
 * GET /api/external/merchants — the Merchant Partnership Programme for the
 * company's own systems (rentsouq.ae shows each merchant its dashboard from
 * this): every merchant with its code, agreement, agent, contact, voucher,
 * scans and closed deals. Keyed. Read-only. No bank details, ever.
 *
 *   ?status=accepted|submitted|onboarding|declined|ended|all   default accepted
 *   ?agent=<profile id>   ?code=<M-XXXX>   ?id=<id>   ?q=<words>
 *   ?include=deals        each merchant's rentals (newest first, up to 25)
 *   ?page=1&limit=50      limit ≤ 100; newest first
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const STATUSES = ["accepted", "submitted", "onboarding", "declined", "ended", "all"]

export async function GET(req: NextRequest) {
  const denied = requireExternalKey(req)
  if (denied) return denied
  const q = req.nextUrl.searchParams
  const admin = createAdminSupabase()
  const { page, limit, from: rangeFrom, to: rangeTo } = pageParams(q)
  const status = (q.get("status") ?? "accepted").toLowerCase()
  const agent = (q.get("agent") ?? "").trim()
  const code = (q.get("code") ?? "").trim().toUpperCase()
  const oneId = (q.get("id") ?? "").trim()
  const words = (q.get("q") ?? "").trim().toLowerCase()
  const includeDeals = (q.get("include") ?? "").split(",").map((s) => s.trim()).includes("deals")
  if (!STATUSES.includes(status)) return NextResponse.json({ error: `status must be one of ${STATUSES.join(", ")}.` }, { status: 400 })
  if ((agent && !UUID_RE.test(agent)) || (oneId && !UUID_RE.test(oneId))) return NextResponse.json({ error: "agent and id must be ids." }, { status: 400 })
  if (code && !MERCHANT_CODE_RE.test(code)) return NextResponse.json({ error: "code looks like M-4K7Q." }, { status: 400 })

  let query = admin.from("merchants").select(MERCHANT_COLUMNS).order("created_at", { ascending: false }).limit(2000)
  if (status !== "all") query = query.eq("status", status)
  if (agent) query = query.eq("agent_id", agent)
  if (code) query = query.eq("code", code)
  if (oneId) query = query.eq("id", oneId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  let merchants = (data ?? []) as MerchantRow[]
  if (words) merchants = merchants.filter((m) => words.split(/\s+/).every((w) => m.business_name.toLowerCase().includes(w) || (m.code ?? "").toLowerCase().includes(w)))
  const total = merchants.length
  const pageRows = merchants.slice(rangeFrom, rangeTo + 1)

  try {
    const rows = await listRows(admin, pageRows)
    const figures = includeDeals ? await Promise.all(pageRows.slice(0, 50).map((m) => figuresFor(admin, m))) : []
    const today = dubaiDay()
    const dataOut = rows.map((r, i) => {
      const m = r.merchant
      const qr = merchantQr({ code: m.code, status: m.status })
      const f = figures[i]
      return {
        id: m.id,
        code: m.code,
        business_name: m.business_name,
        category: m.category,
        address: m.address,
        emirate: m.emirate,
        website: m.website,
        status: m.status,
        agreement: {
          starts_on: m.agreement_starts_on,
          ends_on: m.agreement_ends_on,
          active: m.status === "accepted" && (!m.agreement_ends_on || today <= m.agreement_ends_on),
        },
        agent: r.agent ? { id: r.agent.id, name: r.agent.name, email: r.agent.email, phone: r.agent.phone } : null,
        contact: { name: m.signatory_name, title: m.signatory_title, email: r.account.email, whatsapp: r.account.whatsapp, account_id: m.profile_id },
        voucher: m.voucher_offer,
        qr: { url: qr.url, landing: qr.landing },
        documents: { complete: checklistComplete(r.checklist) },
        scans: { this_month: r.scans_month, total: r.scans_total },
        deals: { validated_this_month: r.deals_month, validated_total: r.deals_total },
        incentives: { merchant_per_deal: MERCHANT_INCENTIVE_AED, agent_per_deal: AGENT_INCENTIVE_AED, merchant_this_month: r.merchant_incentive_month, agent_this_month: r.agent_incentive_month, currency: "AED" },
        ...(f
          ? {
              figures: { month: f.month, last_month: f.last_month, all_time: f.all_time, statement: f.statement },
              recent_deals: f.recent.map((d) => ({ id: d.id, date: d.date, unit: d.unit, validation_status: d.validation_status, contract_price: d.contract_price, agent: d.agent, merchant_incentive: d.merchant_incentive, agent_incentive: d.agent_incentive })),
            }
          : {}),
        accepted_at: m.accepted_at,
        created_at: m.created_at,
        updated_at: m.updated_at,
      }
    })
    return NextResponse.json(
      {
        success: true,
        data: dataOut,
        meta: { total, page, limit, filters: { status, agent: agent || null, code: code || null, q: words || null, include: includeDeals ? "deals" : null }, rules: `A closed deal is a validated rental on FHI tagged with the merchant; the merchant earns AED ${MERCHANT_INCENTIVE_AED} and the agent who signed it AED ${AGENT_INCENTIVE_AED}. Bank details are never returned.` },
      },
      { headers: { "cache-control": "no-store" } },
    )
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't build the list." }, { status: 500 })
  }
}
