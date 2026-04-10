import { redirect } from "next/navigation"
import { isAdminStaffRole } from "@/lib/app-roles"
import { createClient } from "@/lib/supabase/server"
import { ProjectsDashboardShell } from "./projects-dashboard-shell"

export const dynamic = "force-dynamic"

export default async function ProjectsPage() {
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
    <ProjectsDashboardShell
      role={roleValue}
      userName={profile.fullname || user.email || "User"}
      userId={user.id}
    />
  )
}
