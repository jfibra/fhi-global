import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { SeoPage } from "@/lib/seo-pages"

// One line per guide, keyed by slug — what the guide answers, in the buyer's terms. A guide without
// an entry just shows its title.
const GUIDE_BLURBS: Record<string, string> = {
  "dubai-golden-visa-property-guide": "The AED 2M threshold, what qualifies and family sponsorship.",
  "how-to-buy-off-plan-property-in-dubai": "Booking, SPA, escrow and handover, step by step.",
  "dubai-property-buying-costs": "DLD fee, agent fees and service charges to budget for.",
  "can-foreigners-buy-property-in-dubai": "100% freehold zones and how remote purchases work.",
}

/**
 * The project page's "Buying Guide" section: a flat grid of the buyer guides that fit this project
 * (see buyerGuidesForProject). The anchor is the short guide title, never a sentence; the whole
 * card is the click target.
 */
export function BuyingGuideLinks({ guides }: { guides: SeoPage[] }) {
  if (guides.length === 0) return null
  return (
    <ul className="mt-5 grid gap-px border border-[#e5e8ec] bg-[#e5e8ec] sm:grid-cols-2">
      {guides.map((g) => (
        <li key={g.slug} className="group relative bg-white p-5 transition-colors hover:bg-[#fafafa]">
          <h3 className="font-['Outfit'] text-[15px] font-bold text-[#0d1117]">
            <Link href={`/${g.slug}`} className="after:absolute after:inset-0">
              {g.label}
            </Link>
          </h3>
          {GUIDE_BLURBS[g.slug] && <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#6b7280]">{GUIDE_BLURBS[g.slug]}</p>}
          <span aria-hidden="true" className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-[#8a6d2a]">
            Read guide <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </li>
      ))}
    </ul>
  )
}
