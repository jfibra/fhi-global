"use client"

import { type ReactNode } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { MERCHANT_STATUS_LABELS, type MerchantStatus } from "@/lib/merchant/rules"

/** The merchant dashboard's building blocks (features/dashboard/merchant). */

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric", timeZone: iso.length === 10 ? "UTC" : "Asia/Dubai" }) : "—"

export function StatusPill({ status }: { status: MerchantStatus }) {
  const tone =
    status === "accepted"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : status === "submitted"
        ? "bg-sky-50 text-sky-800 border-sky-200"
        : status === "onboarding"
          ? "bg-amber-50 text-amber-800 border-amber-200"
          : "bg-rose-50 text-rose-800 border-rose-200"
  const dot = status === "accepted" ? "bg-emerald-500" : status === "submitted" ? "bg-sky-500" : status === "onboarding" ? "bg-amber-500" : "bg-rose-500"
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {MERCHANT_STATUS_LABELS[status]}
    </span>
  )
}

export function ValidationPill({ status }: { status: string }) {
  const tone = status === "validated" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : status === "invalid" ? "bg-rose-50 text-rose-800 border-rose-200" : "bg-amber-50 text-amber-800 border-amber-200"
  const label = status === "validated" ? "Validated" : status === "invalid" ? "Invalid" : status === "under_review" ? "Under review" : "Waiting for validation"
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${tone}`}>{label}</span>
}

export function Tile({ label, value, hint, dark }: { label: string; value: ReactNode; hint?: ReactNode; dark?: boolean }) {
  return (
    <section className={`rounded-2xl border p-5 ${dark ? "border-[#001f3f] bg-[#001f3f] text-white" : "border-[#e8eaed] bg-white"}`}>
      <p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${dark ? "text-[#d6b357]" : "text-[#6b7280]"}`}>{label}</p>
      <p className={`mt-1.5 font-['Outfit'] text-[30px] font-bold leading-none tabular-nums ${dark ? "text-white" : "text-[#0d1117]"}`}>{value}</p>
      {hint && <p className={`mt-2 text-[13px] ${dark ? "text-[#c1c5cb]" : "text-[#6b7280]"}`}>{hint}</p>}
    </section>
  )
}

export function Card({ title, aside, children, className = "" }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-[#e8eaed] bg-white ${className}`}>
      {(title || aside) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-[#e8eaed] px-5 py-4">
          {title && <h2 className="font-['Outfit'] text-[17px] font-bold text-[#0d1117]">{title}</h2>}
          {aside && <div className="ml-auto flex items-center gap-2">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7280]">{children}</p>
}

export function PageTitle({ title, intro, aside }: { title: string; intro?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-['Outfit'] text-[28px] font-bold uppercase leading-tight text-[#0d1117]">{title}</h1>
        {intro && <div className="mt-1 text-sm text-[#6b7280]">{intro}</div>}
      </div>
      {aside && <div className="flex flex-wrap items-center gap-2">{aside}</div>}
    </div>
  )
}

export function Loading({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 py-16 text-sm text-[#6b7280]">
      <Loader2 className="h-4 w-4 animate-spin" /> {text}
    </div>
  )
}

export function ErrorNote({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {text}
    </div>
  )
}

export const btnPrimary = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#001f3f] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#002952] disabled:cursor-not-allowed disabled:opacity-50"
export const btnGold = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#d6b357] px-4 py-2.5 font-['Outfit'] text-sm font-bold text-[#001428] transition-colors hover:bg-[#c8a544] disabled:cursor-not-allowed disabled:opacity-50"
export const btnGhost = "inline-flex items-center justify-center gap-2 rounded-xl border border-[#e5e8ec] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#001f3f] transition-colors hover:border-[#001f3f] disabled:cursor-not-allowed disabled:opacity-50"
export const inputCls = "w-full rounded-xl border border-[#e5e8ec] bg-white px-3.5 py-2.5 text-sm text-[#0d1117] placeholder:text-[#9ca3af] focus:border-[#001f3f] focus:outline-none focus:ring-4 focus:ring-[#001f3f]/5"
export const labelCls = "mb-1 block text-xs font-semibold text-[#374151]"

/**
 * A plain anchor to one of the merchant API downloads (the QR PNG, the flyer,
 * the agreement PDF). Those are route handlers that answer with a file, not
 * pages, so next/link's client navigation is the wrong tool; the lint rule
 * can't tell the two apart.
 */
export function DownloadLink({ href, children, className = btnGhost }: { href: string; children: ReactNode; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a href={href} className={className}>
      {children}
    </a>
  )
}
