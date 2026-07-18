import { NextRequest, NextResponse } from "next/server"

// Same-origin image passthrough. The marketing generators (Flyer /
// Announcement) rasterize a DOM node to a canvas with html2canvas; remote S3
// images would taint that canvas (cross-origin) and make the PNG export throw.
// Serving them back through our own origin sidesteps CORS entirely.
//
// Locked to an allowlist of image hosts we actually serve from so this can't
// be turned into an open proxy / SSRF vector.

export const runtime = "nodejs"

function allowedHost(host: string): boolean {
  const h = host.toLowerCase()
  let s3Host = ""
  try {
    s3Host = process.env.S3_PUBLIC_URL ? new URL(process.env.S3_PUBLIC_URL).host.toLowerCase() : ""
  } catch {
    s3Host = ""
  }
  return (
    h === s3Host ||
    h.endsWith(".amazonaws.com") ||
    h.endsWith(".cloudfront.net") ||
    h.endsWith(".supabase.co") ||
    h.endsWith(".supabase.in")
  )
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url")
  if (!raw) return new NextResponse("Missing url", { status: 400 })

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return new NextResponse("Invalid url", { status: 400 })
  }
  if (target.protocol !== "https:") {
    return new NextResponse("Only https is allowed", { status: 400 })
  }
  if (!allowedHost(target.host)) {
    return new NextResponse("Host not allowed", { status: 403 })
  }

  try {
    const upstream = await fetch(target.toString(), {
      // Revalidate occasionally; listing photos are effectively immutable.
      next: { revalidate: 3600 },
    })
    if (!upstream.ok || !upstream.body) {
      return new NextResponse("Upstream error", { status: 502 })
    }
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg"
    if (!contentType.startsWith("image/")) {
      return new NextResponse("Not an image", { status: 415 })
    }
    const buf = await upstream.arrayBuffer()
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch {
    return new NextResponse("Fetch failed", { status: 502 })
  }
}
