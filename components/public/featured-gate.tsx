"use client"

import Image from "next/image"
import { useEffect, useRef } from "react"

/**
 * The doors in front of Featured Projects.
 *
 * A zone twice the viewport tall pins a full-screen stage while the reader
 * scrolls through it. The stage shows the skyline with the section's title
 * over it, covered by two navy doors that carry the words "Featured
 * Projects" split down the middle. Scroll progress through the zone drives
 * everything: the doors swing open on hinges at the viewport edges, the
 * skyline settles out of a zoom, and the title beneath rises into place. Once the doors are fully open the
 * stage unpins and the cards follow.
 *
 * Progress is written to CSS custom properties on an animation frame, so
 * there is no React state and nothing re-renders while scrolling. Scrolling
 * is never hijacked: the page moves exactly as far as the finger or wheel
 * says. Reduced-motion readers get the open scene at viewport height with
 * no doors, and without scripts the doors are hidden and the title shows.
 */

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

type WallImage = { src: string; alt: string }

/** Cycle a short list until the collage has enough tiles to cover the door. */
function fillWall(list: WallImage[], min: number): WallImage[] {
  if (list.length === 0) return list
  const out: WallImage[] = []
  while (out.length < min) out.push(...list)
  return out.slice(0, Math.max(min, list.length))
}

export function FeaturedGate({ count, images = [] }: { count: number; images?: WallImage[] }) {
  const zoneRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const zone = zoneRef.current
    const stage = stageRef.current
    if (!zone || !stage) return

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      zone.style.height = "100vh"
      stage.style.setProperty("--d", "1")
      stage.style.setProperty("--s", "1")
      stage.dataset.open = "true"
      return
    }

    let raf = 0
    let active = true
    const update = () => {
      raf = 0
      const r = zone.getBoundingClientRect()
      const travel = Math.max(1, r.height - window.innerHeight)
      const p = clamp01(-r.top / travel)
      // Doors: a short hold, then open across the middle of the travel.
      const d = easeInOut(clamp01((p - 0.06) / 0.7))
      // Title on the scene: rises once the doors are a third of the way open.
      const s = easeInOut(clamp01((p - 0.3) / 0.4))
      stage.style.setProperty("--p", p.toFixed(4))
      stage.style.setProperty("--d", d.toFixed(4))
      stage.style.setProperty("--s", s.toFixed(4))
      stage.dataset.open = d >= 0.999 ? "true" : "false"
    }
    const onScroll = () => {
      if (!active || raf) return
      raf = requestAnimationFrame(update)
    }
    const io = new IntersectionObserver(([e]) => {
      active = e.isIntersecting
      if (active) onScroll()
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
  }, [])

  const label = `${count} hand-picked ${count === 1 ? "development" : "developments"}`
  const wall = fillWall(images, 42)

  return (
    <div ref={zoneRef} className="gate relative h-[170vh] lg:h-[200vh]">
      <noscript>
        <style>{`.gate-doors { display: none !important; } .gate-title { opacity: 1 !important; transform: none !important; }`}</style>
      </noscript>

      <div ref={stageRef} className="gate-stage sticky top-0 h-screen overflow-hidden bg-[#06182e] text-white" data-open="false">
        {/* ── Scene behind the doors ─────────────────────────────── */}
        <div className="absolute inset-0" aria-hidden="true">
          <div className="gate-scene-img absolute inset-0 will-change-transform">
            <Image src="/background/home.webp" alt="" fill sizes="100vw" className="object-cover object-center" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-[#06182e]/70 via-[#06182e]/25 to-[#06182e]/80" />
        </div>

        <div className="gate-title relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          <p className="inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.3em] text-[#f0d89b]">
            <span className="h-px w-10 bg-[#d6b357]" aria-hidden="true" />
            Hand-picked selection
            <span className="h-px w-10 bg-[#d6b357]" aria-hidden="true" />
          </p>
          <h2 className="mt-6 font-['Outfit'] text-[40px] font-bold leading-[1.04] tracking-tight drop-shadow-[0_2px_16px_rgba(0,10,30,0.55)] sm:text-[56px] lg:text-[68px]">
            <span className="block text-white">Featured Off-Plan</span>
            <span className="block text-[#e3c06c]">Projects in Dubai</span>
          </h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
            {label}, chosen by our team for quality, location and returns.
          </p>
          <span className="gate-cue mt-12 flex flex-col items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white/60" aria-hidden="true">
            Keep scrolling
            <span className="gate-cue-line block h-10 w-px bg-white/40" />
          </span>
        </div>

        {/* ── Doors ──────────────────────────────────────────────── */}
        {/* Two panelled doors on hinges at the viewport edges. Each carries the
            full title clipped to its half, so the words split as they swing.
            Surface, lattice and frame are CSS (.gate-door in globals.css). */}
        {/* Every layer inside a leaf is twice the leaf's width and offset so
            the two halves line up with the stage exactly (the old 100vw
            sizing included the scrollbar and split the words a few pixels
            off). Closed, the leaves read as one wall of real project renders
            under the title; open, the wall splits with them. */}
        <div className="gate-doors absolute inset-0 z-20" aria-hidden="true">
          {(["l", "r"] as const).map((side) => (
            <div key={side} className={`gate-door gate-door--${side} absolute inset-y-0 ${side === "l" ? "left-0" : "right-0"} w-1/2 overflow-hidden`}>
              {wall.length > 0 && (
                <div className={`gate-wall absolute inset-y-0 w-[200%] ${side === "l" ? "left-0" : "-left-full"}`}>
                  <div className="gate-wall-grid grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-7">
                    {wall.map((im, i) => (
                      <div key={`${side}-${i}`} className="relative aspect-[4/3] overflow-hidden bg-[#0a1f38]">
                        <Image src={im.src} alt="" fill sizes="(min-width: 1024px) 15vw, 25vw" className="object-cover" />
                      </div>
                    ))}
                  </div>
                  <div className="gate-wall-scrim absolute inset-0" />
                </div>
              )}
              <div className={`gate-door-text absolute top-1/2 z-[3] w-[200%] -translate-y-1/2 px-6 text-center ${side === "l" ? "left-0" : "-left-full"}`}>
                <DoorWords label={label} />
              </div>
            </div>
          ))}
          <div className="gate-hint absolute inset-x-0 bottom-8 z-30 flex flex-col items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6b357]">
            Scroll to open
            <span className="gate-cue-line block h-10 w-px bg-[#d6b357]/60" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** The words on the doors — identical in both halves so they split cleanly. */
function DoorWords({ label }: { label: string }) {
  return (
    <>
      <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#d6b357]">Hand-picked selection</p>
      <p className="mt-5 font-['Outfit'] text-[15vw] font-bold leading-[0.92] tracking-[-0.03em] text-white sm:text-[11vw] lg:text-[9.5vw]">
        Featured <span className="text-[#d6b357]">Projects</span>
      </p>
      <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-white/55">{label}</p>
    </>
  )
}
