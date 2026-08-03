import { NextRequest, NextResponse } from "next/server"
import { newsConfigured, trackArticleView } from "@/lib/news-service"
import { allowRequest, clientIp } from "@/lib/rate-limit"

export const runtime = "nodejs"

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,254}$/i

/**
 * Forwards a visitor's article read to the HomesPH News view counter with the
 * site key attached server-side. Always answers 204 — a failed count must
 * never surface to the reader. Rate-limited per IP so this open endpoint
 * can't be used to burn the upstream API's shared request budget.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    slug?: unknown
    placement?: unknown
    referrer?: unknown
    visitor_id?: unknown
  }

  const slug = typeof body.slug === "string" ? body.slug : ""
  if (!SLUG_RE.test(slug) || !newsConfigured()) {
    return new NextResponse(null, { status: 204 })
  }
  if (!allowRequest(`news-view:${clientIp(req.headers)}`, 20, 60_000)) {
    return new NextResponse(null, { status: 204 }) // silently dropped
  }

  const str = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() ? v.slice(0, max) : undefined

  await trackArticleView(slug, {
    placement: str(body.placement, 255) ?? "article",
    referrer: str(body.referrer, 2048),
    visitor_id: str(body.visitor_id, 255),
  })

  return new NextResponse(null, { status: 204 })
}
