"use client"

import Link from "next/link"
import { QRCodeSVG } from "qrcode.react"
import { ArrowRight, Download } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { isMerchantRole } from "@/lib/app-roles"
import { MERCHANT_DOCUMENT_KINDS, MERCHANT_INCENTIVE_AED, fmtAed } from "@/lib/merchant/rules"
import { useState } from "react"
import { Card, DownloadLink, ErrorNote, Loading, PageTitle, StatusPill, Tile, ValidationPill, btnGold, fmtDate } from "./shared"
import { useMerchant } from "./use-merchant"
import MerchantDocumentsPage from "./documents-page"

/**
 * /merchant — an accepted merchant's overview: scans, closed deals, this
 * month's incentive, the QR, the newest rentals, the agent, the voucher and
 * the documents. Until acceptance the overview IS the documents checklist.
 */
export default function MerchantOverview() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(isMerchantRole(role))
  const { data, error, loading } = useMerchant()
  // The moment the page opened, for "days left" (impure calls stay out of render).
  const [now] = useState(() => Date.now())
  if (!allowed) return null
  if (loading) return <Loading />
  if (error || !data) return <ErrorNote text={error ?? "Couldn't load your record."} />
  if (data.merchant.status !== "accepted" && data.merchant.status !== "ended") return <MerchantDocumentsPage />

  const m = data.merchant
  const f = data.figures
  const daysLeft = m.agreement_ends_on ? Math.max(0, Math.round((Date.parse(`${m.agreement_ends_on}T00:00:00Z`) - now) / 86_400_000)) : null

  return (
    <div className="space-y-6">
      <PageTitle
        title={m.business_name}
        intro={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <StatusPill status={m.status} />
            <span>Agreement {fmtDate(m.agreement_starts_on)} to {fmtDate(m.agreement_ends_on)}</span>
            {m.code && (
              <>
                <span className="text-[#9ca3af]">·</span>
                <span>
                  Merchant code <strong className="font-mono text-[#001f3f]">{m.code}</strong>
                </span>
              </>
            )}
            {data.agent?.name && (
              <>
                <span className="text-[#9ca3af]">·</span>
                <span>Signed by {data.agent.name}</span>
              </>
            )}
          </span>
        }
        aside={
          m.code ? (
            <DownloadLink href="/api/merchant/qr?format=png" className={btnGold}>
              <Download className="h-4 w-4" /> Download QR
            </DownloadLink>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Scans this month" value={f.scans.month.toLocaleString("en-AE")} hint={`${f.scans.week} in the last 7 days · ${f.scans.total.toLocaleString("en-AE")} since you joined`} />
        <Tile label="Closed deals this month" value={f.month.validated + f.month.pending} hint={`${f.month.validated} validated · ${f.month.pending} waiting for validation`} />
        <Tile dark label="Your incentive this month" value={fmtAed(f.month.merchant_incentive)} hint={`${f.month.validated} validated × AED ${MERCHANT_INCENTIVE_AED} · paid on ${f.statement.merchant_pay_date}`} />
        <Tile label="Agreement ends" value={fmtDate(m.agreement_ends_on)} hint={daysLeft !== null ? `${daysLeft} days left · renews only in writing` : "Renews only in writing"} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card title="Your QR code" aside={m.accepted_at ? <span className="text-[12px] font-semibold text-[#6b7280]">Issued {fmtDate(m.accepted_at)}</span> : null}>
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <div className="flex h-[168px] w-[168px] shrink-0 items-center justify-center rounded-xl border border-[#e5e8ec] bg-white p-2.5">
              {data.qr.url ? <QRCodeSVG value={data.qr.url} size={148} level="M" fgColor="#001f3f" /> : null}
            </div>
            <div className="min-w-0 space-y-3">
              <p className="text-[14px] leading-relaxed text-[#4b5563]">
                Your customers scan it and open <strong className="text-[#001f3f]">rentsouq.ae</strong> under your code. Every scan is counted here, and every rental they close is credited to you.
              </p>
              {data.qr.url && <p className="font-mono text-[12px] text-[#6b7280]">{data.qr.url.replace(/^https?:\/\//, "")}</p>}
              <div className="flex flex-wrap gap-2">
                <DownloadLink href="/api/merchant/qr?format=png">QR (PNG)</DownloadLink>
                <DownloadLink href="/api/merchant/qr?format=flyer">Flyer A5</DownloadLink>
                <DownloadLink href="/api/merchant/qr?format=banner">Roll-up banner</DownloadLink>
              </div>
            </div>
          </div>
          <div className="mx-5 mb-5 rounded-xl bg-[#faf7ee] px-4 py-3 text-[13px] leading-relaxed text-[#4b5563]">
            Post your QR on your own pages twice a month. We feature {m.business_name} on rentsouq.ae twice a month too.
          </div>
        </Card>

        <Card title={`Closed deals · ${f.statement.label}`} aside={<Link href="/merchant/deals" className="text-[14px] font-semibold text-[#001f3f] hover:underline">See all</Link>}>
          {f.recent.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-[#6b7280]">No rentals through your QR yet. Once a customer scans and rents, it appears here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="bg-[#f8fafc] text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#6b7280]">
                    <th className="px-5 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Unit rented</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-5 py-2.5 text-right">Your incentive</th>
                  </tr>
                </thead>
                <tbody>
                  {f.recent.slice(0, 6).map((d) => (
                    <tr key={d.id} className="border-t border-[#f0f2f5]">
                      <td className="whitespace-nowrap px-5 py-2.5 text-[#374151]">{fmtDate(d.date)}</td>
                      <td className="px-3 py-2.5 text-[#0d1117]">{d.unit}</td>
                      <td className="px-3 py-2.5"><ValidationPill status={d.validation_status} /></td>
                      <td className={`px-5 py-2.5 text-right tabular-nums ${d.merchant_incentive ? "font-semibold text-[#0d1117]" : "text-[#6b7280]"}`}>{fmtAed(MERCHANT_INCENTIVE_AED)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 border-t border-[#e8eaed] bg-[#f8fafc] px-5 py-3.5">
            <div className="mr-auto">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7280]">{f.statement.label} statement</p>
              <p className="text-[14px] text-[#374151]">
                {f.statement.validated} validated deal{f.statement.validated === 1 ? "" : "s"} · <strong className="text-[#0d1117]">{fmtAed(f.statement.merchant_amount)}</strong> · paid by bank transfer on {f.statement.merchant_pay_date} · questions within 15 days
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <div className="p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7280]">Your FHI agent</p>
            {data.agent ? (
              <>
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#001f3f] font-['Outfit'] text-[15px] font-bold text-[#d6b357]">
                    {(data.agent.name ?? "?").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-[#0d1117]">{data.agent.name}</p>
                    <p className="text-[13px] text-[#6b7280]">{data.agent.role === "team_leader" ? "Team Leader" : "Agent"} · FHI Global</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.agent.whatsapp && (
                    <a href={`https://wa.me/${data.agent.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-800 hover:bg-emerald-100">WhatsApp</a>
                  )}
                  {data.agent.phone && <a href={`tel:${data.agent.phone}`} className="inline-flex items-center rounded-xl border border-[#e5e8ec] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#001f3f]">{data.agent.phone}</a>}
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-[#6b7280]">No agent is linked to this record.</p>
            )}
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7280]">Your customer voucher</p>
            <p className="mt-2 font-['Outfit'] text-[20px] font-bold leading-tight text-[#0d1117]">{m.voucher_offer || "Not set yet"}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-[#4b5563]">Every customer who rents through your QR gets this voucher. They redeem it with you directly; FHI and MCG buy the vouchers at your maximum discount.</p>
            <Link href="/merchant/business" className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[#001f3f] hover:underline">
              {m.voucher_offer ? "Change the voucher" : "Set the voucher"} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7280]">Documents</p>
            <ul className="mt-3 space-y-2 text-[14px] text-[#374151]">
              {MERCHANT_DOCUMENT_KINDS.map(({ kind, label }) => {
                const c = data.checklist[kind]
                return (
                  <li key={kind} className="flex items-center gap-2">
                    <span className={`flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px] font-bold ${c.present ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{c.present ? "✓" : "!"}</span>
                    <span className="truncate">{label}</span>
                    {kind === "trade_licence" && m.trade_licence_expires_on && <span className="ml-auto whitespace-nowrap text-[12px] text-[#6b7280]">expires {fmtDate(m.trade_licence_expires_on)}</span>}
                    {kind === "bank" && m.iban_masked && <span className="ml-auto whitespace-nowrap text-[12px] text-[#6b7280]">{m.bank_name ? `${m.bank_name} · ` : ""}{m.iban_masked}</span>}
                  </li>
                )
              })}
            </ul>
            <Link href="/merchant/documents" className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[#001f3f] hover:underline">
              Open documents <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
