"use client"

import { Suspense } from "react"
import { useAuth } from "@/context/auth-context"
import { canAccessSalesReportsArea } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { SalesTable } from "./sales-table"

export default function SalesPage() {
  const { user, profile, role } = useAuth()
  const allowed = useRequireAllowed(canAccessSalesReportsArea(role))
  if (!allowed) return null

  return (
    // SalesTable reads the ?type= query param (useSearchParams) — Suspense is
    // required so static rendering can bail out to the client cleanly.
    <Suspense fallback={null}>
      <SalesTable
        currentUserId={user?.id ?? ""}
        currentRole={(role ?? "").toLowerCase().trim()}
        userName={profile?.fullname || user?.email || "User"}
      />
    </Suspense>
  )
}
