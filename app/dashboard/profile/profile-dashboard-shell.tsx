"use client"

import { DashboardShell } from "@/components/dashboard/shell"
import { roleToLabel } from "@/lib/auth"
import { getRoleColor } from "@/components/dashboard/sidebar-config"
import { ProfileForm, type DashboardProfile } from "./profile-form"

export function ProfileDashboardShell({
  profile,
  user,
}: {
  profile: DashboardProfile
  user: {
    id: string
    email: string
  }
}) {
  const role = profile.role

  return (
    <DashboardShell
      role={role ?? "member"}
      roleLabel={roleToLabel(role)}
      roleColor={getRoleColor(role)}
      userName={profile.fullname || user.email || "User"}
    >
      <ProfileForm initialProfile={profile} user={user} />
    </DashboardShell>
  )
}
