import type { Metadata } from "next"
import { Info } from "lucide-react"
import { createPageMetadata } from "@/lib/seo"
import { breadcrumbList } from "@/lib/structured-data"
import { JsonLd } from "@/components/json-ld"
import { PriceIndexChart } from "@/components/public/price-index-chart"
import { fetchPriceIndex } from "@/lib/dld-price-index"
import { latestQuarterLabel, latestReadings, periodLabel, signedPct } from "@/lib/dld-price-index-format"

const indexFormat = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 2 })
const changeColour = (v: number | null) => (v === null ? "" : v >= 0 ? "text-[#0f7a4f]" : "text-[#b3261e]")

// The index is read from the shared six-hour cache (lib/dld-price-index.ts) at render time, so
// the chart arrives drawn instead of as a skeleton that is swapped out (a visible jump). Refreshed
// every 30 minutes, like the public API route's Cache-Control.
export const revalidate = 1800

export const metadata: Metadata = createPageMetadata({
  title: "Dubai Property Price Index — Open Data",
  description:
    "The Dubai Land Department's official Property Price Index — residential and commercial, quarterly and annual — free and updated from DLD's open data.",
  pathname: "/open-data",
  keywords: [
    "Dubai property price index",
    "DLD open data",
    "Dubai Land Department price index",
    "Dubai real estate index",
  ],
})

// Static facts about the dataset itself — safe to render on the server; the
// live figures (latest reading, YoY, …) are computed client-side once the
// chart has data and shown as a badge on each chart card instead.
const FACTS = [
  { label: "Source", value: "Dubai Land Dept." },
  { label: "Categories", value: "Residential · Commercial" },
  { label: "Frequency", value: "Quarterly & Annual" },
]

export default async function OpenDataPage() {
  // A failed read throws: this is an ISR page, so a null here would cache a copy without the
  // figures table for half an hour. ISR keeps serving the last good page instead (the chart's own
  // client-side fallback and Retry stay for a browser that loses its connection).
  //
  // Except while `next build` prerenders it: there is no last good page to keep, and the DLD gateway
  // is an external government service — one blip would abort the whole deploy. The build ships the
  // page without the table (the chart loads client-side) and the first revalidation fills it in.
  const buildTime = process.env.NEXT_PHASE === "phase-production-build"
  const result = await fetchPriceIndex(false).catch((error) => {
    if (buildTime) return null
    throw error
  })
  if (!result?.ok && !buildTime) throw new Error("Failed to load the DLD price index")
  const initialSeries = result?.ok ? result.data.series : null
  const readings = initialSeries ? latestReadings(initialSeries) : []
  const asOf = initialSeries ? latestQuarterLabel(initialSeries) : null
  const facts = asOf ? [...FACTS, { label: "Latest quarter", value: asOf }] : FACTS
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <JsonLd schema={[breadcrumbList([{ name: "Home", path: "/" }, { name: "Open Data" }])]} />

      {/* Masthead — same eyebrow + quick-facts pattern as the mortgage calculator,
          so the site's other free tools read as one family. */}
      <section className="bg-white border-b border-[#e8eaed]">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="flex items-center gap-3 mb-3">
            <span className="h-px w-10 bg-[#d6b357]" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#b8913f]">FHI Global · Open Data</span>
          </div>
          <h1 className="font-['Outfit'] text-3xl md:text-[42px] font-bold tracking-tight text-[#001f3f] leading-[1.08]">
            Dubai Property Price Index
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[#6b7280] max-w-2xl">
            Sourced directly from the Dubai Land Department&rsquo;s open data — residential and commercial property, split
            into sub-indexes, quarterly or annual.
          </p>

          <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 sm:flex sm:flex-wrap sm:gap-x-0 sm:gap-y-4">
            {facts.map((f) => (
              <div key={f.label} className="sm:pr-8 sm:mr-8 sm:border-r sm:border-[#e8eaed] sm:last:mr-0 sm:last:border-0 sm:last:pr-0">
                <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8913f] mb-1.5">{f.label}</dt>
                {/* Wraps on phones: "Residential · Commercial" is wider than half a phone screen. */}
                <dd className="font-['Outfit'] text-lg font-bold text-[#001f3f] leading-tight sm:leading-none sm:whitespace-nowrap">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* The charts' own headings are H3, so give them an H2 to sit under. */}
        <h2 className="sr-only">Price index charts</h2>
        <PriceIndexChart initialSeries={initialSeries} />

        {/* The same data as text and a table, in the page itself: what the charts show only as pixels. */}
        {readings.length > 0 && (
          <section aria-labelledby="latest-readings" className="mt-10">
            <h2 id="latest-readings" className="font-['Outfit'] text-xl font-bold text-[#001f3f]">Latest readings</h2>
            <p className="mt-1.5 text-sm text-[#6b7280]">
              The latest published value for each sub-index, from the same DLD data as the charts above.
            </p>
            {readings.map((group) => (
              <div key={group.category} className="mt-6 overflow-x-auto border border-[#e5e8ec] bg-white">
                <table className="w-full min-w-[560px] text-left text-sm tabular-nums">
                  <caption className="border-b border-[#e5e8ec] bg-[#f7f8fa] px-4 py-3 text-left font-['Outfit'] text-[15px] font-bold text-[#001f3f]">
                    {group.category} — latest quarter and year
                  </caption>
                  <thead>
                    <tr className="border-b border-[#e5e8ec] text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7280]">
                      <th scope="col" className="px-4 py-2.5">Sub-index</th>
                      <th scope="col" className="px-4 py-2.5">Quarter</th>
                      <th scope="col" className="px-4 py-2.5">Index</th>
                      <th scope="col" className="px-4 py-2.5">QoQ</th>
                      <th scope="col" className="px-4 py-2.5">YoY</th>
                      <th scope="col" className="px-4 py-2.5">Annual change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.subCategory} className="border-b border-[#eef0f3] last:border-b-0">
                        <th scope="row" className="px-4 py-3 font-semibold text-[#0d1117]">{row.subCategory}</th>
                        <td className="px-4 py-3 text-[#374151]">{row.quarter ? periodLabel(row.quarter.x) : "—"}</td>
                        <td className="px-4 py-3 text-[#374151]">{row.quarter?.actual != null ? indexFormat.format(row.quarter.actual) : "—"}</td>
                        <td className={`px-4 py-3 font-semibold ${changeColour(row.quarter?.qoq ?? null)}`}>{signedPct(row.quarter?.qoq ?? null)}</td>
                        <td className={`px-4 py-3 font-semibold ${changeColour(row.quarter?.yoy ?? null)}`}>{signedPct(row.quarter?.yoy ?? null)}</td>
                        <td className={`px-4 py-3 ${changeColour(row.annual?.yoy ?? null)}`}>
                          {row.annual ? `${periodLabel(row.annual.x)}: ${signedPct(row.annual.yoy)}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </section>
        )}

        <p className="mt-5 flex items-start gap-2 text-xs text-[#9ca3af]">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Source: Dubai Land Department open data (gateway.dubailand.gov.ae).{asOf ? ` Latest published quarter: ${asOf}.` : ""} Figures
          are as published by DLD and may lag by a day.
        </p>
      </section>
    </div>
  )
}
