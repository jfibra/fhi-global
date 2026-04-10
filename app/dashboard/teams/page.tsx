import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isAdminStaffRole } from "@/lib/app-roles"
import { TeamsDashboardShell } from "./teams-dashboard-shell"

export const dynamic = "force-dynamic"

export default async function TeamsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, fullname, profile_url")
    .eq("id", user.id)
    .single()

  const roleValue = String(profile?.role ?? "").toLowerCase().trim()
  if (!profile || !isAdminStaffRole(profile.role)) {
    redirect("/dashboard")
  }

  return (
    <TeamsDashboardShell
      role={roleValue}
      userName={profile.fullname || user.email || "User"}
      userId={user.id}
    />
  )
}
