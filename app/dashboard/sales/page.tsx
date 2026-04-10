import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { canAccessSalesReportsArea } from "@/lib/app-roles"
import { SalesTable } from "./sales-table"

export const dynamic = "force-dynamic"

export default async function SalesPage() {
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
  if (!profile || !canAccessSalesReportsArea(profile.role)) {
    redirect("/dashboard")
  }

  return (
    <SalesTable
      currentUserId={profile.id}
      currentRole={roleValue}
      userName={profile.fullname || user.email || "User"}
    />
  )
}
