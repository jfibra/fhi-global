"use client"

import { DashboardShell } from "@/components/dashboard/shell"
import { SalesPipelineOverview } from "@/components/dashboard/sales-pipeline-overview"
import { useAuth } from "@/context/auth-context"
import { roleToLabel } from "@/lib/auth"
import { getRoleColor } from "@/components/dashboard/sidebar-config"

export default function TeamLeaderDashboard() {
  const { user, profile } = useAuth()
  const displayName = profile?.fullname ?? user?.email ?? "User"

  return (
    <DashboardShell
      role="team_leader"
      roleLabel={roleToLabel("team_leader")}
      roleColor={getRoleColor("team_leader")}
      userName={displayName}
    >
      <SalesPipelineOverview displayName={displayName} userId={user?.id} />
    </DashboardShell>
  )
}
