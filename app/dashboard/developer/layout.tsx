import { redirect } from "next/navigation"
import { getDashboardRouteByRole } from "@/lib/auth"
import { isDeveloperRole } from "@/lib/app-roles"
import { getSessionIdentity } from "@/lib/server-identity"

export const dynamic = "force-dynamic"

export default async function DeveloperDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const identity = await getSessionIdentity()

  if (!identity) {
    redirect("/login")
  }

  const { profile } = identity

  const role = String(profile.role ?? "").toLowerCase().trim()

  // Only developer role can access this section
  if (!isDeveloperRole(profile.role)) {
    redirect(getDashboardRouteByRole(role))
  }

  return <>{children}</>
}
