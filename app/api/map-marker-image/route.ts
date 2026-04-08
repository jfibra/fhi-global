import { NextRequest, NextResponse } from "next/server"

/** Same-origin proxy so map marker canvas can read pixels (avoids CORS taint on Supabase/S3). */
function isAllowedImageHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === "localhost" || h.endsWith(".local")) return false
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
    const [a, b] = h.split(".").map(Number)
    if (a === 10 || a === 127 || a === 0) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    if (a === 169 && b === 254) return false
  }
  if (h.endsWith(".supabase.co")) return true
  if (h.includes(".amazonaws.com") || h.endsWith(".amazonaws.com")) return true
  if (h === "aquaproperties.com" || h.endsWith(".aquaproperties.com")) return true
  if (h === "flagcdn.com" || h.endsWith(".flagcdn.com")) return true
  return false
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url")
  if (!raw?.trim()) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 })
  }

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 })
  }

  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return NextResponse.json({ error: "Unsupported protocol" }, { status: 400 })
  }

  if (process.env.NODE_ENV === "production" && target.protocol !== "https:") {
    return NextResponse.json({ error: "HTTPS only" }, { status: 400 })
  }

  if (!isAllowedImageHost(target.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 })
  }

  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 12_000)

  try {
    const res = await fetch(target.toString(), {
      signal: ac.signal,
      redirect: "follow",
      headers: { Accept: "image/*,*/*;q=0.8" },
    })
    clearTimeout(t)

    if (!res.ok) {
      return NextResponse.json({ error: "Upstream failed" }, { status: 502 })
    }

    const ct = res.headers.get("content-type") ?? ""
    if (!ct.startsWith("image/")) {
      return NextResponse.json({ error: "Not an image" }, { status: 415 })
    }

    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 6 * 1024 * 1024) {
      return NextResponse.json({ error: "Too large" }, { status: 413 })
    }

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": ct.split(";")[0].trim(),
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    })
  } catch {
    clearTimeout(t)
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 })
  }
}
