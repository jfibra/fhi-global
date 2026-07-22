"use client"

import { DashboardShell } from "@/components/dashboard/shell"
import { getRoleColor } from "@/components/dashboard/sidebar-config"
import { roleToLabel } from "@/lib/auth"

export function ContactInboxShell({
  role,
  userName,
  children,
}: {
  role: string
  userName: string
  children: React.ReactNode
}) {
  return (
    <DashboardShell
      role={role}
      roleLabel={roleToLabel(role)}
      roleColor={getRoleColor(role)}
      userName={userName}
    >
      {children}
    </DashboardShell>
  )
}
