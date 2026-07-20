import { redirect } from "next/navigation"
import { isInactiveProfile } from "@/lib/auth"
import { isAdminStaffRole, isSalesPipelineRole } from "@/lib/app-roles"
import { getSessionIdentity } from "@/lib/server-identity"
import { InviteClient } from "./invite-client"

export const dynamic = "force-dynamic"

export default async function InvitePage() {
  const identity = await getSessionIdentity()

  if (!identity) redirect("/login")
  const { userId, email, profile } = identity
  if (isInactiveProfile(profile)) redirect("/account-inactive")

  // Recruiters: sales pipeline roles and admin staff.
  if (!isSalesPipelineRole(profile.role) && !isAdminStaffRole(profile.role)) {
    redirect("/dashboard")
  }

  return (
    <InviteClient
      userId={userId}
      userName={profile.fullname ?? email ?? "User"}
      currentRole={profile.role ?? "agent"}
    />
  )
}
