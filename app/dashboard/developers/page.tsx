"use client"

import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { DevelopersDashboardShell } from "./developers-dashboard-shell"

export default function DevelopersPage() {
  const { user, profile, role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))
  if (!allowed) return null

  return (
    <DevelopersDashboardShell
      role={(role ?? "").toLowerCase().trim()}
      userName={profile?.fullname || user?.email || "User"}
      userId={user?.id ?? ""}
    />
  )
}
