import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminUsersClient } from "@/app/dashboard/admin/users/users-client"

export const dynamic = "force-dynamic"

export default async function SuperAdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "super_admin") {
    redirect("/dashboard/superadmin")
  }

  return (
    <AdminUsersClient
      currentRole="super_admin"
      roleLabel="Super Admin"
      roleColor="#7c3aed"
    />
  )
}
