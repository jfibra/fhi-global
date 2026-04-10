"use client"

import { DashboardShell } from "@/components/dashboard/shell"
import { SalesPipelineOverview } from "@/components/dashboard/sales-pipeline-overview"
import { useAuth } from "@/context/auth-context"
import { roleToLabel } from "@/lib/auth"
import { getRoleColor } from "@/components/dashboard/sidebar-config"

export default function UnitManagerDashboard() {
  const { user, profile } = useAuth()
  const displayName = profile?.fullname ?? user?.email ?? "User"

  return (
    <DashboardShell
      role="unit_manager"
      roleLabel={roleToLabel("unit_manager")}
      roleColor={getRoleColor("unit_manager")}
      userName={displayName}
    >
      <SalesPipelineOverview displayName={displayName} userId={user?.id} />
    </DashboardShell>
  )
}
