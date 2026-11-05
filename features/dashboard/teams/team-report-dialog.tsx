"use client"

// Team Performance Report (boss, 2026-11-05): the admin Teams page's "Performance report" button
// opens this full-screen view for the selected team. The figures arrive first and FHI Assistant's
// analysis a few seconds later (GET /api/admin/teams/[id]/report, streamed). "Export PDF" posts the
// analysis shown here back to the same route, so the PDF says exactly what the screen says.
//
// Redesign for readers aged 40+ (2026-11-05): a timeline on the left that jumps to a section and
// follows the reader (use-section-spy), verdicts per section (team-report-verdicts), report-size
// charts (team-report-charts), the sections themselves in team-report-view / team-report-recruits.
// This file is only the shell: header, period, the stream, export, focus handling and the layout.

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AlertTriangle, FileDown, Loader2, Sparkles, X } from "lucide-react"
import { gaEvent } from "@/lib/ga"
import type { TeamReport } from "@/lib/team-report/data"
import type { TeamInsights } from "@/lib/team-report/insights"
import { TeamReportJumpBar, TeamReportNav } from "./team-report-nav"
import { TeamReportView } from "./team-report-view"
import { fmtDay } from "./team-report-ui"
import { SECTIONS, sectionVerdicts } from "./team-report-verdicts"
import { useSectionSpy } from "./use-section-spy"

type ReportEvent =
  | { type: "status"; text: string }
  | { type: "report"; report: TeamReport }
  | { type: "insights"; insights: TeamInsights }
  | { type: "done" }
  | { type: "error"; error: string }

type Run = { key: string; status: string; report: TeamReport | null; insights: TeamInsights | null; error: string | null; done: boolean }
type Preset = "3m" | "6m" | "ytd" | "12m" | "custom"

const PRESETS: Array<{ key: Preset; label: string }> = [
  { key: "3m", label: "Last 3 months" },
  { key: "6m", label: "Last 6 months" },
  { key: "ytd", label: "This year" },
  { key: "12m", label: "Last 12 months" },
  { key: "custom", label: "Custom" },
]
const SECTION_IDS = SECTIONS.map((s) => s.key)
const FOCUSABLE = 'button:not([disabled]), select, input:not([disabled]), summary, a[href], [tabindex]:not([tabindex="-1"])'

// ─── Period ──────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0")
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const ISO = /^\d{4}-\d{2}-\d{2}$/
const addDay = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

/** [from, to) for a preset, from the browser's calendar (the same clock the Team sales panel uses). */
function spanFor(preset: Preset, today: Date, customFrom: string, customTo: string): { from: string; to: string } | null {
  const tomorrow = isoOf(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1))
  const monthsBack = (n: number) => isoOf(new Date(today.getFullYear(), today.getMonth() - n, 1))
  if (preset === "3m") return { from: monthsBack(2), to: tomorrow }
  if (preset === "6m") return { from: monthsBack(5), to: tomorrow }
  if (preset === "12m") return { from: monthsBack(11), to: tomorrow }
  if (preset === "ytd") return { from: `${today.getFullYear()}-01-01`, to: tomorrow }
  if (!ISO.test(customFrom) || !ISO.test(customTo) || customFrom > customTo) return null
  const to = addDay(customTo, 1)
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${customFrom}T00:00:00Z`)) / 86_400_000
  return days >= 7 && days <= 370 ? { from: customFrom, to } : null
}

// ─── Network ─────────────────────────────────────────────────────────────────

/** Reads the report stream; onEvent gets each stage. Throws a readable error. */
async function streamReport(url: string, signal: AbortSignal, onEvent: (e: ReportEvent) => void): Promise<void> {
  const res = await fetch(url, { cache: "no-store", headers: { Accept: "text/event-stream" }, signal })
  if (!res.ok || !res.body || !(res.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const json = (await res.json().catch(() => ({}))) as { report?: TeamReport; insights?: TeamInsights; error?: string }
    if (!res.ok || !json.report) throw new Error(json.error ?? "Couldn't build the report — try again.")
    onEvent({ type: "report", report: json.report })
    if (json.insights) onEvent({ type: "insights", insights: json.insights })
    onEvent({ type: "done" })
    return
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let finished = false
  while (!finished) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let cut: number
    while ((cut = buffer.indexOf("\n\n")) >= 0) {
      const line = buffer.slice(0, cut).trim()
      buffer = buffer.slice(cut + 2)
      if (!line.startsWith("data:")) continue
      const ev = JSON.parse(line.slice(5)) as ReportEvent
      if (ev.type === "error") throw new Error(ev.error || "Couldn't build the report — try again.")
      onEvent(ev)
      if (ev.type === "done") finished = true
    }
  }
  if (!finished) throw new Error("The report was cut off — try again.")
}

/** POSTs the analysis shown on screen and saves the PDF under the server's file name. */
async function exportPdf(teamId: string, body: { from: string; to: string; insights: TeamInsights | null }): Promise<void> {
  const res = await fetch(`/api/admin/teams/${teamId}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(json.error ?? `Request failed (${res.status}).`)
  }
  const blob = await res.blob()
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "fhi-team-report.pdf"
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}

// ─── Dialog ──────────────────────────────────────────────────────────────────

export function TeamReportDialog({ team, onClose }: { team: { id: string; name: string; logo_url: string | null }; onClose: () => void }) {
  // The clock is read once, when the dialog opens (renders stay pure).
  const [today] = useState(() => new Date())
  const [preset, setPreset] = useState<Preset>("3m")
  const [customFrom, setCustomFrom] = useState(() => isoOf(new Date(today.getFullYear(), today.getMonth() - 2, 1)))
  const [customTo, setCustomTo] = useState(() => isoOf(today))
  const [run, setRun] = useState<Run | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const dialogRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  const span = useMemo(() => spanFor(preset, today, customFrom, customTo), [preset, today, customFrom, customTo])
  const key = span ? `${team.id}|${span.from}|${span.to}` : ""

  useEffect(() => {
    if (!span) return
    const ctrl = new AbortController()
    const patch = (p: Partial<Run>) => setRun((cur) => ({ ...(cur?.key === key ? cur : { key, status: "", report: null, insights: null, error: null, done: false }), ...p }))
    const onEvent = (e: ReportEvent) => {
      if (e.type === "status") patch({ status: e.text })
      else if (e.type === "report") {
        patch({ report: e.report })
        gaEvent("team_report_open", { team_id: team.id, from: span.from, to: span.to })
      } else if (e.type === "insights") patch({ insights: e.insights })
      else if (e.type === "done") patch({ done: true })
    }
    streamReport(`/api/admin/teams/${team.id}/report?from=${span.from}&to=${span.to}&format=json`, ctrl.signal, onEvent).catch((e: unknown) => {
      if (!ctrl.signal.aborted) patch({ error: e instanceof Error ? e.message : "Couldn't build the report — try again.", done: true })
    })
    return () => ctrl.abort()
  }, [key, span, team.id])

  // Escape closes; Tab stays inside; the page behind does not scroll; focus goes to the dialog on open
  // and back to the button that opened it on close (it stays mounted on the Teams page).
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const node = dialogRef.current
    node?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current()
        return
      }
      if (e.key !== "Tab" || !node) return
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (!active || active === node || !node.contains(active)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
      opener?.focus()
    }
  }, [])

  const state = run?.key === key ? run : null
  const r = state?.report ?? null
  const ins = state?.insights ?? null
  const failed = state?.error ?? null
  const writing = !!r && !ins && !state?.done
  const canExport = !!r && !!state?.done && !exporting
  const verdicts = useMemo(() => (r ? sectionVerdicts(r, ins) : null), [r, ins])

  // Below lg the jump bar sticks to the top of the scrolling area, so jumps and the spy leave room for it.
  const { activeId, jumpTo } = useSectionSpy({
    container: scrollRef,
    ids: SECTION_IDS,
    offset: () => (window.matchMedia("(min-width: 1024px)").matches ? 0 : (barRef.current?.offsetHeight ?? 0)),
    enabled: !!r,
  })

  const doExport = async () => {
    if (!r || !span) return
    setExporting(true)
    setExportError(null)
    try {
      await exportPdf(team.id, { from: span.from, to: span.to, insights: ins })
      gaEvent("team_report_pdf", { team_id: team.id, from: span.from, to: span.to, source: ins?.source ?? "rules" })
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Couldn't export the PDF.")
    } finally {
      setExporting(false)
    }
  }

  const chip = (on: boolean) => `rounded-full px-4 py-2 text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d6b357] ${on ? "bg-[#d6b357] text-[#001f3f]" : "bg-white/10 text-white hover:bg-white/20"}`
  const sections = verdicts ? SECTIONS.map((s) => ({ id: s.key, n: s.n, title: s.title, verdict: verdicts[s.key] })) : []

  return createPortal(
    <div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-[200] flex flex-col bg-[#f4f6f9] outline-none" role="dialog" aria-modal="true" aria-label={`Performance report — ${team.name}`}>
      {/* Top bar */}
      <header className="shrink-0 bg-[#001f3f] text-white shadow-lg">
        <div className="mx-auto flex w-full max-w-[1320px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10">
            {team.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={team.logo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <Sparkles className="h-5 w-5 text-[#d6b357]" aria-hidden />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold uppercase tracking-[0.16em] text-[#f0d89b]">Team Performance Report</p>
            <h2 className="truncate font-['Outfit'] text-[22px] font-bold leading-tight">{team.name}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            {exportError && <span className="hidden max-w-[240px] truncate text-[14px] text-rose-200 sm:inline" title={exportError}>{exportError}</span>}
            <button
              type="button"
              onClick={doExport}
              disabled={!canExport}
              title={canExport ? "Download this report as a PDF" : "Available when the report has finished"}
              className="inline-flex items-center gap-2 rounded-xl bg-[#d6b357] px-5 py-2.5 text-[16px] font-bold text-[#001f3f] transition-colors hover:bg-[#c9a449] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50"
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
              <button key={p.key} type="button" aria-pressed={preset === p.key} onClick={() => setPreset(p.key)} className={chip(preset === p.key)}>
                {p.label}
              </button>
            ))}
            {preset === "custom" && (
              <span className="flex flex-wrap items-center gap-2 text-[15px] text-white/80">
                <input type="date" aria-label="From" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-[15px] font-semibold text-white [color-scheme:dark]" />
                to
                <input type="date" aria-label="To" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-[15px] font-semibold text-white [color-scheme:dark]" />
              </span>
            )}
            <span className="ml-auto text-[14px] text-white/75">{span ? `${fmtDay(span.from)} – ${fmtDay(addDay(span.to, -1))}` : "Pick a range of 7 days to 12 months"}</span>
          </div>
        </div>
      </header>

      {/* Body: the scrolling area holds the jump bar (below lg), the timeline (from lg) and the report */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {r && verdicts && <TeamReportJumpBar sections={sections} activeId={activeId} onJump={jumpTo} barRef={barRef} />}
        <div data-spy-content className={r && verdicts ? "mx-auto grid w-full max-w-[1320px] gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[288px_minmax(0,1fr)]" : "mx-auto w-full max-w-4xl px-4 py-6 sm:px-6"}>
          {r && verdicts && (
            <aside className="hidden lg:block">
              <div className="sticky top-6">
                <TeamReportNav
                  sections={sections}
                  activeId={activeId}
                  onJump={jumpTo}
                  footer={
                    <div>
                      <button
                        type="button"
                        onClick={doExport}
                        disabled={!canExport}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d6b357] px-4 py-3 text-[16px] font-bold text-[#001f3f] transition-colors hover:bg-[#c9a449] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#001f3f] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {exporting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <FileDown className="h-5 w-5" aria-hidden />}
                        {exporting ? "Preparing PDF…" : "Export PDF"}
                      </button>
                      <p className="mt-2 text-[14px] leading-snug text-[#4b5563]">A cover, every section and a page of commitments to sign.</p>
                    </div>
                  }
                />
              </div>
            </aside>
          )}
          <div className="min-w-0 max-w-[1000px]">
            {!span ? (
              <p className="rounded-xl border border-dashed border-[#c5ccd6] bg-white px-4 py-10 text-center text-[16px] text-[#374151]">Pick a valid range — at least 7 days and at most 12 months.</p>
            ) : failed && !r ? (
              <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-[16px] text-rose-800">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden /> {failed}
              </div>
            ) : !r || !verdicts ? (
              <div role="status" className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#dfe3e9] bg-white px-4 py-20 text-center">
                <Loader2 className="h-7 w-7 animate-spin text-[#001f3f]" aria-hidden />
                <p className="text-[17px] font-semibold text-[#001f3f]">{state?.status || "Adding up the team's sales, recruits and requirements…"}</p>
                <p className="text-[15px] text-[#4b5563]">Usually ready in a few seconds.</p>
              </div>
            ) : (
              <TeamReportView r={r} ins={ins} writing={writing} verdicts={verdicts} />
            )}
            {failed && r && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[16px] text-amber-900">{failed}</p>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
