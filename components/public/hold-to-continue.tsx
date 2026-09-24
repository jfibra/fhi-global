"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowUpRight, ExternalLink } from "lucide-react"

/**
 * A press-and-hold confirmation before opening an outside site. Holding fills
 * a gold ring over about a second; releasing early cancels. On completion the
 * destination opens in a NEW tab, so the FHI page stays where the reader left
 * it. It is a deliberate interaction gate, not a claim to detect robots: the
 * direct link shown beneath it keeps things usable for keyboard and
 * assistive-tech users, and is also the fallback when a browser blocks the
 * new tab.
 */
export function HoldToContinue({
  href,
  label,
  holdMs = 1100,
  onOpened,
}: {
  href: string
  label: string
  holdMs?: number
  /** Called once the new tab has opened. */
  onOpened?: () => void
}) {
  const [progress, setProgress] = useState(0)
  const [state, setState] = useState<"idle" | "opened" | "blocked">("idle")
  const raf = useRef(0)
  const start = useRef(0)
  const holding = useRef(false)

  const open = () => {
    // Still inside the browser's user-activation window (the pointer went
    // down about a second ago), so the new tab is allowed. Opened without the
    // noopener feature on purpose: with it, window.open returns null by
    // specification even on success, which made every open look blocked. The
    // opener is severed by hand instead. A genuine refusal returns null and
    // the direct link takes over.
    const w = window.open(href, "_blank")
    if (w) {
      try {
        w.opener = null
      } catch {
        /* cross-origin window: opener is already unreachable */
      }
      setState("opened")
      onOpened?.()
    } else {
      setState("blocked")
    }
    setProgress(0)
  }

  const tick = (now: number) => {
    if (!holding.current) return
    const p = Math.min(1, (now - start.current) / holdMs)
    setProgress(p)
    if (p >= 1) {
      holding.current = false
      open()
      return
    }
    raf.current = requestAnimationFrame(tick)
  }
  const begin = () => {
    if (holding.current) return
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

  const text =
    state === "opened" ? "Opened in a new tab. Hold again to reopen"
    : state === "blocked" ? "Your browser blocked the tab. Use the link below"
    : progress > 0 ? "Keep holding"
    : label

  return (
    <div>
      <button
        type="button"
        onPointerDown={begin}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); begin() } }}
        onKeyUp={(e) => { if (e.key === "Enter" || e.key === " ") cancel() }}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={`${label}. Press and hold to open in a new tab.`}
        className="htc group relative inline-flex w-full select-none items-center justify-center gap-3 overflow-hidden bg-[#0d1117] px-7 py-4 text-[15px] font-bold text-white transition-colors hover:bg-[#001f3f] sm:w-auto"
        style={{ ["--p" as string]: progress }}
      >
        <span className="htc-fill pointer-events-none absolute inset-y-0 left-0 bg-[#d6b357]" aria-hidden="true" />
        <span className="relative z-10 inline-flex items-center gap-3">
          <span className="relative inline-flex h-6 w-6 items-center justify-center" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="absolute inset-0 h-6 w-6 -rotate-90">
              <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
              <circle cx="12" cy="12" r="10" fill="none" stroke="#d6b357" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - progress} strokeLinecap="round" />
            </svg>
            <span className={`h-1.5 w-1.5 rounded-full ${state === "opened" ? "bg-[#d6b357]" : "bg-white"}`} />
          </span>
          {text}
          <ArrowUpRight className="h-4 w-4 text-[#d6b357] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </span>
      </button>
      <p className="mt-3 text-[12px] leading-relaxed text-[#6b7280]">
        Opens the Dubai Land Department&rsquo;s validation page in a new tab; this page stays open.{" "}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 font-bold underline-offset-4 hover:underline ${state === "blocked" ? "text-[#b8913f] underline" : "text-[#0d1117] hover:text-[#b8913f]"}`}
        >
          Open the link directly <ExternalLink className="h-3 w-3" />
        </a>
      </p>
    </div>
  )
}
