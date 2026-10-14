import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { invitableRolesFor, isAdminStaffRole } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { buildMyTeam } from "@/lib/my-team"
import { renderTopSellersImage } from "@/lib/my-team-share-image"

/**
 * "Top Sellers" poster for My Team (boss via Juliecor, 2026-10-14): a 1080×1350
 * picture (the portrait size Facebook, Instagram and WhatsApp show uncropped)
 * that a leader downloads or shares to their group — their team's logo, the
 * period, a podium of the top three with photos, the next two, and the team
 * total. Drawn by lib/my-team-share-image.tsx (ranked like the page's podium).
 *
 *   GET ?from=YYYY-MM-DD&to=YYYY-MM-DD&label=October%202026&amounts=1
 *   GET ...&id=<uuid>   admin staff only — any recruiter's team (admin Team Performance)
 *
 * It shows sale figures, so it is session-scoped and never cached by a CDN:
 * every response is `private, no-store`, including the PNG fallback.
 */

export const runtime = "nodejs"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DAY = /^\d{4}-\d{2}-\d{2}$/
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

export async function GET(req: NextRequest) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  const { userId, profile } = session.context
  const sp = req.nextUrl.searchParams

  const asked = sp.get("id")
  let rootId = userId
  if (asked && asked !== userId) {
    if (!isAdminStaffRole(profile.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (!UUID.test(asked)) return NextResponse.json({ error: "Bad id." }, { status: 400 })
    rootId = asked
  } else if (invitableRolesFor(profile.role).length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const from = DAY.test(sp.get("from") ?? "") ? sp.get("from") : null
  const to = DAY.test(sp.get("to") ?? "") ? sp.get("to") : null
  const label = clip((sp.get("label") ?? "").trim() || "All time", 28)
  const amounts = sp.get("amounts") !== "0"

  const admin = createAdminSupabase()
  let fallback = { name: profile.fullname as string | null, photo: profile.profile_url as string | null, role: profile.role as string | null }
  if (rootId !== userId) {
    const { data: p } = await admin.from("profiles").select("fullname, profile_url, role").eq("id", rootId).maybeSingle()
    if (!p) return NextResponse.json({ error: "No such account." }, { status: 404 })
    fallback = { name: p.fullname as string | null, photo: p.profile_url as string | null, role: p.role as string | null }
  }

  let team
  try {
    team = await buildMyTeam(admin, rootId, fallback)
  } catch {
    return NextResponse.json({ error: "Couldn't load the team." }, { status: 500 })
  }
  return renderTopSellersImage({ team, from, to, label, amounts, origin: req.nextUrl.origin })
}
