import { Fragment } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, ArrowUpRight, FileText, MessageCircle } from "lucide-react"
import { absoluteUrl, createPageMetadata } from "@/lib/seo"
import { breadcrumbList, orgRef, webPageSchema } from "@/lib/structured-data"
import { companyWhatsappHref } from "@/lib/company"
import { JsonLd } from "@/components/json-ld"
import { InView } from "@/components/public/in-view"
import { CountUp } from "@/components/public/count-up"
import { MagneticLink } from "@/components/public/magnetic-link"

/**
 * The Dubai Land Department's "Dubai Real Estate Annual Report 2024" (81 pages,
 * published by DLD), read for buyers — boss via Juliecor, 2026-10-11.
 *
 * Every figure on this page is copied from that report (page numbers in the
 * comments below are the report's own); nothing is computed except the sq m →
 * sq ft conversions, which are labelled as such. Expert sections are credited
 * to the firm the report credits (Knight Frank, JLL, New World Wealth). The
 * full report is linked on DLD's site, not re-hosted.
 */

const PATH = "/dubai-real-estate-report-2024"
const DLD_REPORT_PAGE = "https://dubailand.gov.ae/en/open-data/research/annual-report-real-estate-sector-performance-2024/"
const DLD_REPORT_PDF = "https://dubailand.gov.ae/media/o0tfgxat/annual_report_2024_english.pdf"
const PUBLISHED = "2026-10-11"
const TITLE = "Dubai Real Estate Report 2024 — Key Findings from the Dubai Land Department"
const DESCRIPTION =
  "AED 761 billion in transactions, 226,000 deals and a record 108,000 first-time investors: the key findings of the Dubai Land Department's 2024 annual report — prices, off-plan, who is buying, profits, luxury and rents."

export const metadata: Metadata = createPageMetadata({
  title: "Dubai Real Estate Report 2024 — DLD Key Findings",
  description: DESCRIPTION,
  pathname: PATH,
  keywords: [
    "Dubai real estate report 2024",
    "Dubai Land Department annual report",
    "Dubai property market 2024",
    "Dubai real estate transactions 2024",
    "Dubai off-plan market 2024",
    "Dubai property prices 2024",
  ],
})

const SQM_PER_SQFT = 10.7639
const perSqft = (aedPerSqm: number) => Math.round(aedPerSqm / SQM_PER_SQFT).toLocaleString("en-US")

// p. 9 — market facts & figures
const HEADLINE = [
  { value: 761, prefix: "AED ", suffix: "bn", label: "Value of transactions", change: "+20% vs 2023" },
  { value: 226, suffix: "K", label: "Transactions", change: "+36% vs 2023" },
  { value: 158038, label: "Investors", change: "+41% vs 2023" },
  { value: 108451, label: "First-time investors", change: "a record, +38%" },
]

// p. 14 — value by property type, AED bn
const BY_TYPE = [
  { label: "Apartments & units", v2024: 318.18, v2023: 231.88, change: "+37.2%" },
  { label: "Land", v2024: 234.56, v2023: 253.09, change: "−7.3%" },
  { label: "Villas", v2024: 126.32, v2023: 93.76, change: "+34.7%" },
  { label: "Whole buildings", v2024: 81.94, v2023: 53.4, change: "+53.5%" },
]
// p. 16 — value by category, AED bn
const BY_CATEGORY = [
  { label: "Ready (existing)", v2024: 295.82, change: "+35.4%" },
  { label: "Vacant land", v2024: 234.56, change: "−7.3%" },
  { label: "Off-plan", v2024: 230.61, change: "+43.7%" },
]

// p. 18–19 — average price per sq m, selected years the report cites
const UNIT_PRICES = [
  { year: 2007, v: 6928 },
  { year: 2010, v: 11775 },
  { year: 2014, v: 14182 },
  { year: 2021, v: 14719 },
  { year: 2024, v: 19488 },
]
const VILLA_PRICES = [
  { year: 2007, v: 3598 },
  { year: 2010, v: 5500 },
  { year: 2016, v: 9134 },
  { year: 2020, v: 7575 },
  { year: 2024, v: 14605 },
]

// p. 44–45 — investment value by continent, AED bn (total AED 521.6 bn)
const BY_CONTINENT = [
  { label: "Asia", v: 301.88, share: "58%" },
  { label: "Europe", v: 133.05, share: "25.5%" },
  { label: "North America", v: 41.02, share: "7.9%" },
  { label: "Africa", v: 34.57, share: "6.6%" },
  { label: "Oceania", v: 8.17, share: "1.6%" },
  { label: "South & Central America", v: 2.91, share: "0.5%" },
]

// p. 27–29 — extra investment vs 2023 (DLD's official community names)
const HOT_COMMUNITIES = [
  { name: "Madinat Al Mataar", value: 11.74, investors: 4726, note: "The airport district — top for both new money and new buyers" },
  { name: "Bukadra", value: 10.71, investors: 4354, note: "Steady resales plus new launches" },
  { name: "Wadi Al Safa 5", value: 10.6, investors: 4423, note: "Rising suburb with a surge of retail buyers" },
  { name: "Dubai Investment Park Second", value: 9.31, investors: 1718, note: "Institutional, large-ticket buying" },
  { name: "Wadi Al Safa 7", value: 8.69, investors: 1834, note: "Extends the Wadi Al Safa momentum" },
]

// p. 64 — US$10M+ home sales in 2024 (Knight Frank, REIDIN)
const TEN_MILLION = [
  { city: "Dubai", n: 435 },
  { city: "New York", n: 269 },
  { city: "London", n: 224 },
  { city: "Hong Kong", n: 223 },
  { city: "Los Angeles", n: 214 },
]

// p. 65 — prime space US$1 million buys (Knight Frank)
const MILLION_BUYS = [
  { city: "Dubai", sqft: 839 },
  { city: "London", sqft: 366 },
  { city: "New York", sqft: 366 },
  { city: "Monaco", sqft: 204 },
]

const COMPANY_WHATSAPP = companyWhatsappHref()

function Words({ text, start = 0, gold = false }: { text: string; start?: number; gold?: boolean }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <Fragment key={`${w}-${i}`}>
          <span className="wf-word">
            <span style={{ ["--i" as string]: start + i }} className={gold ? "wf-gold" : undefined}>{w}</span>
          </span>{" "}
        </Fragment>
      ))}
    </>
  )
}

function Eyebrow({ n, children, dark = false }: { n: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <p className={`inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.26em] ${dark ? "text-[#f0d89b]" : "text-[#b8913f]"}`}>
      <span className="wf-rule h-px w-10 bg-[#d6b357]" aria-hidden="true" />
      <span className="wf-fade" style={{ ["--d" as string]: "150ms" }}>
        {n} · {children}
      </span>
    </p>
  )
}

/** A horizontal bar that grows in when its section scrolls into view. */
function Bar({ label, value, max, display, change, i, tone = "navy", neutral = false }: { label: string; value: number; max: number; display: string; change?: string; i: number; tone?: "navy" | "gold" | "muted"; neutral?: boolean }) {
  const fill = tone === "gold" ? "bg-[#d6b357]" : tone === "muted" ? "bg-[#c5ccd6]" : "bg-[#001f3f]"
  const negative = change?.startsWith("−")
  return (
    <div className="wf-fade" style={{ ["--d" as string]: `${200 + i * 90}ms` }}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14px] font-semibold text-[#0d1117]">{label}</span>
        <span className="shrink-0 text-right">
          <span className="font-['Outfit'] text-[17px] font-bold tabular-nums text-[#0d1117]">{display}</span>
          {change && <span className={`ml-2 text-[12px] font-bold tabular-nums ${neutral ? "text-[#6b7280]" : negative ? "text-[#b3261e]" : "text-[#0f7a4f]"}`}>{change}</span>}
        </span>
      </div>
      <div className="mt-2 h-2.5 w-full bg-[#eef0f3]">
        <div className={`wf-line h-full ${fill}`} style={{ width: `${Math.max(1.5, (100 * value) / max)}%`, ["--g" as string]: `${250 + i * 110}ms` }} />
      </div>
    </div>
  )
}

/** Units vs villas, AED per sq m — only the years the report quotes, joined. */
function PriceChart() {
  const W = 640
  const H = 300
  const pad = { l: 56, r: 24, t: 20, b: 34 }
  const x = (year: number) => pad.l + ((year - 2007) / (2024 - 2007)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - v / 20000) * (H - pad.t - pad.b)
  const line = (pts: { year: number; v: number }[]) => pts.map((p) => `${x(p.year)},${y(p.v)}`).join(" ")
  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Average price per square metre in Dubai: apartments rose from AED 6,928 in 2007 to AED 19,488 in 2024; villas from AED 3,598 to AED 14,605.">
        {[0, 5000, 10000, 15000, 20000].map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} stroke="#e5e8ec" strokeWidth="1" />
            <text x={pad.l - 10} y={y(g) + 4} textAnchor="end" fontSize="11" fill="#9ca3af">{g === 0 ? "0" : `${g / 1000}K`}</text>
          </g>
        ))}
        {[2007, 2010, 2014, 2016, 2020, 2024].map((yr) => (
          <text key={yr} x={x(yr)} y={H - 10} textAnchor="middle" fontSize="11" fill="#9ca3af">{yr}</text>
        ))}
        <polyline points={line(UNIT_PRICES)} fill="none" stroke="#001f3f" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" className="rp-draw" pathLength={1} />
        <polyline points={line(VILLA_PRICES)} fill="none" stroke="#a8842f" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" className="rp-draw rp-draw--late" pathLength={1} />
        {UNIT_PRICES.map((p) => <circle key={`u${p.year}`} cx={x(p.year)} cy={y(p.v)} r="4" fill="#fff" stroke="#001f3f" strokeWidth="2.5" />)}
        {VILLA_PRICES.map((p) => <circle key={`v${p.year}`} cx={x(p.year)} cy={y(p.v)} r="4" fill="#fff" stroke="#a8842f" strokeWidth="2.5" />)}
        <text x={x(2024) - 6} y={y(19488) - 12} textAnchor="end" fontSize="12" fontWeight="700" fill="#001f3f">19,488</text>
        <text x={x(2024) - 12} y={y(14605) + 4} textAnchor="end" fontSize="12" fontWeight="700" fill="#a8842f">14,605</text>
      </svg>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-[#6b7280]">
        <span className="inline-flex items-center gap-2"><span className="h-[3px] w-5 bg-[#001f3f]" aria-hidden="true" />Apartments &amp; units</span>
        <span className="inline-flex items-center gap-2"><span className="h-[3px] w-5 bg-[#a8842f]" aria-hidden="true" />Villas</span>
        <span>AED per sq m · the years the report quotes, joined</span>
      </figcaption>
    </figure>
  )
}

function Stat({ big, label, sub }: { big: string; label: string; sub?: string }) {
  return (
    <div className="border-t border-[#e5e8ec] pt-4">
      <p className="font-['Outfit'] text-[30px] font-bold leading-none tracking-tight text-[#001f3f] sm:text-[36px]">{big}</p>
      <p className="mt-2 text-[13px] font-semibold text-[#0d1117]">{label}</p>
      {sub && <p className="mt-0.5 text-[12px] leading-snug text-[#6b7280]">{sub}</p>}
    </div>
  )
}

export default function DubaiRealEstateReport2024Page() {
  const typeMax = Math.max(...BY_TYPE.map((r) => r.v2024))
  const catMax = Math.max(...BY_CATEGORY.map((r) => r.v2024))
  const contMax = BY_CONTINENT[0].v
  const commMax = HOT_COMMUNITIES[0].value
  const tenMax = TEN_MILLION[0].n
  const millionMax = MILLION_BUYS[0].sqft

  return (
    <div className="rp wf relative overflow-x-clip bg-[#fafafa]">
      <style>{`
        .rp .rp-draw { stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke-dashoffset 1800ms cubic-bezier(0.16, 1, 0.3, 1) 300ms; }
        .rp .rp-draw--late { transition-delay: 650ms; }
        .rp [data-in="true"] .rp-draw { stroke-dashoffset: 0; }
        @media (prefers-reduced-motion: reduce) { .rp .rp-draw { stroke-dashoffset: 0; transition: none; } }
      `}</style>
      <noscript>
        <style>{`.rp [class*="wf-"], .rp .wf-word > span { opacity: 1 !important; transform: none !important; filter: none !important; clip-path: none !important; } .rp .rp-draw { stroke-dashoffset: 0 !important; }`}</style>
      </noscript>
      <JsonLd
        schema={[
          breadcrumbList([{ name: "Home", path: "/" }, { name: "Dubai Real Estate Report 2024" }]),
          webPageSchema({ path: PATH, name: TITLE, description: DESCRIPTION }),
          {
            "@context": "https://schema.org",
            "@type": "Article",
            "@id": `${absoluteUrl(PATH)}#article`,
            headline: TITLE,
            description: DESCRIPTION,
            datePublished: PUBLISHED,
            dateModified: PUBLISHED,
            inLanguage: "en",
            mainEntityOfPage: { "@id": `${absoluteUrl(PATH)}#webpage` },
            author: orgRef(),
            publisher: orgRef(),
            isBasedOn: { "@type": "Report", name: "Dubai Real Estate Annual Report 2024", url: DLD_REPORT_PAGE, publisher: { "@type": "GovernmentOrganization", name: "Dubai Land Department", url: "https://dubailand.gov.ae" } },
          },
        ]}
      />

      {/* ── Masthead ─────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-[#06182e] text-white">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" aria-hidden="true" style={{ backgroundImage: "linear-gradient(#d6b357 1px, transparent 1px), linear-gradient(90deg, #d6b357 1px, transparent 1px)", backgroundSize: "64px 64px" }} />
        <InView className="relative mx-auto max-w-7xl px-4 pb-14 pt-16 sm:px-6 lg:px-8 lg:pb-20 lg:pt-24" threshold={0.1} rootMargin="0px">
          <p className="inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.3em] text-[#f0d89b]">
            <span className="wf-rule h-px w-10 bg-[#d6b357]" aria-hidden="true" />
            <span className="wf-fade" style={{ ["--d" as string]: "200ms" }}><span className="sm:hidden">DLD · Annual Report 2024</span><span className="hidden sm:inline">Dubai Land Department · Annual Report 2024</span></span>
          </p>
          <h1 className="mt-5 max-w-4xl font-['Outfit'] text-[40px] font-bold leading-[1.03] tracking-tight sm:text-[56px] lg:text-[68px]">
            <Words text="Dubai real estate in 2024:" />
            <Words text="the record year." start={5} gold />
          </h1>
          <p className="wf-fade mt-6 max-w-2xl text-[16px] leading-relaxed text-white/80 sm:text-[17px]" style={{ ["--d" as string]: "650ms" }}>
            The Dubai Land Department&rsquo;s 81-page annual report, read for buyers: what sold, what it cost, who bought it, who made money, and what comes next. Every figure below comes from the report.
          </p>
          <dl className="wf-fade mt-10 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-white/15 pt-8 lg:grid-cols-4" style={{ ["--d" as string]: "800ms" }}>
            {HEADLINE.map((h, i) => (
              <div key={h.label}>
                <dd className="font-['Outfit'] text-[32px] font-bold leading-none tracking-tight sm:text-[44px]">
                  {h.prefix && <span className="text-[0.55em] font-semibold text-white/70">{h.prefix}</span>}
                  <CountUp value={h.value} delay={900 + i * 140} duration={1400} />
                  {h.suffix && <span className="text-[0.6em] text-[#d6b357]">{h.suffix}</span>}
                </dd>
                <dt className="mt-3 text-[13px] font-semibold text-white">{h.label}</dt>
                <p className="mt-0.5 text-[12px] font-bold text-[#7fe3a5]">{h.change}</p>
              </div>
            ))}
          </dl>
          <div className="wf-fade mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-[12px] text-white/60" style={{ ["--d" as string]: "950ms" }}>
            <span>Summary by FHI Global · {new Date(`${PUBLISHED}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</span>
            <a href={DLD_REPORT_PAGE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-[#f0d89b] hover:text-white">
              <FileText className="h-3.5 w-3.5" /> Read DLD&rsquo;s full report <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </InView>
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-[#d6b357]" aria-hidden="true" />
      </section>

      {/* ── 01 Where the money went ─────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <InView threshold={0.15}>
          <Eyebrow n="01">Where the money went</Eyebrow>
          <h2 className="mt-4 max-w-3xl font-['Outfit'] text-[32px] font-bold leading-[1.08] tracking-tight text-[#0d1117] sm:text-[42px]">
            <Words text="AED 761 billion," />
            <Words text="and off-plan grew fastest." start={3} gold />
          </h2>
          <p className="wf-fade mt-4 max-w-2xl text-[15.5px] leading-relaxed text-[#4b5563]" style={{ ["--d" as string]: "450ms" }}>
            Apartments are still the backbone of the market — over 41% of all value. Whole-building sales grew fastest of any property type, and off-plan sales grew fastest of any category, as buyers paid for homes still being built on flexible payment plans.
          </p>
          <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="border border-[#e5e8ec] bg-white p-6 sm:p-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9ca3af]">By property type · AED billion</p>
              <div className="mt-6 space-y-5">
                {BY_TYPE.map((r, i) => (
                  <Bar key={r.label} i={i} label={r.label} value={r.v2024} max={typeMax} display={r.v2024.toFixed(1)} change={r.change} tone={r.change.startsWith("−") ? "muted" : "navy"} />
                ))}
              </div>
            </div>
            <div className="border border-[#e5e8ec] bg-white p-6 sm:p-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9ca3af]">Ready vs off-plan vs land · AED billion</p>
              <div className="mt-6 space-y-5">
                {BY_CATEGORY.map((r, i) => (
                  <Bar key={r.label} i={i} label={r.label} value={r.v2024} max={catMax} display={r.v2024.toFixed(1)} change={r.change} tone={r.label === "Off-plan" ? "gold" : r.change.startsWith("−") ? "muted" : "navy"} />
                ))}
              </div>
              <p className="mt-6 border-t border-[#eef0f3] pt-4 text-[13px] leading-relaxed text-[#6b7280]">
                Land dipped 7.3% after the 2021–2023 land-buying wave — the report reads it as developers moving from buying plots to building on them.
              </p>
            </div>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <Stat big="AED 522bn" label="Sales, +27%" sub="Nearly 69% of all transaction value" />
            <Stat big="AED 187bn" label="Mortgages, −1.2%" sub="A plateau: more buyers are paying cash or on developer plans" />
            <Stat big="+59%" label="Property gifted within families" sub="AED 51bn — families passing homes to the next generation" />
          </div>
        </InView>
      </section>

      {/* ── 02 Prices ───────────────────────────────────────────────── */}
      <section className="border-y border-[#e5e8ec] bg-white">
        <InView className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:px-8 lg:py-24" threshold={0.15}>
          <div>
            <Eyebrow n="02">What it cost</Eyebrow>
            <h2 className="mt-4 font-['Outfit'] text-[32px] font-bold leading-[1.08] tracking-tight text-[#0d1117] sm:text-[42px]">
              <Words text="Prices at an" />
              <Words text="all-time high." start={3} gold />
            </h2>
            <p className="wf-fade mt-4 text-[15.5px] leading-relaxed text-[#4b5563]" style={{ ["--d" as string]: "450ms" }}>
              Average prices per square metre reached new records in 2024. Apartments have nearly tripled since 2007; villas have almost doubled since 2020, as families moved to space, privacy and gardens.
            </p>
            <div className="wf-fade mt-8 grid grid-cols-2 gap-6" style={{ ["--d" as string]: "600ms" }}>
              <Stat big="+93%" label="Villa prices, 2020 → 2024" sub={`AED 7,575 → 14,605 per sq m (≈ AED ${perSqft(14605)} per sq ft)`} />
              <Stat big="+32%" label="Apartment prices, 2021 → 2024" sub={`AED 14,719 → 19,488 per sq m (≈ AED ${perSqft(19488)} per sq ft)`} />
            </div>
            <p className="wf-fade mt-6 text-[13px] leading-relaxed text-[#6b7280]" style={{ ["--d" as string]: "700ms" }}>
              In 2007 apartments cost 92% more per sq m than villas; by 2024 the gap had narrowed to 33% — land and privacy now carry the premium. Per sq ft figures are our conversion.
            </p>
          </div>
          <div className="wf-fade border border-[#e5e8ec] p-5 sm:p-7" style={{ ["--d" as string]: "300ms" }}>
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#9ca3af]">Average price per sq m · AED</p>
            <PriceChart />
          </div>
        </InView>
      </section>

      {/* ── 03 Who is buying ────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <InView threshold={0.15}>
          <Eyebrow n="03">Who is buying</Eyebrow>
          <h2 className="mt-4 max-w-3xl font-['Outfit'] text-[32px] font-bold leading-[1.08] tracking-tight text-[#0d1117] sm:text-[42px]">
            <Words text="A record 108,451" />
            <Words text="first-time investors." start={3} gold />
          </h2>
          <p className="wf-fade mt-4 max-w-2xl text-[15.5px] leading-relaxed text-[#4b5563]" style={{ ["--d" as string]: "450ms" }}>
            Nearly seven in ten investors in 2024 were buying in Dubai for the first time, and most of them chose off-plan. Repeat investors put almost AED 260 billion back in — up 31%.
          </p>
          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-16">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-1">
              <Stat big="69,791" label="New investors chose off-plan (+61%)" sub="Investing AED 130.8 billion, +44%" />
              <Stat big="51,737" label="New investors live outside the UAE" sub="Non-resident first-time buyers grew 44.7%" />
              <Stat big="49,587" label="Repeat investors (+48%)" sub="AED 258.3 billion, building portfolios for rental income" />
            </div>
            <div className="border border-[#e5e8ec] bg-white p-6 sm:p-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9ca3af]">Where the money came from · AED billion</p>
              <div className="mt-6 space-y-5">
                {BY_CONTINENT.map((r, i) => (
                  <Bar key={r.label} i={i} label={r.label} value={r.v} max={contMax} display={r.v.toFixed(1)} change={r.share} neutral tone={i === 0 ? "gold" : "navy"} />
                ))}
              </div>
              <p className="mt-6 border-t border-[#eef0f3] pt-4 text-[13px] leading-relaxed text-[#6b7280]">
                Asia alone invested AED 301.9 billion — 58% of the total, led by buyers from India, China, Pakistan and the GCC. Shares are of total investment (AED 521.6 billion).
              </p>
            </div>
          </div>
        </InView>
      </section>

      {/* ── 04 Where they bought ────────────────────────────────────── */}
      <section className="border-y border-[#e5e8ec] bg-white">
        <InView className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24" threshold={0.15}>
          <Eyebrow n="04">Where the new money went</Eyebrow>
          <h2 className="mt-4 max-w-3xl font-['Outfit'] text-[32px] font-bold leading-[1.08] tracking-tight text-[#0d1117] sm:text-[42px]">
            <Words text="The fastest-growing" />
            <Words text="communities." start={2} gold />
          </h2>
          <p className="wf-fade mt-4 max-w-2xl text-[15.5px] leading-relaxed text-[#4b5563]" style={{ ["--d" as string]: "450ms" }}>
            Ranked by how much more was invested in 2024 than in 2023. Airport-side districts led, while mid-market suburbs are catching up fast. Names are DLD&rsquo;s official community names.
          </p>
          <ol className="mt-10 divide-y divide-[#eef0f3] border-y border-[#e5e8ec]">
            {HOT_COMMUNITIES.map((c, i) => (
              <li key={c.name} className="wf-fade grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-4 gap-y-2 py-5 sm:grid-cols-[3rem_minmax(0,1.2fr)_minmax(0,1fr)] sm:items-center" style={{ ["--d" as string]: `${300 + i * 90}ms` }}>
                <span className="font-['Outfit'] text-[26px] font-bold leading-none text-[#d6b357]">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <p className="font-['Outfit'] text-[19px] font-bold text-[#0d1117]">{c.name}</p>
                  <p className="mt-0.5 text-[13px] text-[#6b7280]">{c.note}</p>
                </div>
                <div className="col-start-2 sm:col-start-auto">
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="font-['Outfit'] text-[18px] font-bold text-[#0d1117]">+AED {c.value.toFixed(2)}bn</span>
                    <span className="font-semibold text-[#6b7280]">+{c.investors.toLocaleString("en-US")} investors</span>
                  </div>
                  <div className="mt-2 h-2 bg-[#eef0f3]">
                    <div className="wf-line h-full bg-[#001f3f]" style={{ width: `${(100 * c.value) / commMax}%`, ["--g" as string]: `${400 + i * 110}ms` }} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </InView>
      </section>

      {/* ── 05 Did investors make money ─────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <InView threshold={0.15}>
          <Eyebrow n="05">Did buyers make money?</Eyebrow>
          <h2 className="mt-4 max-w-3xl font-['Outfit'] text-[32px] font-bold leading-[1.08] tracking-tight text-[#0d1117] sm:text-[42px]">
            <Words text="Billions in profit," />
            <Words text="already banked." start={3} gold />
          </h2>
          <p className="wf-fade mt-4 max-w-2xl text-[15.5px] leading-relaxed text-[#4b5563]" style={{ ["--d" as string]: "450ms" }}>
            DLD tracked buyers who bought between 2021 and 2024 and have already sold. These are profits actually banked on resale — not paper valuations.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-px border border-[#e5e8ec] bg-[#e5e8ec] md:grid-cols-3">
            {[
              { big: "AED 33.5bn", label: "Bought ready, sold on", sub: "Villas AED 24.8bn · apartments AED 8.8bn. 2021 buyers were the most profitable group (AED 13.97bn)." },
              { big: "AED 6.9bn", label: "Bought off-plan, sold after handover", sub: "Apartments AED 4.95bn, villas AED 1.96bn — apartment resales out-earned villas 2.5 to 1." },
              { big: "AED 5.8bn", label: "Off-plan resales", sub: "Sold during construction or on delivery. 2022 was the most profitable entry year (AED 2.37bn); even 2024 buyers have banked AED 209.8m." },
            ].map((c, i) => (
              <div key={c.label} className="wf-fade bg-white p-6 sm:p-8" style={{ ["--d" as string]: `${300 + i * 120}ms` }}>
                <p className="font-['Outfit'] text-[34px] font-bold leading-none tracking-tight text-[#001f3f]">{c.big}</p>
                <p className="mt-3 text-[14px] font-bold text-[#0d1117]">{c.label}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#6b7280]">{c.sub}</p>
              </div>
            ))}
          </div>
          <p className="wf-fade mt-4 text-[12px] text-[#9ca3af]" style={{ ["--d" as string]: "700ms" }}>
            Totals of realised gains across all sellers in each of DLD&rsquo;s three analyses, 2021–2024 — the groups can overlap, so they are not added together. Past results are not a promise of future returns.
          </p>
        </InView>
      </section>

      {/* ── 06 Luxury + rents (dark) ────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#06182e] text-white">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-[#d6b357]" aria-hidden="true" />
        <InView className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24" threshold={0.12}>
          <Eyebrow n="06" dark>Luxury &amp; rents</Eyebrow>
          <h2 className="mt-4 max-w-3xl font-['Outfit'] text-[32px] font-bold leading-[1.08] tracking-tight sm:text-[42px]">
            <Words text="The world's busiest" />
            <Words text="US$10M+ home market." start={3} gold />
          </h2>
          <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">Home sales above US$10 million, 2024</p>
              <div className="mt-6 space-y-4">
                {TEN_MILLION.map((r, i) => (
                  <div key={r.city} className="wf-fade" style={{ ["--d" as string]: `${200 + i * 90}ms` }}>
                    <div className="flex items-baseline justify-between text-[14px]">
                      <span className={r.city === "Dubai" ? "font-bold text-[#f0d89b]" : "font-semibold text-white/80"}>{r.city}</span>
                      <span className="font-['Outfit'] text-[17px] font-bold tabular-nums">{r.n}</span>
                    </div>
                    <div className="mt-1.5 h-2 bg-white/10">
                      <div className={`wf-line h-full ${r.city === "Dubai" ? "bg-[#d6b357]" : "bg-white/45"}`} style={{ width: `${(100 * r.n) / tenMax}%`, ["--g" as string]: `${250 + i * 110}ms` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-[13px] leading-relaxed text-white/60">
                Dubai registered 435 — nearly as many as New York and London combined — for the second year running. Listings above AED 50 million fell 48% as buyers moved in to live.
              </p>
              <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">Prime space US$1 million buys · sq ft</p>
              <div className="mt-4 grid grid-cols-4 gap-3">
                {MILLION_BUYS.map((r, i) => (
                  <div key={r.city} className="wf-fade flex flex-col justify-end" style={{ ["--d" as string]: `${300 + i * 90}ms` }}>
                    <div className="flex h-28 items-end bg-white/[0.04]">
                      <div className={`w-full ${r.city === "Dubai" ? "bg-[#d6b357]" : "bg-white/35"}`} style={{ height: `${(100 * r.sqft) / millionMax}%` }} />
                    </div>
                    <p className="mt-2 font-['Outfit'] text-[18px] font-bold leading-none">{r.sqft}</p>
                    <p className="mt-1 text-[11.5px] text-white/60">{r.city}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-white/40">Source: Knight Frank, as published in the DLD report.</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">The rental market</p>
              <div className="mt-6 grid grid-cols-1 gap-px bg-white/10 sm:grid-cols-2">
                {[
                  { big: "965,067", label: "Rental contracts", sub: "A record — double 2017's count" },
                  { big: "+19.7%", label: "New tenancies", sub: "466,180 new contracts as people keep moving in" },
                  { big: "+19.6%", label: "Villa rents", sub: "AED 37.3 → 44.6 per sq ft" },
                  { big: "AED 3.54bn", label: "Business Bay rents", sub: "Top community by rental value, +23.4%" },
                ].map((c, i) => (
                  <div key={c.label} className="wf-fade bg-[#06182e] p-5" style={{ ["--d" as string]: `${300 + i * 100}ms` }}>
                    <p className="font-['Outfit'] text-[28px] font-bold leading-none tracking-tight text-white">{c.big}</p>
                    <p className="mt-2 text-[13px] font-semibold text-[#f0d89b]">{c.label}</p>
                    <p className="mt-0.5 text-[12px] leading-snug text-white/55">{c.sub}</p>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-[13px] leading-relaxed text-white/60">
                Apartment rents per sq ft eased 18.8% in 2024, giving tenants more choice — while villa rents and the rental value of Business Bay, Burj Khalifa and Dubai Marina kept rising. The report puts Dubai&rsquo;s rental yields at 6–8%, well above London and New York.
              </p>
            </div>
          </div>
        </InView>
      </section>

      {/* ── 07 What comes next ──────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <InView threshold={0.15}>
          <Eyebrow n="07">What comes next</Eyebrow>
          <h2 className="mt-4 max-w-3xl font-['Outfit'] text-[32px] font-bold leading-[1.08] tracking-tight text-[#0d1117] sm:text-[42px]">
            <Words text="Why the demand" />
            <Words text="keeps coming." start={3} gold />
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { big: "6,700", label: "Millionaires expected to move to the UAE in 2024", sub: "The most of any country — almost double the US (New World Wealth)" },
              { big: "18.7M", label: "International visitors, +9%", sub: "Tourism feeds short-term rentals and second homes" },
              { big: "5.8M", label: "Dubai residents planned by 2040", sub: "Dubai Urban Master Plan 2040" },
              { big: "28th", label: "In JLL's 2024 Global Real Estate Transparency Index", sub: "Among the top improvers, now in the 'Transparent' tier" },
            ].map((c, i) => (
              <div key={c.label} className="wf-fade" style={{ ["--d" as string]: `${250 + i * 100}ms` }}>
                <Stat big={c.big} label={c.label} sub={c.sub} />
              </div>
            ))}
          </div>
          <p className="wf-fade mt-10 max-w-3xl text-[15.5px] leading-relaxed text-[#4b5563]" style={{ ["--d" as string]: "650ms" }}>
            DLD expects the luxury segment to stay strong, new districts like Dubai South and Expo City to absorb growth, and the Golden Visa, 100% foreign ownership and the D33 plan to double Dubai&rsquo;s economy to keep capital flowing. The challenge it names: balancing new supply with demand so prices stay sustainable.
          </p>
        </InView>
      </section>

      {/* ── What it means for you + CTA ─────────────────────────────── */}
      <section className="border-t border-[#e5e8ec] bg-white">
        <InView className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20" threshold={0.2}>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
            <div>
              <p className="inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.26em] text-[#b8913f]">
                <span className="wf-rule h-px w-10 bg-[#d6b357]" aria-hidden="true" />
                <span className="wf-fade" style={{ ["--d" as string]: "150ms" }}>What it means if you&rsquo;re buying</span>
              </p>
              <ul className="mt-6 space-y-5">
                {[
                  ["Off-plan led the year.", "First-time and overseas buyers chose it for payment plans spread over construction — and the report credits RERA escrow rules for the confidence."],
                  ["Villas outran apartments.", "Prices nearly doubled since 2020 with limited new supply in the established communities."],
                  ["Apartments are the liquid choice.", "The biggest, most traded segment — and the one where off-plan buyers banked the most on resale."],
                  ["Where you buy matters more each year.", "The report expects profits to become more location-sensitive, rewarding under-supplied areas."],
                ].map(([head, body], i) => (
                  <li key={head} className="wf-fade flex gap-4" style={{ ["--d" as string]: `${250 + i * 100}ms` }}>
                    <span className="mt-1.5 h-2 w-2 shrink-0 bg-[#d6b357]" aria-hidden="true" />
                    <p className="text-[15px] leading-relaxed text-[#4b5563]">
                      <span className="font-bold text-[#0d1117]">{head}</span> {body}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="wf-fade border border-[#e5e8ec] bg-[#fafafa] p-6 sm:p-8" style={{ ["--d" as string]: "400ms" }}>
              <p className="font-['Outfit'] text-[24px] font-bold leading-tight text-[#0d1117]">Turn the numbers into a shortlist.</p>
              <p className="mt-2 text-[14px] leading-relaxed text-[#6b7280]">
                Browse off-plan projects with developer prices, payment plans and handover dates — or ask an FHI Global advisor which areas fit your budget.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                <MagneticLink href="/off-plan-projects-in-dubai" className="inline-flex items-center justify-center gap-2 bg-[#001f3f] px-6 py-3.5 text-[14px] font-bold text-white transition-colors hover:bg-[#00152b]">
                  Off-plan projects <ArrowRight className="h-4 w-4" />
                </MagneticLink>
                <a href={COMPANY_WHATSAPP} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 border border-[#25d366] px-6 py-3.5 text-[14px] font-bold text-[#128c4a] transition-colors hover:bg-[#25d366]/10">
                  <MessageCircle className="h-4 w-4" /> Ask an advisor
                </a>
              </div>
              <div className="mt-6 border-t border-[#e5e8ec] pt-5 text-[13px] leading-relaxed text-[#6b7280]">
                <p>
                  <span className="font-semibold text-[#0d1117]">Source:</span> Dubai Land Department, <em>Dubai Real Estate Annual Report 2024</em>, with expert sections by Knight Frank and JLL. This page is FHI Global&rsquo;s summary.
                </p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  <a href={DLD_REPORT_PAGE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#001f3f] hover:underline">
                    Report page on dubailand.gov.ae <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                  <a href={DLD_REPORT_PDF} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#001f3f] hover:underline">
                    Full report (PDF, 81 pages) <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                  <Link href="/open-data" className="inline-flex items-center gap-1 font-semibold text-[#001f3f] hover:underline">
                    Dubai Residential Price Index <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </InView>
      </section>
    </div>
  )
}
