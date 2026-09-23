"use client"

import { useEffect, useRef } from "react"

/**
 * Slow scroll parallax for a framed photo: the child (an oversized image)
 * drifts a few percent against the scroll direction while the frame is on
 * screen. Written straight to the element on an animation frame — no React
 * state, no layout thrash — and disabled for reduced-motion users.
 */
export function ParallaxPhoto({
  children,
  className = "",
  /** Total travel as a fraction of the frame height (0.12 = 12%). */
  strength = 0.12,
}: {
  children: React.ReactNode
  className?: string
  strength?: number
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const frame = frameRef.current
    const layer = layerRef.current
    if (!frame || !layer) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    let raf = 0
    let active = false
    const update = () => {
      raf = 0
      const r = frame.getBoundingClientRect()
      const vh = window.innerHeight || 1
      // -1 when the frame's centre is a viewport below the fold, +1 a viewport above.
      const progress = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / vh))
      layer.style.transform = `translate3d(0, ${(-progress * strength * r.height).toFixed(1)}px, 0)`
    }
    const onScroll = () => {
      if (!active || raf) return
      raf = requestAnimationFrame(update)
    }
    const io = new IntersectionObserver(([e]) => {
      active = e.isIntersecting
      if (active) onScroll()
    })
    io.observe(frame)
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      io.disconnect()
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [strength])

  return (
    <div ref={frameRef} className={className}>
      {/* Oversized so the drift never exposes the frame's edges. */}
      <div ref={layerRef} className="absolute -inset-y-[10%] inset-x-0 will-change-transform">
        {children}
      </div>
    </div>
  )
}
