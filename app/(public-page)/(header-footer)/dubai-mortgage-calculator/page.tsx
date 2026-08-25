import type { Metadata } from "next"
import Link from "next/link"
import { createPageMetadata } from "@/lib/seo"
import { breadcrumbList, faqPageSchema } from "@/lib/structured-data"
import { JsonLd } from "@/components/json-ld"
import { MortgageCalculator } from "@/components/public/mortgage-calculator"

export const metadata: Metadata = createPageMetadata({
  title: "Dubai Mortgage Calculator — Monthly Payment & Upfront Costs",
  description:
    "Free Dubai mortgage calculator: estimate your monthly payment plus the real upfront costs — DLD 4%, trustee, agent and mortgage fees — in AED.",
  pathname: "/dubai-mortgage-calculator",
  keywords: [
    "Dubai mortgage calculator",
    "UAE mortgage calculator",
    "Dubai home loan calculator",
    "mortgage payment Dubai",
  ],
})

// Visible FAQ copy and the FAQPage markup below must always match.
const FAQS = [
  {
    q: "What deposit do I need for a mortgage in Dubai?",
    a: "UAE regulations require expat residents to put down at least 20% on a first home under AED 5 million (15% for UAE nationals, more above 5M). Non-residents typically need 40–50% down, depending on the bank.",
  },
  {
    q: "What is the maximum mortgage term in the UAE?",
    a: "25 years, and the loan must generally be repaid before age 65 for salaried borrowers (70 for the self-employed).",
  },
  {
    q: "Can non-residents get a UAE mortgage?",
    a: "Yes — several UAE banks lend to non-residents on completed properties, typically at 50–60% loan-to-value with income documentation from your home country.",
  },
  {
    q: "What extra costs should I budget beyond the down payment?",
    a: "Roughly 6–8% of the price: the 4% DLD transfer fee, trustee office fee, agent commission on resales (2% + VAT), 0.25% mortgage registration and the bank's valuation and arrangement fees. This calculator itemises them for you.",
  },
]

const RELATED = [
  { label: "Dubai Property Buying Costs", href: "/dubai-property-buying-costs" },
  { label: "How to Buy Off-Plan", href: "/how-to-buy-off-plan-property-in-dubai" },
  { label: "Can Foreigners Buy in Dubai?", href: "/can-foreigners-buy-property-in-dubai" },
  { label: "Properties Under AED 1M", href: "/properties-under-1m-in-dubai" },
  { label: "New Projects in Dubai", href: "/new-projects-in-dubai" },
]

export default function MortgageCalculatorPage() {
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <JsonLd
        schema={[
          breadcrumbList([{ name: "Home", path: "/" }, { name: "Dubai Mortgage Calculator" }]),
          faqPageSchema(FAQS),
        ]}
      />

      {/* Masthead */}
      <section className="bg-white border-b border-[#e8eaed]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="h-px w-10 bg-[#d6b357]" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#b8913f]">
              FHI Global · Free Tool
            </span>
          </div>
          <h1 className="font-['Outfit'] text-3xl md:text-[42px] font-bold tracking-tight text-[#001f3f] leading-[1.08]">
            Dubai Mortgage Calculator
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[#6b7280] max-w-2xl">
            Estimate your monthly payment in AED — and, unlike most calculators, the real cash you
            need upfront: the 4% DLD fee, trustee, agent and mortgage registration, itemised the
            way they&apos;ll actually hit your bank account.
          </p>

          {/* The regulatory anchors buyers ask about first. */}
          <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 sm:flex sm:flex-wrap sm:gap-x-0 sm:gap-y-4">
            {[
              { label: "Min. Down — Residents", value: "20%" },
              { label: "Non-Residents", value: "40–50%" },
              { label: "Max Term", value: "25 years" },
              { label: "DLD Fee", value: "4%" },
            ].map((f) => (
              <div
                key={f.label}
                className="sm:pr-8 sm:mr-8 sm:border-r sm:border-[#e8eaed] sm:last:mr-0 sm:last:border-0 sm:last:pr-0"
              >
                <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8913f] mb-1.5">
                  {f.label}
                </dt>
                <dd className="font-['Outfit'] text-xl font-bold text-[#001f3f] leading-none">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Calculator */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        <MortgageCalculator />

        {/* FAQ — visible copy first, FAQPage markup mirrors it exactly. */}
        <section className="bg-white border border-[#e8eaed] p-6 sm:p-8">
          <h2 className="font-['Outfit'] text-lg font-bold text-[#001f3f]">Frequently Asked Questions</h2>
          <span className="block w-10 h-[2px] bg-[#d6b357] mt-2.5 mb-5" aria-hidden="true" />
          <div className="divide-y divide-[#eef0f3]">
            {FAQS.map((f) => (
              <div key={f.q} className="py-4 first:pt-0 last:pb-0">
                <h3 className="text-[15px] font-bold text-[#0d1117]">{f.q}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-[#4b5563] max-w-3xl">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Related */}
        <div className="bg-white border border-[#e8eaed] p-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mb-4">
            Keep reading
          </p>
          <div className="flex flex-wrap gap-2.5">
            {RELATED.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="px-4 py-2 border border-[#e5e5e5] bg-[#f8fafc] text-sm font-semibold text-[#001f3f] hover:border-[#d6b357] hover:bg-[#d6b357]/10 transition-colors"
              >
                {r.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
