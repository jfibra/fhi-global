"use client"

import { DashboardShell } from "@/components/dashboard/shell"
import { SecretaryLikeOverview } from "@/components/dashboard/secretary-like-overview"
import { useAuth } from "@/context/auth-context"
import { roleToLabel } from "@/lib/auth"
import { getRoleColor } from "@/components/dashboard/sidebar-config"

export default function TeamSecretaryDashboard() {
  const { user, profile } = useAuth()
  const displayName = profile?.fullname ?? user?.email ?? "User"

  return (
    <DashboardShell
      role="team_secretary"
      roleLabel={roleToLabel("team_secretary")}
      roleColor={getRoleColor("team_secretary")}
      userName={displayName}
    >
      <SecretaryLikeOverview
        displayName={displayName}
        businessCardHref="/dashboard/teamsecretary/business-card"
        intro="Follow team deals in sales reports, add paperwork while a sale is under review or marked invalid, and use support for admin or IT. Your business card holds your public profile."
      />
    </DashboardShell>
  )
}
