"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { MapPin, ArrowRight } from "lucide-react"
import { HeroSearch } from "@/components/public/hero-search"
import { IntroReveal } from "@/components/public/intro-reveal"

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
  /** Featured projects for the card deck (xl screens). */
  spotlight?: HeroSpotlight[]
  /** Quiet facts for the trust strip; the page supplies real counts. */
  facts?: string[]
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
const DECK_MS = 6000

/** A line of the headline, one masked word at a time. `start` offsets the
 *  stagger so the second line follows the first. */
function Words({ text, start, className }: { text: string; start: number; className?: string }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span key={`${w}-${i}`} className="wf-word mr-[0.24em]">
          <span style={{ ["--i" as string]: start + i }} className={className}>
            {w}
          </span>
        </span>
      ))}
    </>
  )
}

export function HeroSection({ popular = [], spotlight = [], facts = [] }: HeroSectionProps) {
  const rootRef = useRef<HTMLElement>(null)
  const [slide, setSlide] = useState(0)

  // The entrance waits for the curtain: IntroReveal calls this when it starts
  // to part (or at once when skipped), and the CSS keyed on data-in takes over.
  const open = useCallback(() => {
    rootRef.current?.setAttribute("data-in", "true")
  }, [])

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const slides = setInterval(() => setSlide((i) => (i + 1) % HERO_SLIDES.length), SLIDE_MS)
    return () => clearInterval(slides)
  }, [])

  return (
    // overflow-x-clip, NOT overflow-hidden: the search results panel has to
    // spill past the hero's bottom edge, and `hidden` on one axis forces a
    // scroll container on the other. z-20 keeps that spill painted above the
    // sections below. The ken-burns backdrop clips itself instead.
    <section ref={rootRef} className="hero wf relative z-20 min-h-[88vh] flex overflow-x-clip">
      <noscript>
        <style>{`.hero [class*="wf-"], .hero .wf-word > span, .hero [class*="hero-"] { opacity: 1 !important; transform: none !important; filter: none !important; }`}</style>
      </noscript>
      <IntroReveal onOpen={open} />

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
            bright and the deck keeps its contrast. */}
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
        {/* One diagonal sweep of light across the photo as the curtain parts. */}
        <div className="hero-sweep pointer-events-none absolute inset-0" aria-hidden="true" />
      </div>

      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-10 flex flex-col justify-center min-h-[88vh]">
        {/* ═══ Hero copy + search ═══ */}
        <div className="relative z-40 max-w-3xl">
          {/* Eyebrow — a rule that draws, then small caps */}
          <div className="mb-6 flex items-center gap-4">
            <span className="wf-rule h-px w-10 bg-[#d6b357]" aria-hidden="true" />
            <span className="wf-fade text-[11px] font-semibold uppercase tracking-[0.3em] text-[#f0d89b] drop-shadow-[0_1px_3px_rgba(0,8,20,0.95)]" style={{ ["--d" as string]: "250ms" }}>
              Dubai&apos;s Premier Real Estate Portal
            </span>
          </div>

          {/* Headline — light over bold, each word rising out of its mask */}
          <h1 className="font-['Outfit'] text-4xl sm:text-5xl lg:text-[3.4rem] xl:text-[3.9rem] leading-[1.06] mb-6 tracking-tight drop-shadow-[0_2px_16px_rgba(0,10,30,0.55)]">
            <span className="block font-light text-white">
              <Words text="Off-Plan & Ready" start={0} />
            </span>
            <span className="block font-bold text-[#e3c06c]">
              <Words text="Dubai Properties for Sale" start={3} className="wf-gold" />
            </span>
          </h1>

          <p
            className="wf-fade text-white/90 text-base sm:text-[17px] leading-relaxed mb-10 max-w-xl drop-shadow-[0_1px_4px_rgba(0,8,20,0.9)]"
            style={{ ["--d" as string]: "800ms" }}
          >
            Apartments, villas and penthouses from Dubai&apos;s most trusted
            developers, with prices, payment plans and handover dates upfront.
          </p>

          {/* ── Search — the omnibox. Live results from the catalog itself.
                 z-50 so the open results panel paints above everything. ── */}
          <div className="hero-search relative z-50 max-w-2xl xl:mt-12 xl:max-w-xl">
            <HeroSearch />
          </div>

          {/* Popular — the developers carrying the most live projects. */}
          {popular.length > 0 && (
            <div className="wf-fade mt-5 flex flex-wrap items-center gap-x-5 gap-y-2" style={{ ["--d" as string]: "1250ms" }}>
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

        {/* ═══ Trust strip — real counts, a hairline that draws, then the facts ═══ */}
        {facts.length > 0 && (
          <div className="relative z-30 mt-auto hidden md:block pt-5">
            <span className="wf-line absolute inset-x-0 top-0 h-px bg-white/25" style={{ ["--d" as string]: "1300ms" }} aria-hidden="true" />
            <div className="flex items-center gap-x-8 gap-y-3 flex-wrap">
              {facts.map((fact, i) => (
                <span key={fact} className="wf-fade flex items-center gap-8" style={{ ["--d" as string]: `${1450 + i * 110}ms` }}>
                  {i > 0 && <span className="hidden lg:block h-1 w-1 rounded-full bg-[#d6b357]/70" aria-hidden="true" />}
                  <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/85 drop-shadow-[0_1px_3px_rgba(0,8,20,0.95)]">
                    {fact}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Scroll cue — a gold line with a travelling dot */}
        <div className="wf-fade absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 md:flex" style={{ ["--d" as string]: "2000ms" }} aria-hidden="true">
          <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/55">Scroll</span>
          <span className="hero-cue relative block h-10 w-px bg-white/25"><span className="hero-cue-dot absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#d6b357]" /></span>
        </div>

        {/* ═══ Featured-project deck (wide screens) ═══ */}
        {spotlight.length > 0 && (
          <div className="wf-fade hidden xl:block absolute right-0 top-10 h-[460px] w-[540px]" style={{ ["--d" as string]: "900ms" }}>
            <Deck cards={spotlight} />
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * A fanned deck of the featured projects. The front card stands upright; the
 * two behind sit lower and further back, turned a few degrees like a hand of
 * cards. Every few seconds the front card lifts and flips away to the back
 * while the next one slides forward. The whole deck leans a little toward the
 * pointer. A card behind the front one can be clicked to bring it forward.
 */
function Deck({ cards }: { cards: HeroSpotlight[] }) {
  const [front, setFront] = useState(0)
  const [leaving, setLeaving] = useState<number | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const tiltRef = useRef<HTMLDivElement>(null)
  const n = cards.length

  const advance = useCallback(
    (to?: number) => {
      setFront((cur) => {
        const next = to ?? (cur + 1) % n
        if (next === cur) return cur
        setLeaving(cur)
        window.setTimeout(() => setLeaving(null), 900)
        return next
      })
    },
    [n],
  )

  useEffect(() => {
    if (n < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const id = setInterval(() => advance(), DECK_MS)
    return () => clearInterval(id)
  }, [n, advance])

  // Pointer lean, written to CSS variables on an animation frame.
  useEffect(() => {
    const stage = stageRef.current
    const tilt = tiltRef.current
    if (!stage || !tilt) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let raf = 0
    let mx = 0
    let my = 0
    const apply = () => {
      raf = 0
      tilt.style.setProperty("--mx", mx.toFixed(3))
      tilt.style.setProperty("--my", my.toFixed(3))
    }
    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect()
      mx = ((e.clientX - r.left) / r.width) * 2 - 1
      my = ((e.clientY - r.top) / r.height) * 2 - 1
      if (!raf) raf = requestAnimationFrame(apply)
    }
    const onLeave = () => {
      mx = 0
      my = 0
      if (!raf) raf = requestAnimationFrame(apply)
    }
    stage.addEventListener("pointermove", onMove)
    stage.addEventListener("pointerleave", onLeave)
    return () => {
      stage.removeEventListener("pointermove", onMove)
      stage.removeEventListener("pointerleave", onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div ref={stageRef} className="hero-deck absolute inset-0">
      {/* Soft gold light behind the deck */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(214,179,87,0.22),rgba(214,179,87,0))]" aria-hidden="true" />
      <div ref={tiltRef} className="hero-deck-tilt absolute inset-0">
        {cards.map((p, i) => {
          const k = (i - front + n) % n // 0 = front, 1 and 2 fanned behind
          const isLeaving = leaving === i
          const pos = isLeaving ? "leaving" : k === 0 ? "front" : k === 1 ? "second" : k === 2 ? "third" : "hidden"
          return (
            <Link
              key={p.slug ?? i}
              href={p.slug ? `/projects/${p.slug}` : "/projects"}
              onClick={(e) => {
                if (k !== 0) {
                  e.preventDefault()
                  advance(i)
                }
              }}
              aria-label={k === 0 ? undefined : `Show ${p.name}`}
              tabIndex={pos === "hidden" || pos === "leaving" ? -1 : 0}
              className="hero-card group absolute left-1/2 top-1/2 w-[320px] -ml-[160px] -mt-[200px] overflow-hidden border border-white/15 bg-[#0a1f38]/95 shadow-[0_24px_70px_rgba(0,0,0,0.5)]"
              data-pos={pos}
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <Image src={p.image} alt={p.name} fill sizes="320px" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#06182e]/85 via-transparent to-transparent" />
                {p.statusLabel && (
                  <span className="absolute left-3 top-3 rounded-full bg-[#d6b357] px-3 py-1 text-[11px] font-bold text-[#001f3f] shadow-sm">
                    {p.statusLabel}
                  </span>
                )}
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#f0d89b]">Featured project</span>
                  <span className="font-['Outfit'] text-lg font-bold leading-none text-white">{p.priceLabel ?? "Price on request"}</span>
                </div>
              </div>
              <div className="p-4 text-left">
                <p className="font-['Outfit'] text-[17px] font-bold leading-snug text-white line-clamp-1">{p.name}</p>
                {p.location && (
                  <p className="mt-1.5 inline-flex max-w-full items-center gap-1.5 text-xs text-white/65">
                    <MapPin className="h-3 w-3 shrink-0 text-[#d6b357]" />
                    <span className="truncate">{p.location}</span>
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-[12px] font-bold text-white/70">
                  View project
                  <ArrowRight className="h-4 w-4 text-[#d6b357] transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Dots */}
      {n > 1 && (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-2">
          {cards.map((p, i) => (
            <button
              key={p.slug ?? i}
              type="button"
              onClick={() => advance(i)}
              aria-label={`Featured project ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === front ? "w-6 bg-[#d6b357]" : "w-1.5 bg-white/30 hover:bg-white/60"}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
