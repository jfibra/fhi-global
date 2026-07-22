import { redirect } from "next/navigation"
import { isAdminStaffRole } from "@/lib/app-roles"
import { getSessionIdentity } from "@/lib/server-identity"
import { AllListingsDashboardShell } from "./all-listings-dashboard-shell"

export const dynamic = "force-dynamic"
export const metadata = { robots: { index: false, follow: false } }

export default async function AllListingsPage() {
  const identity = await getSessionIdentity()
  if (!identity) redirect("/login")
  const { userId, email, profile } = identity

  if (!isAdminStaffRole(profile.role)) {
    redirect("/dashboard")
  }

  const roleValue = String(profile.role ?? "").toLowerCase().trim()

  return (
    <AllListingsDashboardShell
      role={roleValue}
      userName={profile.fullname || email || "User"}
      userId={userId}
    />
  )
}
