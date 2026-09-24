"use client"

import { useEffect, useRef } from "react"

/**
 * Renders the final number on the server (so crawlers and no-script readers
 * see the real figure), then counts up to it the first time it scrolls into
 * view. Writes straight to the text node — no state, no re-render.
 */
export function CountUp({
  value,
  duration = 1600,
  delay = 0,
  className,
}: {
  value: number
  duration?: number
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const fmt = (n: number) => Math.round(n).toLocaleString("en-US")

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    let raf = 0
    let timer = 0
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        timer = window.setTimeout(() => {
          const start = performance.now()
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration)
            // Ease-out quint: fast start, long settle — reads as the number "landing".
            const eased = 1 - Math.pow(1 - t, 5)
            el.textContent = fmt(value * eased)
            if (t < 1) raf = requestAnimationFrame(tick)
          }
          el.textContent = "0"
          raf = requestAnimationFrame(tick)
        }, delay)
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      window.clearTimeout(timer)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [value, duration, delay])

  return (
    <span ref={ref} className={className}>
      {fmt(value)}
    </span>
  )
}
