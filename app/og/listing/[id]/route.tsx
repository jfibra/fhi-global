import { ImageResponse } from "next/og"
import fs from "node:fs/promises"
import path from "node:path"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { assembleListingMarketingData, type MarketingListingRow } from "@/lib/flyer/marketing-data"
import { sanitizeOgCardOptions, OG_CARD_W, OG_CARD_H } from "@/lib/flyer/og-card"
import { isSafeRemoteImageUrl } from "@/lib/image-hosts"
import ListingShareCard from "@/components/dashboard/listings/marketing/ListingShareCard"

// Social link-preview image for a public agent listing. Renders the same
// ListingShareCard the agent customized in the dashboard ShareCardModal,
// using the options saved on agent_listings.og_card_options (NULL = default
// navy/gold card). Unpublished/unknown ids get the branded fallback card.
// The metadata on /listings/[id] points here with a ?v=<updated_at> param so
// scrapers re-fetch after every save; the param itself is ignored.

export const runtime = "nodejs"

// Without this header ImageResponse defaults to a YEAR of immutable caching —
// the page already versions this URL with ?v=updated_at, but scrapers that
// strip params would keep a stale card forever. 5 min matches business-card.
const CACHE_HEADERS = { "cache-control": "public, max-age=300, s-maxage=300" }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// The white FHI mark, memoized as a data URL — satori can't fetch relative
// URLs and a self-HTTP fetch would be fragile in dev, so read it from disk.
let logoCache: string | null = null
async function logoDataUrl(): Promise<string> {
  if (!logoCache) {
    const buf = await fs.readFile(path.join(process.cwd(), "public", "FHI_Branding_White.png"))
    logoCache = `data:image/png;base64,${buf.toString("base64")}`
  }
  return logoCache
}

async function fallbackBrandCard() {
  const logo = await logoDataUrl()
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 26,
          background: "#001f3f",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="FHI Global" width={300} height={110} style={{ width: 300, height: 110, objectFit: "contain" }} />
        <div style={{ display: "flex", fontSize: 30, color: "#d6b357", fontWeight: 700, letterSpacing: 3 }}>
          DUBAI REAL ESTATE
        </div>
      </div>
    ),
    { width: OG_CARD_W, height: OG_CARD_H, headers: CACHE_HEADERS },
  )
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const trimmed = (id ?? "").trim()
  if (!UUID_RE.test(trimmed)) return fallbackBrandCard()

  // Service role: the card needs the agent's profile for the "Listed by"
  // strip and profiles RLS is authenticated-only. Visibility is enforced
  // explicitly below (published + not deleted), like the other /og routes.
  const supabase = createAdminSupabase()
  const { data } = await supabase
    .from("agent_listings")
    .select(
      "id, agent_id, project_id, title, price, currency, listing_kind, unit_type, og_card_options, agent_listing_images ( url, sort_order )",
    )
    .eq("id", trimmed)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle()

  if (!data) return fallbackBrandCard()

  const row = data as unknown as MarketingListingRow & { og_card_options: unknown }
  const card = await assembleListingMarketingData(supabase, row)
  const options = sanitizeOgCardOptions(row.og_card_options, {
    isRent: row.listing_kind === "rent",
    gallery: card.gallery,
  })
  // Raw absolute URLs — satori fetches these server-side, no proxy needed.
  // Host-allowlisted (agents can insert arbitrary image URLs via the REST
  // API); a non-allowlisted URL falls back to the no-photo panel rather
  // than making this server fetch it.
  const photoCandidate = options.photo ?? card.gallery[0] ?? null
  const photoSrc = photoCandidate && isSafeRemoteImageUrl(photoCandidate) ? photoCandidate : null

  return new ImageResponse(
    <ListingShareCard data={card} options={options} photoSrc={photoSrc} logoSrc={await logoDataUrl()} />,
    { width: OG_CARD_W, height: OG_CARD_H, headers: CACHE_HEADERS },
  )
}
