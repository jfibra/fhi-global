import { NextRequest, NextResponse } from "next/server"
import { indexNowConfigured, submitToIndexNow } from "@/lib/indexnow"

export const runtime = "nodejs"

/**
 * Manual/external IndexNow submission endpoint, guarded by a shared secret.
 * POST { urls: string[] } with header x-indexnow-secret. Only same-origin
 * URLs are forwarded (enforced again inside submitToIndexNow).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.INDEXNOW_SUBMIT_SECRET
  if (!secret || req.headers.get("x-indexnow-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!indexNowConfigured()) {
    return NextResponse.json({ error: "IndexNow is not configured" }, { status: 503 })
  }

  const body = (await req.json().catch(() => ({}))) as { urls?: unknown }
  const urls = Array.isArray(body.urls)
    ? body.urls.filter((u): u is string => typeof u === "string").slice(0, 10000)
    : []
  if (urls.length === 0) {
    return NextResponse.json({ error: "Provide a non-empty urls array" }, { status: 422 })
  }

  const submitted = await submitToIndexNow(urls)
  return NextResponse.json({ ok: true, submitted })
}
