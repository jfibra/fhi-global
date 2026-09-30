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
import type { DldPriceIndexResponse, DldPriceIndexSeries } from "@/lib/dld-open-data"

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
 * the usual one-axis-per-chart rule here; everything else (palette, card
 * chrome, tabs) follows FHI's own brand.
 */

// Validated categorical slots (dataviz reference palette): blue, aqua, amber.
// Passes CVD/contrast checks as a trio; the on-chart legend's text labels
// satisfy the "visible labels" relief the surface-contrast WARN calls for.
const C = {
  qoq: "#2a78d6",
  yoy: "#1baf7a",
  actualQuarterly: "#eda100",
  actualAnnual: "#2a78d6",
  navy: "#001f3f",
  gold: "#d6b357",
  grid: "#eef0f2",
  axis: "#e5e7eb",
  tick: "#8b92a0",
} as const
const TOOLTIP_STYLE = { borderRadius: 12, border: "1px solid #e8eaed", fontSize: 12, boxShadow: "0 8px 24px -12px rgba(0,20,40,.25)" }
// Actual (the index level) keeps up to 2 decimals rather than rounding —
// 110.64 stays 110.64, not 111. Percent change already caps at 1 (pctLabel).
const dec = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 2 })
const pctLabel = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`
const xLabel = (x: string) => x.replace(/^(\d{4})\.(\d)$/, "Q$2 $1")

function Skeleton({ h = 340 }: { h?: number }) {
  return <div className="rounded-xl bg-[#f0f2f5] animate-pulse" style={{ height: h }} />
}

/**
 * A clickable legend chip — Chart.js-style series toggle. Active: solid dot,
 * full-opacity label. Off: hollow dot, struck-through muted label. The chart
 * itself must skip rendering the Bar/Line for a hidden key entirely (not
 * just visually hide it), so Recharts recomputes each axis from only the
 * series still on screen, the same rescale Chart.js does on legend click.
 */
function LegendChip({ color, label, active, onToggle }: { color: string; label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      title={active ? `Hide ${label}` : `Show ${label}`}
      className={`inline-flex items-center gap-1.5 rounded-full pl-1.5 pr-3 py-1 transition-colors ${
        active ? "bg-[#f8fafc] hover:bg-[#eef1f5]" : "bg-transparent hover:bg-[#f8fafc]"
      }`}
    >
      <span
        className="h-2.5 w-2.5 rounded-full shrink-0 transition-colors"
        style={active ? { background: color } : { background: "transparent", border: `1.5px solid ${color}`, opacity: 0.5 }}
      />
      <span className={`text-[12.5px] font-medium transition-colors ${active ? "text-[#374151]" : "text-[#9ca3af] line-through decoration-1"}`}>
        {label}
      </span>
    </button>
  )
}

/** Small "as of" reading in the card header, computed from the latest point. */
function LatestBadge({ x, actual, delta, deltaLabel }: { x: string; actual: number | null; delta: number | null; deltaLabel: string }) {
  if (actual === null) return null
  return (
    <div className="hidden sm:flex items-center gap-2 rounded-lg bg-[#f8fafc] px-3 py-1.5 text-xs">
      <span className="text-[#6b7280]">{xLabel(x)}</span>
      <span className="h-3 w-px bg-[#e5e7eb]" aria-hidden="true" />
      <span className="font-semibold text-[#001f3f] tabular-nums">{dec.format(actual)}</span>
      {delta !== null && (
        <span className={`font-semibold tabular-nums ${delta >= 0 ? "text-[#0f7a4f]" : "text-[#b3261e]"}`}>
          {pctLabel(delta)} <span className="font-normal text-[#9ca3af]">{deltaLabel}</span>
        </span>
      )}
    </div>
  )
}

export function PriceIndexChart() {
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
  const quarterly = series.find((s) => s.categoryCode === activeCategory && s.subCategoryCode === activeSub && s.period === "Quarterly")
  const annual = series.find((s) => s.categoryCode === activeCategory && s.subCategoryCode === activeSub && s.period === "Annual")
  const latestQ = quarterly?.points.at(-1) ?? null
  const latestA = annual?.points.at(-1) ?? null

  return (
    <div>
      {state.error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>{state.error}</span>
          <button type="button" onClick={() => setAttempt((a) => a + 1)} className="shrink-0 font-semibold underline underline-offset-2">
            Retry
          </button>
        </div>
      )}

      {/* One panel holds the tabs and both charts, so the whole thing reads as
          a single instrument rather than three stacked boxes. */}
      <div className="bg-white rounded-2xl border border-[#e8eaed] shadow-sm overflow-hidden">
        {/* Header strip: category tabs + sub-index pills */}
        <div className="bg-[#fafbfc] border-b border-[#e8eaed] px-5 pt-4">
          <div className="flex flex-wrap items-center gap-1 -mb-px">
            {loading ? (
              <>
                <div className="h-10 w-40 rounded-md bg-[#eef1f5] animate-pulse mb-2" />
                <div className="h-10 w-40 rounded-md bg-[#eef1f5] animate-pulse mb-2" />
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
                  className={`h-11 px-4 border-b-2 text-[15px] font-semibold transition-colors ${
                    c.value === activeCategory ? "border-[#d6b357] text-[#001f3f]" : "border-transparent text-[#6b7280] hover:text-[#374151]"
                  }`}
                >
                  {c.label}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="px-5 pt-4">
          {loading ? (
            <div className="h-11 w-64 rounded-xl bg-[#eef1f5] animate-pulse mb-2" />
          ) : (
            subCategories.length > 1 && (
              <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-[#eef1f5] border border-[#e8eaed]">
                {subCategories.map((sc) => (
                  <button
                    key={sc.value}
                    type="button"
                    onClick={() => setSubCode(sc.value)}
                    aria-current={sc.value === activeSub ? "true" : undefined}
                    className={`h-9 px-4 rounded-lg text-sm font-semibold transition-colors ${
                      sc.value === activeSub ? "bg-white text-[#001f3f] shadow-sm" : "text-[#6b7280] hover:text-[#374151]"
                    }`}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>
            )
          )}
        </div>

        {/* Charts — one shared surface, a hairline divider between them on wide screens. */}
        <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] xl:divide-x xl:divide-[#f0f2f5]">
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="font-['Outfit'] text-base font-semibold text-[#0d1117]">
                {activeCategoryLabel}
                {activeSubLabel && activeSubLabel !== "General Index" && <span className="text-[#9ca3af] font-normal"> · {activeSubLabel}</span>}
                <span className="text-[#9ca3af] font-normal"> — Quarterly</span>
              </h3>
              {latestQ && <LatestBadge x={latestQ.x} actual={latestQ.actual} delta={latestQ.yoy} deltaLabel="Annual Change" />}
            </div>
            {loading ? (
              <Skeleton />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart data={quarterly?.points ?? []} margin={{ top: 8, right: -4, bottom: 40, left: -16 }} barCategoryGap="20%">
                    <CartesianGrid vertical={false} stroke={C.grid} />
                    <XAxis
                      dataKey="x"
                      tickFormatter={xLabel}
                      tick={{ fontSize: 11, fill: C.tick }}
                      tickLine={false}
                      axisLine={{ stroke: C.axis }}
                      interval={0}
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
                      labelFormatter={(x) => xLabel(String(x))}
                      formatter={(v, name) =>
                        name === "actual" ? [dec.format(Number(v)), "Actual"] : [pctLabel(Number(v)), name === "qoq" ? "Quarterly Change" : "Annual Change"]
                      }
                    />
                    {!qHidden.has("qoq") && <Bar yAxisId="left" dataKey="qoq" name="qoq" fill={C.qoq} radius={[3, 3, 0, 0]} maxBarSize={10} />}
                    {!qHidden.has("yoy") && <Bar yAxisId="left" dataKey="yoy" name="yoy" fill={C.yoy} radius={[3, 3, 0, 0]} maxBarSize={10} />}
                    {!qHidden.has("actual") && (
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="actual"
                        name="actual"
                        stroke={C.actualQuarterly}
                        strokeWidth={2}
                        dot={{ r: 4, fill: C.actualQuarterly, strokeWidth: 0 }}
                        activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-2 mt-3">
                  <LegendChip color={C.qoq} label="Quarterly Change" active={!qHidden.has("qoq")} onToggle={() => toggle(setQHidden, "qoq")} />
                  <LegendChip color={C.yoy} label="Annual Change" active={!qHidden.has("yoy")} onToggle={() => toggle(setQHidden, "yoy")} />
                  <LegendChip color={C.actualQuarterly} label="Actual" active={!qHidden.has("actual")} onToggle={() => toggle(setQHidden, "actual")} />
                </div>
              </>
            )}
          </div>

          <div className="p-5 sm:p-6 border-t xl:border-t-0 border-[#f0f2f5]">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="font-['Outfit'] text-base font-semibold text-[#0d1117]">
                <span className="text-[#9ca3af] font-normal">Annual</span>
              </h3>
              {latestA && <LatestBadge x={latestA.x} actual={latestA.actual} delta={latestA.yoy} deltaLabel="Annual Change" />}
            </div>
            {loading ? (
              <Skeleton />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={340}>
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
                      formatter={(v, name) => (name === "actual" ? [dec.format(Number(v)), "Actual"] : [pctLabel(Number(v)), "Annual Change"])}
                    />
                    {!aHidden.has("yoy") && <Bar yAxisId="left" dataKey="yoy" name="yoy" fill={C.yoy} radius={[4, 4, 0, 0]} maxBarSize={40} />}
                    {!aHidden.has("actual") && (
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="actual"
                        name="actual"
                        stroke={C.actualAnnual}
                        strokeWidth={2}
                        dot={{ r: 5, fill: C.actualAnnual, strokeWidth: 0 }}
                        activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-2 mt-3">
                  <LegendChip color={C.yoy} label="Annual Change" active={!aHidden.has("yoy")} onToggle={() => toggle(setAHidden, "yoy")} />
                  <LegendChip color={C.actualAnnual} label="Actual" active={!aHidden.has("actual")} onToggle={() => toggle(setAHidden, "actual")} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
