"use client"

// The report's top bar: logo, title, Export PDF, Close, and the period chips.
//
// Phone layout: the title row holds only the logo, the title and Close, so the title is never
// squeezed by a button (it used to wrap over Export PDF). Export PDF then lives in the jump bar
// below (team-report-nav.tsx), where it stays in reach while the report scrolls. From sm up the
// Export PDF button sits here, as before.

import { FileDown, Loader2, Sparkles, X } from "lucide-react"
import { LogoTile } from "@/components/common/logo-tile"

export type Preset = "3m" | "6m" | "ytd" | "12m" | "custom"

export const PRESETS: Array<{ key: Preset; label: string }> = [
  { key: "3m", label: "Last 3 months" },
  { key: "6m", label: "Last 6 months" },
  { key: "ytd", label: "This year" },
  { key: "12m", label: "Last 12 months" },
  { key: "custom", label: "Custom" },
]

const chip = (on: boolean) =>
  `rounded-full px-4 py-2 text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d6b357] ${on ? "bg-[#d6b357] text-[#001f3f]" : "bg-white/10 text-white hover:bg-white/20"}`

const dateInput = "rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-[15px] font-semibold text-white [color-scheme:dark]"

type Props = {
  team: { name: string; logo_url: string | null }
  preset: Preset
  onPreset: (p: Preset) => void
  customFrom: string
  customTo: string
  onCustomFrom: (iso: string) => void
  onCustomTo: (iso: string) => void
  /** "1 Sep 2026 – 6 Nov 2026", or the hint shown when the custom range is not valid. */
  rangeLabel: string
  canExport: boolean
  exporting: boolean
  exportError: string | null
  onExport: () => void
  onClose: () => void
}

export function TeamReportHeader({
  team, preset, onPreset, customFrom, customTo, onCustomFrom, onCustomTo, rangeLabel, canExport, exporting, exportError, onExport, onClose,
}: Props) {
  return (
    <header className="shrink-0 bg-[#001f3f] text-white shadow-lg">
      <div className="mx-auto flex w-full max-w-[1320px] items-center gap-3 px-4 py-3 sm:px-6">
        {team.logo_url ? (
          <LogoTile src={team.logo_url} alt="" className="h-14 w-24 rounded-xl p-1.5 sm:h-16 sm:w-28" />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <Sparkles className="h-5 w-5 text-[#d6b357]" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold uppercase tracking-[0.08em] text-[#f0d89b] sm:tracking-[0.16em]">Team Performance Report</p>
          <h2 className="truncate font-['Outfit'] text-[22px] font-bold leading-tight">{team.name}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          {exportError && <span className="hidden max-w-[240px] truncate text-[14px] text-rose-200 sm:inline" title={exportError}>{exportError}</span>}
          <button
            type="button"
            onClick={onExport}
            disabled={!canExport}
            title={canExport ? "Download this report as a PDF" : "Available when the report has finished"}
            className="hidden items-center gap-2 rounded-xl bg-[#d6b357] px-5 py-2.5 text-[16px] font-bold text-[#001f3f] transition-colors hover:bg-[#c9a449] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex"
          >
            {exporting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <FileDown className="h-5 w-5" aria-hidden />}
            {exporting ? "Preparing PDF…" : "Export PDF"}
          </button>
          <button type="button" onClick={onClose} aria-label="Close report" className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-[1320px] flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
          {PRESETS.map((p) => (
            <button key={p.key} type="button" aria-pressed={preset === p.key} onClick={() => onPreset(p.key)} className={chip(preset === p.key)}>
              {p.label}
            </button>
          ))}
          {preset === "custom" && (
            <span className="flex flex-wrap items-center gap-2 text-[15px] text-white/80">
              <input type="date" aria-label="From" value={customFrom} max={customTo} onChange={(e) => onCustomFrom(e.target.value)} className={dateInput} />
              to
              <input type="date" aria-label="To" value={customTo} min={customFrom} onChange={(e) => onCustomTo(e.target.value)} className={dateInput} />
            </span>
          )}
          <span className="ml-auto text-[14px] text-white/75">{rangeLabel}</span>
        </div>
      </div>
      {exportError && (
        <p role="alert" className="border-t border-white/10 px-4 py-2 text-[14px] text-rose-200 sm:hidden">{exportError}</p>
      )}
    </header>
  )
}
