"use client"

import { useEffect, useRef } from "react"
import Image from "next/image"
import { ArrowUpRight } from "lucide-react"
import { TransitionLink } from "@/components/public/transition-link"

export interface DeveloperTileItem {
  id: string
  name: string
  slug: string
  logo_url?: string | null
  logo_bg?: string | null
  /** Live, published projects by this developer, counted by the page. */
  projectCount?: number
}

/**
 * The "Trusted Developers" strip as a slow, seamless marquee of logo tiles.
 *
 * Tiles flip in from the left one after another when the section enters
 * (CSS `.dv-tile`, fired by the enclosing InView), then the track drifts
 * left forever and pauses while hovered or focused. A hovered tile lifts,
 * tilts a few degrees toward the pointer and slides up a navy bar with the
 * developer's live project count. Clicking a tile carries its logo into the
 * developer page's logo box through a view transition.
 *
 * The list is rendered twice for the loop; the second copy is hidden from
 * assistive tech and the tab order.
 */
export function DeveloperMarquee({ developers }: { developers: DeveloperTileItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null)

  // One delegated pointer handler tilts whichever tile is under the cursor.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    if (!window.matchMedia("(pointer: fine)").matches) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let raf = 0
    let target: HTMLElement | null = null
    let tx = 0
    let ty = 0
    const apply = () => {
      raf = 0
      if (!target) return
      target.style.setProperty("--tx", tx.toFixed(2))
      target.style.setProperty("--ty", ty.toFixed(2))
    }
    const onMove = (e: PointerEvent) => {
      const tile = (e.target as HTMLElement).closest<HTMLElement>(".dv-tile-in")
      if (tile !== target && target) {
        target.style.setProperty("--tx", "0")
        target.style.setProperty("--ty", "0")
      }
      target = tile
      if (!tile) return
      const r = tile.getBoundingClientRect()
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2
      if (!raf) raf = requestAnimationFrame(apply)
    }
    const onLeave = () => {
      if (target) {
        target.style.setProperty("--tx", "0")
        target.style.setProperty("--ty", "0")
      }
      target = null
    }
    track.addEventListener("pointermove", onMove)
    track.addEventListener("pointerleave", onLeave)
    return () => {
      track.removeEventListener("pointermove", onMove)
      track.removeEventListener("pointerleave", onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  if (developers.length === 0) return null

  // Roughly 3.4s per tile keeps the drift slow enough to read a logo.
  const duration = `${Math.max(24, developers.length * 3.4)}s`

  const renderTile = (dev: DeveloperTileItem, i: number, clone: boolean) => {
    const count = dev.projectCount ?? 0
    return (
      <TransitionLink
        key={`${clone ? "b" : "a"}-${dev.id}`}
        href={`/${dev.slug}`}
        name="developer-logo"
        className="dv-tile block shrink-0"
        style={{ ["--i" as string]: clone ? developers.length : i }}
        {...(clone ? { prefetch: false } : {})}
      >
        <span
          className="dv-tile-in group relative flex h-[172px] w-[232px] items-center justify-center overflow-hidden border border-[#e5e8ec] bg-white p-7 sm:w-[248px]"
          style={dev.logo_bg ? { backgroundColor: dev.logo_bg } : undefined}
          {...(clone ? { "aria-hidden": true, tabIndex: -1 } : {})}
        >
          <span data-vt-img className="relative flex h-full w-full items-center justify-center">
            {dev.logo_url ? (
              <Image
                src={dev.logo_url}
                // SVG bypasses the optimizer (which rejects it; upload route accepts SVG logos).
                unoptimized={dev.logo_url.toLowerCase().includes(".svg")}
                alt={clone ? "" : dev.name}
                width={160}
                height={160}
                className="max-h-[96px] w-full object-contain transition-transform duration-500 group-hover:scale-[1.06]"
              />
            ) : (
              <span className="text-center text-sm font-semibold uppercase tracking-widest text-[#4b5563]">{dev.name}</span>
            )}
          </span>
          {/* Gold line grows along the top on hover */}
          <span className="dv-tile-line absolute inset-x-0 top-0 h-[3px] bg-[#d6b357]" aria-hidden="true" />
          {/* Count bar slides up from the bottom */}
          <span className="dv-tile-bar absolute inset-x-0 bottom-0 flex items-center justify-between bg-[#001f3f] px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white">
            <span>{count > 0 ? `${count} live ${count === 1 ? "project" : "projects"}` : "View portfolio"}</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-[#d6b357]" aria-hidden="true" />
          </span>
        </span>
      </TransitionLink>
    )
  }

  return (
    <div className="dv-strip relative w-full overflow-hidden py-3" aria-label="Featured developer partners">
      <div ref={trackRef} className="dv-track flex gap-5" style={{ ["--dur" as string]: duration }}>
        {developers.map((d, i) => renderTile(d, i, false))}
        {developers.map((d, i) => renderTile(d, i, true))}
      </div>
    </div>
  )
}
