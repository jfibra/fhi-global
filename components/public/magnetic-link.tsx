"use client"

import Link from "next/link"
import { useRef, type CSSProperties } from "react"

/**
 * A link that leans a few pixels toward the pointer while it hovers, then
 * springs back — the "magnetic button" of high-end agency sites. Transform is
 * written directly to the element; touch devices never fire pointermove with
 * a hover, so they get a plain button.
 */
export function MagneticLink({
  href,
  className = "",
  style,
  children,
  strength = 0.25,
  ariaLabel,
  target,
  rel,
}: {
  href: string
  className?: string
  /** Static styles (e.g. entrance-delay variables); the lean is applied on top. */
  style?: CSSProperties
  children: React.ReactNode
  /** Fraction of the pointer's offset from centre that the button follows. */
  strength?: number
  ariaLabel?: string
  target?: string
  rel?: string
}) {
  const ref = useRef<HTMLAnchorElement>(null)

  const onMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const el = ref.current
    if (!el || e.pointerType !== "mouse") return
    const r = el.getBoundingClientRect()
    const dx = (e.clientX - (r.left + r.width / 2)) * strength
    const dy = (e.clientY - (r.top + r.height / 2)) * strength
    el.style.transition = "transform 120ms ease-out"
    el.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`
    // (The inline `style` prop's other properties are untouched: only transform/transition are written here.)
  }
  const onLeave = () => {
    const el = ref.current
    if (!el) return
    el.style.transition = "transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)"
    el.style.transform = "translate3d(0, 0, 0)"
  }

  return (
    <Link
      ref={ref}
      href={href}
      className={className}
      style={style}
      target={target}
      rel={rel}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  )
}
