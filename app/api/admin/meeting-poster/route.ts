import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { renderMeetingPosterPng, type MeetingPosterData } from "@/lib/meeting-poster"
import { isSafeRemoteImageUrl } from "@/lib/image-hosts"

/**
 * On-demand meeting poster for FHI Assistant. The whole poster payload
 * travels base64url-encoded in ?d= (stateless — nothing stored), and the
 * admin's session cookie authorizes the render, so chat cards can point an
 * <img> straight here.
 */

export const runtime = "nodejs"
export const maxDuration = 60

const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")

export async function GET(req: NextRequest) {
  const session = await requireRole([...ROLES_ADMIN_STAFF])
  if (!session.ok) {
    // Local preview only: ?secret=<CRON_SECRET> stands in for the admin
    // session while developing. Never active in production.
    const secret = process.env.CRON_SECRET?.trim()
    const qs = req.nextUrl.searchParams.get("secret")
    if (process.env.NODE_ENV === "production" || !secret || qs !== secret) return session.response
  }

  const encoded = req.nextUrl.searchParams.get("d")
  if (!encoded) return NextResponse.json({ error: "d is required" }, { status: 422 })
  let raw: unknown
  try {
    raw = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))
  } catch {
    return NextResponse.json({ error: "Bad payload." }, { status: 422 })
  }
  const p = (raw ?? {}) as Record<string, unknown>
  const data: MeetingPosterData = {
    title: s(p.title, 90),
    subtitle: s(p.subtitle, 140),
    tagline: s(p.tagline, 40),
    date: s(p.date, 60),
    time: s(p.time, 60),
    venue: s(p.venue, 90),
    speakers: (Array.isArray(p.speakers) ? p.speakers : []).slice(0, 6).map((sp) => {
      const o = (sp ?? {}) as Record<string, unknown>
      const photo = s(o.photo, 500)
      return {
        name: s(o.name, 40),
        role: s(o.role, 50),
        topic: s(o.topic, 60),
        // Photos render server-side — only hosts we already trust for images.
        photo: photo && isSafeRemoteImageUrl(photo) ? photo : null,
      }
    }).filter((sp) => sp.name),
  }
  if (!data.title || !data.date || !data.time || !data.venue) {
    return NextResponse.json({ error: "title, date, time and venue are required." }, { status: 422 })
  }

  const png = await renderMeetingPosterPng(data)
  if (!png) return NextResponse.json({ error: "Poster render failed." }, { status: 500 })
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "cache-control": "private, max-age=300",
      "content-disposition": `inline; filename="meeting-poster.png"`,
    },
  })
}
