"use client"

import { useAuth } from "@/context/auth-context"
import { roleToLabel } from "@/lib/auth"
import { isSuperAdminRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { AdminDashboardContent } from "../admin/_dashboard"

export default function SuperAdminDashboardPage() {
  const { user, profile, role } = useAuth()
  const allowed = useRequireAllowed(isSuperAdminRole(role))
  if (!allowed) return null

  const roleValue = (role ?? "").toLowerCase()
  return (
    <AdminDashboardContent
      roleValue={roleValue}
      roleLabel={roleToLabel(roleValue)}
      userName={profile?.fullname ?? user?.email ?? "Admin"}
      userId={user?.id ?? ""}
    />
  )
}
