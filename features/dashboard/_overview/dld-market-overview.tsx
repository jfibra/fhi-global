"use client"

// The Dubai market on the overview (2026-10-02, boss's request): last
// calendar month's DLD transactions — value per day, the top 10 areas and the
// splits by type, usage, registration, property type and freehold — for
// agents, team leaders, unit managers, Global Partners and members. It is the
// Open Data page's own chart section in its compact mode (same data, same
// cache), and it only starts loading once it scrolls into view, so opening
// the dashboard never waits on it.

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/context/auth-context"
import { canSeeDldMarketOverview, canViewDldOpenData } from "@/lib/app-roles"
import { getDashboardRouteByRole } from "@/lib/auth"
import { BreakdownSection } from "@/features/dashboard/real-estate-data/market-charts"
import { lastMonthView } from "@/features/dashboard/real-estate-data/open-data-page"

export function DldMarketOverview() {
  const { role } = useAuth()
  const [fixed] = useState(() => {
    const view = lastMonthView()
    return {
      ...view,
      title: view.title.replace(/^Dubai market/, "Dubai market (DLD)"),
      description: "What sold in Dubai last month, by the Land Department's own records: value per day, the busiest areas, and the split by type, usage, off-plan or ready, property type and freehold.",
      compact: { fullHref: canViewDldOpenData(role) ? `${getDashboardRouteByRole(role)}/real-estate-data` : null },
    }
  })
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
