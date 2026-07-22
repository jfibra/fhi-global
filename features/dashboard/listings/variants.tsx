"use client"

import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole, isSalesPipelineRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { AgentListingsClient } from "./listings-client"
import { AllListingsDashboardShell } from "./all-listings-dashboard-shell"

/** Org-wide "All Listings" view — admin / super_admin. */
export function AllListings() {
  const { user, profile, role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))
  if (!allowed) return null

  return (
    <AllListingsDashboardShell
      role={(role ?? "").toLowerCase().trim()}
      userName={profile?.fullname || user?.email || "User"}
      userId={user?.id ?? ""}
    />
  )
}

/** Personal "My listings" — sales-pipeline roles (agent, team leader, unit manager). */
export function MyListings() {
  const { user, profile, role } = useAuth()
  const allowed = useRequireAllowed(isSalesPipelineRole(role))
  if (!allowed) return null

  return (
    <AgentListingsClient
      userId={user?.id ?? ""}
      userName={profile?.fullname || user?.email || "User"}
      currentRole={role ?? "agent"}
    />
  )
}
