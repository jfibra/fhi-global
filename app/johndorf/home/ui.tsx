"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useInView, useMotionValue, useSpring, type MotionValue, useTransform } from "framer-motion"

export const ease = [0.22, 1, 0.36, 1] as const
export const serif = "font-[family-name:var(--font-jd-serif)]"
export const INK = "#160c0a"

/** Fades and lifts its children in when they scroll into view. */
export function Reveal({ children, delay = 0, y = 28, className }: { children: React.ReactNode; delay?: number; y?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={`flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] ${light ? "text-[#f0b6b1]" : "text-[#b4241c]"}`}>
      <span className={`h-px w-10 ${light ? "bg-[#f0b6b1]/70" : "bg-[#b4241c]/60"}`} />
      {children}
    </p>
  )
}

/** Each word rises out of its own mask when the line scrolls into view. */
export function RiseWords({ text, className, delay = 0, accent, accentClass = "italic text-[#b4241c]" }: { text: string; className?: string; delay?: number; accent?: string[]; accentClass?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const seen = useInView(ref, { once: true, margin: "-60px" })
  return (
    <span ref={ref} className={className}>
      {text.split(" ").map((w, i) => (
        <span key={i} className="-mb-[0.18em] mr-[0.24em] inline-block overflow-hidden pb-[0.18em] align-bottom">
          <motion.span
            className={`inline-block ${accent?.includes(w) ? accentClass : ""}`}
            initial={{ y: "110%" }}
            animate={seen ? { y: "0%" } : undefined}
            transition={{ duration: 1, delay: delay + i * 0.06, ease }}
          >
            {w}
          </motion.span>
        </span>
      ))}
    </span>
  )
}

/** A number whose digits roll into place like an odometer the first time it's seen. */
export function Odometer({ value, suffix = "", className }: { value: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const seen = useInView(ref, { once: true, margin: "-40px" })
  const digits = String(value).split("").map(Number)
  return (
    <span ref={ref} className={`inline-flex items-baseline [font-variant-numeric:lining-nums_tabular-nums] ${className ?? ""}`} aria-label={`${value}${suffix}`}>
      {digits.map((d, i) => (
        <span key={i} aria-hidden className="relative inline-block h-[1.08em] overflow-hidden leading-[1.08]">
          <motion.span
            className="flex flex-col"
            initial={{ y: "0%" }}
            animate={seen ? { y: `-${((10 + d) / 20) * 100}%` } : undefined}
            transition={{ duration: 1.8 + i * 0.25, ease }}
          >
            {Array.from({ length: 20 }, (_, n) => (
              <span key={n} className="block h-[1.08em]">
                {n % 10}
              </span>
            ))}
          </motion.span>
        </span>
      ))}
      {suffix && <span aria-hidden>{suffix}</span>}
    </span>
  )
}

/** Pulls its child gently toward the pointer (desktop only — touch never moves it). */
export function Magnetic({ children, strength = 0.35 }: { children: React.ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 18 })
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 18 })
  return (
    <motion.span
      ref={ref}
      style={{ x, y }}
      className="inline-block"
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || !ref.current) return
        const r = ref.current.getBoundingClientRect()
        x.set((e.clientX - (r.left + r.width / 2)) * strength)
        y.set((e.clientY - (r.top + r.height / 2)) * strength)
      }}
      onPointerLeave={() => {
        x.set(0)
        y.set(0)
      }}
    >
      {children}
    </motion.span>
  )
}

/** A soft ring that trails the mouse and grows with a label over [data-cursor] elements. Mouse only. */
export function CursorFollower() {
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const sx = useSpring(x, { stiffness: 500, damping: 40, mass: 0.6 })
  const sy = useSpring(y, { stiffness: 500, damping: 40, mass: 0.6 })
  const [label, setLabel] = useState<string | null>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return
      setOn(true)
      x.set(e.clientX)
      y.set(e.clientY)
      const t = (e.target as Element | null)?.closest?.("[data-cursor]")
      setLabel(t?.getAttribute("data-cursor") ?? null)
    }
    window.addEventListener("pointermove", move, { passive: true })
    return () => window.removeEventListener("pointermove", move)
  }, [x, y])
  return (
    <motion.div
      aria-hidden
      style={{ x: sx, y: sy }}
      className={`pointer-events-none fixed left-0 top-0 z-[80] hidden transition-opacity duration-300 md:block ${on ? "opacity-100" : "opacity-0"}`}
    >
      <motion.div
        animate={{ width: label ? 92 : 34, height: label ? 92 : 34, backgroundColor: label ? "rgba(180,36,28,0.92)" : "rgba(180,36,28,0)" }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#b4241c]/70 text-[10px] font-semibold uppercase tracking-[0.16em] text-white"
      >
        {label}
      </motion.div>
    </motion.div>
  )
}

/** Maps a progress value onto [from, to] — a shorthand for useTransform with clamping. */
export function useRange(p: MotionValue<number>, input: [number, number], output: [number, number]) {
  return useTransform(p, input, output, { clamp: true })
}
