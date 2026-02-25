import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/admin-supabase"

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string | null }>()

  if (!profile || !["super_admin", "admin"].includes(String(profile.role ?? ""))) {
    return null
  }

  return user
}

export async function GET() {
  const caller = await requireAdmin()
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminSupabase()

  const { data, error } = await admin
    .from("developers")
    .select("id, name, slug")
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ developers: data ?? [] })
}
