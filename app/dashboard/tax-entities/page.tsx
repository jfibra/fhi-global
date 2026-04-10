import { redirect } from "next/navigation"
import { isAdminStaffRole } from "@/lib/app-roles"
import { createClient } from "@/lib/supabase/server"
import { TaxEntitiesTable } from "./tax-entities-table"

export const dynamic = "force-dynamic"

export default async function TaxEntitiesPage() {
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
  if (!profile || !isAdminStaffRole(profile.role)) {
    redirect("/dashboard")
  }

  return (
    <TaxEntitiesTable
      currentRole={roleValue}
      userName={profile.fullname || user.email || "User"}
    />
  )
}
