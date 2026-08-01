"use client"

// Export control for the Sales Reports. The parent owns the actual work (it's
// the only thing that knows the active filters); this is just the menu, the
// busy state, and the outside-click handling.

import { useEffect, useRef, useState } from "react"
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react"

export type ExportFormat = "csv" | "pdf"

export function SaleExportButton({
  onExport,
  disabled,
  className = "",
}: {
  onExport: (format: ExportFormat) => Promise<void>
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<ExportFormat | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const run = async (format: ExportFormat) => {
    if (busy) return
    setOpen(false)
    setBusy(format)
    try {
      await onExport(format)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div ref={wrapRef} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || busy !== null}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-[#001f3f]/15 bg-white text-sm font-bold text-[#001f3f] hover:border-[#001f3f]/40 hover:bg-[#f7f8fa] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {busy === "csv" ? "Preparing Excel…" : busy === "pdf" ? "Preparing PDF…" : "Export"}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-60 rounded-2xl border border-black/[0.08] bg-white shadow-lg shadow-black/10 overflow-hidden"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => void run("csv")}
            className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[#f7f8fa] transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 mt-0.5 text-[#001f3f] shrink-0" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[#0d1117]">Excel</span>
              <span className="block text-xs text-[#6b7280]">.csv — opens in Excel or Sheets</span>
            </span>
          </button>
          <div className="h-px bg-[#f0f2f5]" />
          <button
            type="button"
            role="menuitem"
            onClick={() => void run("pdf")}
            className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[#f7f8fa] transition-colors"
          >
            <FileText className="w-4 h-4 mt-0.5 text-[#001f3f] shrink-0" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[#0d1117]">PDF</span>
              <span className="block text-xs text-[#6b7280]">Opens print — choose &ldquo;Save as PDF&rdquo;</span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
