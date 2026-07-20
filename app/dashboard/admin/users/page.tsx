import { redirect } from "next/navigation"
import { isAdminStaffRole } from "@/lib/app-roles"
import { getSessionIdentity } from "@/lib/server-identity"
import { AdminUsersClient } from "./users-client"

export const dynamic = "force-dynamic"

export default async function AdminUsersPage() {
  const identity = await getSessionIdentity()

  if (!identity) redirect("/login")
  const { profile } = identity

  if (!isAdminStaffRole(profile.role)) {
    redirect("/dashboard")
  }

  return <AdminUsersClient currentRole={profile.role ?? "admin"} />
}
