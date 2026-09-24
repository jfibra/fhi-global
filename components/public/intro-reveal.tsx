"use client"

import Image from "next/image"
import { useEffect, useState } from "react"

/**
 * The first-load curtain: a navy screen with the gold FHI mark, a hairline
 * that draws beneath it, then the screen parts along the horizon to reveal
 * the hero. About 1.4 seconds, once per browser session; repeat visits and
 * in-site navigations skip it entirely.
 *
 * An inline script hides the curtain before first paint when the session has
 * already seen it, so returning readers never glimpse it. `onOpen` fires the
 * moment the curtain starts to part (or immediately when skipped) so the hero
 * can begin its own entrance underneath.
 */
const KEY = "fhi-intro-seen"

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
    }, 950)
    const t2 = window.setTimeout(() => setPhase("done"), 1900)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [onOpen])

  if (phase === "done") return null

  return (
    <div className="intro" data-phase={phase} aria-hidden="true">
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
