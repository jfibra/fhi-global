import { NextRequest, NextResponse } from "next/server"

// Same-origin relay for construction-update PDFs so pdf.js can render page
// previews. The S3 bucket sends no CORS headers and isn't in connect-src, so
// the browser refuses to fetch it directly; fetching through our own origin
// sidesteps both. Range headers pass through untouched — S3 supports ranged
// reads, so pdf.js pulls the first pages in ~64 KB chunks instead of the
// whole (multi-MB) document.
//
// Strictly scoped to PDFs under our bucket's construction-updates prefix —
// this must never become an open proxy.

export const runtime = "nodejs"
export const maxDuration = 30

const PREFIX = (() => {
  const base = (process.env.S3_PUBLIC_URL ?? "").replace(/\/+$/, "")
  return base ? `${base}/FHI_GLOBAL/construction-updates/` : null
})()

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") ?? ""
  if (!PREFIX || !url.startsWith(PREFIX) || !/\.pdf$/i.test(new URL(url).pathname)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 400 })
  }

  const range = req.headers.get("range")
  const upstream = await fetch(url, {
    headers: range ? { range } : undefined,
    cache: "no-store",
  })
  if (!(upstream.ok || upstream.status === 206) || !upstream.body) {
    return NextResponse.json({ error: `Upstream responded ${upstream.status}.` }, { status: 502 })
  }

  const headers = new Headers()
  for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  // Upload filenames are timestamped-unique, so long immutable caching is safe.
  headers.set("cache-control", "public, max-age=86400, immutable")

  return new Response(upstream.body, { status: upstream.status, headers })
}
