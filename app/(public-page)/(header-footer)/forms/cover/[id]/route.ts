import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { formCoverVersion, getFormCover, isPdfFileName } from "@/lib/form-cover"

/**
 * /forms/cover/<id>?v=<version> — page 1 of a form on /forms as a WebP cover,
 * rendered and cached by lib/form-cover.ts. Public like the shelf, with the
 * download route's lookup and S3 prefix guard (app/api/forms/[id]). It lives
 * outside /api (robots.txt blocks that) so the covers are crawlable images,
 * like the /og/* cards.
 *
 * Only the current ?v= is served: a missing or old one redirects to it, so a
 * made-up query string can't fill the CDN or force a render, and the one URL
 * that is served can be cached for a year.
 */

export const runtime = "nodejs"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A year in the browser (the URL changes with the file); the CDN rechecks daily, so a deleted form's cover drops out. */
const COVER_CACHE = "public, max-age=31536000, immutable, s-maxage=86400, stale-while-revalidate=604800"

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!UUID.test(id)) return NextResponse.json({ error: "Unknown form" }, { status: 404 })

  const { data: row, error } = await createAdminSupabase()
    .from("documents")
    .select("file_url, file_name")
    .eq("id", id)
    .maybeSingle<{ file_url: string; file_name: string }>()
  if (error) return NextResponse.json({ error: "Could not load the form" }, { status: 503 })
  if (!row) return NextResponse.json({ error: "Unknown form" }, { status: 404 })

  const s3Base = process.env.S3_PUBLIC_URL?.replace(/\/$/, "")
  if (!s3Base || !row.file_url.startsWith(`${s3Base}/FHI_GLOBAL/documents/`) || !isPdfFileName(row.file_name)) {
    return NextResponse.json({ error: "No cover for this form" }, { status: 404 })
  }

  const version = formCoverVersion(row.file_url)
  if (req.nextUrl.searchParams.get("v") !== version) {
    // Temporary: the current ?v= moves on when COVER_REV is bumped.
    return new NextResponse(null, {
      status: 307,
      headers: { Location: `/forms/cover/${id}?v=${version}`, "Cache-Control": "public, max-age=300, s-maxage=300" },
    })
  }

  try {
    const webp = await getFormCover(row.file_url)
    return new NextResponse(new Uint8Array(webp), {
      headers: { "Content-Type": "image/webp", "Cache-Control": COVER_CACHE },
    })
  } catch (err) {
    console.error(`[forms/cover] ${id}: render failed`, err)
    return NextResponse.json({ error: "Cover unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
