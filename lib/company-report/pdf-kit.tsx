import "server-only"

import { Children } from "react"
import { Circle, Font, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer"
import type { Bar, Share } from "./data"

/**
 * The drawing kit shared by every FHI PDF report (the company performance
 * report, lib/company-report/pdf.tsx, and the team performance report,
 * lib/team-report/pdf.tsx): the navy-and-gold palette, the Outfit font
 * registration, and the building blocks — numbered sections, stat tiles,
 * tables, vertical and ranked bars, donuts and a line chart — drawn with
 * @react-pdf/renderer (real text, vector charts; bars are Views, donuts and
 * lines are SVG). Extracted from the company report on 2026-11-05 so both
 * documents stay one design.
 */

export const NAVY = "#001f3f"
export const GOLD = "#d6b357"
export const GOLD_DEEP = "#b8913f"
export const GOLD_SOFT = "#f0d89b"
export const INK = "#0d1117"
export const BODY = "#374151"
export const MUTED = "#6b7280"
export const FAINT = "#9ca3af"
export const LINE = "#e5e8ec"
export const PAPER = "#f6f7f9"
export const UP = { fg: "#047857", bg: "#ecfdf5" }
export const DOWN = { fg: "#b91c1c", bg: "#fef2f2" }
export const PALETTE = [NAVY, GOLD, "#2f5d8a", GOLD_DEEP, "#8aa4c2", "#5c6b7a", "#e3c98a", FAINT]

export const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-AE")}`
export const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n)))
export const int = (n: number) => Math.round(n).toLocaleString("en-AE")
export const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AE", { day: "numeric", month: "short", timeZone: "UTC" })

let fontsFor: string | null = null
export function registerReportFonts(origin: string) {
  if (fontsFor === origin) return
  Font.register({
    family: "Outfit",
    fonts: [
      { src: `${origin}/fonts/Outfit-400.woff`, fontWeight: 400 },
      { src: `${origin}/fonts/Outfit-600.woff`, fontWeight: 600 },
      { src: `${origin}/fonts/Outfit-700.woff`, fontWeight: 700 },
    ],
  })
  // Long project names and URLs wrap anywhere rather than hyphenating.
  Font.registerHyphenationCallback((word) => [word])
  fontsFor = origin
}

export const s = StyleSheet.create({
  page: { fontFamily: "Outfit", fontSize: 9, color: BODY, paddingTop: 64, paddingBottom: 52, paddingHorizontal: 36 },
  cover: { fontFamily: "Outfit", fontSize: 9, color: BODY, paddingBottom: 46 },
  h2: { fontSize: 16, fontWeight: 700, color: NAVY },
  eyebrow: { fontSize: 7.5, fontWeight: 700, letterSpacing: 1.4, color: FAINT, textTransform: "uppercase" },
  card: { borderWidth: 1, borderColor: LINE, borderRadius: 8, padding: 12 },
  muted: { color: MUTED },
})

// ─── Small pieces ────────────────────────────────────────────────────────────

export function Chip({ change }: { change: string | null }) {
  if (!change) return null
  const down = change.startsWith("-")
  const c = change === "new" ? UP : down ? DOWN : UP
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: c.bg, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1.5 }}>
      {change !== "new" && (
        <Svg width={5} height={4} viewBox="0 0 10 8" style={{ marginRight: 2 }}>
          <Path d={down ? "M0 0 L10 0 L5 8 Z" : "M0 8 L10 8 L5 0 Z"} fill={c.fg} />
        </Svg>
      )}
      <Text style={{ fontSize: 7.5, fontWeight: 700, color: c.fg }}>{change === "new" ? "new" : change.replace(/^[+-]/, "")}</Text>
    </View>
  )
}

export function Empty({ children }: { children: string }) {
  return (
    <View style={{ backgroundColor: PAPER, borderRadius: 6, padding: 10, marginTop: 6 }}>
      <Text style={{ color: MUTED, fontSize: 8.5 }}>{children}</Text>
    </View>
  )
}

/** A numbered section. Its heading is glued to the first block under it, so a heading never ends a page alone. */
export function Section({ n, title, subtitle, children }: { n: string; title: string; subtitle: string; children: React.ReactNode }) {
  const [first, ...rest] = Children.toArray(children)
  return (
    <View style={{ marginBottom: 18 }}>
      <View wrap={false}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", borderBottomWidth: 1.5, borderBottomColor: NAVY, paddingBottom: 6, marginBottom: 10 }}>
        <Text style={{ fontSize: 22, fontWeight: 700, color: GOLD, marginRight: 10, lineHeight: 1 }}>{n}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.h2}>{title}</Text>
          <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 1 }}>{subtitle}</Text>
        </View>
      </View>
      {first}
      </View>
      {rest}
    </View>
  )
}

export function SubTitle({ children, right }: { children: string; right?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
      <Text style={s.eyebrow}>{children}</Text>
      {right ? <Text style={{ fontSize: 7.5, color: FAINT }}>{right}</Text> : null}
    </View>
  )
}

export function StatRow({ items }: { items: Array<{ label: string; value: string; hint?: string | null; change?: string | null }> }) {
  return (
    <View wrap={false} style={{ flexDirection: "row", marginBottom: 10 }}>
      {items.map((it, i) => (
        <View key={it.label} style={{ flex: 1, backgroundColor: PAPER, borderRadius: 6, padding: 8, marginLeft: i ? 6 : 0 }}>
          <Text style={{ fontSize: 7, fontWeight: 700, letterSpacing: 0.8, color: FAINT, textTransform: "uppercase" }}>{it.label}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
            <Text style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginRight: 4 }}>{it.value}</Text>
            <Chip change={it.change ?? null} />
          </View>
          {it.hint ? <Text style={{ fontSize: 7, color: MUTED, marginTop: 2 }}>{it.hint}</Text> : null}
        </View>
      ))}
    </View>
  )
}

export type Col<R> = { label: string; width: number; align?: "left" | "right"; render: (r: R, i: number) => React.ReactNode }
export function Table<R>({ cols, rows }: { cols: Array<Col<R>>; rows: R[] }) {
  return (
    <View style={{ borderWidth: 1, borderColor: LINE, borderRadius: 6 }}>
      <View style={{ flexDirection: "row", backgroundColor: PAPER, borderTopLeftRadius: 6, borderTopRightRadius: 6, paddingVertical: 5, paddingHorizontal: 8 }}>
        {cols.map((c) => (
          <Text key={c.label} style={{ width: `${c.width}%`, paddingHorizontal: 3, fontSize: 6.8, fontWeight: 700, letterSpacing: 0.7, color: FAINT, textTransform: "uppercase", textAlign: c.align ?? "left" }}>{c.label}</Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} wrap={false} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 5, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: "#f0f2f5" }}>
          {cols.map((c) => (
            <View key={c.label} style={{ width: `${c.width}%`, paddingHorizontal: 3, alignItems: c.align === "right" ? "flex-end" : "flex-start" }}>
              {(() => {
                const v = c.render(r, i)
                return typeof v === "string" || typeof v === "number" ? <Text style={{ fontSize: 8.5, color: BODY, textAlign: c.align ?? "left" }}>{v}</Text> : v
              })()}
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}
export const Strong = ({ children, color = INK }: { children: React.ReactNode; color?: string }) => <Text style={{ fontSize: 8.5, fontWeight: 700, color }}>{children}</Text>
export const Rank = ({ i }: { i: number }) => <Text style={{ fontSize: 8.5, fontWeight: 700, color: i === 0 ? GOLD_DEEP : FAINT }}>{i + 1}</Text>
export function ShareBar({ value, max, color = GOLD }: { value: number; max: number; color?: string }) {
  return (
    <View style={{ width: "100%", height: 4, backgroundColor: "#eef0f3", borderRadius: 2 }}>
      <View style={{ width: `${Math.max(2, (100 * value) / Math.max(1, max))}%`, height: 4, backgroundColor: color, borderRadius: 2 }} />
    </View>
  )
}

/** Vertical bars as Views — the period's bars navy, the best one gold, context days faded. */
export function VBars({ bars, height = 90, format = short, dateLabels = true }: { bars: Bar[]; height?: number; format?: (n: number) => string; dateLabels?: boolean }) {
  const max = Math.max(1, ...bars.map((b) => b.value))
  const peak = bars.reduce((best, b, i) => (b.inPeriod !== false && b.value > (best < 0 ? 0 : bars[best].value) ? i : best), -1)
  const showValues = bars.length <= 16
  const every = Math.ceil(bars.length / 10)
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height, borderBottomWidth: 1, borderBottomColor: LINE }}>
        {bars.map((b, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height, paddingHorizontal: bars.length > 20 ? 0.6 : 1.5 }}>
            {showValues && b.value > 0 ? <Text style={{ fontSize: 6, color: i === peak ? GOLD_DEEP : b.inPeriod === false ? FAINT : BODY, marginBottom: 2 }}>{format(b.value)}</Text> : null}
            <View style={{ width: "100%", height: b.value > 0 ? Math.max(2, ((height - 12) * b.value) / max) : 1, backgroundColor: i === peak ? GOLD : b.inPeriod === false ? "#d5dbe3" : NAVY, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", marginTop: 3 }}>
        {bars.map((b, i) => (
          <Text key={i} style={{ flex: 1, fontSize: 5.8, color: b.inPeriod === false ? "#c5ccd6" : MUTED, textAlign: "center" }}>
            {i % every === 0 || i === bars.length - 1 ? (dateLabels ? day(b.label) : b.label) : ""}
          </Text>
        ))}
      </View>
    </View>
  )
}

/** Ranked horizontal bars. */
export function HBars({ rows, format = int, color = NAVY }: { rows: Share[]; format?: (n: number) => string; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <View>
      {rows.map((r, i) => (
        <View key={r.label} wrap={false} style={{ marginBottom: 5 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 8, color: INK, maxWidth: "75%" }}>{r.label}</Text>
            <Text style={{ fontSize: 8, fontWeight: 700, color: NAVY }}>{r.display ?? format(r.value)}</Text>
          </View>
          <View style={{ height: 5, backgroundColor: "#eef0f3", borderRadius: 2.5, marginTop: 2 }}>
            <View style={{ width: `${Math.max(1.5, (100 * r.value) / max)}%`, height: 5, backgroundColor: i === 0 ? GOLD : color, borderRadius: 2.5 }} />
          </View>
        </View>
      ))}
    </View>
  )
}

/** A donut with its legend. */
export function Donut({ rows, size = 86, centre }: { rows: Share[]; size?: number; centre?: string }) {
  const data = rows.filter((r) => r.value > 0)
  const total = data.reduce((a, r) => a + r.value, 0)
  if (!total) return <Empty>Nothing to show for this period.</Empty>
  const R = size / 2
  const r = R * 0.6
  // Each slice starts where the previous ones end — cumulative shares, no reassignment while rendering.
  const fracs = data.map((row) => row.value / total)
  const starts = fracs.map((_, i) => -Math.PI / 2 + fracs.slice(0, i).reduce((a, b) => a + b, 0) * Math.PI * 2)
  const arcs = data.map((row, i) => {
    const frac = fracs[i]
    const start = starts[i]
    const end = start + frac * Math.PI * 2 - (data.length > 1 ? 0.02 : 0)
    const p = (rad: number, a: number) => `${R + rad * Math.cos(a)} ${R + rad * Math.sin(a)}`
    const large = end - start > Math.PI ? 1 : 0
    const d = `M ${p(R, start)} A ${R} ${R} 0 ${large} 1 ${p(R, end)} L ${p(r, end)} A ${r} ${r} 0 ${large} 0 ${p(r, start)} Z`
    return { d, color: PALETTE[i % PALETTE.length], row, pct: Math.round(frac * 100) }
  })
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {arcs.length === 1 ? (
            <Circle cx={R} cy={R} r={(R + r) / 2} stroke={arcs[0].color} strokeWidth={R - r} fill="none" />
          ) : (
            arcs.map((a) => <Path key={a.row.label} d={a.d} fill={a.color} />)
          )}
        </Svg>
        <View style={{ position: "absolute", top: 0, left: 0, width: size, height: size, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 12, fontWeight: 700, color: INK }}>{centre ?? short(total)}</Text>
        </View>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        {arcs.slice(0, 7).map((a) => (
          <View key={a.row.label} style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
            <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: a.color, marginRight: 5 }} />
            <Text style={{ flex: 1, fontSize: 8, color: INK }}>{a.row.label}</Text>
            <Text style={{ fontSize: 8, color: BODY, marginRight: 6 }}>{a.row.display ?? int(a.row.value)}</Text>
            <Text style={{ width: 24, fontSize: 7.5, color: FAINT, textAlign: "right" }}>{a.pct}%</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

/** A line with a soft area under it — visitors by day. */
export function LineChart({ points, height = 80, width = 250 }: { points: Bar[]; height?: number; width?: number }) {
  if (points.length < 2) return <Empty>Not enough days to draw a trend.</Empty>
  const max = Math.max(1, ...points.map((p) => p.value))
  const x = (i: number) => (i / (points.length - 1)) * (width - 8) + 4
  const y = (v: number) => height - 6 - (v / max) * (height - 16)
  const line = points.map((p, i) => `${i ? "L" : "M"} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ")
  const area = `${line} L ${x(points.length - 1).toFixed(1)} ${height - 6} L ${x(0).toFixed(1)} ${height - 6} Z`
  const peak = points.reduce((b, p, i) => (p.value > points[b].value ? i : b), 0)
  return (
    <View>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path d={area} fill="#e8eef6" />
        <Path d={line} stroke={NAVY} strokeWidth={1.6} fill="none" />
        <Circle cx={x(peak)} cy={y(points[peak].value)} r={3} fill={GOLD} />
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-between", width }}>
        <Text style={{ fontSize: 6.5, color: FAINT }}>{day(points[0].label)}</Text>
        <Text style={{ fontSize: 6.5, color: GOLD_DEEP }}>Peak {day(points[peak].label)}: {int(points[peak].value)}</Text>
        <Text style={{ fontSize: 6.5, color: FAINT }}>{day(points[points.length - 1].label)}</Text>
      </View>
    </View>
  )
}

export const Two = ({ left, right, gap = 12 }: { left: React.ReactNode; right: React.ReactNode; gap?: number }) => (
  <View style={{ flexDirection: "row" }}>
    <View style={{ flex: 1, marginRight: gap / 2 }}>{left}</View>
    <View style={{ flex: 1, marginLeft: gap / 2 }}>{right}</View>
  </View>
)
