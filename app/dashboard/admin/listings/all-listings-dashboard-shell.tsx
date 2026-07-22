"use client"

import { DashboardShell } from "@/components/dashboard/shell"
import { getRoleColor } from "@/components/dashboard/sidebar-config"
import { roleToLabel } from "@/lib/auth"
import { AllListingsClient } from "./all-listings-client"

export function AllListingsDashboardShell({
  role,
  userName,
}: {
  role: string
  userName: string
  userId: string
}) {
  return (
    <DashboardShell
      role={role}
      roleLabel={roleToLabel(role)}
      roleColor={getRoleColor(role)}
      userName={userName}
    >
      <AllListingsClient />
    </DashboardShell>
  )
}
