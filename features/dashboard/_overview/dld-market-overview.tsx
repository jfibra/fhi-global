"use client"

// The Dubai market on the overview (2026-10-02, boss's request): the last 30
// days of DLD transactions, up to today (a rolling window, so it is current
// every day — the agents' Open Data page keeps the full calendar month) — value per day, the top 10 areas and the
// splits by type, usage, registration, property type and freehold — for
// agents, team leaders, unit managers, Global Partners and members. It is the
// Open Data page's own chart section in its compact mode (same data, same
// cache), and it only starts loading once it scrolls into view, so opening
// the dashboard never waits on it.

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/context/auth-context"
import { canSeeDldMarketOverview } from "@/lib/app-roles"
import { BreakdownSection, type FixedBreakdown } from "@/features/dashboard/real-estate-data/market-charts"

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/** The last 30 days, today included. */
function last30Days(): FixedBreakdown {
  const today = new Date()
  const first = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)
  return {
    command: "transactions",
    dateRange: { from: iso(first), to: iso(today) },
    title: "Dubai market (DLD) · Last 30 days",
    description: "What sold in Dubai over the last 30 days, by the Land Department's own records: value per day, the busiest areas, and the split by type, usage, off-plan or ready, property type and freehold. Today's figures fill in as DLD records them.",
    cacheKey: `charts:overview:last-30:${iso(first)}`,
    // No link to the full Open Data page from here (boss, 2026-10-02).
    compact: { fullHref: null },
  }
}

export function DldMarketOverview() {
  const { role } = useAuth()
  // Fixed on mount so the whole section agrees on the window.
  const [fixed] = useState(last30Days)
  const ref = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    if (typeof IntersectionObserver === "undefined") {
      const t = window.setTimeout(() => setSeen(true), 0)
      return () => window.clearTimeout(t)
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setSeen(true)
        io.disconnect()
      }
    }, { rootMargin: "300px 0px" })
    io.observe(el)
    return () => io.disconnect()
  }, [seen])

  if (!canSeeDldMarketOverview(role)) return null
  return (
    <div ref={ref} className="min-h-[200px]">
      {seen ? (
        <BreakdownSection fixed={fixed} />
      ) : (
        <div className="rounded-2xl border border-dashed border-[#d9dde3] bg-[#fafbfc] px-6 py-10 text-center text-sm text-[#9ca3af]">Dubai market (DLD) — loading when you scroll here…</div>
      )}
    </div>
  )
}
