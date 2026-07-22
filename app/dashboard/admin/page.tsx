"use client"

import { useAuth } from "@/context/auth-context"
import { roleToLabel } from "@/lib/auth"
import { isAdminStaffRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { AdminDashboardContent } from "./_dashboard"

export default function AdminDashboardPage() {
  const { user, profile, role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))
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
