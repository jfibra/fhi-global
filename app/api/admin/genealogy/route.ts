import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { titleCaseName } from "@/lib/public-profile"
import { buildGenealogy } from "@/lib/genealogy"

/**
 * Admin genealogy (boss via Juliecor, 2026-10-13): any account's tree.
 *   GET ?id=<uuid>  → that person's genealogy (lib/genealogy.ts, the same walk agents get for themselves)
 *   GET             → the recruiters to pick from: everyone with at least one direct recruit, with
 *                     direct and whole-network counts, biggest first.
 * Admin staff only; there is no company-wide single root (many accounts joined without an inviter),
 * so the page is "pick a person".
 */

export type Recruiter = { id: string; name: string; photo: string | null; role: string | null; status: string; direct: number; network: number }

const PAGE = 1000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)

export async function GET(req: NextRequest) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const admin = createAdminSupabase()
  const id = req.nextUrl.searchParams.get("id")

  if (id) {
    if (!UUID.test(id)) return NextResponse.json({ error: "Bad id." }, { status: 400 })
    const { data: p } = await admin.from("profiles").select("fullname, profile_url, role").eq("id", id).maybeSingle()
    if (!p) return NextResponse.json({ error: "No such account." }, { status: 404 })
    try {
      const tree = await buildGenealogy(admin, id, { name: p.fullname as string | null, photo: p.profile_url as string | null, role: p.role as string | null })
      return NextResponse.json(tree, { headers: { "Cache-Control": "no-store" } })
    } catch {
      return NextResponse.json({ error: "Couldn't load the genealogy." }, { status: 500 })
    }
  }

  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, fullname, fname, lname, role, status, profile_url, metadata")
      .not("is_deleted", "is", true)
      .range(from, from + PAGE - 1)
    if (error) return NextResponse.json({ error: "Couldn't load the accounts." }, { status: 500 })
    rows.push(...((data ?? []) as Record<string, unknown>[]))
    if (!data || data.length < PAGE) break
  }
  const childrenOf = new Map<string, string[]>()
  for (const p of rows) {
    const meta = (p.metadata ?? {}) as Record<string, unknown>
    const by = str(meta.invited_by)
    if (!by || str(meta.developer_invite_id)) continue
    childrenOf.set(by, [...(childrenOf.get(by) ?? []), String(p.id)])
  }
  const networkOf = new Map<string, number>()
  const network = (id: string, seen = new Set<string>()): number => {
    if (networkOf.has(id)) return networkOf.get(id)!
    seen.add(id)
    let n = 0
    for (const c of childrenOf.get(id) ?? []) if (!seen.has(c)) n += 1 + network(c, seen)
    networkOf.set(id, n)
    return n
  }
  const recruiters: Recruiter[] = rows
    .filter((p) => (childrenOf.get(String(p.id)) ?? []).length > 0)
    .map((p) => ({
      id: String(p.id),
      name: titleCaseName(str(p.fullname) ?? [p.fname, p.lname].filter((v) => typeof v === "string" && v).join(" ")) || "Unnamed account",
      photo: str(p.profile_url),
      role: str(p.role),
      status: (str(p.status) ?? "pending").toLowerCase(),
      direct: (childrenOf.get(String(p.id)) ?? []).length,
      network: network(String(p.id)),
    }))
    .sort((a, b) => b.network - a.network || b.direct - a.direct || a.name.localeCompare(b.name))
  return NextResponse.json({ recruiters }, { headers: { "Cache-Control": "no-store" } })
}
