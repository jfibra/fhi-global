"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCw, Search, Store } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { canReviewMerchants } from "@/lib/app-roles"
import type { AdminMerchantsPayload } from "@/app/api/admin/merchants/route"
import { AGENT_INCENTIVE_AED, MERCHANT_INCENTIVE_AED, fmtAed } from "@/lib/merchant/rules"
import type { MerchantListRow } from "@/lib/merchant/types"
import { Card, ErrorNote, PageTitle, StatusPill, Tile, btnGhost, fmtDate } from "@/features/dashboard/merchant/shared"
import { MerchantDrawer } from "./merchant-drawer"

type Tab = "queue" | "active" | "all"

/**
 * Accounts & Invites → Merchants (admin staff): the review queue (every
 * merchant whose four requirements are in, and those still gathering them),
 * the active partners with their scans and closed deals, and everyone. One
 * click opens the review drawer: documents, the IBAN, accept or decline.
 */
export default function MerchantsAdminPage() {
  const { role, profile } = useAuth()
  // Admin staff, or the leader an admin flagged as a reviewer (metadata.merchant_reviewer).
  const allowed = useRequireAllowed(canReviewMerchants(role, profile?.metadata))
  const [data, setData] = useState<AdminMerchantsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("queue")
  const [q, setQ] = useState("")
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(
    () =>
      fetch("/api/admin/merchants", { cache: "no-store" })
        .then(async (res) => {
          const json = (await res.json().catch(() => ({}))) as AdminMerchantsPayload & { error?: string }
          if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status}).`)
          return json
        })
        .then((json) => {
          setData(json)
          setError(null)
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load the merchants."))
        .finally(() => setLoading(false)),
    [],
  )
  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(() => {
    if (!data) return []
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    let list = data.rows
    if (tab === "queue") list = list.filter((r) => r.merchant.status === "submitted" || r.merchant.status === "onboarding")
    if (tab === "active") list = list.filter((r) => r.merchant.status === "accepted")
    if (words.length) list = list.filter((r) => words.every((w) => [r.merchant.business_name, r.merchant.code, r.merchant.category, r.agent?.name, r.account.email].some((v) => (v ?? "").toLowerCase().includes(w))))
    if (tab === "queue") list = [...list].sort((a, b) => (a.merchant.status === b.merchant.status ? a.merchant.created_at.localeCompare(b.merchant.created_at) : a.merchant.status === "submitted" ? -1 : 1))
    return list
  }, [data, tab, q])

  if (!allowed) return null
  const c = data?.counts
  const active = data?.rows.filter((r) => r.merchant.status === "accepted") ?? []
  const scansMonth = active.reduce((a, r) => a + r.scans_month, 0)
  const dealsMonth = active.reduce((a, r) => a + r.deals_month, 0)

  return (
    <div className="space-y-6">
      <PageTitle
        title="Merchants"
        intro="Businesses the agents sign to the Merchant Partnership Programme. Accepting issues the QR code and starts the one-year agreement."
        aside={
          <button type="button" onClick={() => void load()} className={btnGhost}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        }
      />
      {error && <ErrorNote text={error} />}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Tile label="Active merchants" value={c ? c.accepted : "—"} hint={c ? `${c.submitted} waiting for a decision · ${c.onboarding} gathering documents` : undefined} />
        <Tile label="Scans this month" value={scansMonth.toLocaleString("en-AE")} hint="across active merchants" />
        <Tile label="Closed deals this month" value={dealsMonth} hint="validated rentals through merchant QRs" />
        <Tile dark label="Incentives due this month" value={fmtAed(dealsMonth * (MERCHANT_INCENTIVE_AED + AGENT_INCENTIVE_AED))} hint={`merchants ${fmtAed(dealsMonth * MERCHANT_INCENTIVE_AED)} on the 15th · agents ${fmtAed(dealsMonth * AGENT_INCENTIVE_AED)} on the 10th`} />
      </div>

      <Card
        title={
          <span className="flex flex-wrap gap-1">
            {(
              [
                ["queue", `Review queue · ${c ? c.submitted + c.onboarding : "…"}`],
                ["active", `Active · ${c ? c.accepted : "…"}`],
                ["all", `All · ${data ? data.rows.length : "…"}`],
              ] as Array<[Tab, string]>
            ).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-lg px-3 py-1.5 text-[13px] font-bold ${tab === id ? "bg-[#001f3f] text-white" : "text-[#374151] hover:bg-[#f3f4f6]"}`}>
                {label}
              </button>
            ))}
          </span>
        }
        aside={
          <label className="flex items-center gap-2 rounded-xl border border-[#e5e8ec] bg-white px-3 py-1.5 text-[13px] text-[#6b7280]">
            <Search className="h-4 w-4" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Business, code, agent, email" className="w-44 bg-transparent text-[#0d1117] outline-none placeholder:text-[#9ca3af]" />
          </label>
        }
      >
        {loading && !data && (
          <p className="flex items-center gap-2 px-5 py-10 text-sm text-[#6b7280]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        )}
        {data && rows.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
            <Store className="h-8 w-8 text-[#d6b357]" />
            <p className="text-sm font-semibold text-[#0d1117]">{tab === "queue" ? "Nothing waiting for a decision" : "No merchants here"}</p>
            <p className="max-w-sm text-[13px] text-[#6b7280]">{tab === "queue" ? "Merchants appear here as soon as an agent's link registers one." : "Try another tab or clear the search."}</p>
          </div>
        )}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="bg-[#f8fafc] text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#6b7280]">
                  <th className="px-5 py-2.5">Business</th>
                  <th className="px-3 py-2.5">Signed by</th>
                  <th className="px-3 py-2.5">Documents</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Scans</th>
                  <th className="px-3 py-2.5 text-right">Deals</th>
                  <th className="px-5 py-2.5">{tab === "queue" ? "Registered" : "Agreement"}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Row key={r.merchant.id} r={r} tab={tab} onOpen={() => setOpen(r.merchant.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {open && <MerchantDrawer merchantId={open} mode="admin" onClose={() => setOpen(null)} onChanged={() => void load()} />}
    </div>
  )
}

function Row({ r, tab, onOpen }: { r: MerchantListRow; tab: Tab; onOpen: () => void }) {
  const m = r.merchant
  const kinds = ["agreement", "trade_licence", "emirates_id", "bank"] as const
  const present = kinds.filter((k) => r.checklist[k].present).length
  return (
    <tr className="cursor-pointer border-t border-[#f0f2f5] hover:bg-[#f8fafc]" onClick={onOpen}>
      <td className="px-5 py-3">
        <p className="font-semibold text-[#0d1117]">{m.business_name}</p>
        <p className="text-[12px] text-[#6b7280]">{[m.category, m.emirate, m.code].filter(Boolean).join(" · ") || r.account.email || "—"}</p>
      </td>
      <td className="px-3 py-3 text-[#374151]">{r.agent?.name ?? "—"}</td>
      <td className="px-3 py-3">
        <span className="flex items-center gap-1.5" aria-label={`${present} of 4 documents in`}>
          {kinds.map((k) => (
            <span key={k} title={k} className={`h-3 w-3 rounded-full ${r.checklist[k].verified ? "bg-emerald-600" : r.checklist[k].present ? "bg-emerald-300" : "bg-[#e5e8ec]"}`} />
          ))}
          <span className="ml-1 text-[12px] text-[#6b7280]">{present} of 4</span>
        </span>
      </td>
      <td className="px-3 py-3"><StatusPill status={m.status} /></td>
      <td className="px-3 py-3 text-right tabular-nums text-[#374151]">{m.status === "accepted" ? r.scans_month : "–"}</td>
      <td className="px-3 py-3 text-right tabular-nums text-[#374151]">{m.status === "accepted" ? `${r.deals_month} / ${r.deals_total}` : "–"}</td>
      <td className="whitespace-nowrap px-5 py-3 text-[13px] text-[#374151]">{tab === "queue" ? fmtDate(m.created_at) : m.agreement_ends_on ? `to ${fmtDate(m.agreement_ends_on)}` : "—"}</td>
    </tr>
  )
}
