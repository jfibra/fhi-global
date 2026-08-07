import Link from "next/link"
import { ArrowRight, MessageCircleQuestion, Plus } from "lucide-react"
import { HOME_FAQS } from "@/lib/faqs"

/**
 * Homepage FAQ. Built on native <details>/<summary>, so it opens and closes
 * with no JavaScript at all, stays keyboard accessible for free, and the
 * answers are in the HTML for crawlers whether or not anything is expanded.
 * The FAQPage structured data that pairs with it is emitted by the homepage.
 */
export function HomeFaq() {
  return (
    // #faq so it can be linked to directly (footer, emails, ad landing links);
    // scroll-mt clears the fixed header when jumped to.
    <section id="faq" className="relative scroll-mt-24 bg-white border-y border-[#ebedf0]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-10 lg:gap-16 items-start">
          {/* Heading rail — sticks alongside the list on tall screens. */}
          <div>
            <div className="lg:sticky lg:top-28">
              <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#b8913f] mb-4">
                <MessageCircleQuestion className="w-4 h-4" />
                FHI Global · FAQ
              </p>
              <h2 className="font-['Outfit'] text-3xl md:text-[40px] font-bold uppercase leading-[1.05] tracking-tight">
                <span className="block text-[#001f3f]">Questions</span>
                <span className="block text-[#d6b357]">Answered</span>
              </h2>
              <span className="block w-16 h-[3px] bg-[#d6b357] my-5" aria-hidden="true" />
              <p className="text-[#5f6368] text-[15px] leading-relaxed max-w-sm">
                Buying in Dubai from overseas raises the same handful of questions every time.
                Here are the straight answers — and if yours isn&apos;t here, just ask.
              </p>
              <Link
                href="/contact"
                className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-[#001f3f] text-white text-sm font-bold hover:bg-[#00356b] transition-colors"
              >
                Talk to a consultant
                <ArrowRight className="w-4 h-4 text-[#d6b357]" />
              </Link>
            </div>
          </div>

          <div className="space-y-3">
            {HOME_FAQS.map((faq) => (
              <details
                key={faq.question}
                className="group border border-[#e5e8ec] bg-white open:border-[#d6b357] transition-colors"
              >
                <summary className="flex items-start justify-between gap-5 cursor-pointer list-none px-5 sm:px-6 py-4 [&::-webkit-details-marker]:hidden">
                  <h3 className="font-['Outfit'] text-[15px] sm:text-base font-bold text-[#001f3f] leading-snug">
                    {faq.question}
                  </h3>
                  {/* A plus that becomes an x — one glyph, no icon swap. */}
                  <Plus
                    className="w-[18px] h-[18px] text-[#d6b357] shrink-0 mt-0.5 transition-transform duration-300 group-open:rotate-45"
                    aria-hidden="true"
                  />
                </summary>
                <div className="px-5 sm:px-6 pb-5">
                  <span className="block w-10 h-[2px] bg-[#d6b357] mb-3.5" aria-hidden="true" />
                  <p className="text-sm text-[#4b5563] leading-relaxed max-w-2xl">{faq.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
