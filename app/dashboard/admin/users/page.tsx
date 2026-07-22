"use client"

import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { AdminUsersClient } from "./users-client"

export default function AdminUsersPage() {
  const { profile, role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))
  if (!allowed) return null

  return <AdminUsersClient currentRole={profile?.role ?? "admin"} />
}
