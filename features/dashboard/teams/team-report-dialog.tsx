"use client"

// Team Performance Report (boss, 2026-11-05): the admin Teams page's
// "Performance report" button opens this full-screen view for the selected
// team. It shows the team's sales, new vs tenured agents, recruits and how far
// each got through the requirements, who sold and who went quiet, and FHI
// Assistant's plan to double the sales over the next three months — the
// figures first, the analysis a few seconds later (GET
// /api/admin/teams/[id]/report, streamed). "Export PDF" posts the analysis
// shown here back to the same route, so the PDF says exactly what the screen
// says (lib/team-report/*).

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { AlertTriangle, FileDown, Loader2, Sparkles, X } from "lucide-react"
import { UserAvatar } from "@/components/user-avatar"
import { BarsChart, PieChart, StatTiles, type StatSpec } from "@/features/dashboard/fhi-chat/charts"
import { gaEvent } from "@/lib/ga"
import type { MemberRow, TeamReport } from "@/lib/team-report/data"
import type { TeamInsights } from "@/lib/team-report/insights"
import { REQUIREMENT_HINTS, REQUIREMENT_KEYS, REQUIREMENT_LABELS } from "@/lib/team-report/labels"

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

// ─── Formatting ──────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0")
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const ISO = /^\d{4}-\d{2}-\d{2}$/
const addDay = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const fmtDay = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—")
const monthName = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-AE", { month: "short", year: "2-digit", timeZone: "UTC" })
const aed = (n: number) => `AED ${Math.round(n || 0).toLocaleString("en-US")}`
function aedShort(n: number): string {
  const v = Math.round(n || 0)
  if (v >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `AED ${Math.round(v / 1_000)}K`
  return `AED ${v.toLocaleString("en-US")}`
}
const pct = (part: number, whole: number) => {
  if (whole <= 0) return "0%"
  const p = (part / whole) * 100
  return part > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`
}
const poss = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`)
const num = (n: number) => Math.round(n || 0).toLocaleString("en-US")
const deals = (n: number) => `${n} deal${n === 1 ? "" : "s"}`

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

// ─── Small pieces ────────────────────────────────────────────────────────────

const toneOf = (change: string | null): StatSpec["tone"] => (!change || change === "0%" ? "flat" : change.startsWith("-") ? "down" : "up")
const tile = (label: string, value: string, hint?: string | null, change?: string | null): StatSpec => ({ label, value, hint: hint ?? null, change: change ?? null, tone: change ? toneOf(change) : "neutral" })

function Skeleton({ lines = 3, dark = false }: { lines?: number; dark?: boolean }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={`h-3.5 animate-pulse rounded ${dark ? "bg-white/15" : "bg-[#eef0f3]"}`} style={{ width: `${92 - i * 14}%` }} />
      ))}
    </div>
  )
}

function Writing({ label = "FHI Assistant is writing the analysis…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-[#d6b357]/60 bg-[#fffaf0] px-4 py-3 text-[12.5px] font-semibold text-[#8a6d2a]">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  )
}

function Block({ n, title, subtitle, children }: { n: string; title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#e8eaed] bg-white shadow-[0_2px_12px_-2px_rgba(0,31,63,0.06)]">
      <div className="mx-5 flex items-end gap-3 border-b-2 border-[#001f3f] pb-2 pt-5 sm:mx-6">
        <span className="font-['Outfit'] text-[26px] font-bold leading-none text-[#d6b357]">{n}</span>
        <div className="min-w-0">
          <h3 className="font-['Outfit'] text-[17px] font-bold leading-tight text-[#001f3f]">{title}</h3>
          <p className="text-[12px] text-[#6b7280]">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-5 px-5 py-5 sm:px-6">{children}</div>
    </section>
  )
}

const Label = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <div className="mb-2 flex items-baseline justify-between gap-3">
    <p className="text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">{children}</p>
    {right ? <p className="text-[11px] text-[#9ca3af]">{right}</p> : null}
  </div>
)

function Ranked({ rows, tone = "navy" }: { rows: Array<{ label: string; value: number; display: string; sub?: string | null }>; tone?: "navy" | "blue" }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-[12px]">
            <span className="min-w-0 truncate font-semibold text-[#0d1117]">{r.label}</span>
            <span className={`shrink-0 font-bold tabular-nums ${i === 0 && tone === "navy" ? "text-[#b8913f]" : "text-[#001f3f]"}`}>{r.display}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-[#eef0f3]">
            <div className="h-1.5 rounded-full" style={{ width: `${Math.max(1.5, (100 * r.value) / max)}%`, backgroundColor: i === 0 && tone === "navy" ? "#d6b357" : tone === "blue" ? "#8aa4c2" : "#001f3f" }} />
          </div>
          {r.sub ? <p className="mt-0.5 truncate text-[11px] text-[#9ca3af]">{r.sub}</p> : null}
        </li>
      ))}
    </ul>
  )
}

const CohortChip = ({ cohort }: { cohort: MemberRow["cohort"] }) => (
  <span className={`ml-1.5 rounded-full px-1.5 py-0.5 align-middle text-[9.5px] font-bold ${cohort === "new" ? "bg-[#001f3f] text-white" : "bg-[#eef1f5] text-[#001f3f]"}`}>{cohort === "new" ? "NEW" : "TENURED"}</span>
)

function People({ rows, right, sub }: { rows: MemberRow[]; right: (m: MemberRow, i: number) => ReactNode; sub: (m: MemberRow) => string }) {
  return (
    <ul className="divide-y divide-[#f0f2f5] overflow-hidden rounded-xl border border-[#eceef1]">
      {rows.map((m, i) => (
        <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
          <UserAvatar name={m.name} imageUrl={m.photo} size={30} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-[#0d1117]">
              {m.name}
              <CohortChip cohort={m.cohort} />
            </p>
            <p className="truncate text-[11px] text-[#9ca3af]">{sub(m)}</p>
          </div>
          <div className="shrink-0 text-right text-[12px] text-[#374151]">{right(m, i)}</div>
        </li>
      ))}
    </ul>
  )
}

const roleLine = (m: MemberRow) => [m.roleInTeam, m.subteam].filter(Boolean).join(" · ") || "Member"

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const state = run?.key === key ? run : null
  const r = state?.report ?? null
  const ins = state?.insights ?? null
  const failed = state?.error ?? null
  const writing = !!r && !ins && !state?.done
  const canExport = !!r && !!state?.done && !exporting

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

  const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${on ? "bg-[#d6b357] text-[#001f3f]" : "bg-white/10 text-white/85 hover:bg-white/20"}`

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#f4f6f9]" role="dialog" aria-modal="true" aria-label={`Performance report — ${team.name}`}>
      {/* Top bar */}
      <header className="shrink-0 bg-[#001f3f] text-white shadow-lg">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10">
            {team.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={team.logo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <Sparkles className="h-5 w-5 text-[#d6b357]" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#f0d89b]">Team Performance Report</p>
            <h2 className="truncate font-['Outfit'] text-lg font-bold leading-tight">{team.name}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {exportError && <span className="hidden max-w-[220px] truncate text-[11.5px] text-rose-300 sm:inline" title={exportError}>{exportError}</span>}
            <button
              type="button"
              onClick={doExport}
              disabled={!canExport}
              title={canExport ? "Download this report as a PDF" : "Available when the report has finished"}
              className="inline-flex items-center gap-2 rounded-xl bg-[#d6b357] px-4 py-2 text-[13px] font-bold text-[#001f3f] transition-colors hover:bg-[#c9a449] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              {exporting ? "Preparing PDF…" : "Export PDF"}
            </button>
            <button type="button" onClick={onClose} aria-label="Close report" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white transition-colors hover:bg-white/20">
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6">
            {PRESETS.map((p) => (
              <button key={p.key} type="button" aria-pressed={preset === p.key} onClick={() => setPreset(p.key)} className={chip(preset === p.key)}>
                {p.label}
              </button>
            ))}
            {preset === "custom" && (
              <span className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                <input type="date" aria-label="From" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white [color-scheme:dark]" />
                to
                <input type="date" aria-label="To" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} className="rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white [color-scheme:dark]" />
              </span>
            )}
            <span className="ml-auto text-[11.5px] text-white/60">
              {span ? `${fmtDay(span.from)} – ${fmtDay(addDay(span.to, -1))}` : "Pick a range of 7 days to 12 months"}
            </span>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6">
          {!span ? (
            <p className="rounded-xl border border-dashed border-[#e5e7eb] bg-white px-4 py-10 text-center text-sm text-[#6b7280]">Pick a valid range — at least 7 days and at most 12 months.</p>
          ) : failed && !r ? (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {failed}
            </div>
          ) : !r ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#e8eaed] bg-white px-4 py-20 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#001f3f]" />
              <p className="text-sm font-semibold text-[#001f3f]">{state?.status || "Adding up the team's sales, recruits and requirements…"}</p>
              <p className="text-xs text-[#9ca3af]">Usually ready in a few seconds.</p>
            </div>
          ) : (
            <TeamReportView r={r} ins={ins} writing={writing} />
          )}
          {failed && r && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{failed}</p>}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ─── The report ──────────────────────────────────────────────────────────────

/** The report body — `ins` is null while FHI Assistant is still writing the analysis. */

export function TeamReportView({ r, ins, writing }: { r: TeamReport; ins: TeamInsights | null; writing: boolean }) {
  const S = r.sales
  const C = r.cohorts
  const R = r.recruitment
  const A = r.activity
  const T = r.targets
  const none = T.basis === "none"
  const readyNew = R.funnel[2]?.value ?? 0
  const easiest = [...T.levers].sort((x, y) => x.share - y.share)[0]
  const validatedNew = R.funnel[4]?.value ?? 0
  const maxSeller = Math.max(1, ...A.sellers.map((m) => m.value))
  const compare: Array<[string, string, string]> = [
    ["Members on the team", num(C.new.members), num(C.tenured.members)],
    ["Active accounts", num(C.new.active), num(C.tenured.active)],
    ["With a selling role", num(C.new.sellingRole), num(C.tenured.sellingRole)],
    ["Members who sold", num(C.new.sellers), num(C.tenured.sellers)],
    ["Validated deals", num(C.new.deals), num(C.tenured.deals)],
    ["Validated value", aed(C.new.value), aed(C.tenured.value)],
    ["Share of the team's value", pct(C.new.value, S.validated.value), pct(C.tenured.value, S.validated.value)],
    ["Value per selling member", aed(C.new.perSeller), aed(C.tenured.perSeller)],
    ["Value per member", aed(C.new.perMember), aed(C.tenured.perMember)],
    ["Pending deals", C.new.pendingDeals ? `${C.new.pendingDeals} · ${aedShort(C.new.pendingValue)}` : "—", C.tenured.pendingDeals ? `${C.tenured.pendingDeals} · ${aedShort(C.tenured.pendingValue)}` : "—"],
  ]
  const pace = [
    { l: "Today's pace", v: none ? "No sales yet" : `${aedShort(T.monthlyRunRate)} / month` },
    { l: "Target pace", v: none ? `${num(T.dealsNeeded3m)} first deals` : `${aedShort(T.targetMonthly)} / month` },
    { l: "Next three months", v: none ? "First deals" : aedShort(T.target3m) },
  ]

  return (
    <>
      {/* The goal */}
      <section className="overflow-hidden rounded-2xl bg-[#001f3f] p-5 text-white shadow-[0_8px_30px_-12px_rgba(0,31,63,0.55)] sm:p-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#f0d89b]">The goal: double the sales</p>
        <div className="mt-2 max-w-3xl">
          {ins ? <p className="font-['Outfit'] text-[19px] font-semibold leading-snug sm:text-[21px]">{ins.headline}</p> : <Skeleton lines={2} dark />}
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {pace.map((p, i) => (
            <div key={p.l} className={`rounded-xl border-t-2 bg-white/5 px-4 py-3 ${i === 2 ? "border-[#d6b357]" : "border-white/25"}`}>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#f0d89b]">{p.l}</p>
              <p className="mt-1 font-['Outfit'] text-[22px] font-bold leading-tight">{p.v}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11.5px] text-white/60">
          {r.period.label} · {r.members.total} members{r.team.subteams ? ` · ${r.team.subteams} subteam${r.team.subteams === 1 ? "" : "s"}` : ""}
          {r.team.leaders.length ? ` · led by ${r.team.leaders.join(" & ")}` : ""} · changes compare with {r.period.versus}
        </p>
      </section>

      <StatTiles stats={r.kpis} />

      <section className="rounded-2xl border border-[#e8eaed] bg-white p-5 sm:p-6">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#b8913f]">At a glance</p>
        {ins ? (
          <ol className="space-y-2.5">
            {ins.takeaways.map((t, i) => (
              <li key={i} className="flex gap-3 text-[13.5px] leading-snug text-[#0d1117]">
                <span className="w-4 shrink-0 font-bold text-[#b8913f]">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        ) : (
          <Skeleton lines={4} />
        )}
        {writing && <div className="mt-4"><Writing /></div>}
      </section>

      {/* 01 Sales */}
      <Block n="01" title="Sales" subtitle={`What ${r.team.name} sold in ${r.period.label}, compared with ${r.period.versus}.`}>
        <StatTiles
          stats={[
            tile("Validated value", aedShort(S.validated.value), `before: ${aedShort(S.previous.value)}`, S.change),
            tile("Validated deals", String(S.validated.deals), `before: ${S.previous.deals}`, r.kpis[1]?.change ?? null),
            tile("Average deal", S.avgDeal ? aedShort(S.avgDeal) : "—", "validated, team share"),
            tile("Pending", S.pending.deals ? aedShort(S.pending.value) : "0", `${deals(S.pending.deals)} waiting${S.rejected ? ` · ${S.rejected} rejected` : ""}`),
          ]}
        />
        {S.byMonth.length >= 2 && S.byMonth.some((b) => b.value > 0) && (
          <div className="rounded-xl border border-[#eceef1] p-4">
            <BarsChart title="Validated sales by month" points={S.byMonth.map((b) => ({ label: b.label, value: b.value, display: b.value ? aedShort(b.value).replace("AED ", "") : "0" }))} />
          </div>
        )}
        {(S.topProjects.length > 0 || S.topDevelopers.length > 0) && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-[#eceef1] p-4">
              <Label>Top projects</Label>
              {S.topProjects.length ? <Ranked rows={S.topProjects.slice(0, 6).map((p) => ({ label: p.name, value: p.value, display: aedShort(p.value), sub: `${deals(p.deals)}${p.developer ? ` · ${p.developer}` : ""}` }))} /> : <p className="text-xs text-[#9ca3af]">No validated sales.</p>}
            </div>
            <div className="rounded-xl border border-[#eceef1] p-4">
              <Label>Top developers</Label>
              {S.topDevelopers.length ? <Ranked rows={S.topDevelopers.map((d) => ({ label: d.name, value: d.value, display: aedShort(d.value), sub: deals(d.deals) }))} /> : <p className="text-xs text-[#9ca3af]">No validated sales.</p>}
            </div>
          </div>
        )}
        <p className="text-[11.5px] text-[#9ca3af]">
          Validated sales are the headline, as on every leaderboard. A shared deal credits each member their share and counts once for the team{S.sharedDeals ? ` (${S.sharedDeals} shared in this period)` : ""}. A sale&apos;s date is its reservation date, else when it was recorded. All time: {deals(S.allTime.deals)}, {aedShort(S.allTime.value)}.
        </p>
      </Block>

      {/* 02 New vs tenured */}
      <Block n="02" title="New agents vs tenured agents" subtitle="Who is carrying the sales — agents recruited in this period, or the ones who were already here.">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-[#eceef1] p-4">
            {S.validated.value > 0 && C.new.value > 0 && C.tenured.value > 0 ? (
              <PieChart title="Share of validated value" rows={[{ label: `New agents (${C.new.members})`, value: C.new.value, display: aedShort(C.new.value) }, { label: `Tenured agents (${C.tenured.members})`, value: C.tenured.value, display: aedShort(C.tenured.value) }]} />
            ) : (
              <>
                <Label>Share of validated value</Label>
                <p className="text-[13px] text-[#374151]">
                  {S.validated.value ? (C.new.value ? "All of the validated value came from new agents." : "All of the validated value came from tenured agents.") : "No validated sales in this period."}
                </p>
              </>
            )}
          </div>
          <div className="rounded-xl border border-[#eceef1] p-4">
            <Label>How long members have been with FHI</Label>
            <Ranked rows={r.members.tenureBands.map((b) => ({ label: b.label, value: b.value, display: String(b.value) }))} tone="blue" />
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-[#eceef1]">
          <table className="w-full min-w-[460px] text-[12.5px]">
            <thead>
              <tr className="bg-[#fafbfc] text-[10.5px] font-bold uppercase tracking-wide text-[#9ca3af]">
                <th className="px-4 py-2 text-left">KPI contribution</th>
                <th className="px-4 py-2 text-right text-[#001f3f]">New agents</th>
                <th className="px-4 py-2 text-right">Tenured agents</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f5]">
              {compare.map(([m, n, t]) => (
                <tr key={m}>
                  <td className="px-4 py-2 font-semibold text-[#0d1117]">{m}</td>
                  <td className="px-4 py-2 text-right font-bold tabular-nums text-[#001f3f]">{n}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-[#374151]">{t}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {C.byMonth.length >= 2 && C.byMonth.some((m) => m.newValue + m.tenuredValue > 0) && (
          <div className="rounded-xl border border-[#eceef1] p-4">
            <Label right="navy: new agents · blue: tenured agents">Month by month</Label>
            <ul className="space-y-2">
              {C.byMonth.map((m) => {
                const total = Math.max(1, m.newValue + m.tenuredValue)
                return (
                  <li key={m.month} className="flex items-center gap-3 text-[12px]">
                    <span className="w-14 shrink-0 font-semibold text-[#374151]">{monthName(m.month)}</span>
                    <span className="flex h-3 flex-1 overflow-hidden rounded-full bg-[#eef0f3]">
                      <span className="h-3 bg-[#001f3f]" style={{ width: `${(100 * m.newValue) / total}%` }} />
                      <span className="h-3 bg-[#8aa4c2]" style={{ width: `${(100 * m.tenuredValue) / total}%` }} />
                    </span>
                    <span className="w-44 shrink-0 text-right tabular-nums text-[#6b7280]">{aedShort(m.newValue)} · {aedShort(m.tenuredValue)}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        <div className="rounded-xl border-l-4 border-[#001f3f] bg-[#f4f6fa] p-4">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#001f3f]">FHI Assistant&apos;s reading</p>
          {ins ? <p className="text-[13.5px] leading-relaxed text-[#0d1117]">{ins.cohortAnalysis}</p> : <Skeleton lines={3} />}
        </div>
        <p className="text-[11.5px] text-[#9ca3af]">New = the member&apos;s FHI account was created inside {r.period.label}; tenured = created before it. An older account added to the team counts as tenured.</p>
      </Block>

      {/* 03 Recruitment */}
      <Block n="03" title="Recruitment & activation" subtitle="Who joined, and how far each recruit got — a recruit can only record a sale once every requirement is done.">
        <StatTiles
          stats={[
            tile("New recruits", String(R.recruited), `before: ${R.previous}`, R.change),
            tile("Via team invite links", String(R.viaTeamInvite), "registered under a team member"),
            tile("Ready to sell", `${readyNew} of ${R.recruited}`, "finished every requirement"),
            tile("Validated a first sale", `${validatedNew} of ${R.recruited}`, "counts on the leaderboard"),
          ]}
        />
        {R.recruited > 0 ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="rounded-xl border border-[#eceef1] p-4">
              <Label>Activation funnel — recruits of this period</Label>
              <ul className="space-y-3">
                {R.funnel.map((f, i) => (
                  <li key={f.label}>
                    <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
                      <span className="min-w-0 font-semibold text-[#0d1117]">
                        {f.label} <span className="font-normal text-[#9ca3af]">· {f.hint}</span>
                      </span>
                      <span className="shrink-0 font-bold tabular-nums text-[#001f3f]">{f.value} · {pct(f.value, R.funnel[0].value)}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-[#eef0f3]">
                      <div className="h-2 rounded-full" style={{ width: `${Math.max(1.5, (100 * f.value) / Math.max(1, R.funnel[0].value))}%`, backgroundColor: i === R.funnel.length - 1 ? "#d6b357" : "#001f3f" }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-[#eceef1] p-4">
              <Label>Recruits still missing…</Label>
              <Ranked rows={R.missing.map((m) => ({ label: m.label, value: m.value, display: String(m.value) }))} tone="blue" />
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-[#e5e7eb] px-4 py-6 text-center text-sm text-[#6b7280]">No recruits joined the team in {r.period.label}.</p>
        )}
        <div className="rounded-xl border-l-4 border-[#d6b357] bg-[#fffaf0] p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#8a6d2a]">How we count &ldquo;finished all the requirements&rdquo;</p>
          <ol className="space-y-1">
            {REQUIREMENT_KEYS.map((k, i) => (
              <li key={k} className="flex gap-2.5 text-[12.5px] text-[#0d1117]">
                <span className="w-3 shrink-0 font-bold text-[#b8913f]">{i + 1}</span>
                <span><span className="font-bold">{REQUIREMENT_LABELS[k]}</span> — {REQUIREMENT_HINTS[k]}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[11.5px] text-[#6b7280]">Account approved and selling role are what the system checks before a sale can be recorded; the profile and photo are what the dashboard asks for first.</p>
        </div>
        {R.notReady.length > 0 && (
          <div>
            <Label right={R.notReadyTotal > R.notReady.length ? `Showing ${R.notReady.length} of ${R.notReadyTotal}` : `${R.notReadyTotal} recruit${R.notReadyTotal === 1 ? "" : "s"}`}>Not ready yet — finish these first</Label>
            <People rows={R.notReady} sub={(m) => `Joined ${fmtDay(m.joined)} · ${roleLine(m)}`} right={(m) => <span className="text-[11.5px] text-[#b91c1c]">{m.missing.map((k) => REQUIREMENT_LABELS[k].toLowerCase()).join(" · ")}</span>} />
          </div>
        )}
        {R.readyNotSelling.length > 0 && (
          <div>
            <Label right={R.readyNotSellingTotal > R.readyNotSelling.length ? `Showing ${R.readyNotSelling.length} of ${R.readyNotSellingTotal}` : `${R.readyNotSellingTotal} recruit${R.readyNotSellingTotal === 1 ? "" : "s"}`}>Ready, but no sale recorded — get them their first deal</Label>
            <People rows={R.readyNotSelling} sub={(m) => `Joined ${fmtDay(m.joined)} · ${roleLine(m)}`} right={(m) => <span className="capitalize text-[11.5px] text-[#6b7280]">{(m.accountRole ?? "member").replace(/_/g, " ")}</span>} />
          </div>
        )}
      </Block>

      {/* 04 Who sold */}
      <Block n="04" title="Who sold, who went quiet" subtitle="Validated sales per member in the period, and the tenured sellers who closed nothing.">
        {A.sellers.length ? (
          <div>
            <Label right={A.sellersTotal > A.sellers.length ? `Top ${A.sellers.length} of ${A.sellersTotal}` : `${A.sellersTotal} member${A.sellersTotal === 1 ? "" : "s"}`}>Members who sold</Label>
            <People
              rows={A.sellers}
              sub={(m) => `${roleLine(m)} · ${deals(m.deals)}${m.pendingDeals ? ` · ${m.pendingDeals} pending` : ""}`}
              right={(m) => (
                <div className="w-36">
                  <p className="font-bold tabular-nums text-[#001f3f]">{aedShort(m.value)} <span className="font-normal text-[#9ca3af]">· {pct(m.value, S.validated.value)}</span></p>
                  <div className="mt-1 h-1.5 rounded-full bg-[#eef0f3]"><div className="h-1.5 rounded-full bg-[#d6b357]" style={{ width: `${Math.max(3, (100 * m.value) / maxSeller)}%` }} /></div>
                </div>
              )}
            />
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-[#e5e7eb] px-4 py-6 text-center text-sm text-[#6b7280]">Nobody on the team has a validated sale in {r.period.label}.</p>
        )}
        <div>
          <Label right={A.quietTotal > A.quiet.length ? `Showing ${A.quiet.length} of ${A.quietTotal}` : undefined}>Gone quiet — tenured sellers with no validated deal</Label>
          {A.quiet.length ? (
            <>
              <People rows={A.quiet} sub={(m) => `Joined ${fmtDay(m.joined)} · ${roleLine(m)}`} right={(m) => <span className="text-[11.5px] text-[#6b7280]">{m.lastValidated ? `Last sale ${fmtDay(m.lastValidated)}` : "Never sold"}</span>} />
              <p className="mt-2 text-[11.5px] text-[#9ca3af]">{A.quietTotal} quiet seller{A.quietTotal === 1 ? "" : "s"}, {A.neverSold} of them never sold. Active accounts with a selling role only; members without one are not counted.</p>
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-[#e5e7eb] px-4 py-6 text-center text-sm text-[#6b7280]">Every active tenured seller closed a deal in this period.</p>
          )}
        </div>
      </Block>

      {/* 05 Path to 2x */}
      <Block n="05" title="The next three months: the path to 2×" subtitle={`${ins ? ins.nextQuarter.map((m) => m.month).join(" · ") : "Next three months"} — what doubling ${poss(r.team.name)} sales takes.`}>
        <StatTiles
          stats={[
            tile("Pace now", none ? "—" : aedShort(T.monthlyRunRate), none ? "no validated sales yet" : `per month · ${T.dealsPerMonth} deal${T.dealsPerMonth === 1 ? "" : "s"}`),
            tile("Target pace", none ? "First deals" : aedShort(T.targetMonthly), none ? "one from each ready member" : "per month — double"),
            tile("Three-month target", none ? "—" : aedShort(T.target3m), none ? null : `at today's pace: ${aedShort(T.baseline3m)}`),
            tile("Deals needed", String(T.dealsNeeded3m), none ? "first deals" : `at today's pace: ${T.dealsNow3m}`),
          ]}
        />
        <p className="text-[11.5px] text-[#9ca3af]">
          {T.basis === "period" ? `Baseline: the team's own pace in ${r.period.label}.` : T.basis === "previous" ? `No validated sale in ${r.period.label}, so the baseline is the pace of ${r.period.versus}.` : `No validated sales in ${r.period.label} or ${r.period.versus}, so the target is first deals.`}
          {T.last90dRunRate !== null ? ` The last 90 days ran at ${aedShort(T.last90dRunRate)} a month.` : ""}
          {T.extraDealsPerMonth > 0 && !none ? ` That is ${T.extraDealsPerMonth} more deal${T.extraDealsPerMonth === 1 ? "" : "s"} every month at the team's average of ${aed(S.avgDeal)}.` : ""}
        </p>
        {ins ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {ins.nextQuarter.map((m, i) => (
              <div key={m.month} className={`rounded-xl border border-[#eceef1] border-t-4 p-4 ${i === 2 ? "border-t-[#d6b357]" : "border-t-[#001f3f]"}`}>
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-[#9ca3af]">Month {i + 1}</p>
                <p className="font-['Outfit'] text-[17px] font-bold text-[#001f3f]">{m.month}</p>
                <p className="mt-2 text-[13px] leading-snug text-[#0d1117]">{m.focus}</p>
                <p className="mt-3 text-[10.5px] font-bold uppercase tracking-wide text-[#b8913f]">Target</p>
                <p className="text-[14px] font-bold text-[#001f3f]">{m.target}</p>
              </div>
            ))}
          </div>
        ) : (
          <Skeleton lines={3} />
        )}
        {T.levers.length > 0 && T.extraDeals3m > 0 && (
          <div>
            <Label>Who can close the gap — {T.extraDeals3m} more deal{T.extraDeals3m === 1 ? "" : "s"} in three months</Label>
            <ul className="divide-y divide-[#f0f2f5] overflow-hidden rounded-xl border border-[#eceef1]">
              {T.levers.map((l) => (
                <li key={l.title} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="text-[13px] font-bold text-[#0d1117]">{l.title}</p>
                    <p className="text-[11.5px] text-[#9ca3af]">{l.detail}</p>
                  </div>
                  <span className="shrink-0 text-[12px] tabular-nums text-[#6b7280]">{l.people} {l.people === 1 ? "person" : "people"}</span>
                  <span className="w-44 shrink-0 text-right text-[13px] font-bold tabular-nums text-[#001f3f]">
                    {l.share > 1 ? <span className="font-normal text-[#9ca3af]">not enough alone</span> : <>a deal from {l.needed} of {l.people} <span className="font-normal text-[#9ca3af]">· {Math.round(l.share * 100)}%</span></>}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11.5px] text-[#9ca3af]">
              Plain arithmetic: how many people in each group would have to close one validated deal, at the team&apos;s average of {aed(S.avgDeal)}, to cover the gap on their own. No conversion rate is assumed.
              {easiest && easiest.share <= 1 ? ` The easiest start: ${easiest.title.toLowerCase()} — ${easiest.needed} of ${easiest.people}.` : ""}
            </p>
          </div>
        )}
      </Block>

      {/* 06 Strategies */}
      <Block n="06" title="Ten strategies to double the sales" subtitle="Ordered by impact, each tied to a figure in this report — start with the first three this week.">
        {ins ? (
          <ol className="space-y-3">
            {ins.strategies.map((st, i) => (
              <li key={`${st.title}-${i}`} className="flex gap-3 rounded-xl border border-[#eceef1] p-4">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${i < 3 ? "bg-[#d6b357] text-[#001f3f]" : "bg-[#001f3f] text-[#f0d89b]"}`}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-['Outfit'] text-[15px] font-bold text-[#001f3f]">{st.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.impact === "High" ? "bg-[#001f3f] text-white" : st.impact === "Quick win" ? "bg-[#fdf3d8] text-[#8a6d2a]" : "bg-[#eef1f5] text-[#001f3f]"}`}>{st.impact.toUpperCase()}</span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-snug text-[#374151]"><span className="mr-2 text-[10px] font-bold tracking-wide text-[#9ca3af]">WHAT WE SEE</span>{st.why}</p>
                  <p className="mt-1 text-[13px] font-semibold leading-snug text-[#0d1117]"><span className="mr-2 text-[10px] font-bold tracking-wide text-[#b8913f]">WHAT TO DO</span>{st.how}</p>
                  <p className="mt-1.5 text-[11.5px] text-[#9ca3af]">Owner: {st.owner}{st.metric ? ` · Measure: ${st.metric}` : ""}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <>
            <Writing />
            <Skeleton lines={5} />
          </>
        )}
        {ins && <p className="text-[11.5px] text-[#9ca3af]">{ins.source === "ai" ? "The analysis is written by FHI Assistant from the figures in this report only — review it before acting." : "The analysis is generated from the figures in this report by fixed rules."}</p>}
      </Block>

      <p className="pb-6 text-center text-[12px] text-[#9ca3af]">
        <b className="text-[#001f3f]">Export PDF</b> adds a cover and a page of commitments for the team leader to sign. Generated {r.generatedAt} (Dubai).
      </p>
    </>
  )
}
