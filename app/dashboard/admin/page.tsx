import { redirect } from "next/navigation"
import { isInactiveProfile, getProfileByUserId, roleToLabel } from "@/lib/auth"
import { isAdminStaffRole } from "@/lib/app-roles"
import { createClient } from "@/lib/supabase/server"
import { AdminDashboardContent } from "./_dashboard"

export const dynamic = "force-dynamic"

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { profile } = await getProfileByUserId(supabase, user.id)
  if (!profile) redirect("/login")
  if (isInactiveProfile(profile)) redirect("/account-inactive")

  const roleValue = String(profile.role ?? "").toLowerCase()
  if (!isAdminStaffRole(profile.role)) redirect("/dashboard")

  return (
    <AdminDashboardContent
      roleValue={roleValue}
      roleLabel={roleToLabel(roleValue)}
      userName={profile.fullname ?? user.email ?? "Admin"}
      userId={user.id}
    />
  )
}
