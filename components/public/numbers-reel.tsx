"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ArrowUpRight } from "lucide-react"
import { UAE_EMIRATES, UAE_VIEWBOX } from "@/lib/uae-emirates"

/** What stands behind a figure: the evidence for it. */
export type ReelBackdrop =
  | { kind: "photo"; src: string; alt: string }
  /** A drifting wall of real images: project renders, agent portraits. */
  | { kind: "mosaic"; images: { src: string; alt: string }[]; shape?: "landscape" | "square" | "portrait" }
  /** A drifting wall of logos on their own tiles. */
  | { kind: "logos"; logos: { src: string; alt: string; bg?: string | null }[] }
  /** The emirates, lit by count. */
  | { kind: "map"; counts: Record<string, number> }

export type ReelItem = {
  value: number
  label: string
  note: string
  href?: string
  backdrop: ReelBackdrop
  /** Set the figure in gold (for the one that is a promise, not a count). */
  accent?: boolean
}

/**
 * A documentary statistics sequence. A zone several viewports tall pins a
 * full-screen stage; scrolling through it moves from one figure to the next.
 * Each figure fills the screen in huge type over the evidence for it: a
 * drifting wall of the real project renders, the real developer logos, the
 * emirates lit by count, the agents' own portraits. The figure counts up as
 * its slide arrives. A rail of chapters on the left tracks the position and
 * jumps on click; a gold line along the bottom fills with progress.
 *
 * Progress is written on an animation frame to CSS variables and to the
 * number text; React state changes only when the active slide changes.
 * Reduced-motion readers get the slides stacked and every figure complete.
 */
/** Cycle a short list until the wall has enough tiles to cover the stage. */
function fill<T>(list: T[], min: number): T[] {
  if (list.length === 0) return list
  const out: T[] = []
  while (out.length < min) out.push(...list)
  return out
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 4)
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const fmt = (n: number) => Math.round(n).toLocaleString("en-US")

function Backdrop({ b, active, first }: { b: ReelBackdrop; active: boolean; first: boolean }) {
  if (b.kind === "photo") {
    return (
      <div className="nr-slide-img absolute inset-0">
        <Image src={b.src} alt={b.alt} fill sizes="100vw" className="object-cover object-center" priority={first} />
      </div>
    )
  }
  if (b.kind === "map") {
    const max = Math.max(1, ...Object.values(b.counts))
    return (
      <div className="nr-slide-img absolute inset-0">
        <svg viewBox={UAE_VIEWBOX} preserveAspectRatio="xMidYMid slice" className="absolute inset-y-0 right-0 h-full w-full lg:left-[22%] lg:w-auto" aria-hidden="true">
          <defs>
            <filter id="nr-map-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" />
            </filter>
          </defs>
          {UAE_EMIRATES.map((p) => {
            const c = b.counts[p.code] ?? 0
            const lit = c > 0
            const o = lit ? 0.22 + 0.65 * Math.pow(c / max, 0.6) : 0.05
            return (
              <g key={p.code}>
                {lit && <path d={p.d} fill="#d6b357" fillOpacity={o * 0.8} filter="url(#nr-map-glow)" />}
                <path d={p.d} fill="#d6b357" fillOpacity={o} stroke="#f0d89b" strokeOpacity={lit ? 0.9 : 0.35} strokeWidth={1.2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </g>
            )
          })}
        </svg>
      </div>
    )
  }
  if (b.kind === "logos") {
    return (
      <div className={`nr-wall absolute inset-0 ${active ? "nr-wall--on" : ""}`}>
        <div className="nr-wall-grid grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          {fill(b.logos, 56).map((l, i) => (
            <div key={`${l.src}-${i}`} className="flex aspect-[4/3] items-center justify-center bg-white p-4" style={l.bg ? { backgroundColor: l.bg } : undefined}>
              <Image src={l.src} alt={l.alt} width={160} height={80} unoptimized={l.src.toLowerCase().includes(".svg")} className="max-h-[70%] w-auto max-w-[80%] object-contain" />
            </div>
          ))}
        </div>
      </div>
    )
  }
  const shape = b.shape ?? "landscape"
  const cols = shape === "square" ? "grid-cols-5 sm:grid-cols-7 lg:grid-cols-9" : shape === "portrait" ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6" : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6"
  const ratio = shape === "square" ? "aspect-square" : shape === "portrait" ? "aspect-[3/4]" : "aspect-[4/3]"
  const min = shape === "square" ? 72 : shape === "portrait" ? 30 : 42
  return (
    <div className={`nr-wall absolute inset-0 ${active ? "nr-wall--on" : ""}`}>
      <div className={`nr-wall-grid grid gap-2 ${cols}`}>
        {fill(b.images, min).map((im, i) => (
          <div key={`${im.src}-${i}`} className={`relative overflow-hidden bg-[#0a1f38] ${ratio}`}>
            <Image src={im.src} alt={im.alt} fill sizes={shape === "square" ? "160px" : "260px"} className="object-cover" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function NumbersReel({
  items,
  numeral,
  kicker,
  title,
  intro,
}: {
  items: ReelItem[]
  numeral: string
  kicker: string
  title: React.ReactNode
  intro: string
}) {
  const zoneRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const numRefs = useRef<(HTMLElement | null)[]>([])
  const activeRef = useRef(0)
  const [active, setActive] = useState(0)
  const n = items.length

  useEffect(() => {
    const zone = zoneRef.current
    const stage = stageRef.current
    if (!zone || !stage) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      zone.dataset.static = "true"
      items.forEach((it, i) => {
        const el = numRefs.current[i]
        if (el) el.textContent = fmt(it.value)
      })
      return
    }
    let raf = 0
    let on = true
    const update = () => {
      raf = 0
      const r = zone.getBoundingClientRect()
      const travel = Math.max(1, r.height - window.innerHeight)
      const p = clamp01(-r.top / travel)
      const pos = p * n
      const idx = Math.min(n - 1, Math.floor(pos))
      const local = pos - idx
      stage.style.setProperty("--p", p.toFixed(4))
      // The count runs over the first 55% of a slide's dwell, then holds.
      for (let i = 0; i < n; i++) {
        const el = numRefs.current[i]
        if (!el) continue
        const v = i < idx ? items[i].value : i > idx ? 0 : items[i].value * easeOut(clamp01(local / 0.55))
        el.textContent = fmt(v)
      }
      if (idx !== activeRef.current) {
        activeRef.current = idx
        setActive(idx)
      }
    }
    const onScroll = () => {
      if (!on || raf) return
      raf = requestAnimationFrame(update)
    }
    const io = new IntersectionObserver(([e]) => {
      on = e.isIntersecting
      if (on) onScroll()
    }, { rootMargin: "20% 0px 20% 0px" })
    io.observe(zone)
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    update()
    return () => {
      io.disconnect()
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [items, n])

  const jumpTo = (i: number) => {
    const zone = zoneRef.current
    if (!zone) return
    const top = zone.getBoundingClientRect().top + window.scrollY
    const travel = zone.offsetHeight - window.innerHeight
    // Land a third of the way into the slide, where the count has settled.
    window.scrollTo({ top: top + ((i + 0.34) / n) * travel, behavior: "smooth" })
  }

  return (
    <div ref={zoneRef} className="nr relative" style={{ height: `calc(${n} * 70vh + 100vh)`, ["--n" as string]: n }}>
      <noscript>
        <style>{`.nr { height: auto !important; } .nr-stage { position: static !important; height: auto !important; } .nr-slide { position: static !important; opacity: 1 !important; transform: none !important; min-height: 70vh; } .nr-rail { display: none !important; }`}</style>
      </noscript>

      <div ref={stageRef} className="nr-stage sticky top-0 h-screen overflow-hidden bg-[#06182e] text-white">
        {/* Slides: the evidence, the scrim, and the figure */}
        {items.map((it, i) => {
          const state = i === active ? "active" : i < active ? "past" : "next"
          const wall = it.backdrop.kind !== "photo"
          return (
            <div key={it.label} className="nr-slide absolute inset-0" data-state={state} aria-hidden={i !== active}>
              <Backdrop b={it.backdrop} active={i === active} first={i === 0} />
              <div className={`absolute inset-0 bg-gradient-to-r ${wall ? "from-[#06182e]/97 via-[#06182e]/80 to-[#06182e]/45" : "from-[#06182e]/95 via-[#06182e]/70 to-[#06182e]/35"}`} aria-hidden="true" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#06182e] via-[#06182e]/20 to-[#06182e]/60" aria-hidden="true" />

              <div className="relative mx-auto flex h-full max-w-[1440px] flex-col justify-center px-4 sm:px-6 lg:px-8 lg:pl-[26rem]">
                <p className="nr-figure font-['Outfit'] text-[clamp(96px,22vw,260px)] font-bold leading-[0.9] tracking-[-0.04em]">
                  <span ref={(el) => { numRefs.current[i] = el }} className={it.accent ? "text-[#d6b357]" : "text-white"}>
                    {fmt(it.value)}
                  </span>
                </p>
                <p className="nr-label mt-4 font-['Outfit'] text-[28px] font-bold leading-tight sm:text-[40px]">{it.label}</p>
                <p className="nr-note mt-3 max-w-md text-[16px] leading-relaxed text-white/75 sm:text-[18px]">{it.note}</p>
                {it.href && (
                  <Link
                    href={it.href}
                    tabIndex={i === active ? 0 : -1}
                    className="nr-link group mt-6 inline-flex w-fit items-center gap-2 border border-white/30 px-5 py-3 text-[14px] font-bold text-white transition-colors hover:border-[#d6b357] hover:text-[#f0d89b]"
                  >
                    See them
                    <ArrowUpRight className="h-4 w-4 text-[#d6b357] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </Link>
                )}
              </div>
            </div>
          )
        })}

        {/* Film grain and vignette */}
        <div className="nr-grain pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_50%,transparent_55%,rgba(0,0,0,0.45)_100%)]" aria-hidden="true" />

        {/* Rail: chapter head + the list of figures */}
        <div className="nr-rail absolute inset-x-0 top-0 mx-auto max-w-[1440px] px-4 pt-24 sm:px-6 lg:px-8 lg:pt-28">
          <p className="inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[#d6b357]">
            <span className="font-['Outfit'] text-[13px] tracking-normal">{numeral}</span>
            <span className="h-px w-8 bg-[#d6b357]" aria-hidden="true" />
            {kicker}
          </p>
          <h2 className="mt-3 max-w-sm font-['Outfit'] text-[26px] font-bold leading-[1.08] tracking-tight sm:text-[32px]">{title}</h2>
          <p className="mt-3 hidden max-w-xs text-[13px] leading-relaxed text-white/60 lg:block">{intro}</p>

          <ol className="mt-8 hidden flex-col gap-1 lg:flex">
            {items.map((it, i) => (
              <li key={it.label}>
                <button
                  type="button"
                  onClick={() => jumpTo(i)}
                  aria-current={i === active ? "step" : undefined}
                  className={`nr-dot group flex items-center gap-3 py-1.5 text-left text-[13px] font-semibold transition-colors ${i === active ? "text-white" : "text-white/45 hover:text-white/80"}`}
                >
                  <span className={`block h-px transition-all duration-500 ${i === active ? "w-8 bg-[#d6b357]" : "w-4 bg-white/30 group-hover:bg-white/60"}`} aria-hidden="true" />
                  <span className="font-['Outfit'] tabular-nums text-[#d6b357]/80">{String(i + 1).padStart(2, "0")}</span>
                  {it.label}
                </button>
              </li>
            ))}
          </ol>
        </div>

        {/* Counter and progress along the bottom */}
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto flex max-w-[1440px] items-end justify-between px-4 pb-5 sm:px-6 lg:px-8">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/55">Keep scrolling</span>
            <span className="font-['Outfit'] text-[13px] font-bold tabular-nums text-[#d6b357]">
              {String(active + 1).padStart(2, "0")} <span className="text-white/40">/ {String(n).padStart(2, "0")}</span>
            </span>
          </div>
          <div className="h-[2px] w-full bg-white/10">
            <span className="nr-progress block h-full bg-[#d6b357]" />
          </div>
        </div>
      </div>
    </div>
  )
}
