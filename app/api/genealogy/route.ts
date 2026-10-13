import { NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { invitableRolesFor } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { buildGenealogy } from "@/lib/genealogy"

export type { Genealogy as GenealogyResponse, GenealogyNode } from "@/lib/genealogy"

/**
 * The caller's genealogy (boss via Juliecor, 2026-10-13) — strictly
 * session-scoped: the root is always the signed-in account, there is no id
 * parameter. See lib/genealogy.ts for the walk.
 */
export async function GET() {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  const { userId, profile } = session.context
  // Whoever may recruit may see their own tree (same ladder as the invite routes).
  if (invitableRolesFor(profile.role).length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  try {
    const tree = await buildGenealogy(createAdminSupabase(), userId, { name: profile.fullname, photo: profile.profile_url, role: profile.role })
    return NextResponse.json(tree, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Couldn't load your genealogy." }, { status: 500 })
  }
}
