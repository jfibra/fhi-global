"use client"

import { useAuth } from "@/context/auth-context"
import { isDeveloperRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"

// proxy.ts already restricts /dashboard/developer to the developer role (it isn't
// a SHARED prefix, so canAccessDashboardPath falls through to the role's base path).
// This client guard mirrors that for the UI; kept static so developer routes stay
// prefetchable like the rest of the dashboard.
export default function DeveloperDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { role } = useAuth()
  const allowed = useRequireAllowed(isDeveloperRole(role))
  if (!allowed) return null
  return <>{children}</>
}
