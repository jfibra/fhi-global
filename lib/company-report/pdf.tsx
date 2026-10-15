import "server-only"

import { Children } from "react"
import { Circle, Document, Font, Image, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer"
import type { Bar, CompanyReport, Share } from "./data"
import type { Insights } from "./insights"

/**
 * The company performance report as an A4 PDF (boss via Juliecor,
 * 2026-10-15): a navy cover with the headline tiles, the takeaways and the
 * sales-by-day chart, then numbered sections — teams & leader networks,
 * sales, pipeline, recruitment, leads & website — with tables and charts,
 * and the recommendations last. Drawn with @react-pdf/renderer (real text,
 * vector charts); bars are Views, donuts and lines are SVG.
 */

const NAVY = "#001f3f"
const GOLD = "#d6b357"
const GOLD_DEEP = "#b8913f"
const GOLD_SOFT = "#f0d89b"
const INK = "#0d1117"
const BODY = "#374151"
const MUTED = "#6b7280"
const FAINT = "#9ca3af"
const LINE = "#e5e8ec"
const PAPER = "#f6f7f9"
const UP = { fg: "#047857", bg: "#ecfdf5" }
const DOWN = { fg: "#b91c1c", bg: "#fef2f2" }
const PALETTE = [NAVY, GOLD, "#2f5d8a", GOLD_DEEP, "#8aa4c2", "#5c6b7a", "#e3c98a", FAINT]

const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-AE")}`
const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n)))
const int = (n: number) => Math.round(n).toLocaleString("en-AE")
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AE", { day: "numeric", month: "short", timeZone: "UTC" })

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

const s = StyleSheet.create({
  page: { fontFamily: "Outfit", fontSize: 9, color: BODY, paddingTop: 64, paddingBottom: 52, paddingHorizontal: 36 },
  cover: { fontFamily: "Outfit", fontSize: 9, color: BODY, paddingBottom: 46 },
  h2: { fontSize: 16, fontWeight: 700, color: NAVY },
  eyebrow: { fontSize: 7.5, fontWeight: 700, letterSpacing: 1.4, color: FAINT, textTransform: "uppercase" },
  card: { borderWidth: 1, borderColor: LINE, borderRadius: 8, padding: 12 },
  muted: { color: MUTED },
})

// ─── Small pieces ────────────────────────────────────────────────────────────

function Chip({ change }: { change: string | null }) {
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

function Empty({ children }: { children: string }) {
  return (
    <View style={{ backgroundColor: PAPER, borderRadius: 6, padding: 10, marginTop: 6 }}>
      <Text style={{ color: MUTED, fontSize: 8.5 }}>{children}</Text>
    </View>
  )
}

/** A numbered section. Its heading is glued to the first block under it, so a heading never ends a page alone. */
function Section({ n, title, subtitle, children }: { n: string; title: string; subtitle: string; children: React.ReactNode }) {
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

function SubTitle({ children, right }: { children: string; right?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
      <Text style={s.eyebrow}>{children}</Text>
      {right ? <Text style={{ fontSize: 7.5, color: FAINT }}>{right}</Text> : null}
    </View>
  )
}

function StatRow({ items }: { items: Array<{ label: string; value: string; hint?: string | null; change?: string | null }> }) {
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

type Col<R> = { label: string; width: number; align?: "left" | "right"; render: (r: R, i: number) => React.ReactNode }
function Table<R>({ cols, rows }: { cols: Array<Col<R>>; rows: R[] }) {
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
const Strong = ({ children, color = INK }: { children: React.ReactNode; color?: string }) => <Text style={{ fontSize: 8.5, fontWeight: 700, color }}>{children}</Text>
const Rank = ({ i }: { i: number }) => <Text style={{ fontSize: 8.5, fontWeight: 700, color: i === 0 ? GOLD_DEEP : FAINT }}>{i + 1}</Text>
function ShareBar({ value, max, color = GOLD }: { value: number; max: number; color?: string }) {
  return (
    <View style={{ width: "100%", height: 4, backgroundColor: "#eef0f3", borderRadius: 2 }}>
      <View style={{ width: `${Math.max(2, (100 * value) / Math.max(1, max))}%`, height: 4, backgroundColor: color, borderRadius: 2 }} />
    </View>
  )
}

/** Vertical bars as Views — the period's bars navy, the best one gold, context days faded. */
function VBars({ bars, height = 90, format = short, dateLabels = true }: { bars: Bar[]; height?: number; format?: (n: number) => string; dateLabels?: boolean }) {
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
function HBars({ rows, format = int, color = NAVY }: { rows: Share[]; format?: (n: number) => string; color?: string }) {
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
function Donut({ rows, size = 86, centre }: { rows: Share[]; size?: number; centre?: string }) {
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
function LineChart({ points, height = 80, width = 250 }: { points: Bar[]; height?: number; width?: number }) {
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

const Two = ({ left, right, gap = 12 }: { left: React.ReactNode; right: React.ReactNode; gap?: number }) => (
  <View style={{ flexDirection: "row" }}>
    <View style={{ flex: 1, marginRight: gap / 2 }}>{left}</View>
    <View style={{ flex: 1, marginLeft: gap / 2 }}>{right}</View>
  </View>
)

// ─── Document ────────────────────────────────────────────────────────────────

export type ReportImages = { whiteLogo: Buffer | null; navyLogo: Buffer | null }

export function CompanyReportDocument({ r, insights, images }: { r: CompanyReport; insights: Insights; images: ReportImages }) {
  const S = r.sales
  const P = r.pipeline
  const W = r.website
  const maxAgent = Math.max(1, ...S.topAgents.map((a) => a.value))
  const maxNet = Math.max(1, ...r.teams.networks.map((n) => n.network))

  const header = (
    <View fixed style={{ position: "absolute", top: 22, left: 36, right: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 8 }}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
      {images.navyLogo ? <Image src={{ data: images.navyLogo, format: "png" }} style={{ width: 66, height: 27, borderRadius: 3 }} /> : <Text style={{ fontWeight: 700, color: NAVY }}>FHI Global Property</Text>}
      <Text style={{ fontSize: 7.5, color: MUTED }}>
        <Text style={{ fontWeight: 700, color: NAVY }}>Company performance</Text> · {r.period.kind} · {r.period.label}
      </Text>
    </View>
  )
  const footer = (
    <View fixed style={{ position: "absolute", bottom: 20, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6 }}>
      <Text style={{ fontSize: 7, color: FAINT }}>FHI Global Property · Confidential — for internal use · Generated {r.generatedAt} (Dubai)</Text>
      <Text style={{ fontSize: 7, color: FAINT }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  )

  return (
    <Document title={`FHI Global — ${r.period.kind} — ${r.period.label}`} author="FHI Assistant" subject="Company performance report" creator="fhiglobal.ae">
      {/* ── Cover: the period, the headline tiles, the takeaways, sales by day ── */}
      <Page size="A4" style={s.cover}>
        <View style={{ backgroundColor: NAVY, paddingHorizontal: 36, paddingTop: 30, paddingBottom: 28, position: "relative" }}>
          <Svg width={260} height={220} style={{ position: "absolute", top: -60, right: -70 }}>
            <Circle cx={150} cy={110} r={100} stroke={GOLD} strokeOpacity={0.28} strokeWidth={1} fill="none" />
            <Circle cx={185} cy={85} r={100} stroke={GOLD} strokeOpacity={0.16} strokeWidth={1} fill="none" />
          </Svg>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            {images.whiteLogo ? <Image src={{ data: images.whiteLogo, format: "png" }} style={{ width: 112, height: 41 }} /> : <Text style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>FHI Global Property</Text>}
            <Text style={{ fontSize: 7, fontWeight: 700, letterSpacing: 1.6, color: GOLD_SOFT }}>CONFIDENTIAL · INTERNAL</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 34 }}>
            <View style={{ width: 26, height: 1.5, backgroundColor: GOLD, marginRight: 8 }} />
            <Text style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2.4, color: GOLD_SOFT }}>{r.period.kind.toUpperCase()}</Text>
          </View>
          <Text style={{ fontSize: 30, fontWeight: 700, color: "#ffffff", marginTop: 6, lineHeight: 1.05 }}>Company performance</Text>
          <Text style={{ fontSize: 17, fontWeight: 600, color: GOLD_SOFT, marginTop: 4 }}>{r.period.label}</Text>
          <Text style={{ fontSize: 8, color: "rgba(255,255,255,0.62)", marginTop: 10 }}>
            Prepared for the CEO · Generated {r.generatedAt} (Dubai) · Changes compare with {r.period.versus}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 36, paddingTop: 18 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 }}>
            {r.kpis.map((k) => (
              <View key={k.label} style={{ width: "25%", padding: 4 }}>
                <View style={{ ...s.card, padding: 10, minHeight: 66 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontSize: 6.8, fontWeight: 700, letterSpacing: 0.9, color: FAINT, textTransform: "uppercase" }}>{k.label}</Text>
                    <Chip change={k.change} />
                  </View>
                  <Text style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginTop: 5 }}>{k.value}</Text>
                  {k.hint ? <Text style={{ fontSize: 7, color: MUTED, marginTop: 3 }}>{k.hint}</Text> : null}
                </View>
              </View>
            ))}
          </View>

          <View style={{ marginTop: 12, backgroundColor: "#f4f6fa", borderLeftWidth: 3, borderLeftColor: GOLD, borderRadius: 6, padding: 12 }}>
            <Text style={{ ...s.eyebrow, color: GOLD_DEEP }}>At a glance</Text>
            {insights.takeaways.map((t, i) => (
              <View key={i} style={{ flexDirection: "row", marginTop: 6 }}>
                <Text style={{ fontSize: 9, fontWeight: 700, color: GOLD_DEEP, width: 14 }}>{i + 1}</Text>
                <Text style={{ flex: 1, fontSize: 9.5, color: INK, lineHeight: 1.35 }}>{t}</Text>
              </View>
            ))}
          </View>

          <View style={{ ...s.card, marginTop: 12 }}>
            <SubTitle right={S.byDay.some((b) => b.inPeriod === false) ? "Navy: this period · Grey: days before, for context" : undefined}>Validated sales by day (AED)</SubTitle>
            {S.byDay.some((b) => b.value > 0) ? <VBars bars={S.byDay} height={96} /> : <Empty>No validated sales in these days.</Empty>}
          </View>

          <View style={{ flexDirection: "row", marginTop: 12 }}>
            {["Teams & leaders", "Sales", "Pipeline", "Recruitment", "Leads & website", "Recommendations"].map((t, i) => (
              <View key={t} style={{ flex: 1, borderTopWidth: 2, borderTopColor: i === 5 ? GOLD : NAVY, paddingTop: 4, marginRight: i < 5 ? 6 : 0 }}>
                <Text style={{ fontSize: 9, fontWeight: 700, color: i === 5 ? GOLD_DEEP : NAVY }}>{String(i + 1).padStart(2, "0")}</Text>
                <Text style={{ fontSize: 7.5, color: MUTED }}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
        <View fixed style={{ position: "absolute", bottom: 20, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6 }}>
          <Text style={{ fontSize: 7, color: FAINT }}>FHI Global Property · Confidential — for internal use</Text>
          <Text style={{ fontSize: 7, color: FAINT }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* ── The sections ── */}
      <Page size="A4" style={s.page}>
        {header}
        {footer}

        <Section n="01" title="Teams & leaders" subtitle="How each team and each leader's network is doing — sales are validated and credited per share.">
          {r.teams.formal.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <SubTitle>Formal teams</SubTitle>
              <Table
                rows={r.teams.formal}
                cols={[
                  { label: "Team", width: 24, render: (t) => <View><Strong>{t.name}</Strong><Text style={{ fontSize: 7, color: MUTED }}>Led by {t.leaders || "—"}</Text></View> },
                  { label: "Members", width: 12, align: "right", render: (t) => `${int(t.members)}` },
                  { label: "Active", width: 11, align: "right", render: (t) => `${int(t.active)}` },
                  { label: "Ever sold", width: 13, align: "right", render: (t) => `${t.soldAllTime} (${t.members ? Math.round((100 * t.soldAllTime) / t.members) : 0}%)` },
                  { label: "This period", width: 20, align: "right", render: (t) => <Strong color={NAVY}>{t.dealsPeriod ? `${t.dealsPeriod} · ${aed(t.valuePeriod)}` : "—"}</Strong> },
                  { label: "All time", width: 20, align: "right", render: (t) => `${t.dealsAllTime} · AED ${short(t.valueAllTime)}` },
                ]}
              />
            </View>
          )}
          <SubTitle right="A network includes the networks under it, so leaders overlap.">Biggest leader networks</SubTitle>
          {r.teams.networks.length ? (
            <Table
              rows={r.teams.networks}
              cols={[
                { label: "#", width: 5, render: (_, i) => <Rank i={i} /> },
                { label: "Leader", width: 25, render: (n) => <View><Strong>{n.name}</Strong><Text style={{ fontSize: 7, color: MUTED }}>{n.direct} direct recruits</Text></View> },
                { label: "Network", width: 18, render: (n) => <View style={{ width: "92%" }}><Text style={{ fontSize: 8.5, color: INK, marginBottom: 2 }}>{int(n.network)} people</Text><ShareBar value={n.network} max={maxNet} color={NAVY} /></View> },
                { label: "Joined", width: 9, align: "right", render: (n) => (n.joined ? `+${n.joined}` : "—") },
                { label: "Sold", width: 13, align: "right", render: (n) => `${n.sellers} of ${n.active}` },
                { label: "Deals", width: 8, align: "right", render: (n) => (n.deals ? String(n.deals) : "—") },
                { label: "Network sales", width: 22, align: "right", render: (n) => <Strong color={n.value ? NAVY : FAINT}>{n.value ? aed(n.value) : "—"}</Strong> },
              ]}
            />
          ) : (
            <Empty>No recruiter networks yet.</Empty>
          )}
          {r.teams.noTeam.count > 0 && (
            <View style={{ flexDirection: "row", marginTop: 10, backgroundColor: "#fffaf0", borderRadius: 6, padding: 9, borderLeftWidth: 3, borderLeftColor: GOLD }}>
              <Text style={{ fontSize: 8.5, color: INK, flex: 1 }}>
                <Text style={{ fontWeight: 700 }}>{int(r.teams.noTeam.count)} selling accounts are in no team</Text> — {r.teams.noTeam.byRole.map((b) => `${b.value} ${b.label.toLowerCase()}${b.value === 1 ? "" : "s"}`).join(", ")}. Nobody coaches them and their sales don&apos;t roll up to a leader.
              </Text>
            </View>
          )}
        </Section>

        <Section n="02" title="Sales" subtitle={`Validated sales in the period, compared with ${r.period.versus}.`}>
          <StatRow
            items={[
              { label: "Validated value", value: `AED ${short(S.validated.value)}`, change: r.kpis[0]?.change ?? null, hint: `vs AED ${short(S.previous.value)}` },
              { label: "Validated deals", value: String(S.validated.deals), change: r.kpis[1]?.change ?? null, hint: `vs ${S.previous.deals}` },
              { label: "Pending", value: String(S.pending.deals), hint: S.pending.deals ? `AED ${short(S.pending.value)}` : "nothing waiting" },
              { label: "All time", value: `AED ${short(S.allTime.value)}`, hint: `${S.allTime.deals} validated deals` },
            ]}
          />
          <SubTitle>Top agents</SubTitle>
          {S.topAgents.length ? (
            <Table
              rows={S.topAgents}
              cols={[
                { label: "#", width: 6, render: (_, i) => <Rank i={i} /> },
                { label: "Agent", width: 36, render: (a) => <Strong>{a.name}</Strong> },
                { label: "Deals", width: 10, align: "right", render: (a) => String(a.deals) },
                { label: "Share of value", width: 26, render: (a) => <View style={{ flexDirection: "row", alignItems: "center", width: "100%", paddingLeft: 8 }}><View style={{ flex: 1 }}><ShareBar value={a.value} max={maxAgent} /></View><Text style={{ width: 26, fontSize: 7.5, color: MUTED, textAlign: "right" }}>{Math.round(a.share * 100)}%</Text></View> },
                { label: "Value", width: 22, align: "right", render: (a) => <Strong color={NAVY}>{aed(a.value)}</Strong> },
              ]}
            />
          ) : (
            <Empty>No validated sales in this period.</Empty>
          )}
          {(S.topDevelopers.length > 0 || S.topProjects.length > 0) && (
            <View style={{ marginTop: 12 }}>
              <Two
                left={
                  <View>
                    <SubTitle>Top developers</SubTitle>
                    <HBars rows={S.topDevelopers.map((d) => ({ label: `${d.name} · ${d.deals} deal${d.deals === 1 ? "" : "s"}`, value: d.value, display: `AED ${short(d.value)}` }))} />
                  </View>
                }
                right={
                  <View>
                    <SubTitle>Top projects</SubTitle>
                    <HBars rows={S.topProjects.map((p) => ({ label: `${p.name} · ${p.deals} deal${p.deals === 1 ? "" : "s"}`, value: p.value, display: `AED ${short(p.value)}` }))} />
                  </View>
                }
              />
            </View>
          )}
          {S.partnerDeals > 0 && <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 6 }}>{S.partnerDeals} of the period&apos;s deals were shared between agents; each agent is credited their share, company totals count the sale once.</Text>}
        </Section>

        <Section n="03" title="Pipeline & activity" subtitle="Sales waiting for validation, commission status and who is selling — as of today.">
          <StatRow
            items={[
              { label: "Awaiting validation", value: String(P.awaiting), hint: P.awaiting ? `AED ${short(P.awaitingValue)}` : "all clear" },
              { label: `Waiting > ${P.staleDays} days`, value: String(P.stale), hint: "oldest first below" },
              { label: "Days to validate", value: P.validationDays === null ? "—" : String(P.validationDays), hint: "average, submitted to validated" },
              { label: "Sold this period", value: `${P.soldInPeriod} / ${P.sellingActive}`, hint: `${P.neverSold} have never sold` },
            ]}
          />
          {P.oldest.length > 0 && (
            <View style={{ marginBottom: 10 }}>
              <SubTitle>Waiting for validation — chase these first</SubTitle>
              <Table
                rows={P.oldest}
                cols={[
                  { label: "Agent", width: 32, render: (o) => <Strong>{o.agent}</Strong> },
                  { label: "Project", width: 34, render: (o) => o.project },
                  { label: "Value", width: 20, align: "right", render: (o) => aed(o.value) },
                  { label: "Days", width: 14, align: "right", render: (o) => <Strong color={o.days > P.staleDays ? DOWN.fg : INK}>{String(o.days)}</Strong> },
                ]}
              />
            </View>
          )}
          <View wrap={false}>
          <Two
            left={
              <View style={s.card}>
                <SubTitle>Quiet selling accounts by role</SubTitle>
                {P.quietByRole.length ? <HBars rows={P.quietByRole} color="#8aa4c2" /> : <Empty>Everyone sold this period.</Empty>}
              </View>
            }
            right={
              <View style={s.card}>
                <SubTitle>Commission status (validated sales)</SubTitle>
                <Donut rows={P.commissions} />
              </View>
            }
          />
          </View>
        </Section>

        <Section n="04" title="Recruitment" subtitle={`New accounts in the period, compared with ${r.period.versus}.`}>
          <StatRow
            items={[
              { label: "New accounts", value: int(r.recruitment.total), change: r.recruitment.change, hint: `vs ${r.recruitment.previous}` },
              { label: "Recruited", value: int(r.recruitment.recruited), hint: "registered under someone" },
              { label: "Direct sign-ups", value: int(r.recruitment.direct), hint: "from the website" },
              { label: "Waiting approval", value: int(r.recruitment.waiting), hint: "status pending" },
            ]}
          />
          <View wrap={false}>
          <Two
            left={
              <View style={s.card}>
                <SubTitle>New accounts by role</SubTitle>
                <Donut rows={r.recruitment.byRole} />
              </View>
            }
            right={
              <View style={s.card}>
                <SubTitle>Top recruiters this period</SubTitle>
                {r.recruitment.topRecruiters.length ? <HBars rows={r.recruitment.topRecruiters.map((t) => ({ label: t.name, value: t.recruits }))} /> : <Empty>No recruits this period.</Empty>}
              </View>
            }
          />
          </View>
          <View style={{ ...s.card, marginTop: 10 }} wrap={false}>
            <SubTitle right="Navy: this period · Grey: days before">Sign-ups by day</SubTitle>
            <VBars bars={r.recruitment.byDay} height={70} format={int} />
          </View>
        </Section>

        <Section n="05" title="Leads & website" subtitle="Every way a prospect reached FHI, and who visited fhiglobal.ae.">
          <SubTitle>Leads by source</SubTitle>
          <Table
            rows={[...r.leads.sources, { label: "All leads", total: r.leads.total, previous: r.leads.previous, change: r.leads.change }]}
            cols={[
              { label: "Source", width: 40, render: (l) => (l.label === "All leads" ? <Strong>All leads</Strong> : l.label) },
              { label: "This period", width: 20, align: "right", render: (l) => <Strong color={NAVY}>{int(l.total)}</Strong> },
              { label: "Before", width: 20, align: "right", render: (l) => int(l.previous) },
              { label: "Change", width: 20, align: "right", render: (l) => (l.change ? <Chip change={l.change} /> : "—") },
            ]}
          />
          <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 5, marginBottom: 10 }}>
            {r.leads.unanswered ? `${r.leads.unanswered} still waiting for a reply. ` : "Nothing waiting for a reply. "}
            Website buttons: {int(r.leads.whatsappClicks)} WhatsApp clicks, {int(r.leads.inquiriesSubmitted)} inquiry forms submitted.
          </Text>
          {W ? (
            <View>
              <StatRow
                items={[
                  { label: "Visitors", value: int(W.visitors), change: W.change, hint: `vs ${int(W.previous)}` },
                  { label: "Sessions", value: int(W.sessions) },
                  { label: "Page views", value: int(W.pageViews) },
                  { label: "Time on site", value: W.avgTime ?? "—", hint: W.engagement !== null ? `${W.engagement}% engaged` : null },
                ]}
              />
              <View wrap={false}>
                <Two
                  left={
                    <View style={s.card}>
                      <SubTitle right={W.trend ?? undefined}>Visitors by day</SubTitle>
                      <LineChart points={W.byDay} width={232} />
                    </View>
                  }
                  right={
                    <View style={s.card}>
                      <SubTitle>Traffic sources (sessions)</SubTitle>
                      <HBars rows={W.sources} />
                    </View>
                  }
                />
              </View>
              <View style={{ marginTop: 10 }} wrap={false}>
                <Two
                  left={
                    <View style={s.card}>
                      <SubTitle>Devices</SubTitle>
                      <Donut rows={W.devices} size={74} />
                    </View>
                  }
                  right={
                    <View style={s.card}>
                      <SubTitle>Most viewed pages</SubTitle>
                      {W.topPages.map((p, i) => (
                        <View key={p.path} style={{ flexDirection: "row", marginBottom: 3 }}>
                          <Text style={{ width: 12, fontSize: 7.5, color: FAINT }}>{i + 1}</Text>
                          <Text style={{ flex: 1, fontSize: 7.5, color: INK, marginRight: 6 }}>{p.path.length > 46 ? `${p.path.slice(0, 45)}…` : p.path}</Text>
                          <Text style={{ fontSize: 7.5, fontWeight: 700, color: NAVY }}>{int(p.views)}</Text>
                        </View>
                      ))}
                    </View>
                  }
                />
              </View>
            </View>
          ) : (
            <Empty>Website analytics were not available when this report was generated.</Empty>
          )}
        </Section>

        <View break />
        <Section n="06" title="Recommendations" subtitle="What to do in the next two weeks to make the company more productive.">
          {insights.recommendations.map((rec, i) => (
            <View key={i} wrap={false} style={{ flexDirection: "row", borderWidth: 1, borderColor: LINE, borderRadius: 8, padding: 11, marginBottom: 8 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: NAVY, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                <Text style={{ color: GOLD_SOFT, fontSize: 10, fontWeight: 700 }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 11, fontWeight: 700, color: NAVY, flex: 1 }}>{rec.title}</Text>
                  <Text style={{ fontSize: 7, fontWeight: 700, color: rec.impact === "High" ? "#ffffff" : NAVY, backgroundColor: rec.impact === "High" ? NAVY : rec.impact === "Quick win" ? "#fdf3d8" : "#eef1f5", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                    {rec.impact.toUpperCase()}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", marginTop: 5 }}>
                  <Text style={{ width: 62, fontSize: 7, fontWeight: 700, letterSpacing: 0.6, color: FAINT, marginTop: 1 }}>WHAT WE SEE</Text>
                  <Text style={{ flex: 1, fontSize: 8.8, color: BODY, lineHeight: 1.35 }}>{rec.finding}</Text>
                </View>
                <View style={{ flexDirection: "row", marginTop: 4 }}>
                  <Text style={{ width: 62, fontSize: 7, fontWeight: 700, letterSpacing: 0.6, color: GOLD_DEEP, marginTop: 1 }}>WHAT TO DO</Text>
                  <Text style={{ flex: 1, fontSize: 8.8, color: INK, fontWeight: 600, lineHeight: 1.35 }}>{rec.action}</Text>
                </View>
                <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 4 }}>Owner: {rec.owner}</Text>
              </View>
            </View>
          ))}
          <Text style={{ fontSize: 7.5, color: FAINT, marginTop: 2 }}>
            {insights.source === "ai"
              ? "Recommendations are drafted by FHI Assistant from the figures in this report only — review them before acting."
              : "Recommendations are generated from the figures in this report by fixed rules."}
          </Text>
        </Section>
      </Page>
    </Document>
  )
}
