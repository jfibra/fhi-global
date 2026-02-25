"use client"

import { DashboardShell } from "@/components/dashboard/shell"
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
      <div className="mb-6">
        <h2 className="font-['Space_Grotesk'] text-xl font-bold text-[#0d1117]">Welcome, {displayName}</h2>
        <p className="text-sm text-[#9ca3af] mt-0.5">We are preparing your team tools.</p>
      </div>
    </DashboardShell>
  )
}