import { redirect } from "next/navigation"
import { isAdminStaffRole } from "@/lib/app-roles"
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

  // Any admin-staff role that can reach this page may clear logs.
  return <SystemLogsClient currentRole={profile.role ?? "admin"} canClear />
}
