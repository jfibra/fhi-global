import { redirect } from "next/navigation"
import { getSessionIdentity } from "@/lib/server-identity"
import { SupportTable } from "./support-table"
import { canAccessSupportRole, isSupportAdmin } from "@/lib/support-service"

export const dynamic = "force-dynamic"

export default async function SupportPage() {
  const identity = await getSessionIdentity()

  if (!identity) redirect("/login")
  const { userId, email, profile } = identity

  const roleValue = String(profile.role ?? "").toLowerCase().trim()
  if (!canAccessSupportRole(roleValue)) {
    redirect("/dashboard")
  }
  const isAdmin = isSupportAdmin(roleValue)

  return (
    <SupportTable
      currentUserId={userId}
      currentRole={roleValue}
      userName={profile.fullname || email || "User"}
      isAdminView={isAdmin}
    />
  )
}
