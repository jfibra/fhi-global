"use client"

import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole, isSuperAdminRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { AdminUsersClient } from "./users-client"

/** User management for admin. */
export function AdminUsers() {
  const { profile, role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))
  if (!allowed) return null

  return <AdminUsersClient currentRole={profile?.role ?? "admin"} />
}

/** User management for super admin (purple accent + label). */
export function SuperAdminUsers() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(isSuperAdminRole(role))
  if (!allowed) return null

  return (
    <AdminUsersClient
      currentRole="super_admin"
      roleLabel="Super Admin"
      roleColor="#7c3aed"
    />
  )
}
