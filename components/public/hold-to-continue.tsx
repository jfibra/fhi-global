"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowUpRight } from "lucide-react"

/**
 * A press-and-hold confirmation before leaving the site. Holding fills a gold
 * ring over about a second; releasing early cancels. It is a deliberate
 * interaction gate, not a claim to detect robots: the visible direct link
 * beneath it keeps the page usable for keyboard and assistive-tech users.
 */
export function HoldToContinue({ href, label, holdMs = 1100 }: { href: string; label: string; holdMs?: number }) {
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const raf = useRef(0)
  const start = useRef(0)
  const holding = useRef(false)

  const go = () => {
    setDone(true)
    window.location.assign(href)
  }

  const tick = (now: number) => {
    if (!holding.current) return
    const p = Math.min(1, (now - start.current) / holdMs)
    setProgress(p)
    if (p >= 1) {
      holding.current = false
      go()
      return
    }
    raf.current = requestAnimationFrame(tick)
  }
  const begin = () => {
    if (done || holding.current) return
    holding.current = true
    start.current = performance.now()
    raf.current = requestAnimationFrame(tick)
  }
  const cancel = () => {
    if (!holding.current) return
    holding.current = false
    cancelAnimationFrame(raf.current)
    setProgress(0)
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  return (
    <button
      type="button"
      onPointerDown={begin}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); begin() } }}
      onKeyUp={(e) => { if (e.key === "Enter" || e.key === " ") cancel() }}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={`${label}. Press and hold to continue.`}
      disabled={done}
      className="htc group relative inline-flex w-full select-none items-center justify-center gap-3 overflow-hidden bg-[#0d1117] px-7 py-4 text-[15px] font-bold text-white transition-colors hover:bg-[#001f3f] disabled:opacity-70 sm:w-auto"
      style={{ ["--p" as string]: progress }}
    >
      <span className="htc-fill pointer-events-none absolute inset-y-0 left-0 bg-[#d6b357]" aria-hidden="true" />
      <span className="relative z-10 inline-flex items-center gap-3">
        <span className="htc-ring relative inline-flex h-6 w-6 items-center justify-center" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="absolute inset-0 h-6 w-6 -rotate-90">
            <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
            <circle cx="12" cy="12" r="10" fill="none" stroke="#d6b357" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - progress} strokeLinecap="round" />
          </svg>
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
        </span>
        {done ? "Opening the Dubai Land Department" : progress > 0 ? "Keep holding" : label}
        <ArrowUpRight className="h-4 w-4 text-[#d6b357] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </span>
    </button>
  )
}
