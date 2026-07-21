import { redirect } from "next/navigation"
import { isAdminStaffRole, isSuperAdminRole } from "@/lib/app-roles"
import { getSessionIdentity } from "@/lib/server-identity"
import { SystemLogsClient } from "@/components/dashboard/system-logs/system-logs-client"

export const dynamic = "force-dynamic"
export const metadata = { robots: { index: false, follow: false } }

export default async function SystemLogsPage() {
  const identity = await getSessionIdentity()
  if (!identity) redirect("/login")
  const { profile } = identity

  if (!isAdminStaffRole(profile.role)) {
    redirect("/dashboard")
  }

  return (
    <SystemLogsClient
      currentRole={profile.role ?? "admin"}
      canClear={isSuperAdminRole(profile.role)}
    />
  )
}
