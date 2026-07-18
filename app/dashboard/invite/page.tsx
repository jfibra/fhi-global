import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getProfileByUserId, isInactiveProfile } from "@/lib/auth"
import { isAdminStaffRole, isSalesPipelineRole } from "@/lib/app-roles"
import { InviteClient } from "./invite-client"

export const dynamic = "force-dynamic"

export default async function InvitePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { profile } = await getProfileByUserId(supabase, user.id)
  if (!profile) redirect("/login")
  if (isInactiveProfile(profile)) redirect("/account-inactive")

  // Recruiters: sales pipeline roles and admin staff.
  if (!isSalesPipelineRole(profile.role) && !isAdminStaffRole(profile.role)) {
    redirect("/dashboard")
  }

  return (
    <InviteClient
      userId={user.id}
      userName={profile.fullname ?? user.email ?? "User"}
      currentRole={profile.role ?? "agent"}
    />
  )
}
