"use client"

import Image from "next/image"
import { useEffect, useState } from "react"

/**
 * The first-load curtain: a navy screen with the gold FHI mark, a hairline
 * that draws beneath it, then the screen parts along the horizon to reveal
 * the hero. About 0.6 seconds, once per browser session; repeat visits and
 * in-site navigations skip it entirely.
 *
 * An inline script hides the curtain before first paint when the session has
 * already seen it, so returning readers never glimpse it. `onOpen` fires the
 * moment the curtain starts to part (or immediately when skipped) so the hero
 * can begin its own entrance underneath.
 */
const KEY = "fhi-intro-seen"
// The curtain's timeline in ms. globals.css reads PART_AT / PART_MS through custom properties set on
// the root below, so the CSS animation and this component's phase change share one set of numbers.
const PART_AT = 380 // the halves start to part, and the hero's own entrance begins
const PART_MS = 220 // time for the halves to clear the screen (fully open at 600 ms)
const DONE_AT = PART_AT + PART_MS + 20

export function IntroReveal({ onOpen }: { onOpen: () => void }) {
  const [phase, setPhase] = useState<"closed" | "open" | "done">("closed")

  useEffect(() => {
    let seen = false
    try {
      seen = !!sessionStorage.getItem(KEY)
    } catch {
      /* private mode: treat as unseen, but never throw */
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (seen || reduce) {
      // The curtain is already hidden by CSS in both cases (the inline script
      // for a seen session, the reduced-motion rule otherwise); unmount it on
      // the next tick and let the hero begin at once.
      const t = window.setTimeout(() => setPhase("done"), 0)
      onOpen()
      return () => window.clearTimeout(t)
    }
    try {
      sessionStorage.setItem(KEY, "1")
    } catch {
      /* ignore */
    }
    const t1 = window.setTimeout(() => {
      setPhase("open")
      onOpen()
    }, PART_AT)
    const t2 = window.setTimeout(() => setPhase("done"), DONE_AT)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [onOpen])

  if (phase === "done") return null

  return (
    <div
      className="intro"
      data-phase={phase}
      aria-hidden="true"
      style={{ ["--intro-part-at" as string]: `${PART_AT}ms`, ["--intro-part-ms" as string]: `${PART_MS}ms` }}
    >
      {/* Hide before paint when this session has seen the curtain. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(sessionStorage.getItem('${KEY}')){var s=document.createElement('style');s.textContent='.intro{display:none}';document.head.appendChild(s)}}catch(e){}`,
        }}
      />
      <div className="intro-half intro-half--top" />
      <div className="intro-half intro-half--bottom" />
      <div className="intro-center">
        <div className="intro-mark">
          <Image src="/logos/fhi-mark-gold.png" alt="" width={84} height={100} priority className="h-[100px] w-auto" />
        </div>
        <span className="intro-rule" />
      </div>
    </div>
  )
}
