import { redirect } from "next/navigation"
import { canAccessSalesReportsArea } from "@/lib/app-roles"
import { getSessionIdentity } from "@/lib/server-identity"
import { SalesTable } from "./sales-table"

export const dynamic = "force-dynamic"

export default async function SalesPage() {
  const identity = await getSessionIdentity()

  if (!identity) redirect("/login")
  const { userId, email, profile } = identity

  const roleValue = String(profile.role ?? "").toLowerCase().trim()
  if (!canAccessSalesReportsArea(profile.role)) {
    redirect("/dashboard")
  }

  return (
    <SalesTable
      currentUserId={userId}
      currentRole={roleValue}
      userName={profile.fullname || email || "User"}
    />
  )
}
