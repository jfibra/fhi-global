import { ArrowUpRight, MessageCircleQuestion, Plus } from "lucide-react"
import { HOME_FAQS } from "@/lib/faqs"
import { InView } from "@/components/public/in-view"
import { MagneticLink } from "@/components/public/magnetic-link"

/**
 * Homepage FAQ, laid out as a ruled ledger.
 *
 * Still native <details>/<summary>: it opens and closes without JavaScript,
 * is keyboard accessible for free, and every answer is in the HTML for
 * crawlers. `name="home-faq"` makes the group exclusive in browsers that
 * support it, so one answer is open at a time. The FAQPage structured data
 * is emitted by the homepage.
 *
 * Entrance (CSS `.faq-*` in app/globals.css, fired by InView): the rail's
 * gold rule draws and its headline rises word by word; on the right the
 * hairlines rule the page top to bottom first, then each question writes
 * itself in beneath its line. Opening a row tints it, turns the question
 * gold, grows a gold underline beneath it, turns the plus into a cross and
 * slides the answer open (height animates where `::details-content` is
 * supported, and simply appears elsewhere).
 */

const HEADLINE: { text: string; gold?: boolean }[] = [
  { text: "Questions" },
  { text: "answered.", gold: true },
]

export function HomeFaq() {
  return (
    // #faq so it can be linked to directly (footer, emails, ad landing links);
    // scroll-mt clears the fixed header when jumped to.
    <section id="faq" className="faq wf relative scroll-mt-24 overflow-hidden border-y border-[#ebedf0] bg-white">
      <noscript>
        <style>{`.faq [class*="wf-"], .faq .wf-word > span, .faq .faq-q, .faq .faq-row::before, .faq .faq-list::after { opacity: 1 !important; transform: none !important; filter: none !important; }`}</style>
      </noscript>

      <div className="pointer-events-none absolute -right-40 top-0 h-[560px] w-[560px] rounded-full bg-[radial-gradient(closest-side,rgba(214,179,87,0.12),rgba(214,179,87,0))]" aria-hidden="true" />

      <div className="relative mx-auto max-w-[1440px] px-4 py-20 sm:px-6 md:py-24 lg:px-8">
        <InView threshold={0.15}>
          <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-20">
            {/* ── Rail: sticks beside the list on tall screens ───────── */}
            <div className="lg:sticky lg:top-28">
              <p className="wf-fade inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#b8913f]">
                <MessageCircleQuestion className="h-4 w-4" aria-hidden="true" />
                FHI Global · FAQ
              </p>

              <h2 className="mt-5 font-['Outfit'] text-[40px] font-bold leading-[1.02] tracking-tight text-[#0d1117] sm:text-[48px]">
                {HEADLINE.map((w, i) => (
                  <span key={w.text} className="wf-word block">
                    <span style={{ ["--i" as string]: i }} className={w.gold ? "wf-gold" : undefined}>
                      {w.text}
                    </span>
                  </span>
                ))}
              </h2>

              <span className="wf-rule mt-6 block h-[3px] w-14 bg-[#d6b357]" aria-hidden="true" />

              <p className="wf-fade mt-6 max-w-sm text-[15px] leading-relaxed text-[#4b5563]" style={{ ["--d" as string]: "500ms" }}>
                Buying in Dubai from overseas raises the same handful of questions every
                time. Here are the straight answers. If yours isn&apos;t here, ask us.
              </p>

              <div className="wf-fade mt-8" style={{ ["--d" as string]: "650ms" }}>
                <MagneticLink
                  href="/contact"
                  className="group inline-flex items-center gap-2 bg-[#0d1117] px-6 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-[#001f3f]"
                >
                  Talk to a consultant
                  <ArrowUpRight className="h-4 w-4 text-[#d6b357] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                </MagneticLink>
              </div>
            </div>

            {/* ── Ledger ─────────────────────────────────────────────── */}
            <div className="faq-list relative" style={{ ["--n" as string]: HOME_FAQS.length }}>
              {HOME_FAQS.map((faq, i) => (
                <details
                  key={faq.question}
                  name="home-faq"
                  open={i === 0}
                  className="faq-row group relative"
                  style={{ ["--i" as string]: i }}
                >
                  <summary className="faq-q flex cursor-pointer list-none items-start justify-between gap-6 px-1 py-5 sm:px-4 sm:py-6 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0">
                      <h3 className="faq-title font-['Outfit'] text-[17px] font-bold leading-snug text-[#0d1117] transition-colors duration-300 sm:text-[19px]">
                        {faq.question}
                      </h3>
                      <span className="faq-underline mt-2 block h-[2px] w-12 bg-[#d6b357]" aria-hidden="true" />
                    </span>
                    <span className="faq-plus relative mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#d6b357]/60 text-[#b8913f] transition-colors duration-300" aria-hidden="true">
                      <Plus className="h-4 w-4 transition-transform duration-400" strokeWidth={2} />
                    </span>
                  </summary>
                  <div className="faq-a px-1 pb-6 sm:px-4 sm:pb-7">
                    <p className="max-w-2xl text-[15px] leading-[1.7] text-[#4b5563]">{faq.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </InView>
      </div>
    </section>
  )
}
