import { redirect } from "next/navigation"
import { getDashboardRouteByRole, isInactiveProfile } from "@/lib/auth"
import { getSessionIdentity } from "@/lib/server-identity"

export const dynamic = "force-dynamic"

export default async function DashboardIndexPage() {
  const identity = await getSessionIdentity()

  if (!identity) {
    redirect("/")
  }

  const { profile } = identity

  if (isInactiveProfile(profile)) {
    redirect("/account-inactive")
  }

  redirect(getDashboardRouteByRole(profile.role))
}
