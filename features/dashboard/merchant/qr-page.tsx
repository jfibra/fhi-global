"use client"

import Link from "next/link"
import { QRCodeSVG } from "qrcode.react"
import { Download } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { isMerchantRole } from "@/lib/app-roles"
import { Card, DownloadLink, ErrorNote, Loading, PageTitle, StatusPill, btnGold, fmtDate } from "./shared"
import { useMerchant } from "./use-merchant"

/** /merchant/qr — the QR, the flyer and the roll-up banner, and how to use them. */
export default function MerchantQrPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(isMerchantRole(role))
  const { data, error, loading } = useMerchant()
  if (!allowed) return null
  if (loading) return <Loading />
  if (error || !data) return <ErrorNote text={error ?? "Couldn't load your record."} />
  const m = data.merchant

  if (!data.qr.url) {
    return (
      <div className="space-y-6">
        <PageTitle title="My QR & materials" aside={<StatusPill status={m.status} />} />
        <Card>
          <div className="p-6 text-sm text-[#4b5563]">
            Your QR code, A5 flyer and roll-up banner are issued the moment FHI accepts your application.{" "}
            <Link href="/merchant/documents" className="font-semibold text-[#001f3f] hover:underline">Finish the documents</Link> to get there.
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="My QR & materials"
        intro={<>Code <strong className="font-mono text-[#001f3f]">{m.code}</strong> · issued {fmtDate(m.accepted_at)} · opens {data.qr.url.replace(/^https?:\/\//, "")}</>}
        aside={
          <DownloadLink href="/api/merchant/qr?format=png" className={btnGold}>
            <Download className="h-4 w-4" /> QR (PNG)
          </DownloadLink>
        }
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card title="The QR code">
          <div className="flex flex-col items-center gap-4 p-6">
            <div className="rounded-2xl border border-[#e5e8ec] bg-white p-4">
              <QRCodeSVG value={data.qr.url} size={260} level="M" fgColor="#001f3f" />
            </div>
            <p className="text-center text-[13px] text-[#6b7280]">Scans open fhiglobal.ae, which counts the scan and forwards your customer to rentsouq.ae under your code.</p>
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="Print-ready files">
            <ul className="divide-y divide-[#f0f2f5]">
              {[
                { href: "/api/merchant/qr?format=png", label: "QR code · PNG", hint: "1024 px, for your website, social pages, menus and email." },
                { href: "/api/merchant/qr?format=flyer", label: "Flyer · A5 PDF", hint: "Put it by the till, on tables, or hand it out." },
                { href: "/api/merchant/qr?format=banner", label: "Roll-up banner · 85 × 200 cm PDF", hint: "Send it to your printer for the shop entrance." },
              ].map((f) => (
                <li key={f.href} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-[#0d1117]">{f.label}</p>
                    <p className="text-[13px] text-[#6b7280]">{f.hint}</p>
                  </div>
                  <DownloadLink href={f.href}>
                    <Download className="h-4 w-4" /> Download
                  </DownloadLink>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="How to use it">
            <ol className="list-decimal space-y-2 px-5 py-4 pl-9 text-[14px] leading-relaxed text-[#4b5563]">
              <li>Display the flyer or banner in your store, office or shop, and let your staff hand the flyer out.</li>
              <li>Post the QR on your website, social pages and email blast twice a month. We feature you on rentsouq.ae twice a month too.</li>
              <li>Each customer who rents through it gets your voucher{m.voucher_offer ? ` (${m.voucher_offer})` : ""}, redeemed with you.</li>
              <li>You earn AED 100 for every rented unit, on your statement each month.</li>
            </ol>
          </Card>
        </div>
      </div>
    </div>
  )
}
