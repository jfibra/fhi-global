"use client"

import { useEffect, useRef } from "react"

/**
 * Marks its element with `data-in="true"` the first time it scrolls into view.
 * All the choreography lives in CSS keyed on that attribute, so server-rendered
 * children animate without a single client re-render. Reduced-motion users
 * get the final state immediately.
 */
export function InView({
  children,
  className = "",
  threshold = 0.2,
  rootMargin = "0px 0px -10% 0px",
  style,
}: {
  children: React.ReactNode
  className?: string
  threshold?: number
  rootMargin?: string
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.dataset.in = "true"
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.dataset.in = "true"
          io.disconnect()
        }
      },
      { threshold, rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold, rootMargin])

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  )
}
