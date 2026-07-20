import { redirect } from "next/navigation"
import { isAdminStaffRole } from "@/lib/app-roles"
import { getSessionIdentity } from "@/lib/server-identity"
import { TaxEntitiesTable } from "./tax-entities-table"

export const dynamic = "force-dynamic"

export default async function TaxEntitiesPage() {
  const identity = await getSessionIdentity()

  if (!identity) redirect("/login")
  const { email, profile } = identity

  const roleValue = String(profile.role ?? "").toLowerCase().trim()
  if (!isAdminStaffRole(profile.role)) {
    redirect("/dashboard")
  }

  return (
    <TaxEntitiesTable
      currentRole={roleValue}
      userName={profile.fullname || email || "User"}
    />
  )
}
