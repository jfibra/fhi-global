import "server-only"

import { timingSafeEqual } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"
import { allowRequest, clientIp } from "@/lib/rate-limit"

/**
 * The keyed external API (boss via Juliecor, 2026-11-17): FHI data for the
 * company's own systems — first the cross-company AI chat for admins and
 * agents. One key, FHI_EXTERNAL_API_KEY, sent as "Authorization: Bearer <key>"
 * or "x-api-key: <key>" — or, for a quick look in a browser, as ?key=<key>
 * (code should use the header; a key in a URL ends up in logs and history).
 * With no key configured the endpoints answer 503, never open.
 * (GET /api/external/users predates this and is still open by request; it
 * does not use this guard.)
 */

export function requireExternalKey(req: NextRequest): NextResponse | null {
  const key = process.env.FHI_EXTERNAL_API_KEY?.trim()
  if (!key) return NextResponse.json({ error: "FHI_EXTERNAL_API_KEY is not configured." }, { status: 503 })
  if (!allowRequest(`external-api:${clientIp(req.headers)}`, 600, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many requests — try again in a few minutes." }, { status: 429 })
  }
  const auth = req.headers.get("authorization") ?? ""
  const sent = (auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : req.headers.get("x-api-key") ?? req.nextUrl.searchParams.get("key") ?? "").trim()
  const a = Buffer.from(sent, "utf8")
  const b = Buffer.from(key, "utf8")
  if (!sent || a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized — send the API key as Authorization: Bearer <key>." }, { status: 401 })
  }
  return null
}

/** page (≥1) and limit (1–100) from the query string. */
export function pageParams(q: URLSearchParams, defaultLimit = 50): { page: number; limit: number; from: number; to: number } {
  const page = Math.max(1, Math.floor(Number(q.get("page")) || 1))
  const limit = Math.min(100, Math.max(1, Math.floor(Number(q.get("limit")) || defaultLimit)))
  return { page, limit, from: (page - 1) * limit, to: page * limit - 1 }
}

export const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
