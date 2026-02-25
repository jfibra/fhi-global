"use client"

import { DashboardShell } from "@/components/dashboard/shell"
import { getRoleColor } from "@/components/dashboard/sidebar-config"
import { roleToLabel } from "@/lib/auth"
import { TeamsClient } from "./teams-client"

export function TeamsDashboardShell({
  role,
  userName,
  userId,
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
      <TeamsClient currentRole={role} userId={userId} />
    </DashboardShell>
  )
}
