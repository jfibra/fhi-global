import { NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { SITE_URL } from "@/lib/seo"

export const runtime = "nodejs"

const W = 1200
const H = 630
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"

/**
 * An event's link-share thumbnail (2026-10-04): the WHOLE poster — posters
 * carry their own text, so never cropped — centred on a blurred, darkened copy
 * of itself, as a 1200×630 JPEG. Events used the raw poster as og:image: a
 * WebP that WhatsApp/Messenger show no thumbnail for, in whatever shape it
 * was. Published events only; anything else (or no poster, or sharp failing)
 * gets the site's default card. In outputFileTracingIncludes for sharp.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const fallback = () => NextResponse.redirect(`${SITE_URL.replace(/\/$/, "")}/og-default.jpg`, 302)

  const admin = createAdminSupabase()
  const query = admin.from("events").select("image_url, status, deleted_at")
  const { data: event } = await (UUID_RE.test(slug) ? query.eq("id", slug) : query.eq("slug", slug)).maybeSingle()
  if (!event || event.status !== "published" || event.deleted_at || !event.image_url) return fallback()

  try {
    const res = await fetch(event.image_url as string, { cache: "force-cache" })
    if (!res.ok) return fallback()
    const poster = Buffer.from(await res.arrayBuffer())
    const { default: sharp } = await import("sharp")
    const backdrop = await sharp(poster).resize(W, H, { fit: "cover" }).blur(28).modulate({ brightness: 0.6 }).toBuffer()
    const front = await sharp(poster).resize(W - 96, H - 64, { fit: "inside" }).toBuffer({ resolveWithObject: true })
    const jpg = await sharp(backdrop)
      .composite([{ input: front.data, left: Math.round((W - front.info.width) / 2), top: Math.round((H - front.info.height) / 2) }])
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
    return new Response(new Uint8Array(jpg), { headers: { "Content-Type": "image/jpeg", "Cache-Control": CACHE } })
  } catch {
    return fallback()
  }
}
