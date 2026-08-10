import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { createAdminSupabase } from "@/lib/admin-supabase"

/**
 * Name-search over active accounts, for the poster studios' "pick a teammate"
 * box.
 *
 * Service-role with an explicit column list: the browser client can't read
 * other people's profiles under RLS, and this must never hand back more than
 * the public face of an account. No email, phone or role leaves here — just
 * what a poster needs.
 *
 * Any signed-in active account may search; the result is the same directory
 * already published at /agents.
 */

export const runtime = "nodejs"

type Row = { id: string; fullname: string | null; profile_url: string | null }

export async function GET(req: NextRequest) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim()
  if (q.length < 2) return NextResponse.json({ people: [] })

  // Escape PostgREST's pattern metacharacters so a search for "%" can't
  // widen the match.
  const safe = q.replace(/[%_\\,()]/g, " ").trim()
  if (!safe) return NextResponse.json({ people: [] })

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("profiles")
    .select("id, fullname, profile_url")
    .eq("status", "active")
    .eq("is_deleted", false)
    .ilike("fullname", `%${safe}%`)
    .order("fullname", { ascending: true })
    .limit(12)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const people = ((data ?? []) as Row[])
    .filter((p) => (p.fullname ?? "").trim())
    .map((p) => ({
      id: p.id,
      name: (p.fullname ?? "").trim(),
      photo: p.profile_url?.trim() || null,
    }))

  return NextResponse.json({ people })
}
