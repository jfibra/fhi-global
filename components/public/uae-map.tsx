"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ArrowUpRight } from "lucide-react"
import { EMIRATES } from "@/lib/emirates"
import { UaeRelief, UAE_RELIEF_ASPECT } from "@/components/public/uae-relief"
import { InView } from "@/components/public/in-view"
import { CountUp } from "@/components/public/count-up"

/**
 * "Where we build": the UAE as a tilted 3D relief.
 *
 * A navy slab of the country sits on a receding dot-grid floor. Each emirate
 * with live projects rises out of the slab as a gold block whose height
 * follows its project count, so Dubai stands tallest. The relief is built
 * from stacked SVG layers in a CSS preserve-3d context: a few dark layers
 * make the slab's thickness, and each block is its own stack of gold-brown
 * layers under a lit top face that carries the label. Hovering a list row or
 * a block lifts that emirate further; the model tilts a few degrees toward
 * the pointer and floats slowly.
 *
 * Counts arrive from the page (counted from published rows by
 * `countByEmirate`), so the map never shows a figure the catalogue does not
 * hold. Boundaries: Natural Earth 10m admin-1 (public domain).
 */

export function UaeMap({
  counts,
  eyebrow = "Where we build",
  titleTop = "Projects across",
  intro,
  linkParams,
  hrefOverrides,
  hideEmpty = false,
}: {
  counts: Record<string, number>
  /** Small gold label above the heading. */
  eyebrow?: string
  /** First line of the heading; the second is always "N emirates." */
  titleTop?: string
  /** Paragraph under the heading; the default explains the site-wide count. */
  intro?: string
  /** Extra query parameters for each emirate row's link, e.g. { developer: id };
   *  the row always adds its own `city`. Plain data, since this is a client component. */
  linkParams?: Record<string, string>
  /** Send an emirate to a page of its own instead of the filtered catalogue, keyed by
   *  the emirate's cityParam ("Dubai"). The filtered /projects?city= view is kept out
   *  of the index, so linking the home page's map there spent its link weight on a
   *  page that cannot rank; the landing pages can. Plain data (client component). */
  hrefOverrides?: Record<string, string>
  /** Leave emirates with no projects out of the list (the map still draws them). */
  hideEmpty?: boolean
}) {
  const hrefFor = (cityParam: string) =>
    hrefOverrides?.[cityParam] ?? `/projects?${new URLSearchParams({ ...(linkParams ?? {}), city: cityParam }).toString()}`
  const [active, setActive] = useState<string | null>(null)
  // The relief (about 40 stacked SVG planes) is built only once its column is within a viewport of the
  // screen; until then a placeholder of the same shape keeps its place. The copy, the counts and the
  // emirate link list above stay in the server HTML either way.
  const [near, setNear] = useState(false)
  const reliefBoxRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = reliefBoxRef.current
    if (!box) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true)
          io.disconnect()
        }
      },
      // A full viewport early: CSS transitions do not run for elements first rendered while [data-in="true"]
      // already applies, so the entrance only plays if the relief mounts before the section's own InView fires.
      { rootMargin: "100% 0px" },
    )
    io.observe(box)
    return () => io.disconnect()
  }, [])

  const max = Math.max(1, ...Object.values(counts))
  const lit = EMIRATES.filter((e) => (counts[e.code] ?? 0) > 0)
  const rows = [...EMIRATES]
    .filter((e) => !hideEmpty || (counts[e.code] ?? 0) > 0)
    .sort((a, b) => (counts[b.code] ?? 0) - (counts[a.code] ?? 0))
  const total = Object.values(counts).reduce((n, c) => n + c, 0)

  return (
    <section className="um wf relative overflow-hidden py-24 text-white lg:py-28">
      <noscript>
        <style>{`.um [class*="um-"], .um [class*="wf-"], .um .um-em svg { opacity: 1 !important; stroke-dashoffset: 0 !important; } .um .um-em { transform: translateZ(var(--h)) !important; } .um .um-ph { display: none !important; }`}</style>
      </noscript>

      {/* Background: deep navy falling to near-black, a gold light behind the
          model, and a faint vignette so the relief reads as lit from above. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#08213f_0%,#06182e_45%,#030d1c_100%)]" />
        <div className="absolute right-[-10%] top-[10%] h-[80%] w-[70%] bg-[radial-gradient(closest-side,rgba(214,179,87,0.16),rgba(214,179,87,0.04)_55%,rgba(214,179,87,0)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_100%,rgba(0,0,0,0.35),transparent_60%)]" />
      </div>

      <InView className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" threshold={0.2}>
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-12 lg:gap-8">
          {/* ── Copy and the list ─────────────────────────────────── */}
          <div className="lg:col-span-5">
            <p className="wf-fade inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#d6b357]">
              <span className="h-[3px] w-6 bg-[#d6b357]" aria-hidden="true" />
              {eyebrow}
            </p>
            <h2 className="mt-5 font-['Outfit'] text-[38px] font-bold leading-[1.05] tracking-tight sm:text-[48px]">
              <span className="wf-word block"><span style={{ ["--i" as string]: 0 }}>{titleTop}</span></span>{" "}
              <span className="wf-word block"><span style={{ ["--i" as string]: 1 }} className="wf-gold">{lit.length} {lit.length === 1 ? "emirate" : "emirates"}.</span></span>
            </h2>
            <p className="wf-fade mt-6 max-w-md text-[15px] leading-relaxed text-white/70" style={{ ["--d" as string]: "500ms" }}>
              {intro ?? `${total.toLocaleString("en-US")} live projects, counted from the listings published on this site. The taller the block, the more we have selling there. Choose an emirate to see them.`}
            </p>

            <ul className="mt-10 border-t border-white/10">
              {rows.map((e, i) => {
                const count = counts[e.code] ?? 0
                const isActive = active === e.code
                const inner = (
                  <>
                    <span className="flex min-w-0 items-center gap-4">
                      <span className={`h-2 w-2 shrink-0 rounded-full transition-colors ${count > 0 ? "bg-[#d6b357]" : "bg-white/20"}`} aria-hidden="true" />
                      <span className={`truncate font-['Outfit'] text-[17px] font-bold transition-colors ${count > 0 ? "text-white" : "text-white/40"} ${isActive ? "text-[#e3c06c]" : ""}`}>
                        {e.name}
                      </span>
                    </span>
                    <span className="flex items-center gap-4">
                      <span className="hidden h-1 w-24 overflow-hidden bg-white/10 sm:block" aria-hidden="true">
                        <span className="um-bar block h-full bg-[#d6b357]" style={{ ["--w" as string]: `${Math.round((count / max) * 100)}%`, ["--d" as string]: `${900 + i * 90}ms` }} />
                      </span>
                      <span className={`w-12 text-right font-['Outfit'] text-[17px] font-bold tabular-nums ${count > 0 ? "text-[#d6b357]" : "text-white/30"}`}>
                        {count > 0 ? <CountUp value={count} delay={900 + i * 90} duration={1200} /> : "0"}
                      </span>
                      <ArrowUpRight className={`h-4 w-4 transition-all ${count > 0 ? "text-[#d6b357]" : "text-transparent"} ${isActive ? "translate-x-0.5 -translate-y-0.5" : ""}`} aria-hidden="true" />
                    </span>
                  </>
                )
                const cls = "wf-fade flex items-center justify-between gap-6 border-b border-white/10 py-3.5"
                const style = { ["--d" as string]: `${700 + i * 90}ms` }
                return (
                  <li key={e.code} onMouseEnter={() => setActive(e.code)} onMouseLeave={() => setActive(null)}>
                    {count > 0 ? (
                      <Link href={hrefFor(e.cityParam)} rel={hrefOverrides?.[e.cityParam] ? undefined : "nofollow"} className={`${cls} group`} style={style} onFocus={() => setActive(e.code)} onBlur={() => setActive(null)}>
                        {inner}
                      </Link>
                    ) : (
                      <div className={cls} style={style}>{inner}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>

          {/* ── The relief ────────────────────────────────────────── */}
          <div ref={reliefBoxRef} className="lg:col-span-7">
            {near ? (
              <UaeRelief counts={counts} active={active} onActive={setActive} />
            ) : (
              <div className="um-ph relative mx-auto w-full max-w-[860px]" style={{ aspectRatio: UAE_RELIEF_ASPECT }} aria-hidden="true" />
            )}
            <p className="wf-fade mt-6 text-right text-[11px] uppercase tracking-[0.16em] text-white/40" style={{ ["--d" as string]: "2200ms" }}>
              Block height = live projects · boundaries: Natural Earth
            </p>
          </div>
        </div>
      </InView>
    </section>
  )
}
