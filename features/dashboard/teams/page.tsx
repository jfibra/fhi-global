"use client"

import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { TeamsDashboardShell } from "./teams-dashboard-shell"

export default function TeamsPage() {
  const { user, profile, role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))
  if (!allowed) return null

  return (
    <TeamsDashboardShell
      role={(role ?? "").toLowerCase().trim()}
      userName={profile?.fullname || user?.email || "User"}
      userId={user?.id ?? ""}
    />
  )
}
