import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"

export const runtime = "nodejs"

export type DeveloperAccount = {
  id: string
  fullname: string | null
  username: string | null
  status: string | null
  profile_url: string | null
  joined_at: string | null
}

// GET /api/admin/developers/[id]/accounts — the developer USER accounts linked to
// this company (profiles.role = 'developer' AND metadata.developer_id = id), so
// an admin can see who already has portal access before creating another.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const { id } = await params
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("profiles")
    .select("id, fullname, username, status, profile_url, joined_at")
    .eq("role", "developer")
    .eq("metadata->>developer_id", id)
    .not("is_deleted", "is", true)
    .order("joined_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ accounts: (data ?? []) as DeveloperAccount[] })
}
