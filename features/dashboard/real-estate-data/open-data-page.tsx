"use client"

// Agent / team leader / unit manager → Open Data (DLD).
//
// The sales ladder's cut of the admin Real Estate Data workbench: last
// calendar month only, with the same tiles and charts the admin Breakdowns
// tab draws (BreakdownSection in fixed mode). The period is chosen here, not
// by the user; the dataset can be switched and defaults to Transactions.
// No index tab and no raw tables. Role access: ROLES_DLD_OPEN_DATA
// (lib/app-roles.ts), mirrored by SUB_PATH_ROLES["real-estate-data"] in
// lib/auth.ts and the charts route.

import { useState } from "react"
import { useAuth } from "@/context/auth-context"
import { canViewDldOpenData } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { BreakdownSection, type FixedBreakdown } from "./market-charts"

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** The previous calendar month, first to last day, as ISO dates. */
function lastCalendarMonth(): { from: string; to: string; label: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const last = new Date(now.getFullYear(), now.getMonth(), 0)
  return { from: iso(first), to: iso(last), label: first.toLocaleDateString("en-AE", { month: "long", year: "numeric" }) }
}

export function lastMonthView(): FixedBreakdown {
  const month = lastCalendarMonth()
  return {
    command: "transactions",
    dateRange: { from: month.from, to: month.to },
    title: `Dubai market · ${month.label}`,
    description: "DLD's figures for last month: daily volume and value, totals, price per sqft, the busiest areas and how the month compares with the one before. Transactions by default — pick another dataset to see the same month for rents, projects or valuations.",
    cacheKey: `charts:open-data:last-month:${month.from}`,
  }
}

export default function OpenDataPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(canViewDldOpenData(role))
  // Fixed on mount so the whole page agrees on "last month".
  const [fixed] = useState(lastMonthView)
  if (!allowed) return null

  return (
    <>
      <BreakdownSection fixed={fixed} />
    </>
  )
}
