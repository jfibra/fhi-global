import { redirect } from "next/navigation"
import { isAdminStaffRole } from "@/lib/app-roles"
import { getSessionIdentity } from "@/lib/server-identity"
import { TeamsDashboardShell } from "./teams-dashboard-shell"

export const dynamic = "force-dynamic"

export default async function TeamsPage() {
  const identity = await getSessionIdentity()
  if (!identity) redirect("/login")
  const { userId, email, profile } = identity

  const roleValue = String(profile.role ?? "").toLowerCase().trim()
  if (!isAdminStaffRole(profile.role)) {
    redirect("/dashboard")
  }

  return (
    <TeamsDashboardShell
      role={roleValue}
      userName={profile.fullname || email || "User"}
      userId={userId}
    />
  )
}
