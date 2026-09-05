import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { renderBirthdayPosterPng } from "@/lib/birthday-poster"

/**
 * On-demand birthday poster for FHI Assistant — the same artwork the greeting
 * emails use, rendered for one member. Admin staff only (session cookie), so
 * the chat can simply point an <img> at this route.
 */

export const runtime = "nodejs"
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const session = await requireRole([...ROLES_ADMIN_STAFF])
  if (!session.ok) return session.response

  const uid = req.nextUrl.searchParams.get("uid")?.trim()
  if (!uid) return NextResponse.json({ error: "uid is required" }, { status: 422 })

  const admin = createAdminSupabase()
  const { data: p } = await admin
    .from("profiles")
    .select("fullname, fname, profile_url")
    .eq("id", uid)
    .maybeSingle()
  if (!p) return NextResponse.json({ error: "No such profile." }, { status: 404 })

  const png = await renderBirthdayPosterPng({
    name: (p.fullname ?? p.fname ?? "You").trim().replace(/\s+/g, " "),
    photoUrl: p.profile_url ?? null,
    designId: req.nextUrl.searchParams.get("design")?.trim() || undefined,
  })
  if (!png) return NextResponse.json({ error: "Poster render failed." }, { status: 500 })

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      // The member may change their photo — keep it fresh, cache briefly.
      "cache-control": "private, max-age=300",
      "content-disposition": `inline; filename="happy-birthday.png"`,
    },
  })
}
