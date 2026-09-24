"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { ArrowUpRight, BadgeCheck, Building2 } from "lucide-react"
import { TransitionLink } from "@/components/public/transition-link"
import { InView } from "@/components/public/in-view"
import { sampleLogoBg } from "@/lib/logo-bg"

export type DirectoryDeveloper = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  logo_bg: string | null
  is_verified: boolean | null
  /** Live, published projects, counted by the page. */
  projectCount: number
  /** Emirates those projects stand in, most first. */
  emirates: string[]
}

/**
 * The /developers logo wall with the homepage marquee's tile treatment:
 * tiles flip in from the left as each row scrolls in; a hovered tile lifts,
 * tilts toward the pointer, grows a gold line along its top and slides up a
 * navy "Open portfolio" bar; the footer carries the live project count and
 * where those projects are. Clicking carries the logo panel into the
 * developer page's logo plate through a view transition.
 */
export function DeveloperDirectory({ developers }: { developers: DirectoryDeveloper[] }) {
  const gridRef = useRef<HTMLDivElement>(null)

  // One delegated pointer handler tilts whichever tile is under the cursor.
  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    if (!window.matchMedia("(pointer: fine)").matches) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let raf = 0
    let target: HTMLElement | null = null
    let tx = 0
    let ty = 0
    const reset = (el: HTMLElement | null) => {
      el?.style.setProperty("--tx", "0")
      el?.style.setProperty("--ty", "0")
    }
    const apply = () => {
      raf = 0
      if (!target) return
      target.style.setProperty("--tx", tx.toFixed(2))
      target.style.setProperty("--ty", ty.toFixed(2))
    }
    const onMove = (e: PointerEvent) => {
      const tile = (e.target as HTMLElement).closest<HTMLElement>(".dv-tile-in")
      if (tile !== target) reset(target)
      target = tile
      if (!tile) return
      const r = tile.getBoundingClientRect()
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2
      if (!raf) raf = requestAnimationFrame(apply)
    }
    const onLeave = () => {
      reset(target)
      target = null
    }
    grid.addEventListener("pointermove", onMove)
    grid.addEventListener("pointerleave", onLeave)
    return () => {
      grid.removeEventListener("pointermove", onMove)
      grid.removeEventListener("pointerleave", onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div ref={gridRef} className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {developers.map((d, i) => (
        <InView key={d.id} className="h-full" threshold={0.12}>
          <Tile d={d} i={i % 4} />
        </InView>
      ))}
    </div>
  )
}

function Tile({ d, i }: { d: DirectoryDeveloper; i: number }) {
  const [sampled, setSampled] = useState<string | null>(null)
  const bg = d.logo_bg ?? sampled ?? "#f4f6f9"
  const count = d.projectCount
  const where = d.emirates.length > 2 ? `${d.emirates.slice(0, 2).join(" · ")} +${d.emirates.length - 2}` : d.emirates.join(" · ")

  return (
    <TransitionLink href={`/${d.slug}`} name="developer-logo" className="dv-tile block h-full" style={{ ["--i" as string]: i }}>
      <span className="dv-tile-in group relative flex h-full flex-col overflow-hidden border border-[#e5e8ec] bg-white">
        <span data-vt-img className="relative flex aspect-[16/10] items-center justify-center overflow-hidden" style={{ backgroundColor: bg }}>
          {d.logo_url ? (
            <Image
              src={d.logo_url}
              // SVG bypasses the optimizer (which rejects it; upload route accepts SVG logos).
              unoptimized={d.logo_url.toLowerCase().includes(".svg")}
              alt={d.name}
              width={160}
              height={160}
              onLoad={(e) => { if (!d.logo_bg) setSampled(sampleLogoBg(e.currentTarget)) }}
              className="max-h-[55%] max-w-[58%] object-contain transition-transform duration-500 group-hover:scale-[1.06]"
            />
          ) : (
            <Building2 className="h-10 w-10 text-[#001f3f]/20" aria-hidden="true" />
          )}
          {d.is_verified && (
            <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 border border-[#d6b357] bg-white/95 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#b8913f]">
              <BadgeCheck className="h-3 w-3" /> Verified
            </span>
          )}
          <span className="dv-tile-line absolute inset-x-0 top-0 h-[3px] bg-[#d6b357]" aria-hidden="true" />
          <span className="dv-tile-bar absolute inset-x-0 bottom-0 flex items-center justify-between bg-[#001f3f] px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white">
            Open portfolio
            <ArrowUpRight className="h-3.5 w-3.5 text-[#d6b357]" aria-hidden="true" />
          </span>
        </span>
        <span className="flex flex-1 items-center justify-between gap-3 border-t border-[#eef0f3] px-4 py-3">
          <span className="min-w-0">
            <span className="line-clamp-2 block font-['Outfit'] text-[14px] font-bold leading-tight text-[#0d1117] transition-colors group-hover:text-[#001f3f] sm:line-clamp-1 sm:text-[15px]">
              {d.name}
            </span>
            <span className="mt-1 block truncate text-[12px] text-[#6b7280]">
              {count > 0 ? (
                <>
                  <span className="font-['Outfit'] font-bold text-[#b8913f]">{count}</span> live {count === 1 ? "project" : "projects"}
                  {where && <span className="text-[#9ca3af]"> · {where}</span>}
                </>
              ) : (
                "Portfolio coming soon"
              )}
            </span>
          </span>
          <span className="hidden h-8 w-8 shrink-0 items-center justify-center bg-[#001f3f]/5 transition-colors duration-300 group-hover:bg-[#d6b357] sm:flex">
            <ArrowUpRight className="h-4 w-4 text-[#001f3f]" />
          </span>
        </span>
      </span>
    </TransitionLink>
  )
}
