"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Scroll-reveal wrapper: children fade/slide in the first time they enter the
 * viewport. Server components can be passed as children. Respects
 * prefers-reduced-motion (content simply shows without animating).
 */
export function Reveal({
  children,
  delay = 0,
  direction = "up",
  className = "",
}: {
  children: React.ReactNode
  /** ms before the transition starts once visible (for staggering grids) */
  delay?: number
  direction?: "up" | "left" | "right" | "zoom"
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const hidden =
    direction === "up"
      ? "translate-y-8"
      : direction === "left"
        ? "-translate-x-10"
        : direction === "right"
          ? "translate-x-10"
          : "scale-[0.95]"

  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
        shown ? "opacity-100 translate-x-0 translate-y-0 scale-100" : `opacity-0 ${hidden}`
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}
