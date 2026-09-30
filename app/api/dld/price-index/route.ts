import { NextResponse, type NextRequest } from "next/server"
import { allowRequest, clientIp } from "@/lib/rate-limit"
import { fetchPriceIndex } from "@/lib/dld-price-index"

/**
 * Public proxy for the Dubai Land Department Property Price Index — feeds
 * the public /open-data page (linked from the header's Properties menu).
 *
 * Unauthenticated by design: this is DLD's own public open data, not
 * anything tied to an FHI account. Always served from the shared Postgres
 * cache (lib/dld-price-index.ts, six hours) — no client-supplied `refresh`,
 * so an anonymous visitor can never force a live pull from DLD. Per-IP
 * rate-limited as a floor against endpoint abuse; the response also carries
 * a public Cache-Control so repeat visits are usually served by the CDN or
 * the browser without reaching this route at all.
 */

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  if (!allowRequest(`dld-price-index:${clientIp(req.headers)}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 })
  }

  const result = await fetchPriceIndex(false)
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status })

  return NextResponse.json(result.data, {
    headers: { "Cache-Control": "public, max-age=1800, stale-while-revalidate=21600" },
  })
}
