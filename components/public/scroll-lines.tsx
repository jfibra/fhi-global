"use client"

import { useEffect, useRef } from "react"

/**
 * A manifesto that lights up as you read it. Each line starts dim and
 * brightens as it approaches the middle of the viewport, then dims again as
 * it leaves, so the reader's eye is led one sentence at a time. Driven by
 * scroll position on an animation frame; nothing re-renders. Reduced-motion
 * readers see every line at full strength.
 *
 * Each line is plain data (this is a client component fed by a server page):
 * `text`, and an optional trailing `gold` phrase set in the accent colour.
 */
export type ScrollLine = { text: string; gold?: string }

export function ScrollLines({ lines, className = "" }: { lines: ScrollLine[]; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const items = Array.from(root.querySelectorAll<HTMLElement>(".sl-line"))
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      items.forEach((el) => el.style.setProperty("--o", "1"))
      return
    }
    let raf = 0
    let active = false
    const update = () => {
      raf = 0
      const vh = window.innerHeight || 1
      const centre = vh * 0.5
      const band = vh * 0.32
      for (const el of items) {
        const r = el.getBoundingClientRect()
        const mid = r.top + r.height / 2
        const d = Math.abs(mid - centre)
        const o = Math.max(0.14, Math.min(1, 1 - (d - band * 0.25) / band))
        el.style.setProperty("--o", o.toFixed(3))
      }
    }
    const onScroll = () => {
      if (!active || raf) return
      raf = requestAnimationFrame(update)
    }
    const io = new IntersectionObserver(([e]) => {
      active = e.isIntersecting
      if (active) onScroll()
    }, { rootMargin: "20% 0px 20% 0px" })
    io.observe(root)
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

  return (
    <div ref={rootRef} className={className}>
      {lines.map((line, i) => (
        <p key={i} className="sl-line">
          {line.text}
          {line.gold && (
            <>
              {" "}
              <em className="not-italic text-[#e3c06c]">{line.gold}</em>
            </>
          )}
        </p>
      ))}
    </div>
  )
}
