import { redirect } from "next/navigation"
import { isInactiveProfile, roleToLabel } from "@/lib/auth"
import { isSuperAdminRole } from "@/lib/app-roles"
import { getSessionIdentity } from "@/lib/server-identity"
import { AdminDashboardContent } from "../admin/_dashboard"

export const dynamic = "force-dynamic"

export default async function SuperAdminDashboardPage() {
  const identity = await getSessionIdentity()
  if (!identity) redirect("/login")
  const { userId, email, profile } = identity
  if (isInactiveProfile(profile)) redirect("/account-inactive")
  const roleValue = String(profile.role ?? "").toLowerCase()
  if (!isSuperAdminRole(profile.role)) redirect("/dashboard")
  return (
    <AdminDashboardContent
      roleValue={roleValue}
      roleLabel={roleToLabel(roleValue)}
      userName={profile.fullname ?? email ?? "Admin"}
      userId={userId}
    />
  )
}
