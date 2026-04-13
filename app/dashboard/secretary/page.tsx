"use client"

import { DashboardShell } from "@/components/dashboard/shell"
import { SecretaryLikeOverview } from "@/components/dashboard/secretary-like-overview"
import { useAuth } from "@/context/auth-context"
import { roleToLabel } from "@/lib/auth"
import { getRoleColor } from "@/components/dashboard/sidebar-config"

export default function SecretaryDashboard() {
  const { user, profile } = useAuth()
  const displayName = profile?.fullname ?? user?.email ?? "User"

  return (
    <DashboardShell
      role="secretary"
      roleLabel={roleToLabel("secretary")}
      roleColor={getRoleColor("secretary")}
      userName={displayName}
    >
      <SecretaryLikeOverview
        displayName={displayName}
        businessCardHref="/dashboard/secretary/business-card"
        intro="Company-wide visibility into sales, support for IT and operations, and your business card. Attach documents to deals that are under review or marked invalid so agents can complete validation."
      />
    </DashboardShell>
  )
}
