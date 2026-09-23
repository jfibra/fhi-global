import Image from "next/image"
import Link from "next/link"
import {
  ShieldCheck,
  UsersRound,
  Award,
  TrendingUp,
  Globe,
  FilePenLine,
  ArrowUpRight,
  MapPin,
} from "lucide-react"
import { InView } from "@/components/public/in-view"
import { ParallaxPhoto } from "@/components/public/parallax-photo"

/**
 * "We connect serious investors…" — the homepage's statement of why FHI.
 *
 * Two columns: the statement, its two calls to action and the skyline on the
 * left; six facts in three named groups on the right. Every fact restates a
 * claim the site already made in this section — nothing new is asserted, and
 * the mockup's bracketed placeholders (languages, data source) were dropped
 * rather than filled in.
 *
 * The entrance is choreographed in CSS (`.wf-*` in app/globals.css) and fired
 * by `InView`: the gold rule draws, the headline rises word by word from a
 * mask with a gold shimmer sweeping across it, the photo wipes open and
 * settles from a zoom, then each group's divider draws and its icons trace
 * their own strokes as the group scrolls in.
 */

const HEADLINE: { text: string; gold?: boolean }[] = [
  { text: "We" },
  { text: "connect" },
  { text: "serious" },
  { text: "investors" },
  { text: "with" },
  { text: "the" },
  { text: "right", gold: true },
  { text: "developers", gold: true },
  { text: "and", gold: true },
  { text: "projects.", gold: true },
]

const GROUPS: {
  label: string
  items: { icon: React.ElementType; title: string; desc: string }[]
}[] = [
  {
    label: "Who you're dealing with",
    items: [
      {
        icon: ShieldCheck,
        title: "Verified developers",
        desc: "Every developer we work with is vetted, RERA-registered and financially screened before a single unit is listed.",
      },
      {
        icon: UsersRound,
        title: "An expert, multilingual team",
        desc: "One agent guides you from the first search to handover, so you never have to repeat yourself.",
      },
    ],
  },
  {
    label: "What you're buying",
    items: [
      {
        icon: Award,
        title: "Hand-picked projects",
        desc: "A curated portfolio of residential and investment projects, each reviewed by our team before it goes live.",
      },
      {
        icon: TrendingUp,
        title: "Returns worth the move",
        desc: "Dubai rental yields commonly run 6 to 8%, among the highest of any major city in the world.",
      },
    ],
  },
  {
    label: "How it gets done",
    items: [
      {
        icon: Globe,
        title: "Buy from anywhere",
        desc: "Investors from more than 50 countries work with us. Off-plan purchases can usually be completed without flying in.",
      },
      {
        icon: FilePenLine,
        title: "From viewing to SPA, handled",
        desc: "We manage every step up to signing the Sale and Purchase Agreement, and tell you what happens next.",
      },
    ],
  },
]

export function WhyFhi() {
  return (
    <section className="wf relative overflow-hidden bg-[#f3f4f6] py-24 lg:py-32">
      {/* Content stays visible if scripts never run (the CSS hides it until data-in). */}
      <noscript>
        <style>{`.wf [class*="wf-"], .wf .wf-word > span { opacity: 1 !important; transform: none !important; clip-path: none !important; filter: none !important; }`}</style>
      </noscript>

      {/* Soft gold light behind the statement, and a hairline grid so the
          section reads as a drafted page rather than a flat panel. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-40 top-10 h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(214,179,87,0.16),rgba(214,179,87,0))]" />
        <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,rgba(13,17,23,0.045)_1px,transparent_1px)] [background-size:96px_100%]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-12 lg:gap-12">
          {/* ── Left: the statement ─────────────────────────────── */}
          <div className="lg:col-span-5">
            <InView>
              <span className="wf-rule block h-[3px] w-14 bg-[#d6b357]" aria-hidden="true" />

              <h2 className="mt-8 font-['Outfit'] text-[40px] font-bold leading-[1.05] tracking-tight text-[#0d1117] sm:text-[52px] lg:text-[56px]">
                {HEADLINE.map((w, i) => (
                  <span key={i} className="wf-word mr-[0.26em]">
                    <span style={{ ["--i" as string]: i }} className={w.gold ? "wf-gold" : undefined}>
                      {w.text}
                    </span>
                  </span>
                ))}
              </h2>

              <p className="wf-fade mt-6 max-w-md text-lg leading-relaxed text-[#4b5563]" style={{ ["--d" as string]: "700ms" }}>
                Backed by expertise, transparency and a proven track record.
              </p>

              <div className="wf-fade mt-8 flex flex-wrap items-center gap-x-7 gap-y-4" style={{ ["--d" as string]: "850ms" }}>
                <Link
                  href="/contact"
                  className="wf-cta group relative inline-flex items-center gap-2 overflow-hidden bg-[#0d1117] px-6 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-[#001f3f]"
                >
                  <span className="relative z-10">Speak to an investment advisor</span>
                  <ArrowUpRight className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/projects"
                  className="wf-link relative text-[15px] font-bold text-[#0d1117] transition-colors hover:text-[#b8913f]"
                >
                  See vetted projects
                </Link>
              </div>
            </InView>

            <InView className="mt-12" style={{ ["--d" as string]: "150ms" }}>
              {/* The wipe mask sits on the frame, not this wrapper, so the corner
                  marks hanging outside the frame are not clipped by it. */}
              <div className="relative">
                <ParallaxPhoto className="wf-photo relative aspect-[4/3] w-full overflow-hidden bg-[#dfe3ea]">
                  <div className="wf-photo-img relative h-full w-full">
                    <Image
                      src="/background/developers.webp"
                      alt="Dubai skyline with the Burj Khalifa and Dubai Frame at golden hour"
                      fill
                      sizes="(max-width: 1024px) 100vw, 40vw"
                      className="object-cover"
                    />
                  </div>
                </ParallaxPhoto>
                {/* Four gold corner marks that slide in once the wipe is done. */}
                <span className="wf-corner wf-corner--tl" aria-hidden="true" />
                <span className="wf-corner wf-corner--tr" aria-hidden="true" />
                <span className="wf-corner wf-corner--bl" aria-hidden="true" />
                <span className="wf-corner wf-corner--br" aria-hidden="true" />
                <div className="wf-fade absolute bottom-4 left-4 flex items-center gap-2 bg-white/92 px-3 py-2 text-[12px] font-bold text-[#0d1117] shadow-sm backdrop-blur-sm" style={{ ["--d" as string]: "1400ms" }}>
                  <MapPin className="h-3.5 w-3.5 text-[#b8913f]" aria-hidden="true" />
                  Dubai, United Arab Emirates
                </div>
              </div>
            </InView>
          </div>

          {/* ── Right: six facts in three groups ─────────────────── */}
          <div className="lg:col-span-7 lg:pl-6">
            {GROUPS.map((g, gi) => (
              <InView
                key={g.label}
                threshold={0.25}
                className={gi === 0 ? "" : "mt-12"}
                // When the whole column is on screen at once (desktop), the
                // groups cascade instead of landing together.
                style={{ ["--g" as string]: `${gi * 260}ms` }}
              >
                {gi > 0 && (
                  <span className="wf-line mb-12 block h-px w-full bg-[#d7dae0]" aria-hidden="true" />
                )}
                <p className="wf-fade text-[13px] font-bold tracking-[0.02em] text-[#8a6d2b]">{g.label}</p>
                <div className="mt-7 grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-x-10">
                  {g.items.map(({ icon: Icon, title, desc }, ii) => (
                    <div
                      key={title}
                      className="wf-fade wf-item group"
                      style={{ ["--d" as string]: `${180 + ii * 160}ms` }}
                    >
                      <span className="wf-icon relative inline-flex h-11 w-11 items-center justify-center" style={{ ["--d" as string]: `${420 + ii * 160}ms` }}>
                        <span className="wf-icon-ring absolute inset-0 rounded-full border border-[#d6b357]/50" aria-hidden="true" />
                        <Icon className="relative h-6 w-6 text-[#b8913f]" strokeWidth={1.5} aria-hidden="true" />
                      </span>
                      <h3 className="mt-4 font-['Outfit'] text-[20px] font-bold leading-snug text-[#0d1117] transition-colors duration-300 group-hover:text-[#001f3f]">
                        {title}
                      </h3>
                      <p className="mt-2.5 text-[15px] leading-relaxed text-[#4b5563]">{desc}</p>
                    </div>
                  ))}
                </div>
              </InView>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
