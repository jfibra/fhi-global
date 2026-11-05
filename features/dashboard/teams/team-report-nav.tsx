"use client"

// Navigation for the Team Performance Report. From lg up: a sticky timeline on the LEFT — a vertical
// line, one numbered node per section, the section's verdict fact under its title, the current
// section filled navy. Click a node and the report scrolls there. Below lg: one big "Jump to section"
// select stuck to the top of the scrolling area, with a progress line. (Not a tablist: nothing is
// hidden, every section is on the page.)

import { useId, type ReactNode, type Ref } from "react"
import { FileDown, Loader2, Target } from "lucide-react"
import { TONE, type Verdict } from "./team-report-verdicts"

export type NavSection = { id: string; n: string; title: string; verdict: Verdict | null }

type Props = { sections: NavSection[]; activeId: string; onJump: (id: string) => void }

export function TeamReportNav({ sections, activeId, onJump, footer }: Props & { footer?: ReactNode }) {
  const activeIndex = sections.findIndex((s) => s.id === activeId)
  return (
    <nav aria-label="Report sections">
      <p className="mb-3 px-1 text-[14px] font-bold uppercase tracking-[0.12em] text-[#4b5563]">In this report</p>
      <ol className="relative">
        <span className="absolute bottom-6 left-[21px] top-6 w-0.5 bg-[#cfd5de]" aria-hidden />
        {sections.map((s, i) => {
          const active = s.id === activeId
          const passed = i < activeIndex
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onJump(s.id)}
                aria-current={active ? "location" : undefined}
                className={`relative flex w-full items-start gap-3 rounded-xl px-1.5 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#001f3f] ${active ? "bg-white shadow-sm ring-1 ring-[#dfe3e9]" : "hover:bg-white/70"}`}
              >
                <span
                  className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 font-['Outfit'] text-[15px] font-bold ${active ? "border-[#001f3f] bg-[#001f3f] text-[#f0d89b]" : passed ? "border-[#001f3f] bg-[#e5e9f0] text-[#001f3f]" : "border-[#b6bec9] bg-white text-[#374151]"}`}
                  aria-hidden
                >
                  {s.n || <Target className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1 pt-0.5">
                  <span className={`block text-[16px] leading-snug ${active ? "font-bold text-[#001f3f]" : "font-semibold text-[#1f2937]"}`}>{s.title}</span>
                  {s.verdict && (
                    <span className="mt-1 flex items-start gap-1.5 text-[14px] leading-snug text-[#374151]">
                      <span className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: TONE[s.verdict.tone].dot }} aria-hidden />
                      <span>
                        <span className="sr-only">{TONE[s.verdict.tone].word}: </span>
                        {s.verdict.fact}
                      </span>
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      {footer ? <div className="mt-5">{footer}</div> : null}
    </nav>
  )
}

/** Phone and tablet: one select with the section names, stuck to the top of the scroll area. `barRef` lets the shell measure its height. */
export type JumpBarExport = { onExport: () => void; canExport: boolean; exporting: boolean }

export function TeamReportJumpBar({ sections, activeId, onJump, barRef, exportAction }: Props & { barRef: Ref<HTMLDivElement>; exportAction?: JumpBarExport }) {
  const selectId = useId()
  const index = Math.max(0, sections.findIndex((s) => s.id === activeId))
  return (
    <div ref={barRef} className="sticky top-0 z-20 border-b border-[#dfe3e9] bg-[#f4f6f9]/95 px-4 py-2.5 backdrop-blur sm:px-6 lg:hidden">
      <label htmlFor={selectId} className="text-[14px] font-semibold text-[#4b5563]">
        Jump to section · {index + 1} of {sections.length}
      </label>
      <div className="mt-1 flex items-stretch gap-2">
        <select
          id={selectId}
          value={activeId}
          onChange={(e) => onJump(e.target.value)}
          className="block min-w-0 flex-1 rounded-xl border border-[#b6bec9] bg-white px-3 py-2.5 text-[16px] font-semibold text-[#001f3f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#001f3f]"
        >
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.n ? `${s.n} · ` : ""}
              {s.title}
            </option>
          ))}
        </select>
        {exportAction && (
          <button
            type="button"
            onClick={exportAction.onExport}
            disabled={!exportAction.canExport}
            aria-label="Export PDF"
            title={exportAction.canExport ? "Download this report as a PDF" : "Available when the report has finished"}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#d6b357] px-3.5 text-[16px] font-bold text-[#001f3f] transition-colors hover:bg-[#c9a449] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#001f3f] disabled:cursor-not-allowed disabled:opacity-50 sm:hidden"
          >
            {exportAction.exporting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <FileDown className="h-5 w-5" aria-hidden />}
            PDF
          </button>
        )}
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-[#dfe3e9]" aria-hidden>
        <div className="h-1.5 rounded-full bg-[#d6b357] transition-all" style={{ width: `${((index + 1) / sections.length) * 100}%` }} />
      </div>
    </div>
  )
}
