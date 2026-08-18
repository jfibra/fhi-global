"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { MapPin, ArrowRight } from "lucide-react"
import { HeroSearch } from "@/components/public/hero-search"

export interface HeroSpotlight {
  name: string
  slug: string | null
  image: string
  location: string | null
  priceLabel: string | null
  statusLabel: string | null
}

interface HeroSectionProps {
  developers: { id: string; name: string }[]
  /** Quick links under the search — real developer portfolios, ranked by
   *  how many live projects each one carries (built in the page). */
  popular?: { label: string; href: string }[]
  /** Featured projects for the rotating spotlight card (xl screens). */
  spotlight?: HeroSpotlight[]
}

// The hero rotates through these on a slow crossfade — one frozen photo was
// the single biggest reason the section read as static. All served locally.
const HERO_SLIDES = [
  "/background/home.webp",
  "/background/developers.webp",
  "/background/featured-marina.jpg",
  "/background/dubai.webp",
]
const SLIDE_MS = 7000

export function HeroSection({ developers, popular = [], spotlight = [] }: HeroSectionProps) {
  // Rotation state for the background and the spotlight carousel. One
  // interval each, both skipped for reduced-motion users.
  const [slide, setSlide] = useState(0)
  const [spot, setSpot] = useState(0)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const slides = setInterval(() => setSlide((i) => (i + 1) % HERO_SLIDES.length), SLIDE_MS)
    const spots = spotlight.length > 1
      ? setInterval(() => setSpot((i) => (i + 1) % spotlight.length), 6000)
      : undefined
    return () => {
      clearInterval(slides)
      clearInterval(spots)
    }
  }, [spotlight.length])

  return (
    // overflow-x-clip, NOT overflow-hidden: the search results panel has to
    // spill past the hero's bottom edge, and `hidden` on one axis forces a
    // scroll container on the other. z-20 keeps that spill painted above the
    // sections below. The ken-burns backdrop clips itself instead.
    <section className="relative z-20 min-h-[88vh] flex overflow-x-clip">
      {/* ── Background photo + legibility washes ── */}
      <div className="absolute inset-0 overflow-hidden">
        {HERO_SLIDES.map((src, i) => (
          <Image
            key={src}
            src={src}
            alt=""
            fill
            priority={i === 0}
            sizes="100vw"
            quality={80}
            className={`object-cover object-center animate-kenburns transition-opacity duration-[1800ms] ease-linear ${
              i === slide ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        {/* Text-protection scrim: deep enough on the left third to carry
            small type at speed, fully transparent by 60% so the skyline stays
            bright and the navy cards keep their contrast. Explicit stops
            rather than via-* — the fade has to finish BEFORE the carousel. */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(0,16,34,0.88) 0%, rgba(0,16,34,0.72) 22%, rgba(0,16,34,0.34) 44%, rgba(0,16,34,0.06) 58%, transparent 68%)",
          }}
        />
        {/* Bottom band — the trust strip sits over the brightest water. */}
        <div
          className="absolute inset-x-0 bottom-0 h-52"
          style={{
            backgroundImage:
              "linear-gradient(to top, rgba(0,10,24,0.85) 0%, rgba(0,10,24,0.45) 45%, transparent 100%)",
          }}
        />
      </div>

      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-10 flex flex-col justify-center min-h-[88vh]">
        {/* ═══ Hero copy + search ═══
            Editorial, not boxed: hairline eyebrow, light/bold headline pair,
            one white search bar. z-30: whenever a carousel card drifts near,
            the search always sits on top and keeps every click. */}
        <div className="relative z-40 max-w-3xl">
          {/* Eyebrow — a rule and small caps, no badge chrome */}
          <div
            className="animate-hero-item mb-6 flex items-center gap-4"
            style={{ animationDelay: "0.05s" }}
          >
            <span className="h-px w-10 bg-[#d6b357]" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#f0d89b] drop-shadow-[0_1px_3px_rgba(0,8,20,0.95)]">
              Dubai&apos;s Premier Real Estate Portal
            </span>
          </div>

          {/* Headline — light over bold, solid gold, no effects */}
          <h1
            className="animate-hero-item font-['Outfit'] text-4xl sm:text-5xl lg:text-[3.4rem] xl:text-[3.9rem] leading-[1.06] mb-6 tracking-tight drop-shadow-[0_2px_16px_rgba(0,10,30,0.55)]"
            style={{ animationDelay: "0.18s" }}
          >
            <span className="block font-light text-white">Discover Premium</span>
            <span className="block font-bold text-[#e3c06c]">Real Estate in Dubai</span>
          </h1>

          <p
            className="animate-hero-item text-white/90 text-base sm:text-[17px] leading-relaxed mb-10 max-w-xl drop-shadow-[0_1px_4px_rgba(0,8,20,0.9)]"
            style={{ animationDelay: "0.32s" }}
          >
            Off-plan launches and ready residences from the city&apos;s most
            trusted developers — curated for investors who expect more.
          </p>

          {/* ── Search — the omnibox. Live results from the catalog itself:
                 projects, developers and communities, each deep-linking to
                 its own page. See components/public/hero-search.tsx. ── */}
          {/* z-50: the entry animations give each hero row its own stacking
              layer, so without this the popular links and trust strip would
              paint straight through the open results panel. max-w keeps the
              bar an elegant width rather than a full-bleed slab. */}
          <div
            className="animate-hero-item relative z-50 max-w-2xl xl:mt-12 xl:max-w-xl"
            style={{ animationDelay: "0.46s" }}
          >
            <HeroSearch />
          </div>

          {/* Popular — the developers carrying the most live projects. Real
              portfolio pages, so every link lands on inventory. */}
          {popular.length > 0 && (
            <div
              className="animate-hero-item mt-5 flex flex-wrap items-center gap-x-5 gap-y-2"
              style={{ animationDelay: "0.58s" }}
            >
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/75 drop-shadow-[0_1px_3px_rgba(0,8,20,0.95)]">
                Popular
              </span>
              {popular.map((p, i) => (
                <span key={p.href} className="flex items-center gap-5">
                  {i > 0 && <span className="h-1 w-1 rounded-full bg-[#d6b357]/60" aria-hidden="true" />}
                  <Link
                    href={p.href}
                    className="text-[13px] font-medium text-white/90 underline-offset-4 transition-colors hover:text-white hover:underline drop-shadow-[0_1px_3px_rgba(0,8,20,0.95)]"
                  >
                    {p.label}
                  </Link>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ═══ Trust strip — quiet facts anchoring the section ═══ */}
        <div
          className="animate-hero-item relative z-30 mt-auto hidden md:flex items-center gap-x-8 gap-y-3 flex-wrap border-t border-white/25 pt-5"
          style={{ animationDelay: "0.7s" }}
        >
          {[
            `${developers.length}+ Trusted Developers`,
            "Off-Plan & Ready Residences",
            "RERA Licensed",
            "Dubai · United Arab Emirates",
          ].map((fact, i) => (
            <span key={fact} className="flex items-center gap-8">
              {i > 0 && <span className="hidden lg:block h-1 w-1 rounded-full bg-[#d6b357]/70" aria-hidden="true" />}
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/85 drop-shadow-[0_1px_3px_rgba(0,8,20,0.95)]">
                {fact}
              </span>
            </span>
          ))}
        </div>

        {/* ═══ Highlight band (mockup's bottom strip) ═══ */}
        {/* <div
          className="animate-hero-item mt-12 lg:mt-14 bg-[#06182e]/65 backdrop-blur-xl border border-white/10 shadow-[0_16px_50px_rgba(0,0,0,0.35)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 lg:divide-x divide-white/10"
          style={{ animationDelay: "0.62s" }}
        >
          {HIGHLIGHTS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-center gap-4 px-6 py-5">
              <span className="w-12 h-12 border-2 border-[#d6b357]/70 bg-[#d6b357]/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-[#d6b357]" />
              </span>
              <div>
                <p className="text-[15px] font-bold text-white">{title}</p>
                <p className="text-xs text-white/70 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div> */}
        {/* ═══ Featured-project globe carousel (wide screens) ═══
            The cards sit on a curved arc, like panels on a globe: the front
            card faces the visitor, its neighbours bend away with a rotateY,
            and advancing the spotlight glides every card to its next spot on
            the arc. A wireframe sphere behind sells the "globe". */}
        {spotlight.length > 0 && (
          <div className="animate-hero-item hidden xl:block absolute right-0 top-6 h-[430px] w-[560px]">
            {/* Wireframe globe — solid gold strokes, no glow */}
            <svg
              viewBox="0 0 200 200"
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 text-[#d6b357]"
            >
              <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="0.7" />
              <ellipse cx="100" cy="100" rx="96" ry="38" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="0.6" />
              <ellipse cx="100" cy="100" rx="60" ry="94" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="0.6" />
              <ellipse cx="100" cy="100" rx="24" ry="95" fill="none" stroke="currentColor" strokeOpacity="0.14" strokeWidth="0.6" />
              <circle cx="100" cy="4" r="1.6" fill="currentColor" fillOpacity="0.7" />
              <circle cx="4" cy="100" r="1.4" fill="currentColor" fillOpacity="0.5" />
              <circle cx="196" cy="100" r="1.4" fill="currentColor" fillOpacity="0.5" />
              <circle cx="160" cy="30" r="1.2" fill="currentColor" fillOpacity="0.45" />
              <circle cx="40" cy="170" r="1.2" fill="currentColor" fillOpacity="0.45" />
            </svg>

            {/* The 3D stage is its own clean layer: nothing else animated or
                filtered on it, so the browser can't flatten the projection. A
                short perspective distance = pronounced curve. */}
            <div
              className="absolute inset-0"
              style={{ perspective: "750px", perspectiveOrigin: "50% 42%", transformStyle: "preserve-3d" }}
            >
            {spotlight.map((p, i) => {
              const n = spotlight.length
              // Shortest signed distance from the active card: 0 = front,
              // -1/+1 = the bent neighbours, further = around the back.
              let off = (i - spot + n) % n
              if (off > n / 2) off -= n
              const hidden = Math.abs(off) > 1
              // Positions on the sphere: front card pulled toward the viewer,
              // neighbours swung hard around the curve, hidden cards parked
              // BEHIND the globe on their side — so a card entering the arc
              // sweeps forward and around, like the sphere itself is turning.
              const transform =
                off === 0
                  ? "translateX(0px) translateY(0px) translateZ(120px) rotateY(0deg)"
                  : off === -1
                    ? "translateX(-200px) translateY(8px) translateZ(-60px) rotateY(48deg)"
                    : off === 1
                      ? "translateX(200px) translateY(8px) translateZ(-60px) rotateY(-48deg)"
                      : off < 0
                        ? "translateX(-90px) translateY(24px) translateZ(-220px) rotateY(75deg)"
                        : "translateX(90px) translateY(24px) translateZ(-220px) rotateY(-75deg)"
              const inner = (
                <>
                  <div className="relative h-40 overflow-hidden">
                    <Image
                      src={p.image}
                      alt={p.name}
                      fill
                      sizes="300px"
                      className="object-cover"
                    />
                    {p.statusLabel && (
                      <span className="absolute top-0 left-0 bg-[#0a2647] text-white text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1.5">
                        {p.statusLabel}
                      </span>
                    )}
                  </div>
                  <div className="p-4 text-left">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d6b357] mb-1.5">
                      Featured Project
                    </p>
                    <p className="font-['Outfit'] text-base font-bold text-white leading-snug line-clamp-1">
                      {p.name}
                    </p>
                    {p.location && (
                      <p className="text-xs text-white/60 mt-1 inline-flex items-center gap-1.5 max-w-full">
                        <MapPin className="w-3 h-3 text-[#d6b357] shrink-0" />
                        <span className="truncate">{p.location}</span>
                      </p>
                    )}
                    <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-[#d6b357]">
                        {p.priceLabel ?? "Price on request"}
                      </span>
                      <ArrowRight className="w-4 h-4 text-white/60 group-hover:text-[#d6b357] group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </>
              )
              const cardCls = `group absolute left-1/2 top-1/2 w-[290px] -ml-[145px] -mt-[150px] bg-[#0a1f38]/95 border overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.45)] transition-all duration-[900ms] ease-in-out ${
                hidden
                  ? "opacity-0 pointer-events-none z-0"
                  : off === 0
                    ? "z-20 border-white/15 hover:border-[#d6b357]/70"
                    : "z-10 opacity-75 border-white/10"
              }`
              // ALWAYS the same element, whatever the position — swapping the
              // tag between positions would remount the node and kill the
              // glide. A bent neighbour intercepts the click and rotates to
              // the front instead of navigating.
              return (
                <Link
                  key={p.slug ?? i}
                  href={p.slug ? `/projects/${p.slug}` : "/projects"}
                  onClick={(e) => {
                    if (off !== 0) {
                      e.preventDefault()
                      setSpot(i)
                    }
                  }}
                  aria-label={off === 0 ? undefined : `Show ${p.name}`}
                  tabIndex={hidden ? -1 : 0}
                  className={cardCls}
                  style={{ transform, transformStyle: "preserve-3d" }}
                >
                  {inner}
                </Link>
              )
            })}
            </div>

            {/* Dots */}
            {spotlight.length > 1 && (
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
                {spotlight.map((p, i) => (
                  <button
                    key={p.slug ?? i}
                    type="button"
                    onClick={() => setSpot(i)}
                    aria-label={`Featured project ${i + 1}`}
                    className={`h-2 w-2 rounded-full transition-colors ${
                      i === spot ? "bg-[#d6b357]" : "bg-white/30 hover:bg-white/60"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </section>
  )
}
