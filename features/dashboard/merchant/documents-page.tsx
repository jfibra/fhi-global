"use client"

import Link from "next/link"
import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { isMerchantRole } from "@/lib/app-roles"
import { MERCHANT_DOCUMENT_KINDS, MERCHANT_REVIEW_DAYS } from "@/lib/merchant/rules"
import { DocumentsPanel } from "./documents-panel"
import { Card, ErrorNote, Loading, PageTitle, StatusPill, fmtDate } from "./shared"
import { useMerchant } from "./use-merchant"

/** /merchant/documents — the four official requirements and where the application stands. */
export default function MerchantDocumentsPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(isMerchantRole(role))
  const { data, error, loading, reload } = useMerchant()
  if (!allowed) return null
  if (loading) return <Loading />
  if (error || !data) return <ErrorNote text={error ?? "Couldn't load your record."} />

  const m = data.merchant
  const present = MERCHANT_DOCUMENT_KINDS.filter(({ kind }) => data.checklist[kind].present).length
  const steps = [
    { label: "Business details", done: !!m.business_name && !!m.category, hint: m.category ?? "Fill in your business profile" },
    { label: "Documents", done: present === 4, hint: `${present} of 4 in` },
    { label: "Sign the agreement", done: data.checklist.agreement.present, hint: data.checklist.agreement.present ? "Signed" : "On screen, or upload the signed PDF" },
    { label: "FHI review", done: m.status === "accepted", hint: m.status === "accepted" ? `Accepted ${fmtDate(m.accepted_at)}` : m.status === "submitted" ? "Under review" : `Within ${MERCHANT_REVIEW_DAYS} working days` },
  ]

  return (
    <div className="space-y-6">
      <PageTitle
        title={m.status === "accepted" ? "Documents" : "Get your QR code"}
        intro={
          m.status === "accepted"
            ? "The four requirements on file. Replace one if it changes, for example a renewed trade licence."
            : <>Four official requirements, then FHI reviews and issues your QR, flyer and roll-up banner.{data.agent ? <> Your agent, <span className="font-semibold text-[#374151]">{data.agent.name}</span>, can upload any of these for you.</> : null}</>
        }
        aside={<StatusPill status={m.status} />}
      />

      {m.status === "declined" && (
        <ErrorNote text={`FHI declined this application${m.decline_reason ? `: ${m.decline_reason}` : "."} ${data.agent?.name ? `${data.agent.name} can tell you what would change this.` : ""}`} />
      )}

      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Onboarding steps">
        {steps.map((s, i) => {
          const current = !s.done && steps.slice(0, i).every((p) => p.done)
          return (
            <li key={s.label} className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3.5 ${current ? "border-2 border-[#001f3f]" : "border-[#e8eaed]"}`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${s.done ? "bg-emerald-50 text-emerald-800" : current ? "bg-[#001f3f] text-white" : "bg-[#f1f5f9] text-[#475569]"}`}>{s.done ? "✓" : i + 1}</span>
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-[#0d1117]">{s.label}</p>
                <p className="truncate text-[12px] text-[#6b7280]">{s.hint}</p>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <DocumentsPanel data={data} merchantId={null} who="merchant" onChanged={() => void reload()} />

        <div className="space-y-4">
          <section className="rounded-2xl bg-[#001f3f] p-5 text-white">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#d6b357]">What happens next</p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14px] leading-relaxed">
              <li>FHI checks your licence and documents within {MERCHANT_REVIEW_DAYS} working days.</li>
              <li>The agreement runs one year from the day you are accepted.</li>
              <li>You get your unique QR code, an A5 flyer and a roll-up banner, by email and here.</li>
              <li>Your customers scan, rent, and you earn AED 100 per rented unit.</li>
            </ol>
          </section>
          {data.agent && (
            <Card title="Your FHI agent">
              <div className="flex items-center gap-3 px-5 py-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#001f3f] font-['Outfit'] text-[15px] font-bold text-[#d6b357]">
                  {(data.agent.name ?? "?").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-[#0d1117]">{data.agent.name}</p>
                  <p className="text-[13px] text-[#6b7280]">Can upload documents for you</p>
                </div>
                {data.agent.whatsapp && (
                  <a href={`https://wa.me/${data.agent.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="ml-auto rounded-xl bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-800 hover:bg-emerald-100">
                    WhatsApp
                  </a>
                )}
              </div>
            </Card>
          )}
          <Card title="The programme in short">
            <ul className="space-y-2 px-5 py-4 text-[13px] leading-relaxed text-[#4b5563]">
              <li>AED 100 for every unit your customers rent, paid monthly on the 15th.</li>
              <li>A discount voucher for each of those customers, redeemed with you.</li>
              <li>Twice a month we feature you on rentsouq.ae; twice a month you post the QR on your own pages.</li>
              <li>One-year agreement; it renews only in writing.</li>
            </ul>
            <div className="border-t border-[#e8eaed] px-5 py-3">
              <Link href="/merchant/business" className="text-[13px] font-semibold text-[#001f3f] hover:underline">Edit your business profile</Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
