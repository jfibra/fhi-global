import type { Metadata } from "next"
import { Info } from "lucide-react"
import { createPageMetadata } from "@/lib/seo"
import { breadcrumbList } from "@/lib/structured-data"
import { JsonLd } from "@/components/json-ld"
import { PriceIndexChart } from "@/components/public/price-index-chart"

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

export default function OpenDataPage() {
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
            {FACTS.map((f) => (
              <div key={f.label} className="sm:pr-8 sm:mr-8 sm:border-r sm:border-[#e8eaed] sm:last:mr-0 sm:last:border-0 sm:last:pr-0">
                <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8913f] mb-1.5">{f.label}</dt>
                <dd className="font-['Outfit'] text-lg font-bold text-[#001f3f] leading-none whitespace-nowrap">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <PriceIndexChart />
        <p className="mt-5 flex items-start gap-2 text-xs text-[#9ca3af]">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Source: Dubai Land Department open data (gateway.dubailand.gov.ae). Figures are as published by DLD and may lag by
          a day.
        </p>
      </section>
    </div>
  )
}
