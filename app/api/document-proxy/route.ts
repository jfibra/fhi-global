import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_DOCUMENT_LIBRARY } from "@/lib/app-roles"
import { createClient } from "@/lib/supabase/server"

/**
 * Same-origin passthrough for uploaded documents (Library → Documents) —
 * used for the in-page pdf.js preview (inline, Range requests) and Download.
 *
 * The HTML `download` attribute on an <a> is only honoured for a same-origin
 * URL — for a cross-origin one (our S3 bucket) browsers silently ignore it
 * and just navigate to the file instead of saving it. Routing through our
 * own origin with `?download=1` fixes that: it sets Content-Disposition:
 * attachment, an actual download, not a hint the browser can ignore.
 *
 * Without `download=1` the file is served `inline` with Range passthrough —
 * that is what the in-page pdf.js preview (PdfFormViewer) and the shelf's
 * PdfThumbnail fetch, since pdf.js needs a same-origin URL it can read.
 *
 * The target must both sit under our own S3 documents prefix (an SSRF guard)
 * and match a real row the caller's session can read (RLS already scopes
 * that to admin staff, same role gate as the page).
 */

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const guard = await requireRole([...ROLES_DOCUMENT_LIBRARY])
  if (!guard.ok) return guard.response

  const target = req.nextUrl.searchParams.get("url") ?? ""
  const download = req.nextUrl.searchParams.get("download") === "1"

  const s3Base = process.env.S3_PUBLIC_URL?.replace(/\/$/, "")
  if (!s3Base || !target.startsWith(`${s3Base}/FHI_GLOBAL/documents/`)) {
    return NextResponse.json({ error: "Invalid document URL" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: row } = await supabase.from("documents").select("file_name").eq("file_url", target).maybeSingle<{ file_name: string }>()
  if (!row) {
    return NextResponse.json({ error: "Unknown document" }, { status: 404 })
  }

  const range = req.headers.get("range")
  let upstream: Response
  try {
    upstream = await fetch(target, {
      headers: range ? { Range: range } : undefined,
      cache: "no-store",
    })
  } catch {
    return NextResponse.json({ error: "Could not reach storage" }, { status: 502 })
  }

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json({ error: "Document unavailable" }, { status: 502 })
  }

  const headers = new Headers()
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const v = upstream.headers.get(h)
    if (v) headers.set(h, v)
  }
  // Not cached: a stale copy of an earlier failed/blocked load would keep
  // getting replayed by the browser instead of a fresh request picking up a
  // server-side fix (this bit us once already — see the frame-ancestors note
  // in next.config.mjs).
  headers.set("Cache-Control", "private, no-store")
  const safeName = row.file_name.replace(/["\\]/g, "_")
  headers.set("Content-Disposition", download ? `attachment; filename="${safeName}"` : "inline")
  headers.set("X-Content-Type-Options", "nosniff")

  return new NextResponse(upstream.body, { status: upstream.status, headers })
}
