"use client"

// Report-size charts for the Team Performance Report screen — hand-drawn like the rest of the
// dashboard's charts (no chart library), but with reading-size type: values written on the shapes,
// every unit in words, nothing that needs a hover. Colours: navy #001f3f and gold #d6b357 as fills only,
// #8aa4c2 for the second series, bronze #8a6d2a for text on white.

import { useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { aedShort, num } from "./team-report-ui"

// ─── Month bars, with the doubling line ──────────────────────────────────────

const PLOT = 190
const TOP_ROOM = 30

/** One bar per month with the value on it and the deal count under the month. `target` draws a dashed line: bars under it are below double pace. */
export function MonthBars({ months, target }: { months: Array<{ label: string; value: number; deals: number }>; target?: { value: number; label: string } | null }) {
  const max = Math.max(1, ...months.map((m) => m.value), target?.value ?? 0)
  const peak = months.reduce((b, m, i) => (m.value > months[b].value ? i : b), 0)
  const h = (v: number) => (v > 0 ? Math.max(4, (v / max) * (PLOT - TOP_ROOM)) : 2)
  return (
    <div>
      <div className="relative flex items-end gap-3 border-b-2 border-[#c5ccd6] sm:gap-5" style={{ height: PLOT }} role="img" aria-label={`Validated sales by month: ${months.map((m) => `${m.label} ${aedShort(m.value)}, ${m.deals} deals`).join("; ")}`}>
        {target && target.value > 0 && (
          <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-[#8a6d2a]" style={{ bottom: h(target.value) }}>
            <span className="absolute right-0 -translate-y-full rounded bg-white/90 px-1.5 pb-0.5 text-[14px] font-bold text-[#6b5320]">{target.label}</span>
          </div>
        )}
        {months.map((m, i) => (
          <div key={m.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
            <span className={`mb-1 text-[15px] font-bold tabular-nums ${i === peak && m.value > 0 ? "text-[#6b5320]" : "text-[#1f2937]"}`}>{m.value ? aedShort(m.value).replace("AED ", "") : "0"}</span>
            <div className={`w-full max-w-[72px] rounded-t-md ${i === peak && m.value > 0 ? "bg-[#d6b357]" : "bg-[#001f3f]"}`} style={{ height: h(m.value), opacity: m.value > 0 ? 1 : 0.2 }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3 sm:gap-5">
        {months.map((m) => (
          <div key={m.label} className="min-w-0 flex-1 text-center">
            <p className="text-[15px] font-semibold text-[#1f2937]">{m.label}</p>
            <p className="text-[14px] text-[#4b5563]">{m.deals} deal{m.deals === 1 ? "" : "s"}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Two-part bar ────────────────────────────────────────────────────────────

export type Seg = { label: string; value: number; display: string; color: string; ink: string }

/** One bar split in two (new vs existing, sold vs quiet). A side with 0 simply has no segment — a donut cannot degrade like that. */
export function SplitBar({ a, b, empty }: { a: Seg; b: Seg; empty: string }) {
  const total = a.value + b.value
  const pa = total ? Math.round((a.value / total) * 100) : 0
  const pb = total ? 100 - pa : 0
  const seg = (s: Seg, p: number) => (s.value > 0 ? <div className="flex items-center justify-center text-[16px] font-bold" style={{ width: `${p}%`, backgroundColor: s.color, color: s.ink }}>{p >= 10 ? `${p}%` : ""}</div> : null)
  return (
    <div>
      <div className="flex h-12 overflow-hidden rounded-xl bg-[#e5e8ec]" role="img" aria-label={total ? `${a.label}: ${pa}%, ${b.label}: ${pb}%` : empty}>
        {total ? (
          <>
            {seg(a, pa)}
            {seg(b, pb)}
          </>
        ) : (
          <p className="m-auto text-[15px] font-semibold text-[#4b5563]">{empty}</p>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-4">
        {[a, b].map((s) => (
          <div key={s.label} className="min-w-0">
            <dt className="flex items-center gap-2 text-[15px] font-semibold text-[#1f2937]">
              <span className="h-3.5 w-3.5 shrink-0 rounded" style={{ backgroundColor: s.color }} aria-hidden />
              {s.label}
            </dt>
            <dd className="mt-0.5 font-['Outfit'] text-[26px] font-bold leading-tight text-[#001f3f]">{s.display}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// ─── Funnel with drop-offs ───────────────────────────────────────────────────

/** Steps from joining to a validated sale; between steps, how many people dropped out, and the biggest drop is marked. */
export function Funnel({ steps }: { steps: Array<{ label: string; value: number; hint: string }> }) {
  const first = steps[0]?.value ?? 0
  const max = Math.max(1, first)
  let biggest = -1
  let biggestDrop = 0
  steps.forEach((s, i) => {
    const drop = i ? steps[i - 1].value - s.value : 0
    if (drop > biggestDrop) {
      biggestDrop = drop
      biggest = i
    }
  })
  return (
    <ol>
      {steps.map((s, i) => {
        const drop = i ? steps[i - 1].value - s.value : 0
        return (
          <li key={s.label}>
            {i > 0 && drop > 0 && (
              <p className={`my-1.5 ml-1 flex items-center gap-2 text-[14px] ${i === biggest ? "font-bold text-[#991b1b]" : "text-[#4b5563]"}`}>
                <span aria-hidden>↓</span>
                {num(drop)} dropped out here{i === biggest ? " — the biggest drop" : ""}
              </p>
            )}
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-[16px] font-bold text-[#0d1117]">
                {s.label} <span className="font-normal text-[#4b5563]">· {s.hint}</span>
              </p>
              <p className="text-[16px] font-bold tabular-nums text-[#001f3f]">
                {num(s.value)} <span className="font-normal text-[#4b5563]">· {first ? (s.value > 0 && (s.value / first) * 100 < 1 ? "<1" : Math.round((s.value / first) * 100)) : 0}%</span>
              </p>
            </div>
            <div className="mt-1 h-7 rounded-lg bg-[#e5e8ec]" aria-hidden>
              <div className="h-7 rounded-lg" style={{ width: s.value > 0 ? `${Math.max(1.5, (s.value / max) * 100)}%` : 0, backgroundColor: i === steps.length - 1 ? "#d6b357" : "#001f3f" }} />
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ─── Pace against target ─────────────────────────────────────────────────────

/** Today's pace as a bar against the doubled target; under it, the deals that pace brings against the deals needed. */
export function PaceBullet({ now, target, nowLabel, targetLabel, dealsNow, dealsNeeded, basis }: { now: number; target: number; nowLabel: string; targetLabel: string; dealsNow: number; dealsNeeded: number; basis: "period" | "previous" | "none" }) {
  if (basis === "none" || target <= 0) {
    return <p className="rounded-xl bg-[#f4f6fa] px-4 py-3.5 text-[16px] text-[#1f2937]">There is no sales pace to double yet. The target is a first validated deal from every member who is ready to sell — <b>{dealsNeeded} first deal{dealsNeeded === 1 ? "" : "s"}</b>.</p>
  }
  const w = Math.max(2, Math.min(100, (now / target) * 100))
  return (
    <div>
      <div className="space-y-3.5">
        <div>
          <div className="flex items-baseline justify-between gap-3 text-[16px]">
            <span className="font-bold text-[#0d1117]">Today&apos;s pace</span>
            <span className="font-bold tabular-nums text-[#001f3f]">{nowLabel}</span>
          </div>
          <div className="mt-1 h-9 rounded-lg bg-[#e5e8ec]" aria-hidden>
            <div className="h-9 rounded-lg bg-[#001f3f]" style={{ width: `${w}%` }} />
          </div>
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3 text-[16px]">
            <span className="font-bold text-[#0d1117]">Target — double</span>
            <span className="font-bold tabular-nums text-[#6b5320]">{targetLabel}</span>
          </div>
          <div className="mt-1 h-9 rounded-lg bg-[#d6b357]" aria-hidden />
        </div>
      </div>
      <p className="mt-3 text-[16px] text-[#1f2937]">
        In three months that is <b>{dealsNeeded} deals</b> needed, against <b>{dealsNow}</b> at today&apos;s pace.
      </p>
    </div>
  )
}

// ─── Ranked bars ─────────────────────────────────────────────────────────────

export type RankedRow = { label: string; value: number; display: string; sub?: string | null }

/** Horizontal bars ranked by value, the first in gold for "navy" tone. Overlapping sets belong here, never in a pie. */
export function RankedBars({ rows, tone = "navy" }: { rows: RankedRow[]; tone?: "navy" | "blue" }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="space-y-3.5">
      {rows.map((r, i) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-[16px]">
            <span className="min-w-0 font-semibold text-[#0d1117]">{r.label}</span>
            <span className="shrink-0 font-bold tabular-nums text-[#001f3f]">{r.display}</span>
          </div>
          <div className="mt-1 h-3 rounded-full bg-[#e5e8ec]" aria-hidden>
            <div className="h-3 rounded-full" style={{ width: r.value > 0 ? `${Math.max(1.5, (100 * r.value) / max)}%` : 0, backgroundColor: i === 0 && tone === "navy" ? "#d6b357" : tone === "blue" ? "#8aa4c2" : "#001f3f" }} />
          </div>
          {r.sub ? <p className="mt-0.5 text-[14px] text-[#4b5563]">{r.sub}</p> : null}
        </li>
      ))}
    </ul>
  )
}

// ─── Stacked months (new vs existing) ────────────────────────────────────────

/** Per month, the validated value split between new and existing agents. */
export function StackedMonths({ months, aLabel, bLabel }: { months: Array<{ label: string; a: number; b: number }>; aLabel: string; bLabel: string }) {
  return (
    <div>
      <p className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-[15px] text-[#1f2937]">
        <span className="inline-flex items-center gap-2"><span className="h-3.5 w-3.5 rounded bg-[#001f3f]" aria-hidden />{aLabel}</span>
        <span className="inline-flex items-center gap-2"><span className="h-3.5 w-3.5 rounded bg-[#8aa4c2]" aria-hidden />{bLabel}</span>
      </p>
      <ul className="space-y-3">
        {months.map((m) => {
          const total = Math.max(1, m.a + m.b)
          return (
            <li key={m.label} className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="w-16 shrink-0 text-[15px] font-semibold text-[#1f2937]">{m.label}</span>
              <span className="flex h-6 min-w-[140px] flex-1 overflow-hidden rounded-full bg-[#e5e8ec]" aria-hidden>
                <span className="h-6 bg-[#001f3f]" style={{ width: `${(100 * m.a) / total}%` }} />
                <span className="h-6 bg-[#8aa4c2]" style={{ width: `${(100 * m.b) / total}%` }} />
              </span>
              <span className="w-full text-[14px] tabular-nums text-[#4b5563] sm:w-auto sm:min-w-[200px] sm:text-right">{aedShort(m.a)} new · {aedShort(m.b)} existing</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ─── Show all ────────────────────────────────────────────────────────────────

/** The top few rows, and a large button for the rest. `total` can exceed `rows` when the server capped the list. */
export function ShowAll<T>({ rows, total, top = 5, noun, render }: { rows: T[]; total: number; top?: number; noun: string; render: (rows: T[]) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const shown = open ? rows : rows.slice(0, top)
  return (
    <div>
      {render(shown)}
      {rows.length > top && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-2 rounded-xl border border-[#c5ccd6] bg-white px-4 py-2.5 text-[16px] font-semibold text-[#001f3f] transition-colors hover:bg-[#f4f6f9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#001f3f]"
          >
            {open ? "Show fewer" : `Show all ${num(total)} ${noun}`}
            <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {open && total > rows.length && <p className="text-[14px] text-[#4b5563]">Showing the first {num(rows.length)} of {num(total)}.</p>}
        </div>
      )}
    </div>
  )
}
