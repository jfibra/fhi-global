import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { isDeveloperRole } from "@/lib/app-roles"
import { EBOOKS } from "@/lib/ebooks"

/**
 * Same-origin passthrough for ebook PDFs, used only by the Book view.
 *
 * The Page view embeds the PDF directly and needs none of this — the browser
 * hands the URL to its own viewer. Book view is different: it draws each page
 * with pdf.js, which has to READ the bytes in JavaScript, and a cross-origin
 * read needs `Access-Control-Allow-Origin` from the host. leuteriorealty.com
 * doesn't send one, so the fetch has to come from our own origin instead.
 *
 * Two things keep this from being an open relay: the target must be a URL
 * already in the catalogue (an exact-match allowlist, so no attacker-supplied
 * address can be reached — an SSRF hole otherwise), and the caller must hold a
 * session for a role that can see Ebooks at all.
 *
 * Range headers are forwarded in both directions so pdf.js keeps fetching
 * pages on demand rather than pulling a whole 5 MB book up front.
 */

export const runtime = "nodejs"

/** Exact URLs we will proxy. Anything else is refused. */
const ALLOWED = new Set(EBOOKS.map((b) => b.url))

export async function GET(req: NextRequest) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  if (isDeveloperRole(session.context.profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const target = req.nextUrl.searchParams.get("url") ?? ""
  if (!ALLOWED.has(target)) {
    return NextResponse.json({ error: "Unknown ebook" }, { status: 400 })
  }

  const range = req.headers.get("range")
  let upstream: Response
  try {
    upstream = await fetch(target, {
      headers: range ? { Range: range } : undefined,
      // Books change rarely; let the platform cache what it can.
      cache: "no-store",
    })
  } catch {
    return NextResponse.json({ error: "Could not reach the ebook host" }, { status: 502 })
  }

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json({ error: "Ebook unavailable" }, { status: 502 })
  }

  const headers = new Headers()
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const v = upstream.headers.get(h)
    if (v) headers.set(h, v)
  }
  headers.set("Cache-Control", "private, max-age=3600")
  // The bytes are a PDF for our own viewer, never a page to render.
  headers.set("Content-Disposition", "inline")
  headers.set("X-Content-Type-Options", "nosniff")

  return new NextResponse(upstream.body, { status: upstream.status, headers })
}
