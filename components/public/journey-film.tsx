"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"

export type FilmStep = {
  title: string
  body: string
  image: string
  imageAlt: string
}

/**
 * The buying journey as a filmstrip. On wide screens a zone several viewports
 * tall pins a full-screen stage and the strip of photographs pans left as the
 * reader scrolls down, one step at a time, with a running "03 / 05" counter
 * and a gold progress line. Each frame is one of the team's own photographs
 * with the step written over its lower third. Below the lg breakpoint the
 * frames simply stack, no pinning.
 *
 * Progress is written on an animation frame to the track's transform and a
 * CSS variable; React state changes only when the nearest frame changes.
 */
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

export function JourneyFilm({
  steps,
  numeral,
  kicker,
  title,
}: {
  steps: FilmStep[]
  numeral: string
  kicker: string
  title: React.ReactNode
}) {
  const zoneRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef(0)
  const [active, setActive] = useState(0)
  const n = steps.length

  useEffect(() => {
    const zone = zoneRef.current
    const stage = stageRef.current
    const track = trackRef.current
    if (!zone || !stage || !track) return
    const desktop = window.matchMedia("(min-width: 1024px)")
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
    let raf = 0
    let on = true
    const update = () => {
      raf = 0
      if (!desktop.matches) {
        track.style.transform = ""
        return
      }
      const r = zone.getBoundingClientRect()
      const travel = Math.max(1, r.height - window.innerHeight)
      const p = clamp01(-r.top / travel)
      const maxX = Math.max(0, track.scrollWidth - stage.clientWidth)
      track.style.transform = reduce.matches ? "" : `translate3d(${(-p * maxX).toFixed(1)}px, 0, 0)`
      stage.style.setProperty("--p", p.toFixed(4))
      const idx = Math.min(n - 1, Math.round(p * (n - 1)))
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
    desktop.addEventListener("change", onScroll)
    update()
    return () => {
      io.disconnect()
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      desktop.removeEventListener("change", onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [n])

  return (
    <div ref={zoneRef} className="jf relative bg-[#030d1c] text-white" style={{ ["--n" as string]: n }}>
      <div ref={stageRef} className="jf-stage relative overflow-hidden">
        {/* Header: chapter head left, running counter right */}
        <div className="relative z-10 mx-auto flex max-w-[1440px] items-start justify-between gap-6 px-4 pt-14 sm:px-6 lg:px-8 lg:pt-28">
          <div>
            <p className="inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[#d6b357]">
              <span className="font-['Outfit'] text-[13px] tracking-normal">{numeral}</span>
              <span className="h-px w-8 bg-[#d6b357]" aria-hidden="true" />
              {kicker}
            </p>
            <h2 className="mt-3 font-['Outfit'] text-[30px] font-bold leading-[1.06] tracking-tight sm:text-[40px]">{title}</h2>
          </div>
          <p className="hidden shrink-0 font-['Outfit'] text-[64px] font-bold leading-none tabular-nums text-white/90 lg:block" aria-live="polite">
            {String(active + 1).padStart(2, "0")}
            <span className="text-[28px] text-white/35"> / {String(n).padStart(2, "0")}</span>
          </p>
        </div>

        {/* Progress line (desktop) */}
        <div className="relative z-10 mx-auto mt-6 hidden max-w-[1440px] px-4 sm:px-6 lg:block lg:px-8">
          <div className="h-px w-full bg-white/15">
            <span className="jf-progress block h-full bg-[#d6b357]" />
          </div>
        </div>

        {/* The strip */}
        <div className="jf-viewport relative mt-8 lg:mt-10">
          <div ref={trackRef} className="jf-track">
            {steps.map((s, i) => {
              const state = i === active ? "active" : "idle"
              return (
                <article key={s.title} className="jf-frame group relative overflow-hidden" data-state={state} style={{ ["--i" as string]: i }}>
                  <div className="jf-frame-img absolute inset-0">
                    <Image src={s.image} alt={s.imageAlt} fill sizes="(min-width: 1024px) 62vw, 100vw" className="object-cover object-center" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#030d1c] via-[#030d1c]/40 to-transparent" aria-hidden="true" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#030d1c]/40 to-transparent" aria-hidden="true" />
                  <span className="jf-frame-num absolute right-6 top-6 font-['Outfit'] text-[72px] font-bold leading-none text-white/15 sm:text-[96px]" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 lg:p-10">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6b357]">Step {i + 1}</p>
                    <h3 className="mt-2 font-['Outfit'] text-[34px] font-bold leading-none tracking-tight sm:text-[48px]">{s.title}</h3>
                    <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/80 sm:text-[17px]">{s.body}</p>
                  </div>
                  <span className="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-[#d6b357] jf-frame-bar" aria-hidden="true" />
                </article>
              )
            })}
            {/* End card so the last frame can centre on wide screens */}
            <div className="jf-end hidden shrink-0 lg:block" aria-hidden="true" />
          </div>
        </div>

        <div className="jf-grain pointer-events-none absolute inset-0" aria-hidden="true" />
      </div>
    </div>
  )
}
