"use client"

import { useEffect, useRef } from "react"
import Image from "next/image"

export type WallPerson = { src: string; name: string; role: string }

/**
 * The /agents masthead: the team's own uploaded portraits in slowly drifting
 * columns, like a film's cast wall, with a spotlight that brings one face at
 * a time into full colour with its name. The spotlight only picks faces
 * clear of the text block marked data-wall-avoid in the same section. The drift pauses while the wall is off
 * screen; reduced motion gets a still wall and no spotlight. Decorative
 * (aria-hidden): the directory below lists everyone.
 */
export function AgentWall({ people, columns = 6 }: { people: WallPerson[]; columns?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  const cols: WallPerson[][] = Array.from({ length: columns }, () => [])
  people.forEach((p, i) => cols[i % columns].push(p))

  useEffect(() => {
    const wall = ref.current
    if (!wall) return
    const io = new IntersectionObserver(([e]) => {
      wall.dataset.paused = e.isIntersecting ? "false" : "true"
    })
    io.observe(wall)
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => io.disconnect()

    let lit: HTMLElement | null = null
    const pick = () => {
      if (document.hidden || wall.dataset.paused === "true") return
      const box = wall.getBoundingClientRect()
      const text = wall.parentElement?.querySelector("[data-wall-avoid]")?.getBoundingClientRect()
      // On desktop the left of the wall sits under the solid end of the gradient.
      const wide = window.innerWidth >= 1024
      // A lit face drifts ~60px before the next pick, so keep a margin above and
      // below the text (smaller on phones, where the band above it is short).
      const padX = 12
      const padY = wide ? 90 : 28
      const faces = [...wall.querySelectorAll<HTMLElement>(".ag-tile")].filter((t) => {
        if (t === lit) return false
        const r = t.getBoundingClientRect()
        if (r.width === 0) return false // a column hidden at this width
        const onScreen = r.top >= Math.max(box.top, 0) + 16 && r.bottom <= Math.min(box.bottom, window.innerHeight) - 16
        const underText =
          !!text && r.left < text.right + padX && r.right > text.left - padX && r.top < text.bottom + padY && r.bottom > text.top - padY
        return onScreen && !underText && (!wide || r.left >= box.left + box.width * 0.48)
      })
      if (!faces.length) return
      const next = faces[Math.floor(Math.random() * faces.length)]
      if (lit) delete lit.dataset.lit
      next.dataset.lit = "true"
      lit = next
    }
    const first = window.setTimeout(pick, 1500)
    const timer = window.setInterval(pick, 2900)
    return () => {
      io.disconnect()
      window.clearTimeout(first)
      window.clearInterval(timer)
      if (lit) delete lit.dataset.lit
    }
  }, [])

  return (
    <div ref={ref} className="ag-wall absolute inset-0 flex gap-3 overflow-hidden px-3" aria-hidden="true">
      {cols.map((col, c) => (
        <div key={c} className={`min-w-0 flex-1 ${c === 3 ? "hidden md:block" : c >= 4 ? "hidden lg:block" : ""}`}>
          {/* The column twice over, so a -50% drift loops without a seam. */}
          <div
            className={`ag-col ${c % 2 ? "ag-col--down" : ""}`}
            style={{ ["--dur" as string]: `${74 + (c % 3) * 14}s`, animationDelay: `-${c * 11}s` }}
          >
            {[...col, ...col].map((p, i) => (
              <figure key={i} className="ag-tile">
                <Image
                  src={p.src}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 33vw, (max-width: 1024px) 25vw, 17vw"
                  loading={i < 4 ? "eager" : "lazy"}
                  fetchPriority={i < 2 ? "high" : "auto"}
                  className="object-cover object-top"
                />
                <figcaption className="ag-tile-cap">
                  <span className="block font-['Outfit'] text-[13px] font-bold leading-tight text-white">{p.name}</span>
                  <span className="mt-0.5 block text-[9.5px] font-bold uppercase tracking-[0.18em] text-[#d6b357]">{p.role}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
