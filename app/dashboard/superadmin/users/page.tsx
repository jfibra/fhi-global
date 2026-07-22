"use client"

import { useAuth } from "@/context/auth-context"
import { isSuperAdminRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { AdminUsersClient } from "@/app/dashboard/admin/users/users-client"

export default function SuperAdminUsersPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(isSuperAdminRole(role), "/dashboard/superadmin")
  if (!allowed) return null

  return (
    <AdminUsersClient
      currentRole="super_admin"
      roleLabel="Super Admin"
      roleColor="#7c3aed"
    />
  )
}
