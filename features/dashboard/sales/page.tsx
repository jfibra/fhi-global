"use client"

import { useAuth } from "@/context/auth-context"
import { canAccessSalesReportsArea } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { SalesTable } from "./sales-table"
import type { SaleType } from "@/lib/sales-service"

/**
 * Sales reports. The active type comes from the route, not a query param:
 *   /{role}/sales                 → the three-card chooser (saleType omitted)
 *   /{role}/sales/project-sale    → that type's report
 *   /{role}/sales/brokerage-sale
 *   /{role}/sales/rental
 *
 * The Suspense boundary that used to wrap this is gone — nothing here reads
 * useSearchParams any more.
 */
export default function SalesPage({ saleType }: { saleType?: SaleType }) {
  const { user, profile, role } = useAuth()
  const allowed = useRequireAllowed(canAccessSalesReportsArea(role))
  if (!allowed) return null

  return (
    <SalesTable
      currentUserId={user?.id ?? ""}
      currentRole={(role ?? "").toLowerCase().trim()}
      userName={profile?.fullname || user?.email || "User"}
      saleType={saleType ?? null}
    />
  )
}
