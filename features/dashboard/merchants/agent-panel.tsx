"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react"
import { Check, Copy, Download, FileText, Loader2, MessageCircle, RefreshCw, Store } from "lucide-react"
import type { AgentMerchantsPayload } from "@/app/api/agent/merchants/route"
import { AGENT_INCENTIVE_AED, AGENT_PAY_DAY, MERCHANT_CLAWBACK_DAYS, MERCHANT_MATERIALS, MERCHANT_PITCH, fmtAed } from "@/lib/merchant/rules"
import { merchantInviteShare, merchantInviteUrl } from "@/lib/share-links"
import { Card, StatusPill, Tile, btnGhost, btnGold, fmtDate } from "@/features/dashboard/merchant/shared"
import { MerchantDrawer } from "./merchant-drawer"

/**
 * Invite › Merchants (the sales ladder): the merchant link with the WhatsApp
 * wording, what to send and say, and My merchants — status, scans, closed
 * deals and the agent's own AED 100 per deal — with the drawer to see one and
 * upload its documents on its behalf.
 */
export function AgentMerchantsPanel({ userId, origin }: { userId: string; origin: string }) {
  const [data, setData] = useState<AgentMerchantsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const downloadRef = useRef<HTMLDivElement>(null)
  const url = origin ? merchantInviteUrl(origin, userId) : ""
  const share = merchantInviteShare(url)

  const load = useCallback(
    () =>
      fetch("/api/agent/merchants", { cache: "no-store" })
        .then(async (res) => {
          const json = (await res.json().catch(() => ({}))) as AgentMerchantsPayload & { error?: string }
          if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status}).`)
          return json
        })
        .then((json) => {
          setData(json)
          setError(null)
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load your merchants."))
        .finally(() => setLoading(false)),
    [],
  )
  useEffect(() => {
    void load()
  }, [load])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // clipboard blocked
    }
  }
  const downloadQr = () => {
    const canvas = downloadRef.current?.querySelector("canvas")
    if (!canvas) return
    const a = document.createElement("a")
    a.href = canvas.toDataURL("image/png")
    a.download = "fhi-merchant-link-qr.png"
    a.click()
  }

  const t = data?.totals

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Merchants signed" value={t ? t.merchants : "—"} hint={t ? `${t.active} active · ${t.merchants - t.active} not yet` : undefined} />
        <Tile label="Scans this month" value={t ? t.scans_month.toLocaleString("en-AE") : "—"} hint="across your active merchants" />
        <Tile label="Closed deals this month" value={t ? t.deals_month : "—"} hint="validated rentals through their QRs" />
        <Tile dark label="Your incentive this month" value={t ? fmtAed(t.agent_incentive_month) : "—"} hint={t ? `${t.deals_month} validated × AED ${AGENT_INCENTIVE_AED} · paid on the ${AGENT_PAY_DAY}th of next month` : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <div className="space-y-4">
          <Card title="Your merchant link" aside={<span className="text-[12px] font-semibold text-[#6b7280]">Registers them under your name</span>}>
            <div className="space-y-3 p-5">
              <div className="flex items-center gap-2 rounded-xl border border-[#e8eaed] bg-[#f8fafc] px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-[#001f3f]">{url.replace(/^https?:\/\//, "") || "…"}</span>
                <button type="button" onClick={() => void copy()} disabled={!url} className={btnGhost}>
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="rounded-xl bg-[#faf7ee] px-4 py-3 text-[13.5px] leading-relaxed text-[#4b5563]">{share}</p>
              <div className="flex flex-wrap gap-2">
                <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener noreferrer" className={btnGold}>
                  <MessageCircle className="h-4 w-4" /> Share on WhatsApp
                </a>
                <button type="button" onClick={downloadQr} disabled={!url} className={btnGhost}>
                  <Download className="h-4 w-4" /> QR of this link
                </button>
              </div>
              <div className="flex items-center gap-4">
                <div className="rounded-xl border-2 border-[#d6b357] bg-white p-2">{url ? <QRCodeSVG value={url} size={96} level="M" fgColor="#001f3f" /> : <div className="h-24 w-24" />}</div>
                <p className="text-[13px] text-[#6b7280]">The same link as a QR, for a merchant standing in front of you. They fill in their business, get a login and upload the four documents.</p>
              </div>
              <div ref={downloadRef} className="hidden" aria-hidden>
                {url && <QRCodeCanvas value={url} size={1024} level="M" fgColor="#001f3f" marginSize={4} />}
              </div>
            </div>
          </Card>

          <Card title="What to send and say">
            <div className="space-y-3 p-5">
              {MERCHANT_MATERIALS.length > 0 && (
                <ul className="space-y-2">
                  {MERCHANT_MATERIALS.map((m) => (
                    <li key={m.url} className="flex items-center gap-3 rounded-xl border border-[#e8eaed] px-3 py-2.5">
                      <FileText className="h-4 w-4 text-[#b8913f]" />
                      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[#0d1117]">{m.label}</span>
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-[#001f3f] hover:underline">Open PDF</a>
                    </li>
                  ))}
                </ul>
              )}
              <ol className="list-decimal space-y-1.5 pl-5 text-[14px] leading-relaxed text-[#4b5563]">
                {MERCHANT_PITCH.map((p) => (
                  <li key={p.title}>
                    <strong className="text-[#0d1117]">{p.title}.</strong> {p.text}
                  </li>
                ))}
              </ol>
              <p className="text-[12px] text-[#6b7280]">The Merchant Partnership Agreement is generated for each merchant, pre-filled, from their dashboard or from the drawer here.</p>
            </div>
          </Card>
        </div>

        <Card
          title="My merchants"
          aside={
            <button type="button" onClick={() => void load()} className={btnGhost} aria-label="Refresh">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          }
        >
          {error && <p className="px-5 py-4 text-sm text-rose-700">{error}</p>}
          {loading && !data && (
            <p className="flex items-center gap-2 px-5 py-10 text-sm text-[#6b7280]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          )}
          {data && data.rows.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <Store className="h-8 w-8 text-[#d6b357]" />
              <p className="text-sm font-semibold text-[#0d1117]">No merchants yet</p>
              <p className="max-w-sm text-[13px] text-[#6b7280]">Share your merchant link with a restaurant, a cleaner, a spa or a school. They appear here the moment they register.</p>
            </div>
          )}
          {data && data.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="bg-[#f8fafc] text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#6b7280]">
                    <th className="px-5 py-2.5">Business</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Scans</th>
                    <th className="px-3 py-2.5 text-right">Deals</th>
                    <th className="px-5 py-2.5 text-right">My incentive</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => {
                    const m = r.merchant
                    const missing = (["agreement", "trade_licence", "emirates_id", "bank"] as const).filter((k) => !r.checklist[k].present).length
                    return (
                      <tr key={m.id} className="cursor-pointer border-t border-[#f0f2f5] hover:bg-[#f8fafc]" onClick={() => setOpen(m.id)}>
                        <td className="px-5 py-3">
                          <p className="font-semibold text-[#0d1117]">{m.business_name}</p>
                          <p className="text-[12px] text-[#6b7280]">{[m.category, m.emirate, m.code].filter(Boolean).join(" · ") || `registered ${fmtDate(m.created_at)}`}</p>
                        </td>
                        <td className="px-3 py-3">
                          <StatusPill status={m.status} />
                          {m.status === "onboarding" && <p className="mt-1 text-[12px] text-[#6b7280]">{4 - missing} of 4 documents · tap to upload for them</p>}
                          {m.status === "accepted" && m.agreement_ends_on && <p className="mt-1 text-[12px] text-[#6b7280]">to {fmtDate(m.agreement_ends_on)}</p>}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-[#374151]">{m.status === "accepted" ? r.scans_month : "–"}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-[#374151]">{m.status === "accepted" ? r.deals_month : "–"}</td>
                        <td className="px-5 py-3 text-right font-semibold tabular-nums text-[#0d1117]">{m.status === "accepted" ? fmtAed(r.agent_incentive_month) : "–"}</td>
                      </tr>
                    )
                  })}
                </tbody>
                {t && (
                  <tfoot>
                    <tr className="border-t border-[#e8eaed] bg-[#f8fafc] font-bold text-[#0d1117]">
                      <td className="px-5 py-2.5" colSpan={2}>This month</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{t.scans_month}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{t.deals_month}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{fmtAed(t.agent_incentive_month)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
          <p className="border-t border-[#e8eaed] px-5 py-3 text-[12px] leading-relaxed text-[#6b7280]">
            AED {AGENT_INCENTIVE_AED} per validated rental through your merchants&apos; QR codes, for as long as each merchant&apos;s agreement runs, paid on the {AGENT_PAY_DAY}th of the next month. A rental cancelled within {MERCHANT_CLAWBACK_DAYS} days is taken back.
          </p>
        </Card>
      </div>

      {open && <MerchantDrawer merchantId={open} mode="agent" onClose={() => setOpen(null)} onChanged={() => void load()} />}
    </div>
  )
}
