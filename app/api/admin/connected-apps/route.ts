import { NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { requireRole } from "@/lib/auth-guard"
import { listGrants } from "@/lib/oauth/server"

/**
 * Every live Claude connection, with who it belongs to — the "Claude
 * sign-ins" list on the admin API page. Disconnect anyone with
 * DELETE /api/admin/connected-apps/[id]. Admin staff only.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ProfileRow = { id: string; fullname: string | null; role: string | null; status: string | null }

export async function GET() {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  try {
    const grants = await listGrants()
    const ids = [...new Set(grants.map((g) => g.user_id))]
    const people = new Map<string, ProfileRow>()
    if (ids.length) {
      const { data } = await createAdminSupabase().from("profiles").select("id, fullname, role, status").in("id", ids)
      for (const p of (data ?? []) as ProfileRow[]) people.set(p.id, p)
    }
    return NextResponse.json(
      {
        apps: grants.map((g) => {
          const p = people.get(g.user_id)
          return { id: g.id, user_id: g.user_id, name: p?.fullname ?? null, role: p?.role ?? null, status: p?.status ?? null, client_name: g.client_name, created_at: g.created_at, last_used_at: g.last_used_at }
        }),
      },
      { headers: { "cache-control": "no-store" } },
    )
  } catch (e) {
    console.error("[admin/connected-apps]", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "Couldn't load the connections." }, { status: 500 })
  }
}
