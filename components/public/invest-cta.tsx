import Image from "next/image"
import { ArrowRight, TrendingUp } from "lucide-react"
import { InView } from "@/components/public/in-view"
import { ParallaxPhoto } from "@/components/public/parallax-photo"
import { CountUp } from "@/components/public/count-up"
import { MagneticLink } from "@/components/public/magnetic-link"

/**
 * Closing call to action: "Explore Properties for Sale in Dubai."
 *
 * A navy panel on the left carries the copy; the skyline fills the right
 * behind a diagonal seam edged in gold. On phones the photo sits behind
 * everything under a navy scrim.
 *
 * Entrance (CSS `.cta-*` in app/globals.css, fired by InView): twelve navy
 * slats over the photo roll up one after another like blinds while the photo
 * eases out of a zoom and a golden-hour glow rises at the horizon; the seam
 * draws top to bottom; the "Ready to invest?" chip unfolds; a bar of light
 * scans across the headline and reveals it in its wake; the rule draws; copy,
 * buttons and the live counters settle in last. Afterwards the photo drifts
 * against the scroll and slowly zooms, and the buttons lean toward the cursor.
 *
 * The counters are computed from the catalogue by the page — nothing here is
 * a typed-in figure.
 */

export type CtaStat = { value: number; label: string }

const SLATS = 12

export function InvestCta({ stats }: { stats: CtaStat[] }) {
  return (
    <section className="cta relative overflow-hidden bg-[#06182e] text-white">
      <noscript>
        <style>{`.cta [class*="cta-"] { opacity: 1 !important; transform: none !important; clip-path: none !important; filter: none !important; } .cta .cta-slat { display: none !important; }`}</style>
      </noscript>

      <InView className="relative" threshold={0.3}>
        {/* ── Photo, clipped to the diagonal on md+ ────────────────── */}
        <div
          className="cta-photo absolute inset-0 md:left-[36%] md:[clip-path:polygon(13%_0,100%_0,100%_100%,0_100%)]"
          aria-hidden="true"
        >
          <ParallaxPhoto className="absolute inset-0 overflow-hidden" strength={0.08}>
            <div className="cta-photo-img absolute inset-0">
              <div className="animate-kenburns absolute inset-0">
                <Image
                  src="/background/dubai.webp"
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 64vw"
                  className="object-cover object-[62%_center]"
                />
              </div>
            </div>
          </ParallaxPhoto>

          {/* Golden-hour glow rising at the horizon */}
          <div className="cta-sun pointer-events-none absolute left-[22%] top-[38%] h-[70%] w-[60%]" />

          {/* Navy slats that roll up to reveal the photo */}
          {Array.from({ length: SLATS }, (_, i) => (
            <span
              key={i}
              className="cta-slat absolute inset-y-0 bg-[#06182e]"
              style={{ left: `${(i * 100) / SLATS}%`, width: `${100 / SLATS + 0.3}%`, ["--i" as string]: i }}
            />
          ))}

          {/* Legibility: full scrim on phones, a soft fade into the panel on md+ */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#06182e] via-[#06182e]/75 to-[#06182e]/25 md:hidden" />
          <div className="absolute inset-y-0 left-0 hidden w-[34%] bg-gradient-to-r from-[#06182e] to-transparent md:block" />
        </div>

        {/* Gold seam along the diagonal — same box as the photo, unclipped */}
        <svg
          className="cta-seam pointer-events-none absolute inset-0 hidden md:left-[36%] md:block"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line x1="13" y1="0" x2="0" y2="100" stroke="#d6b357" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>

        {/* Soft gold light behind the copy */}
        <div className="pointer-events-none absolute -left-32 top-1/2 h-[560px] w-[560px] -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(214,179,87,0.14),rgba(214,179,87,0))]" aria-hidden="true" />

        {/* ── Copy ─────────────────────────────────────────────────── */}
        <div className="relative mx-auto max-w-[1440px] px-4 py-24 sm:px-6 md:py-32 lg:px-8">
          <div className="max-w-xl">
            <div className="cta-chip inline-flex items-center gap-2 border border-[#d6b357]/70 bg-[#06182e]/60 px-3.5 py-2 backdrop-blur-sm">
              <TrendingUp className="h-3.5 w-3.5 text-[#d6b357]" aria-hidden="true" />
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#d6b357]">Ready to invest?</span>
            </div>

            <div className="cta-wipe relative mt-7 inline-block pr-2">
              <h2 className="font-['Outfit'] text-[40px] font-bold leading-[1.06] tracking-tight sm:text-[52px] lg:text-[60px]">
                <span className="block text-white">Explore Properties</span>
                <span className="cta-gold block">for Sale in Dubai.</span>
              </h2>
              <span className="cta-scan" aria-hidden="true" />
            </div>

            <span className="cta-rule mt-6 block h-[3px] w-14 bg-[#d6b357]" aria-hidden="true" />

            <p className="cta-fade mt-6 max-w-md text-[16.5px] leading-[1.7] text-white/75" style={{ ["--d" as string]: "1500ms" }}>
              Browse hundreds of premium developments, from off-plan launches to
              ready-to-move homes in Dubai&apos;s finest communities.
            </p>

            <div className="cta-fade mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center" style={{ ["--d" as string]: "1650ms" }}>
              <MagneticLink
                href="/projects"
                className="group inline-flex items-center justify-center gap-2.5 bg-[#d6b357] px-7 py-4 text-[15px] font-bold text-[#001f3f] transition-colors duration-300 hover:bg-[#e2c26a]"
              >
                Browse Projects
                <ArrowRight className="h-[18px] w-[18px] transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
              </MagneticLink>
              <MagneticLink
                href="/contact"
                className="inline-flex items-center justify-center gap-2.5 border border-white/35 px-7 py-4 text-[15px] font-bold text-white backdrop-blur-sm transition-colors duration-300 hover:border-white/70 hover:bg-white/10"
              >
                Contact Us
              </MagneticLink>
            </div>

            {stats.length > 0 && (
              <dl className="cta-fade mt-14 flex flex-wrap gap-x-10 gap-y-6 border-t border-white/15 pt-8" style={{ ["--d" as string]: "1850ms" }}>
                {stats.map((s, i) => (
                  <div key={s.label} className="min-w-[110px]">
                    <dd className="font-['Outfit'] text-[34px] font-bold leading-none text-white">
                      <CountUp value={s.value} delay={1900 + i * 150} />
                    </dd>
                    <dt className="mt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#d6b357]">{s.label}</dt>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </InView>
    </section>
  )
}
