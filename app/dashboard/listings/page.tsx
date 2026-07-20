import { redirect } from "next/navigation"
import { isInactiveProfile } from "@/lib/auth"
import { isSalesPipelineRole } from "@/lib/app-roles"
import { getSessionIdentity } from "@/lib/server-identity"
import { AgentListingsClient } from "./listings-client"

export const dynamic = "force-dynamic"

export default async function AgentListingsPage() {
  const identity = await getSessionIdentity()

  if (!identity) redirect("/login")
  const { userId, email, profile } = identity
  if (isInactiveProfile(profile)) redirect("/account-inactive")

  // Agents, team leaders, and unit managers (see ROLES_SALES_PIPELINE).
  if (!isSalesPipelineRole(profile.role)) {
    redirect("/dashboard")
  }

  return (
    <AgentListingsClient
      userId={userId}
      userName={profile.fullname ?? email ?? "User"}
      currentRole={profile.role ?? "agent"}
    />
  )
}
