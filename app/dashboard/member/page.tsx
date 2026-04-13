"use client"

import { DashboardShell } from "@/components/dashboard/shell"
import { MemberOverview } from "@/components/dashboard/member-overview"
import { useAuth } from "@/context/auth-context"
import { roleToLabel } from "@/lib/auth"
import { getRoleColor } from "@/components/dashboard/sidebar-config"

export default function MemberDashboard() {
  const { user, profile } = useAuth()
  const displayName = profile?.fullname ?? user?.email ?? "User"

  return (
    <DashboardShell
      role="member"
      roleLabel={roleToLabel("member")}
      roleColor={getRoleColor("member")}
      userName={displayName}
    >
      <MemberOverview displayName={displayName} />
    </DashboardShell>
  )
}
