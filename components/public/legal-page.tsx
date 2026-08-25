import Link from "next/link"
import { Mail } from "lucide-react"

export type LegalSection = {
  heading: string
  paragraphs?: string[]
  bullets?: string[]
}

/**
 * Shared template for the legal pages (/privacy, /terms, /cookies) — the
 * site's light editorial masthead over readable prose. Content stays in each
 * page file; this only owns the layout.
 */
export function LegalPage({
  title,
  effective,
  intro,
  sections,
}: {
  title: string
  effective: string
  intro: string
  sections: LegalSection[]
}) {
  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Masthead */}
      <section className="bg-white border-b border-[#e8eaed]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="h-px w-10 bg-[#d6b357]" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#b8913f]">
              FHI Global · Legal
            </span>
          </div>
          <h1 className="font-['Outfit'] text-3xl md:text-[42px] font-bold tracking-tight text-[#001f3f] leading-[1.08]">
            {title}
          </h1>
          <p className="mt-3 text-sm text-[#6b7280]">Effective date: {effective}</p>
          <p className="mt-4 text-[15px] leading-relaxed text-[#4b5563] max-w-3xl">{intro}</p>
        </div>
      </section>

      {/* Body */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-3xl space-y-10">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="font-['Outfit'] text-[19px] font-bold uppercase tracking-[0.08em] text-[#0d1117]">
                {s.heading}
              </h2>
              <div className="h-px bg-[#e5e8ec] mt-2.5 mb-4" />
              <div className="space-y-3.5">
                {s.paragraphs?.map((p) => (
                  <p key={p.slice(0, 40)} className="text-[15px] leading-[1.8] text-[#374151]">
                    {p}
                  </p>
                ))}
                {s.bullets && (
                  <ul className="space-y-2.5">
                    {s.bullets.map((b) => (
                      <li key={b.slice(0, 40)} className="flex items-start gap-3">
                        <span className="mt-[9px] w-2 h-2 rotate-45 bg-[#d6b357] shrink-0" aria-hidden="true" />
                        <span className="text-[15px] leading-[1.7] text-[#374151]">{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}

          {/* Contact strip */}
          <section className="bg-[#001f3f] p-6 sm:p-7">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#d6b357]">
              Questions about this policy?
            </p>
            <p className="mt-2 text-white text-[15px] leading-relaxed">
              Write to us and a member of the team will respond within one business day.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <a
                href="mailto:info@fhiglobal.ae"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#d6b357] text-[#001f3f] text-sm font-bold hover:bg-[#c8a544] transition-colors"
              >
                <Mail className="w-4 h-4" /> info@fhiglobal.ae
              </a>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-white/30 text-white text-sm font-bold hover:border-[#d6b357] hover:text-[#d6b357] transition-colors"
              >
                Contact Page
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
