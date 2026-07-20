import { redirect } from "next/navigation"
import { isSuperAdminRole } from "@/lib/app-roles"
import { getSessionIdentity } from "@/lib/server-identity"
import { AdminUsersClient } from "@/app/dashboard/admin/users/users-client"

export const dynamic = "force-dynamic"

export default async function SuperAdminUsersPage() {
  const identity = await getSessionIdentity()

  if (!identity) {
    redirect("/login")
  }

  const { profile } = identity

  if (!isSuperAdminRole(profile.role)) {
    redirect("/dashboard/superadmin")
  }

  return (
    <AdminUsersClient
      currentRole="super_admin"
      roleLabel="Super Admin"
      roleColor="#7c3aed"
    />
  )
}
