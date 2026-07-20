import { redirect } from "next/navigation"
import { isAdminStaffRole } from "@/lib/app-roles"
import { getSessionIdentity } from "@/lib/server-identity"
import { PurchasesTable } from "./purchases-table"

export const dynamic = "force-dynamic"

export default async function PurchasesPage() {
  const identity = await getSessionIdentity()

  if (!identity) redirect("/login")
  const { userId, email, profile } = identity

  const roleValue = String(profile.role ?? "").toLowerCase().trim()
  if (!isAdminStaffRole(profile.role)) {
    redirect("/dashboard")
  }

  return (
    <PurchasesTable
      currentUserId={userId}
      currentRole={roleValue}
      userName={profile.fullname || email || "User"}
    />
  )
}
