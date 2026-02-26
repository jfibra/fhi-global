import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PurchaseCategoriesTable } from "./purchase-categories-table"

export const dynamic = "force-dynamic"

export default async function PurchaseCategoriesPage() {
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
  if (!profile || !["super_admin", "admin"].includes(roleValue)) {
    redirect("/dashboard")
  }

  return (
    <PurchaseCategoriesTable
      currentUserId={profile.id}
      currentRole={roleValue}
      userName={profile.fullname || user.email || "User"}
    />
  )
}
