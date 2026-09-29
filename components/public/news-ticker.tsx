"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

/**
 * The strip under the News masthead: the newest headlines, one at a time,
 * changing every few seconds — the page reads as fresh even before anyone
 * scrolls. The first headline is in the server HTML (what crawlers and the
 * first paint see); the rest slide in on the client. Hovering or focusing
 * holds the current story; the arrows step through by hand; a
 * reduced-motion visitor gets no auto-advance and instant swaps.
 */

export type TickerItem = { slug: string; title: string; date: string }

const INTERVAL_MS = 5000

function fmt(dateStr: string) {
  if (!dateStr) return ""
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  } catch {
    return dateStr
  }
}

export function NewsTicker({ items }: { items: TickerItem[] }) {
  // The story on screen and the one it replaced (which slides out above it).
  const [pos, setPos] = useState({ i: 0, from: 0 })
  const [held, setHeld] = useState(false)
  const [still, setStill] = useState(false)
  const n = items.length

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const apply = () => setStill(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  useEffect(() => {
    if (n < 2 || held || still) return
    const t = window.setInterval(() => setPos((p) => ({ i: (p.i + 1) % n, from: p.i })), INTERVAL_MS)
    return () => window.clearInterval(t)
  }, [n, held, still])

  const go = (d: number) => setPos((p) => ({ i: (p.i + d + n) % n, from: p.i }))

  if (n === 0) return null
  const { i, from } = pos
  const current = items[i]
  const move = still ? "" : "transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"

  return (
    <div
      className="bg-white border-b border-[#e8eaed]"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-4">
        <span className="shrink-0 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#c0392b]">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            {!still && <span className="absolute inline-flex h-full w-full rounded-full bg-[#c0392b] opacity-60 animate-ping" />}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#c0392b]" />
          </span>
          Live
        </span>

        {/* One line tall; the headlines slide through it like a departures board. */}
        <div className="relative min-w-0 flex-1 h-5 overflow-hidden" aria-live="off">
          {items.map((item, k) => {
            const on = k === i
            const leaving = k === from && from !== i
            const cls = on ? "translate-y-0 opacity-100" : leaving ? "-translate-y-full opacity-0" : "translate-y-full opacity-0"
            return (
              <Link
                key={item.slug}
                href={`/news/${item.slug}`}
                tabIndex={on ? 0 : -1}
                aria-hidden={!on}
                className={`absolute inset-x-0 top-0 block truncate text-sm leading-5 text-[#0d1117] hover:text-[#b8913f] ${on || leaving ? move : ""} ${cls}`}
              >
                {item.title}
              </Link>
            )
          })}
        </div>

        {current.date && <span className="hidden sm:block shrink-0 text-xs text-[#9ca3af]">{fmt(current.date)}</span>}

        {n > 1 && (
          <div className="hidden sm:flex shrink-0 items-center gap-1.5">
            <span className="text-[11px] font-bold tabular-nums text-[#9ca3af]">
              {String(i + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous headline"
              className="inline-flex h-7 w-7 items-center justify-center border border-[#e5e8ec] text-[#6b7280] transition-colors hover:border-[#d6b357] hover:text-[#0d1117]"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next headline"
              className="inline-flex h-7 w-7 items-center justify-center border border-[#e5e8ec] text-[#6b7280] transition-colors hover:border-[#d6b357] hover:text-[#0d1117]"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
