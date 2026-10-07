import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireActiveSession } from "@/lib/auth-guard"
import { createClient } from "@/lib/supabase/server"

// Purges the ISR cache of a listing's public page after its owner changes
// something that feeds the page metadata (currently: saving a share card,
// which versions the og:image URL off updated_at). Without this the page —
// and therefore the ?v= cache-bust — stays stale for up to `revalidate`
// seconds, so an immediate re-share would scrape the old card.

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response

  const body = (await req.json().catch(() => null)) as { listingId?: unknown } | null
  const listingId = typeof body?.listingId === "string" ? body.listingId.trim() : ""
  if (!listingId) {
    return NextResponse.json({ error: "Missing listingId" }, { status: 400 })
  }

  // RLS-scoped read + explicit owner check: only the listing's agent may
  // trigger a purge for it.
  const supabase = await createClient()
  const { data } = await supabase
    .from("agent_listings")
    .select("id, slug, agent_id")
    .eq("id", listingId)
    .maybeSingle()

  const listing = data as { id: string; slug: string | null; agent_id: string } | null
  if (!listing || listing.agent_id !== session.context.userId) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 })
  }

  // The public page is cached per URL and the canonical one is the slug
  // (/listings/luxury-2br-marina); the uuid form is the legacy link. Purging
  // only the uuid left the slug page — the one shared and indexed — stale.
  revalidatePath(`/listings/${listing.id}`)
  if (listing.slug) revalidatePath(`/listings/${listing.slug}`)
  return NextResponse.json({ ok: true })
}
