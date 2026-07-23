import { redirect } from "next/navigation"
import { createClient, hasServerSupabaseEnv } from "@/lib/supabase/server"
import { getProfileByUserId, getDashboardRouteByRole } from "@/lib/auth"
import { isAdminStaffRole, isSalesPipelineRole } from "@/lib/app-roles"
import { getRecruitsForUser, type Recruit } from "./get-recruits"
import { InviteClient } from "./invite-client"

/**
 * Invite page — data is fetched on the server (recruits list) and handed to the
 * client component as initial props, so the list is in the first paint with no
 * loading spinner or client-side request waterfall.
 */
export default async function InvitePage() {
  if (!hasServerSupabaseEnv()) redirect("/")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const { profile } = await getProfileByUserId(supabase, user.id)
  const role = profile?.role ?? ""

  // This page is for sales-pipeline + admin staff. proxy.ts already gates the
  // route; this is a server-side backstop that mirrors the old client check.
  if (!isSalesPipelineRole(role) && !isAdminStaffRole(role)) {
    redirect(getDashboardRouteByRole(role))
  }

  let initialRecruits: Recruit[] = []
  try {
    initialRecruits = await getRecruitsForUser(user.id)
  } catch {
    // Non-fatal — the client can retry via the Refresh button.
    initialRecruits = []
  }

  return (
    <InviteClient
      userId={user.id}
      userName={profile?.fullname ?? user.email ?? "User"}
      currentRole={role || "agent"}
      initialRecruits={initialRecruits}
    />
  )
}
