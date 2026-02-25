import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminUsersClient } from "./users-client"

export const dynamic = "force-dynamic"

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || !["super_admin", "admin"].includes(profile.role ?? "")) {
    redirect("/dashboard")
  }

  return <AdminUsersClient currentRole={profile.role ?? "admin"} />
}
