import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { listDeveloperLogins } from "@/lib/developer-logins"

/**
 * Admin → Developers Login: every developer login (lib/developer-logins.ts).
 * Never returns a password — there is none to read. Admin staff only.
 */

export const runtime = "nodejs"

export async function GET() {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  try {
    return NextResponse.json(await listDeveloperLogins(createAdminSupabase()))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
