"use client"

/**
 * FHI Assistant → "PDF report" (boss via Juliecor, 2026-10-15): the company
 * performance report as a downloadable PDF for a chosen period, built by
 * app/api/admin/reports/company. Fetched as a blob so the button can show
 * progress (a build takes several seconds) and a readable error.
 */

import { useState } from "react"
import { ChevronDown, FileDown, Loader2 } from "lucide-react"

const PERIODS = [
  { key: "today", label: "Today", hint: "Daily report" },
  { key: "last7", label: "Last 7 days", hint: "Weekly report" },
  { key: "month", label: "This month", hint: "Month to date" },
  { key: "last_month", label: "Last month", hint: "Full month" },
] as const

/** Fetch the report PDF for a period and save it under the server's file name. Throws a readable error. */
export async function downloadReportPdf(endpoint: string, key: string): Promise<void> {
  const res = await fetch(`${endpoint}?period=${key}`, { cache: "no-store" })
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(json.error ?? `Request failed (${res.status}).`)
  }
  const blob = await res.blob()
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? `fhi-report-${key}.pdf`
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}

export default function PdfReportMenu({ endpoint, disabled = false }: { endpoint: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const download = async (key: string, label: string) => {
    setOpen(false)
    setBusy(label)
    setError(null)
    try {
      await downloadReportPdf(endpoint, key)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't build the report.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <span className="relative inline-flex items-center gap-2">
      <button
        type="button"
        disabled={disabled || busy !== null}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#d6b357] px-3 py-1 text-[12px] font-bold text-[#001f3f] transition-colors hover:bg-[#c9a449] disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
        {busy ? `Preparing ${busy} PDF…` : "PDF report"}
        {!busy && <ChevronDown className="h-3 w-3" />}
      </button>
      {error && <span className="text-[11.5px] text-rose-600">{error}</span>}
      {open && (
        <>
          <button type="button" aria-label="Close menu" tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
          <div role="menu" className="absolute bottom-full right-0 z-50 mb-2 w-60 sm:left-0 sm:right-auto overflow-hidden rounded-xl border border-[#e3e6ea] bg-white py-1 shadow-[0_18px_40px_-12px_rgba(0,31,63,0.35)]">
            <p className="px-3 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-wide text-[#9ca3af]">Company report as PDF</p>
            {PERIODS.map((p) => (
              <button key={p.key} type="button" role="menuitem" onClick={() => void download(p.key, p.label.toLowerCase())} className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-[#f4f6f9]">
                <span className="text-[13px] font-semibold text-[#001f3f]">{p.label}</span>
                <span className="text-[11px] text-[#9ca3af]">{p.hint}</span>
              </button>
            ))}
            <p className="border-t border-[#eef0f3] px-3 py-2 text-[11px] leading-snug text-[#6b7280]">Teams, sales, pipeline, recruitment, leads, website and recommendations — about 10 seconds to build.</p>
          </div>
        </>
      )}
    </span>
  )
}
