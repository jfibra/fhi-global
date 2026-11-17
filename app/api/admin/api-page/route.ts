import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { canSeeApiPage } from "@/lib/api-catalog"
import { SITE_URL } from "@/lib/seo"

/**
 * What the admin API page needs: whether FHI_EXTERNAL_API_KEY is configured on
 * this server and, for the page's owner only, the key itself — so the example
 * links open and the curl lines copy with the key in place. Nobody else, not
 * even other admins, is handed the key.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  if (!canSeeApiPage(guard.context.userId)) return NextResponse.json({ error: "This page is not for your account." }, { status: 403 })

  const key = process.env.FHI_EXTERNAL_API_KEY?.trim() || null
  return NextResponse.json(
    { configured: !!key, key, site: SITE_URL.replace(/\/$/, ""), environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development" },
    { headers: { "cache-control": "no-store" } },
  )
}
