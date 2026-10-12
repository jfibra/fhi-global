import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"

/**
 * Public passthrough for one form on /forms — the download-only twin of
 * app/api/document-proxy (which needs a staff session and also serves the
 * fillable viewer). Visitors never see the S3 address: the row is looked up
 * by id with the service-role client, the target must sit under our own
 * documents prefix (SSRF guard), and the bytes stream through with Range
 * support so the page's first-page thumbnails (pdf.js) load the same way the
 * dashboard's do. `?download=1` makes it a real download (Content-Disposition:
 * attachment — the `download` attribute alone is ignored cross-origin).
 */

export const runtime = "nodejs"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!UUID.test(id)) return NextResponse.json({ error: "Unknown form" }, { status: 404 })

  const { data: row } = await createAdminSupabase()
    .from("documents")
    .select("file_url, file_name")
    .eq("id", id)
    .maybeSingle<{ file_url: string; file_name: string }>()
  if (!row) return NextResponse.json({ error: "Unknown form" }, { status: 404 })

  const s3Base = process.env.S3_PUBLIC_URL?.replace(/\/$/, "")
  if (!s3Base || !row.file_url.startsWith(`${s3Base}/FHI_GLOBAL/documents/`)) {
    return NextResponse.json({ error: "Form unavailable" }, { status: 404 })
  }

  const range = req.headers.get("range")
  let upstream: Response
  try {
    upstream = await fetch(row.file_url, { headers: range ? { Range: range } : undefined, cache: "no-store" })
  } catch {
    return NextResponse.json({ error: "Could not reach storage" }, { status: 502 })
  }
  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json({ error: "Form unavailable" }, { status: 502 })
  }

  const headers = new Headers()
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const v = upstream.headers.get(h)
    if (v) headers.set(h, v)
  }
  // Same policy as document-proxy: never let a cached failed load replay.
  headers.set("Cache-Control", "private, no-store")
  headers.set("X-Content-Type-Options", "nosniff")
  headers.set("X-Robots-Tag", "noindex")
  const download = req.nextUrl.searchParams.get("download") === "1"
  const safeName = row.file_name.replace(/["\\]/g, "_")
  headers.set("Content-Disposition", download ? `attachment; filename="${safeName}"` : "inline")

  return new NextResponse(upstream.body, { status: upstream.status, headers })
}
