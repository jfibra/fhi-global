import "server-only"

import { readFile } from "node:fs/promises"
import path from "node:path"
import { ImageResponse } from "next/og"
import type { FhiChatChart, FhiChatStat } from "@/lib/fhi-chat-tools"

/**
 * The stat tiles and charts of a report as ONE picture for the email — the
 * same navy/gold language as the FHI Assistant page, drawn with Satori
 * (next/og) so it needs no browser and no sharp. Email clients can't run the
 * page's SVG/CSS, so the picture is embedded inline (cid) by the mailer.
 *
 * Satori rules kept here: flex everywhere, explicit sizes, no `inset`,
 * SVG paths only for the donut.
 */

const W = 1200
const NAVY = "#001f3f"
const GOLD = "#d6b357"
const INK = "#0d1117"
const MUTED = "#6b7280"
const FAINT = "#9ca3af"
const LINE = "#e8eaed"
const PIE_COLORS = ["#001f3f", "#d6b357", "#2f5d8a", "#b8913f", "#8aa4c2", "#5c6b7a", "#e3c98a", "#9ca3af"]

let fontsPromise: Promise<Array<{ name: string; data: ArrayBuffer; weight: 400 | 600 | 700; style: "normal" }>> | null = null
function fonts() {
  fontsPromise ??= Promise.all(
    ([400, 600, 700] as const).map(async (weight) => ({
      name: "Outfit",
      data: (await readFile(path.join(process.cwd(), "public", "fonts", `Outfit-${weight}.woff`))).buffer as ArrayBuffer,
      weight,
      style: "normal" as const,
    })),
  )
  return fontsPromise
}

const compact = (v: number) => (Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M` : Math.abs(v) >= 10_000 ? `${Math.round(v / 1000)}K` : v.toLocaleString("en-AE"))

function Tile({ s }: { s: FhiChatStat }) {
  const tone = s.tone === "up" ? { bg: "#e8f5ec", fg: "#15803d", mark: "" } : s.tone === "down" ? { bg: "#fdecec", fg: "#b91c1c", mark: "" } : { bg: "#f1f3f6", fg: MUTED, mark: "" }
  const change = s.change ? (s.change.startsWith("n/a") ? "n/a" : s.change.startsWith("new") ? "new" : s.change.startsWith("0%") ? "0%" : s.change) : null
  return (
    <div style={{ display: "flex", flexDirection: "column", width: 270, padding: "18px 20px", border: `1px solid ${LINE}`, borderRadius: 14, backgroundColor: "#fafbfc" }}>
      <div style={{ display: "flex", fontSize: 12, fontWeight: 700, letterSpacing: 1.4, color: FAINT, textTransform: "uppercase" }}>{s.label.toUpperCase()}</div>
      <div style={{ display: "flex", alignItems: "baseline", marginTop: 8 }}>
        <div style={{ display: "flex", fontSize: s.value.length > 12 ? 24 : 30, fontWeight: 700, color: NAVY, letterSpacing: -0.5 }}>{s.value}</div>
        {change && (
          <div style={{ display: "flex", marginLeft: 10, padding: "3px 8px", borderRadius: 999, backgroundColor: tone.bg, color: tone.fg, fontSize: 12, fontWeight: 700 }}>
            {tone.mark}
            {change}
          </div>
        )}
      </div>
      {s.hint && <div style={{ display: "flex", marginTop: 6, fontSize: 12, color: MUTED }}>{s.hint.length > 40 ? `${s.hint.slice(0, 38)}…` : s.hint}</div>}
    </div>
  )
}

function Title({ text }: { text: string }) {
  return <div style={{ display: "flex", fontSize: 12, fontWeight: 700, letterSpacing: 1.4, color: FAINT, marginBottom: 14 }}>{text.toUpperCase()}</div>
}

function Bars({ chart }: { chart: Extract<FhiChatChart, { kind: "bars" }> }) {
  const pts = chart.points.slice(0, 12)
  const max = Math.max(...pts.map((p) => p.value), 1)
  const peak = pts.reduce((b, p, i) => (p.value > pts[b].value ? i : b), 0)
  const colW = Math.floor(520 / pts.length)
  return (
    <div style={{ display: "flex", flexDirection: "column", width: 560 }}>
      <Title text={chart.title} />
      <div style={{ display: "flex", alignItems: "flex-end", height: 150 }}>
        {pts.map((p, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", width: colW, height: 150 }}>
            <div style={{ display: "flex", fontSize: 12, fontWeight: 700, color: i === peak ? "#b8913f" : "#374151", marginBottom: 6 }}>{p.display ?? compact(p.value)}</div>
            <div style={{ display: "flex", width: Math.min(44, colW - 10), height: Math.max(Math.round((p.value / max) * 100), p.value > 0 ? 4 : 1), backgroundColor: i === peak ? GOLD : NAVY, borderRadius: 2, opacity: p.value > 0 ? 1 : 0.2 }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", borderTop: `1px solid ${LINE}`, marginTop: 6, paddingTop: 6 }}>
        {pts.map((p, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "center", width: colW, fontSize: 11, color: MUTED }}>
            {p.label.length > 12 ? `${p.label.slice(0, 11)}…` : p.label}
          </div>
        ))}
      </div>
    </div>
  )
}

function Shares({ chart }: { chart: Extract<FhiChatChart, { kind: "shares" }> }) {
  const rows = chart.rows.slice(0, 6)
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <div style={{ display: "flex", flexDirection: "column", width: 560 }}>
      <Title text={chart.title} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        {rows.map((r, i) => (
          <div key={r.label} style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", width: 190, fontSize: 13, fontWeight: 600, color: INK }}>{r.label.length > 24 ? `${r.label.slice(0, 23)}…` : r.label}</div>
            <div style={{ display: "flex", width: 270, height: 14, backgroundColor: "#f1f3f6", marginLeft: 8 }}>
              <div style={{ display: "flex", width: Math.max(Math.round((r.value / max) * 270), 4), height: 14, backgroundColor: i === 0 ? GOLD : NAVY }} />
            </div>
            <div style={{ display: "flex", width: 84, justifyContent: "flex-end", fontSize: 12, color: "#374151" }}>{r.display ?? r.value.toLocaleString("en-AE")}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Pie({ chart }: { chart: Extract<FhiChatChart, { kind: "pie" }> }) {
  const data = chart.rows.filter((r) => r.value > 0).slice(0, 8)
  const total = data.reduce((a, r) => a + r.value, 0) || 1
  const R = 70
  const r = 44
  const C = 76
  const fracs = data.map((row) => row.value / total)
  const starts = fracs.map((_, i) => -Math.PI / 2 + fracs.slice(0, i).reduce((a, b) => a + b, 0) * Math.PI * 2)
  const arcs = data.map((row, i) => {
    const frac = fracs[i]
    const start = starts[i]
    const end = start + frac * Math.PI * 2 - 0.03
    const large = end - start > Math.PI ? 1 : 0
    const p = (rad: number, a: number) => [C + rad * Math.cos(a), C + rad * Math.sin(a)]
    const [x1, y1] = p(R, start)
    const [x2, y2] = p(R, end)
    const [x3, y3] = p(r, end)
    const [x4, y4] = p(r, start)
    return { d: `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${large} 0 ${x4} ${y4} Z`, color: PIE_COLORS[i % PIE_COLORS.length], row, pct: Math.round(frac * 100) }
  })
  return (
    <div style={{ display: "flex", flexDirection: "column", width: 560 }}>
      <Title text={chart.title} />
      <div style={{ display: "flex", alignItems: "center" }}>
        <svg width={152} height={152} viewBox="0 0 152 152">
          {arcs.map((a) => (
            <path key={a.row.label} d={a.d} fill={a.color} />
          ))}
        </svg>
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 22 }}>
          {arcs.map((a) => (
            <div key={a.row.label} style={{ display: "flex", alignItems: "center", marginBottom: 7, fontSize: 13 }}>
              <div style={{ display: "flex", width: 12, height: 12, borderRadius: 3, backgroundColor: a.color, marginRight: 10 }} />
              <div style={{ display: "flex", width: 200, fontWeight: 600, color: INK }}>{a.row.label.length > 26 ? `${a.row.label.slice(0, 25)}…` : a.row.label}</div>
              <div style={{ display: "flex", width: 70, justifyContent: "flex-end", color: "#374151" }}>{a.row.display ?? a.row.value.toLocaleString("en-AE")}</div>
              <div style={{ display: "flex", width: 46, justifyContent: "flex-end", color: FAINT }}>{a.pct}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Trend({ chart }: { chart: Extract<FhiChatChart, { kind: "trend" }> }) {
  const pts = chart.points
  const max = Math.max(...pts.map((p) => p.visitors), 1)
  const peak = pts.reduce((a, b) => (b.visitors > a.visitors ? b : a))
  const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-AE", { month: "short", day: "numeric", timeZone: "UTC" })
  const gap = 3
  const barW = Math.max(3, Math.floor((560 - gap * (pts.length - 1)) / pts.length))
  return (
    <div style={{ display: "flex", flexDirection: "column", width: 560 }}>
      <Title text={`${chart.title} · peak ${fmt(peak.date)} (${peak.visitors.toLocaleString("en-AE")})`} />
      <div style={{ display: "flex", alignItems: "flex-end", height: 120 }}>
        {pts.map((p, i) => (
          <div key={p.date} style={{ display: "flex", width: barW, height: Math.max(Math.round((p.visitors / max) * 120), 2), backgroundColor: p === peak ? GOLD : NAVY, marginLeft: i ? gap : 0, opacity: p.visitors ? 1 : 0.15 }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${LINE}`, marginTop: 6, paddingTop: 6, fontSize: 11, color: MUTED }}>
        <div style={{ display: "flex" }}>{fmt(pts[0].date)}</div>
        <div style={{ display: "flex" }}>{fmt(pts[pts.length - 1].date)}</div>
      </div>
    </div>
  )
}

function chartHeight(c: FhiChatChart): number {
  if (c.kind === "bars") return 230
  if (c.kind === "trend") return 200
  if (c.kind === "pie") return 50 + Math.max(152, Math.min(c.rows.length, 8) * 26) + 10
  return 50 + Math.min(c.rows.length, 6) * 26 + 10
}

/** Width 1200; height follows the content. Returns PNG bytes, or null when
 *  there is nothing to draw. */
export async function renderReportPng(input: { title: string; periodLabel: string; stats: FhiChatStat[]; charts: FhiChatChart[] }): Promise<Buffer | null> {
  const stats = input.stats.filter((s) => s.value && s.value !== "–").slice(0, 8)
  const charts = input.charts.slice(0, 4)
  if (stats.length < 2 && charts.length === 0) return null
  const tileRows = Math.ceil(stats.length / 4)
  const chartRows: FhiChatChart[][] = []
  for (let i = 0; i < charts.length; i += 2) chartRows.push(charts.slice(i, i + 2))
  const height = 92 + tileRows * 118 + chartRows.reduce((a, row) => a + Math.max(...row.map(chartHeight)) + 36, 0) + 24

  const res = new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: W, height, backgroundColor: "#ffffff", fontFamily: "Outfit", padding: "28px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 22 }}>
          <div style={{ display: "flex", width: 10, height: 34, backgroundColor: GOLD, marginRight: 14 }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 12, fontWeight: 700, letterSpacing: 2.5, color: "#b8913f" }}>{input.title.toUpperCase()}</div>
            <div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: INK }}>{input.periodLabel}</div>
          </div>
        </div>
        {Array.from({ length: tileRows }).map((_, r) => (
          <div key={r} style={{ display: "flex", marginBottom: 14 }}>
            {stats.slice(r * 4, r * 4 + 4).map((s, i) => (
              <div key={s.label} style={{ display: "flex", marginLeft: i ? 13 : 0 }}>
                <Tile s={s} />
              </div>
            ))}
          </div>
        ))}
        {chartRows.map((row, r) => (
          <div key={r} style={{ display: "flex", marginTop: 22, paddingTop: 22, borderTop: `1px solid ${LINE}` }}>
            {row.map((c, i) => (
              <div key={c.title} style={{ display: "flex", marginLeft: i ? 0 : 0, width: 560, marginRight: i === 0 ? 0 : 0, paddingRight: i === 0 ? 0 : 0 }}>
                <div style={{ display: "flex", marginLeft: i ? 0 : 0 }}>
                  {c.kind === "bars" ? <Bars chart={c} /> : c.kind === "shares" ? <Shares chart={c} /> : c.kind === "pie" ? <Pie chart={c} /> : <Trend chart={c} />}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    ),
    { width: W, height, fonts: await fonts() },
  )
  return Buffer.from(await res.arrayBuffer())
}
