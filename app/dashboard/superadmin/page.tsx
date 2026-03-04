import { redirect } from "next/navigation"
import { isInactiveProfile, getProfileByUserId, roleToLabel } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { AdminDashboardContent } from "../admin/_dashboard"

export const dynamic = "force-dynamic"

export default async function SuperAdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { profile } = await getProfileByUserId(supabase, user.id)
  if (!profile) redirect("/login")
  if (isInactiveProfile(profile)) redirect("/account-inactive")
  const roleValue = String(profile.role ?? "").toLowerCase()
  if (roleValue !== "super_admin") redirect("/dashboard")
  return (
    <AdminDashboardContent
      roleValue={roleValue}
      roleLabel={roleToLabel(roleValue)}
      userName={profile.fullname ?? user.email ?? "Admin"}
      userId={user.id}
    />
  )
}
