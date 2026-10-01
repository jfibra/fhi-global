"use client"

/**
 * The FHI Assistant's chart vocabulary — drawn by hand in SVG/CSS (no chart
 * library), in the dashboard's navy and gold, small enough to sit under an
 * answer. The tools decide what to draw (`_charts` on a tool result); the
 * page only renders. Four kinds:
 *
 *   trend   — one series over days (visitors), thin bars, gold peak
 *   shares  — ranked horizontal bars (leaderboards, sources, countries)
 *   bars    — a few labelled vertical bars with the value on top (months,
 *             star ratings, statuses) — the "growth over months" picture
 *   pie     — a donut with a legend and percentages (status splits, by role,
 *             by source, by country)
 */

export type TrendPoint = { date: string; visitors: number }
export type ShareRow = { label: string; value: number; display?: string; iso?: string | null; icon?: string | null }
export type BarPoint = { label: string; value: number; display?: string }
export type ChartSpec =
  | { kind: "trend"; title: string; points: TrendPoint[] }
  | { kind: "shares"; title: string; rows: ShareRow[] }
  | { kind: "bars"; title: string; points: BarPoint[] }
  | { kind: "pie"; title: string; rows: ShareRow[] }

/** Navy first, gold second, then calmer blues and sands — reads well on white
 *  and still tells eight slices apart. */
export const PIE_COLORS = ["#001f3f", "#d6b357", "#2f5d8a", "#b8913f", "#8aa4c2", "#5c6b7a", "#e3c98a", "#9ca3af"]

const compact = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)}K`
  return n.toLocaleString()
}

/** Labelled vertical bars — months, star ratings, statuses. The tallest bar
 *  is gold; every bar carries its value so nothing hides in a tooltip. */
export function BarsChart({ title, points }: { title: string; points: BarPoint[] }) {
  const rows = points.filter((p) => Number.isFinite(p.value))
  if (rows.length < 2) return null
  const max = Math.max(...rows.map((p) => p.value), 1)
  const peakIndex = rows.reduce((best, p, i) => (p.value > rows[best].value ? i : best), 0)
  const dense = rows.length > 8
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">{title}</p>
      <div className="flex h-[108px] items-end gap-1.5 sm:gap-2">
        {rows.map((p, i) => (
          <div key={`${p.label}-${i}`} className="flex min-w-0 flex-1 flex-col items-center justify-end" title={`${p.label}: ${p.display ?? p.value.toLocaleString()}`}>
            {!dense && (
              <span className={`mb-1 truncate text-[10.5px] font-semibold tabular-nums ${i === peakIndex ? "text-[#b8913f]" : "text-[#374151]"}`}>
                {p.display ?? compact(p.value)}
              </span>
            )}
            <div
              className={`w-full max-w-[44px] rounded-t-[2px] ${i === peakIndex ? "bg-[#d6b357]" : "bg-[#001f3f]"}`}
              style={{ height: `${Math.max((p.value / max) * 72, p.value > 0 ? 3 : 1)}px`, opacity: p.value > 0 ? 1 : 0.15 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5 border-t border-[#e5e8ec] pt-1 sm:gap-2">
        {rows.map((p, i) => (
          <span key={`${p.label}-l-${i}`} className="min-w-0 flex-1 truncate text-center text-[10.5px] text-[#6b7280]">
            {p.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/** A donut with its legend: each slice's share in percent, the total in the
 *  hole. Slices under 1% are kept in the legend but drawn hairline-thin. */
export function PieChart({ title, rows }: { title: string; rows: ShareRow[] }) {
  const data = rows.filter((r) => r.value > 0)
  const total = data.reduce((a, r) => a + r.value, 0)
  if (data.length < 2 || total <= 0) return null
  const R = 44
  const r = 28
  const C = 56
  // Each slice starts where the previous ones end — cumulative shares, so
  // nothing is reassigned while rendering.
  const fracs = data.map((row) => row.value / total)
  const starts = fracs.map((_, i) => -Math.PI / 2 + fracs.slice(0, i).reduce((a, b) => a + b, 0) * Math.PI * 2)
  const arcs = data.map((row, i) => {
    const frac = fracs[i]
    const start = starts[i]
    const end = start + frac * Math.PI * 2 - 0.025
    const large = end - start > Math.PI ? 1 : 0
    const p = (rad: number, ang: number) => [C + rad * Math.cos(ang), C + rad * Math.sin(ang)]
    const [x1, y1] = p(R, start)
    const [x2, y2] = p(R, end)
    const [x3, y3] = p(r, end)
    const [x4, y4] = p(r, start)
    const d = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${large} 0 ${x4} ${y4} Z`
    return { d, color: PIE_COLORS[i % PIE_COLORS.length], row, pct: Math.round(frac * 100) }
  })
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">{title}</p>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 112 112" className="h-[104px] w-[104px] shrink-0" role="img" aria-label={title}>
          {arcs.map((a) => (
            <path key={a.row.label} d={a.d} fill={a.color}>
              <title>{`${a.row.label}: ${a.row.display ?? a.row.value.toLocaleString()} (${a.pct}%)`}</title>
            </path>
          ))}
          <text x={C} y={C - 2} textAnchor="middle" className="fill-[#0d1117]" style={{ fontSize: 15, fontWeight: 700 }}>
            {compact(total)}
          </text>
          <text x={C} y={C + 11} textAnchor="middle" className="fill-[#9ca3af]" style={{ fontSize: 8, fontWeight: 600, letterSpacing: 0.6 }}>
            TOTAL
          </text>
        </svg>
        <ul className="min-w-0 flex-1 space-y-1">
          {arcs.slice(0, 8).map((a) => (
            <li key={a.row.label} className="flex items-center gap-2 text-[12px]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: a.color }} />
              <span className="min-w-0 flex-1 truncate font-semibold capitalize text-[#0d1117]">{a.row.label}</span>
              <span className="shrink-0 tabular-nums text-[#374151]">{a.row.display ?? a.row.value.toLocaleString()}</span>
              <span className="w-9 shrink-0 text-right tabular-nums text-[#9ca3af]">{a.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ─── Stat tiles ──────────────────────────────────────────────────────────────

export type StatSpec = {
  label: string
  value: string
  change?: string | null
  tone?: "up" | "down" | "flat" | "neutral"
  hint?: string | null
}

/** The headline figures of an answer, big and scannable: label, value, the
 *  change against the previous period as a green/red chip, one hint line.
 *  Two to four tiles per row; a lone tile is not drawn (the text says it). */
export function StatTiles({ stats }: { stats: StatSpec[] }) {
  const rows = stats.filter((s) => s.value && s.value !== "–").slice(0, 8)
  if (rows.length < 2) return null
  const cols = rows.length === 2 ? "sm:grid-cols-2" : rows.length === 3 || rows.length === 6 ? "sm:grid-cols-3" : "sm:grid-cols-4"
  const tone = (t: StatSpec["tone"]) =>
    t === "up" ? "bg-[#e8f5ec] text-[#15803d]" : t === "down" ? "bg-[#fdecec] text-[#b91c1c]" : t === "flat" ? "bg-[#f1f3f6] text-[#6b7280]" : "bg-[#f6f1e3] text-[#8a6d2b]"
  const short = (c: string) => (c.startsWith("n/a") ? "n/a" : c.startsWith("new") ? "new" : c.startsWith("0%") ? "0%" : c)
  return (
    <div className={`grid grid-cols-2 gap-2.5 ${cols}`}>
      {rows.map((s) => (
        <div key={s.label} className="min-w-0 rounded-xl border border-[#eceef1] bg-[#fafbfc] px-3.5 py-3">
          <p className="truncate text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">{s.label}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="font-['Outfit'] text-[22px] font-bold leading-none tracking-tight text-[#001f3f] tabular-nums">{s.value}</p>
            {s.change && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums ${tone(s.tone)}`} title={s.change}>
                {s.tone === "up" ? "▲ " : s.tone === "down" ? "▼ " : ""}
                {short(s.change)}
              </span>
            )}
          </div>
          {s.hint && <p className="mt-1 truncate text-[11px] text-[#6b7280]">{s.hint}</p>}
        </div>
      ))}
    </div>
  )
}
