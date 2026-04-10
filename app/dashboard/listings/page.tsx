import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getProfileByUserId, isInactiveProfile } from "@/lib/auth"
import { isSalesPipelineRole } from "@/lib/app-roles"
import { AgentListingsClient } from "./listings-client"

export const dynamic = "force-dynamic"

export default async function AgentListingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { profile } = await getProfileByUserId(supabase, user.id)
  if (!profile) redirect("/login")
  if (isInactiveProfile(profile)) redirect("/account-inactive")

  // Agents, team leaders, and unit managers (see ROLES_SALES_PIPELINE).
  if (!isSalesPipelineRole(profile.role)) {
    redirect("/dashboard")
  }

  return (
    <AgentListingsClient
      userId={user.id}
      userName={profile.fullname ?? user.email ?? "User"}
      currentRole={profile.role ?? "agent"}
    />
  )
}
