"use client"

import { useEffect, useState } from "react"
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { InView } from "@/components/public/in-view"
import type { DldPriceIndexPoint, DldPriceIndexResponse, DldPriceIndexSeries } from "@/lib/dld-open-data"

/**
 * Dubai Land Department's official Property Price Index, for the public
 * /open-data page (linked from the header's Properties menu → after
 * Developers). Fetches the public, unauthenticated /api/dld/price-index
 * proxy (server-cached six hours).
 *
 * Deliberately self-contained rather than importing the admin dashboard's
 * Market Charts module (features/dashboard/real-estate-data/market-charts.tsx):
 * that file also pulls in FilterSelect (Radix Popover + cmdk) and the whole
 * breakdown/summary machinery, none of which this page needs — a public,
 * SEO page's bundle should not carry admin-dashboard weight.
 *
 * Chart layout mirrors DLD's own presentation of this data (dubailand.gov.ae
 * /en/open-data/indexes-home): quarterly and annual side by side for the
 * active category, each a dual-axis chart — percent change as bars on the
 * left axis, the index level as a line on the right. That's why it breaks
 * the usual one-axis-per-chart rule here. Everything else follows the public
 * site's design (as on /projects and the mortgage calculator): square corners,
 * hairline #e5e8ec borders, the black segmented switch (.pl-view), gold
 * eyebrows whose rule draws in (InView + .wf-rule), Outfit figures, and the
 * navy / gold brand palette below.
 */

// Brand colours, contrast-checked on white (charts need 3:1): navy 16.6:1,
// steel 3.4:1, deep gold 3.5:1. The two bar series differ in lightness (navy
// vs steel) and the index line in hue and shape, so the three still separate
// for colour-blind readers. A series keeps its colour in both charts.
const C = {
  qoq: "#6f8db3",
  yoy: "#001f3f",
  actual: "#a8842f",
  grid: "#eef0f3",
  axis: "#e5e8ec",
  tick: "#8b92a0",
} as const
const TOOLTIP_STYLE = { borderRadius: 0, border: "1px solid #e5e8ec", fontSize: 12, boxShadow: "0 12px 32px -18px rgba(0,20,40,.28)" }
const TOOLTIP_LABEL = { fontWeight: 700, color: "#0d1117", marginBottom: 4 }
// Actual (the index level) keeps up to 2 decimals rather than rounding —
// 110.64 stays 110.64, not 111. Percent change already caps at 1 (pctLabel).
const dec = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 2 })
const pctLabel = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`
const xLabel = (x: string) => x.replace(/^(\d{4})\.(\d)$/, "Q$2 $1")

function Skeleton({ h = 340 }: { h?: number }) {
  return <div className="bg-[#f0f2f5] animate-pulse" style={{ height: h }} />
}

/**
 * True below the sm breakpoint (640px). Recharts' axis ticks and chart
 * height are plain numeric props, not CSS — Tailwind can't thin out the
 * quarterly chart's 24 labels on a phone, so this is the one place that
 * genuinely needs a JS media query rather than responsive classes.
 */
function useIsNarrowScreen(): boolean {
  // Computed lazily at first render (not set from inside the effect below) —
  // the effect only subscribes to later changes, so there is nothing for
  // React's set-state-in-effect check to flag.
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)")
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  return narrow
}

/**
 * A clickable legend key — Chart.js-style series toggle. The marker is drawn
 * like its series (a square for bars, a line with a dot for the index). On:
 * solid marker, full label. Off: hollow marker, dashed edge, struck label. The
 * chart itself must skip rendering the Bar/Line for a hidden key entirely (not
 * just visually hide it), so Recharts recomputes each axis from only the
 * series still on screen, the same rescale Chart.js does on legend click.
 */
function LegendKey({ color, label, line, active, onToggle }: { color: string; label: string; line?: boolean; active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      title={active ? `Hide ${label}` : `Show ${label}`}
      className={`inline-flex items-center gap-2 border px-3 py-1.5 text-[12px] font-semibold transition-colors hover:border-[#d6b357] ${
        active ? "border-[#e5e8ec] bg-white text-[#374151]" : "border-dashed border-[#e5e8ec] bg-transparent text-[#9ca3af] line-through decoration-1"
      }`}
    >
      {line ? (
        <span className="relative flex h-2.5 w-4 shrink-0 items-center" aria-hidden="true" style={{ opacity: active ? 1 : 0.45 }}>
          <span className="h-[2px] w-full" style={{ background: color }} />
          <span className="absolute left-1/2 h-2 w-2 -translate-x-1/2 rounded-full" style={{ background: active ? color : "#fff", border: `1.5px solid ${color}` }} />
        </span>
      ) : (
        <span className="h-2.5 w-2.5 shrink-0" aria-hidden="true" style={{ background: active ? color : "transparent", border: `1.5px solid ${color}`, opacity: active ? 1 : 0.5 }} />
      )}
      {label}
    </button>
  )
}

/** Period eyebrow + the latest reading, in the site's eyebrow-and-figure style. */
function ChartHead({ period, context, point }: { period: string; context: string; point: DldPriceIndexPoint | null }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <h3 className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#b8913f]">
        <span className="wf-rule h-px w-8 bg-[#d6b357]" aria-hidden="true" />
        <span className="sr-only">{context} — </span>
        {period}
      </h3>
      {point && point.actual !== null && (
        <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 tabular-nums">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9ca3af]">{xLabel(point.x)}</span>
          <span className="font-['Outfit'] text-[22px] font-bold leading-none text-[#001f3f]">{dec.format(point.actual)}</span>
          {point.yoy !== null && (
            <span className={`text-[12.5px] font-semibold ${point.yoy >= 0 ? "text-[#0f7a4f]" : "text-[#b3261e]"}`}>
              {pctLabel(point.yoy)} <span className="font-normal text-[#9ca3af]">annual change</span>
            </span>
          )}
        </p>
      )}
    </div>
  )
}

export function PriceIndexChart() {
  const narrow = useIsNarrowScreen()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ series: DldPriceIndexSeries[] | null; error: string | null }>({ series: null, error: null })
  const [categoryCode, setCategoryCode] = useState("")
  const [subCode, setSubCode] = useState("")

  // Which series are switched off, per chart (Chart.js-style legend toggle).
  // Kept separate from category/sub-index choice — hiding "QoQ" stays hidden
  // as you browse to a different sub-index.
  const [qHidden, setQHidden] = useState<Set<string>>(new Set())
  const [aHidden, setAHidden] = useState<Set<string>>(new Set())
  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) =>
    set((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch("/api/dld/price-index")
        const json = (await r.json()) as DldPriceIndexResponse & { error?: string }
        if (cancelled) return
        if (r.ok) setState({ series: json.series, error: null })
        else setState({ series: null, error: json.error || "Request failed." })
      } catch {
        if (!cancelled) setState({ series: null, error: "Could not load the price index." })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [attempt])

  const loading = !state.series && !state.error
  const series = state.series ?? []

  // Category/sub-category options, in first-seen order (the gateway's own order).
  const categories: Array<{ value: string; label: string }> = []
  const seenCat = new Set<string>()
  for (const s of series) {
    if (seenCat.has(s.categoryCode)) continue
    seenCat.add(s.categoryCode)
    categories.push({ value: s.categoryCode, label: s.category })
  }
  const activeCategory = categoryCode || categories[0]?.value || ""

  const subCategories: Array<{ value: string; label: string }> = []
  const seenSub = new Set<string>()
  for (const s of series) {
    if (s.categoryCode !== activeCategory || seenSub.has(s.subCategoryCode)) continue
    seenSub.add(s.subCategoryCode)
    subCategories.push({ value: s.subCategoryCode, label: s.subCategory })
  }
  const activeSub = subCategories.some((s) => s.value === subCode) ? subCode : subCategories[0]?.value || ""

  const activeCategoryLabel = categories.find((c) => c.value === activeCategory)?.label ?? ""
  const activeSubLabel = subCategories.find((s) => s.value === activeSub)?.label ?? ""
  const context = [activeCategoryLabel, activeSubLabel].filter(Boolean).join(", ")
  const quarterly = series.find((s) => s.categoryCode === activeCategory && s.subCategoryCode === activeSub && s.period === "Quarterly")
  const annual = series.find((s) => s.categoryCode === activeCategory && s.subCategoryCode === activeSub && s.period === "Annual")
  const latestQ = quarterly?.points.at(-1) ?? null
  const latestA = annual?.points.at(-1) ?? null

  return (
    <div>
      {state.error && (
        <div className="mb-4 flex items-center justify-between gap-3 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>{state.error}</span>
          <button type="button" onClick={() => setAttempt((a) => a + 1)} className="shrink-0 font-semibold underline underline-offset-2">
            Retry
          </button>
        </div>
      )}

      {/* One panel holds the tabs and both charts, so the whole thing reads as
          a single instrument rather than stacked boxes. */}
      <InView className="overflow-hidden border border-[#e5e8ec] bg-white">
        {/* Category tabs — gold underline, like the header's active link */}
        <div className="border-b border-[#e5e8ec] bg-[#fafbfc] px-5 sm:px-6">
          <div className="-mb-px flex flex-wrap items-center gap-1">
            {loading ? (
              <>
                <div className="my-2 h-10 w-40 bg-[#eef1f5] animate-pulse" />
                <div className="my-2 h-10 w-40 bg-[#eef1f5] animate-pulse" />
              </>
            ) : (
              categories.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    setCategoryCode(c.value)
                    setSubCode("")
                  }}
                  aria-current={c.value === activeCategory ? "true" : undefined}
                  className={`h-12 border-b-2 px-3 text-[15px] font-semibold transition-colors sm:px-4 ${
                    c.value === activeCategory ? "border-[#d6b357] text-[#001f3f]" : "border-transparent text-[#6b7280] hover:text-[#0d1117]"
                  }`}
                >
                  {/* "Residential" / "Commercial" on a phone, so both tabs share one row. */}
                  <span className="sm:hidden">{c.label.replace(/\s+Properties$/i, "")}</span>
                  <span className="hidden sm:inline">{c.label}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Sub-index switch — the same black segmented control as /projects' List / Map */}
        {(loading || subCategories.length > 1) && (
          <div className="px-5 pt-5 sm:px-6">
            {loading ? (
              <div className="h-9 w-64 bg-[#eef1f5] animate-pulse" />
            ) : (
              <div role="group" aria-label="Index" className="inline-flex flex-wrap border border-[#e5e8ec] bg-white p-0.5">
                {subCategories.map((sc) => {
                  const on = sc.value === activeSub
                  return (
                    <button key={sc.value} type="button" onClick={() => setSubCode(sc.value)} aria-pressed={on} className={`pl-view ${on ? "pl-view--on" : ""}`}>
                      {sc.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Charts — one shared surface, a hairline divider between them on wide screens. */}
        <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] xl:divide-x xl:divide-[#eef0f3]">
          <div className="p-5 sm:p-6">
            <ChartHead period="Quarterly" context={context} point={latestQ} />
            {loading ? (
              <Skeleton />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={narrow ? 260 : 340}>
                  <ComposedChart data={quarterly?.points ?? []} margin={{ top: 8, right: -4, bottom: 40, left: -16 }} barCategoryGap="20%">
                    <CartesianGrid vertical={false} stroke={C.grid} />
                    <XAxis
                      dataKey="x"
                      tickFormatter={xLabel}
                      tick={{ fontSize: 11, fill: C.tick }}
                      tickLine={false}
                      axisLine={{ stroke: C.axis }}
                      // All 24 quarters fit on a wide screen; a phone can only
                      // read every 4th one before the labels overlap.
                      interval={narrow ? 3 : 0}
                      angle={-40}
                      textAnchor="end"
                      height={54}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11, fill: C.tick }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11, fill: C.tick }}
                      tickLine={false}
                      axisLine={false}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={TOOLTIP_LABEL}
                      labelFormatter={(x) => xLabel(String(x))}
                      formatter={(v, name) =>
                        name === "actual" ? [dec.format(Number(v)), "Actual"] : [pctLabel(Number(v)), name === "qoq" ? "Quarterly Change" : "Annual Change"]
                      }
                    />
                    {!qHidden.has("qoq") && <Bar yAxisId="left" dataKey="qoq" name="qoq" fill={C.qoq} maxBarSize={10} />}
                    {!qHidden.has("yoy") && <Bar yAxisId="left" dataKey="yoy" name="yoy" fill={C.yoy} maxBarSize={10} />}
                    {!qHidden.has("actual") && (
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="actual"
                        name="actual"
                        stroke={C.actual}
                        strokeWidth={2.5}
                        dot={{ r: 3.5, fill: C.actual, strokeWidth: 0 }}
                        activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <LegendKey color={C.qoq} label="Quarterly Change" active={!qHidden.has("qoq")} onToggle={() => toggle(setQHidden, "qoq")} />
                  <LegendKey color={C.yoy} label="Annual Change" active={!qHidden.has("yoy")} onToggle={() => toggle(setQHidden, "yoy")} />
                  <LegendKey color={C.actual} label="Actual" line active={!qHidden.has("actual")} onToggle={() => toggle(setQHidden, "actual")} />
                </div>
              </>
            )}
          </div>

          <div className="min-w-0 border-t border-[#eef0f3] p-5 sm:p-6 xl:border-t-0">
            <ChartHead period="Annual" context={context} point={latestA} />
            {loading ? (
              <Skeleton />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={narrow ? 260 : 340}>
                  <ComposedChart data={annual?.points ?? []} margin={{ top: 8, right: -4, bottom: 24, left: -16 }} barCategoryGap="35%">
                    <CartesianGrid vertical={false} stroke={C.grid} />
                    <XAxis dataKey="x" tick={{ fontSize: 11, fill: C.tick }} tickLine={false} axisLine={{ stroke: C.axis }} />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11, fill: C.tick }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11, fill: C.tick }}
                      tickLine={false}
                      axisLine={false}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={TOOLTIP_LABEL}
                      formatter={(v, name) => (name === "actual" ? [dec.format(Number(v)), "Actual"] : [pctLabel(Number(v)), "Annual Change"])}
                    />
                    {!aHidden.has("yoy") && <Bar yAxisId="left" dataKey="yoy" name="yoy" fill={C.yoy} maxBarSize={40} />}
                    {!aHidden.has("actual") && (
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="actual"
                        name="actual"
                        stroke={C.actual}
                        strokeWidth={2.5}
                        dot={{ r: 4.5, fill: C.actual, strokeWidth: 0 }}
                        activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <LegendKey color={C.yoy} label="Annual Change" active={!aHidden.has("yoy")} onToggle={() => toggle(setAHidden, "yoy")} />
                  <LegendKey color={C.actual} label="Actual" line active={!aHidden.has("actual")} onToggle={() => toggle(setAHidden, "actual")} />
                </div>
              </>
            )}
          </div>
        </div>
      </InView>
    </div>
  )
}
