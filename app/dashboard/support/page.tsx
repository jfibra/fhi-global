import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SupportTable } from "./support-table"
import { canAccessSupportRole, isSupportAdmin } from "@/lib/support-service"

export const dynamic = "force-dynamic"

export default async function SupportPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, fullname")
    .eq("id", user.id)
    .single()

  const roleValue = String(profile?.role ?? "").toLowerCase().trim()
  if (!profile || !canAccessSupportRole(roleValue)) {
    redirect("/dashboard")
  }
  const isAdmin = isSupportAdmin(roleValue)

  return (
    <SupportTable
      currentUserId={profile.id}
      currentRole={roleValue}
      userName={profile.fullname || user.email || "User"}
      isAdminView={isAdmin}
    />
  )
}
