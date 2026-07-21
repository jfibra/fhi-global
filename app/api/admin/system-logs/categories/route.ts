import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"

// Distinct categories + per-category counts for the filter dropdown.

export const runtime = "nodejs"

export async function GET() {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const admin = createAdminSupabase()
  const { data, error } = await admin.rpc("audit_categories")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ counts: data ?? {} })
}
