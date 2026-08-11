import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { MapPin, Building2, ArrowLeft, Mail, Phone, ChevronRight } from "lucide-react"
import { createPageMetadata, SITE_URL, truncateDescription, truncateTitle } from "@/lib/seo"
import {
  fetchPublicAgentListingById,
  isUsableListingAgent,
  listingAgentName,
  listingAgentPhone,
  type PublicListingAgent,
  type PublicAgentListingRow,
} from "@/lib/buy/agent-listings-public"
import { roleToLabel } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { pickUnit } from "@/lib/buy/listings-page-logic"
import { fetchSectionPage } from "@/lib/sitemap-sections"
import { breadcrumbList, realEstateListingSchema } from "@/lib/structured-data"
import { JsonLd } from "@/components/json-ld"
import { mergedListingGalleryUrls } from "@/lib/listing-gallery-urls"
import { ListingPhotoMosaic } from "@/components/public/listing-photo-mosaic"
import { TopBar } from "@/components/topbar"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export const revalidate = 120

/**
 * Prerender published listings (production only) so they serve from the ISR
 * cache; the sitemap's enumeration provides the same slug-or-id params the
 * route resolves. New listings render on demand and cache on first hit.
 */
export async function generateStaticParams(): Promise<{ id: string }[]> {
  if (process.env.VERCEL_ENV !== "production") return []
  try {
    const rows = await fetchSectionPage("listings", 1)
    return (rows ?? []).flatMap((r) => {
      const param = r.slug ?? (r.id != null ? String(r.id) : null)
      return param ? [{ id: param }] : []
    })
  } catch {
    return []
  }
}

type Props = { params: Promise<{ id: string }> }

const TEL = "+971567428288"
const EMAIL = "info@fhiglobal.ae"
const WA = "971567428288"

/**
 * The listing agent's details for the enquiry card.
 *
 * Service-role, because neither half is reachable publicly: `profiles` is
 * behind RLS (migration 020) and email lives in auth.users. Same approach as
 * the public business-card page. It runs server-side during ISR, so the key
 * never reaches the browser and the page stays cacheable; any failure falls
 * back to the house contact card rather than breaking the page.
 */
async function fetchListingAgent(
  agentId: string | null | undefined,
): Promise<{ agent: PublicListingAgent | null; email: string }> {
  if (!agentId) return { agent: null, email: "" }
  try {
    const admin = createAdminSupabase()
    const [profileRes, authRes] = await Promise.all([
      admin
        .from("profiles")
        .select("id, fullname, fname, lname, profile_url, role, status, is_deleted, metadata")
        .eq("id", agentId)
        .maybeSingle(),
      admin.auth.admin.getUserById(agentId).catch(() => null),
    ])
    const agent = (profileRes.data as PublicListingAgent | null) ?? null
    return {
      agent: isUsableListingAgent(agent) ? agent : null,
      email: authRes?.data?.user?.email?.trim() ?? "",
    }
  } catch {
    return { agent: null, email: "" }
  }
}

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function formatPriceLine(
  own: number | null,
  from: number | null,
  to: number | null,
  currency: string,
): string {
  const code = (currency || "AED").toUpperCase()
  const useFrom = own ?? from
  const useTo = own ?? to
  if (useFrom == null) return "Price on request"
  const locale = code === "AED" ? "en-AE" : "en-US"
  const fmt = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 0 })
  if (code === "USD") {
    if (useTo != null && useTo !== useFrom) return `$${fmt(useFrom)} – $${fmt(useTo)}`
    return `$${fmt(useFrom)}`
  }
  if (code === "AED") {
    if (useTo != null && useTo !== useFrom) return `AED ${fmt(useFrom)} – ${fmt(useTo)}`
    return `AED ${fmt(useFrom)}`
  }
  if (useTo != null && useTo !== useFrom) return `${code} ${fmt(useFrom)} – ${fmt(useTo)}`
  return `${code} ${fmt(useFrom)}`
}

// Shared between generateMetadata and the page body so the SERP snippet and
// the rendered page can never disagree.
type ListingRowLike = Pick<PublicAgentListingRow, "price" | "unit_type" | "projects">

function listingOwnPrice(row: Pick<PublicAgentListingRow, "price">): number | null {
  const n = row.price == null ? null : typeof row.price === "number" ? row.price : Number(row.price)
  return n != null && Number.isFinite(n) ? n : null
}

function listingLocationLabel(proj: PublicAgentListingRow["projects"]): string {
  return [proj?.city, proj?.location].filter(Boolean).join(", ") || "United Arab Emirates"
}

function listingTypeLabel(row: ListingRowLike, unitType: string | null | undefined): string {
  return (row.unit_type?.trim() || unitType || "Property").replace(/\b\w/g, (c) => c.toUpperCase())
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const { row, error } = await fetchPublicAgentListingById(id)
  // Transient query failure → 5xx (crawlers retry, never deindex); a truly
  // missing row → notFound() here, not a placeholder title, because aborting
  // in metadata is what turns a dead listing URL into a real HTTP 404.
  if (error) throw new Error("Failed to load listing")
  if (!row) notFound()

  // Compose the fallback from structured fields, never from the agent's raw
  // notes: those are free text (deposit terms, commission notes) and read as
  // junk in a SERP snippet.
  const proj = row.projects
  const u = proj ? pickUnit(proj.project_units) : null
  const priceLine = formatPriceLine(
    listingOwnPrice(row),
    proj?.launch_price_from ?? null,
    proj?.launch_price_to ?? null,
    row.currency,
  )
  const facts = [
    u?.bedrooms != null ? `${u.bedrooms} bed` : null,
    u?.bathrooms != null ? `${u.bathrooms} bath` : null,
    priceLine === "Price on request" ? null : priceLine,
  ]
    .filter(Boolean)
    .join(", ")
  const kindLabel = row.listing_kind === "rent" ? "rent" : "sale"
  const description =
    truncateDescription(row.description) ||
    `${listingTypeLabel(row, u?.unit_type)} for ${kindLabel} in ${listingLocationLabel(proj)}${facts ? ` — ${facts}` : ""}.`

  // The customized share card (see ShareCardModal / /og/listing). The
  // updated_at version param makes scrapers re-fetch after every save.
  const ogImageVersion = Date.parse(row.updated_at) || 0
  return createPageMetadata({
    title: truncateTitle(row.title),
    description,
    pathname: `/listings/${row.slug ?? row.id}`,
    imageUrl: `${SITE_URL.replace(/\/$/, "")}/og/listing/${row.id}?v=${ogImageVersion}`,
    keywords: [row.title, "UAE property", kindLabel, "FHI Global"],
  })
}

export default async function PublicAgentListingPage({ params }: Props) {
  const { id } = await params
  const { row, error } = await fetchPublicAgentListingById(id)

  if (error) {
    // Thrown (not rendered) so the response is a real 5xx — crawlers retry a
    // 500 but deindex a 404/soft-404. The friendly UI lives in ./error.tsx.
    throw new Error("Failed to load listing")
  }

  if (!row) {
    notFound()
  }

  const proj = row.projects
  const u = proj ? pickUnit(proj.project_units) : null
  const ownOk = listingOwnPrice(row)
  const galleryUrls = mergedListingGalleryUrls(proj, row.agent_listing_images)
  const galleryItems = galleryUrls.map((image_url, i) => ({ id: i + 1, image_url }))
  const loc = listingLocationLabel(proj)
  const typeLabel = listingTypeLabel(row, u?.unit_type)
  const backHref = row.listing_kind === "rent" ? "/rent" : "/buy"

  // Enquiries go to the agent who owns the listing. Their phone falls back to
  // the house line, so Call and WhatsApp always reach someone even when the
  // agent has no number saved.
  const { agent, email: agentEmail } = await fetchListingAgent(row.agent_id)
  const agentName = listingAgentName(agent)
  const agentTitle = agent?.role ? roleToLabel(agent.role) : "Listing Agent"
  const agentPhone = listingAgentPhone(agent)
  const contactTel = agentPhone || TEL
  const contactWa = (agentPhone || WA).replace(/^\+/, "")
  const contactEmail = agentEmail || EMAIL

  return (
    <div className="min-h-screen bg-[#faf8f4] font-sans">
      <TopBar />
      <Header />

      {/* Photo mosaic — full-bleed, flush under the header (homes.com style) */}
      <div className="relative">
        {galleryItems.length > 0 ? (
          <ListingPhotoMosaic images={galleryItems} fullBleed title={row.title} location={loc} />
        ) : (
          <div className="relative w-full aspect-[16/9] max-h-[420px] bg-[#f3f4f6]">
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[#94a3b8] gap-2">
              <Building2 className="w-16 h-16" />
              <span className="text-sm font-medium">No image</span>
            </div>
          </div>
        )}
        {/* Floating back chip over the photos */}
        <Link
          href={backHref}
          className="absolute top-4 left-4 z-10 inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-bold text-[#0f2940] shadow-md hover:bg-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {row.listing_kind === "rent" ? "rent" : "buy"}
        </Link>
      </div>

      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-16">
        {/* Breadcrumbs — visible trail + BreadcrumbList structured data for
            SEO, plus the listing entity itself (price/photos/location are all
            on the page; the schema mirrors them). */}
        <JsonLd
          schema={[
            breadcrumbList([
              { name: "Home", path: "/" },
              { name: row.listing_kind === "rent" ? "Rent" : "Buy", path: backHref },
              { name: row.title },
            ]),
            realEstateListingSchema({
              name: row.title,
              description: row.description,
              path: `/listings/${row.slug ?? row.id}`,
              images: galleryUrls,
              price: ownOk ?? proj?.launch_price_from,
              currency: row.currency?.trim() || proj?.currency || "AED",
              city: proj?.city,
              street: [proj?.location].filter(Boolean).join(", ") || null,
              latitude: proj?.latitude,
              longitude: proj?.longitude,
              seller: proj?.developers?.name
                ? { name: proj.developers.name, path: proj.developers.slug ? `/${proj.developers.slug}` : null }
                : { name: "FHI Global", path: "/" },
            }),
          ]}
        />
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-[#6b7280] mb-5">
          <Link href="/" className="text-[#0f2940] hover:text-[#d6b357] transition-colors">
            Home
          </Link>
          <ChevronRight className="w-4 h-4 shrink-0 text-[#9ca3af]" />
          <Link href={backHref} className="text-[#0f2940] hover:text-[#d6b357] transition-colors">
            {row.listing_kind === "rent" ? "Rent" : "Buy"}
          </Link>
          <ChevronRight className="w-4 h-4 shrink-0 text-[#9ca3af]" />
          <span className="text-[#d6b357] font-semibold truncate max-w-[60vw]">{row.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
          {/* ── Main details ── */}
          <div className="bg-white rounded-2xl border border-[#e8eaed] shadow-sm p-6 sm:p-8 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-[#d6b357] mb-2">
                  {row.listing_kind === "rent" ? "For rent" : "For sale"} · Agent listing
                </p>
                <p className="font-['Outfit'] text-3xl sm:text-4xl font-bold text-[#0f2940] leading-tight">
                  {formatPriceLine(
                    ownOk,
                    proj?.launch_price_from ?? null,
                    proj?.launch_price_to ?? null,
                    row.currency?.trim() || proj?.currency || "AED",
                  )}
                </p>
              </div>
              {proj?.developers?.logo_url && (
                <Image
                  src={proj.developers.logo_url}
                  alt={proj.developers.name}
                  width={100}
                  height={48}
                  className="object-contain max-h-12 w-auto shrink-0"
                />
              )}
            </div>

            <h1 className="text-lg sm:text-xl font-semibold text-[#374151] leading-snug mb-1.5">{row.title}</h1>
            <p className="inline-flex items-center gap-1.5 text-sm text-[#4b5563] mb-6">
              <MapPin className="w-4 h-4 text-[#d6b357]" />
              {loc}
            </p>

            {/* Specs strip — divided columns like the reference */}
            <div className="flex flex-wrap divide-x divide-[#e8eaed] rounded-xl border border-[#e8eaed] overflow-hidden mb-7">
              <div className="flex-1 min-w-[110px] px-4 py-3 text-center">
                <p className="font-['Outfit'] text-lg font-bold text-[#0f2940] leading-tight">{typeLabel}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280] mt-0.5">Type</p>
              </div>
              {u?.bedrooms != null && (
                <div className="flex-1 min-w-[110px] px-4 py-3 text-center">
                  <p className="font-['Outfit'] text-lg font-bold text-[#0f2940] leading-tight">{u.bedrooms}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280] mt-0.5">
                    Bed{u.bedrooms === 1 ? "" : "s"}
                  </p>
                </div>
              )}
              {u?.bathrooms != null && (
                <div className="flex-1 min-w-[110px] px-4 py-3 text-center">
                  <p className="font-['Outfit'] text-lg font-bold text-[#0f2940] leading-tight">{u.bathrooms}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280] mt-0.5">
                    Bath{u.bathrooms === 1 ? "" : "s"}
                  </p>
                </div>
              )}
              {(u?.size_sqft != null || u?.size_sqm != null) && (
                <div className="flex-1 min-w-[110px] px-4 py-3 text-center">
                  <p className="font-['Outfit'] text-lg font-bold text-[#0f2940] leading-tight">
                    {u?.size_sqft != null
                      ? Number(u.size_sqft).toLocaleString()
                      : Number(u?.size_sqm).toLocaleString()}
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280] mt-0.5">
                    {u?.size_sqft != null ? "Sq Ft" : "Sqm"}
                  </p>
                </div>
              )}
            </div>

            {row.description?.trim() && (
              <p className="text-[#374151] leading-relaxed whitespace-pre-wrap mb-7">{row.description.trim()}</p>
            )}

            {proj?.slug && (
              <p>
                <Link
                  href={proj.developers?.slug ? `/${proj.developers.slug}/${proj.slug}` : `/projects/${proj.slug}`}
                  className="text-sm font-semibold text-[#001f3f] hover:text-[#d6b357] underline underline-offset-2"
                >
                  View developer project: {proj.name}
                </Link>
              </p>
            )}
          </div>

          {/* ── Contact card (sticky, like the reference's agent panel) ── */}
          <aside className="lg:sticky lg:top-24 bg-white rounded-2xl border border-[#e8eaed] shadow-[0_16px_44px_-16px_rgba(0,20,40,0.18)] overflow-hidden">
            {/* Header: the listing's own agent when we have one, otherwise the
                house team — a deactivated agent or one with no phone on file
                must not leave the enquiry pointing nowhere. */}
            <div className="bg-gradient-to-r from-[#001f3f] to-[#002a52] px-5 py-4 flex items-center gap-3">
              {agentName ? (
                <>
                  {agent?.profile_url ? (
                    <Image
                      src={agent.profile_url}
                      alt={agentName}
                      width={44}
                      height={44}
                      className="h-11 w-11 rounded-full object-cover border-2 border-[#d6b357] shrink-0"
                    />
                  ) : (
                    <span className="h-11 w-11 rounded-full border-2 border-[#d6b357] bg-white/10 flex items-center justify-center text-[#d6b357] text-sm font-bold shrink-0">
                      {agentName.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-white text-sm font-bold leading-tight truncate">{agentName}</p>
                    <p className="text-[#d6b357] text-[11px] font-bold uppercase tracking-wider">
                      {agentTitle}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Image src="/FHI_Branding_White.png" alt="FHI Global" width={87} height={32} className="h-8 w-auto object-contain" />
                  <div>
                    <p className="text-white text-sm font-bold leading-tight">FHI Global</p>
                    <p className="text-[#d6b357] text-[11px] font-bold uppercase tracking-wider">Listing Team</p>
                  </div>
                </>
              )}
            </div>
            <div className="p-5 space-y-2.5">
              <p className="rounded-xl bg-[#f8faff] border border-[#e0e7ff] px-4 py-3 text-sm text-[#4b5563] leading-relaxed">
                Hi, I&apos;m interested in <span className="font-semibold text-[#0f2940]">{row.title}</span>.
              </p>
              <a
                href={`https://wa.me/${contactWa}?text=${encodeURIComponent(`Hi, I'm interested in ${row.title}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-[#25d366] text-white text-sm font-bold hover:bg-[#1fb457] transition-colors"
              >
                <WhatsAppGlyph className="w-[18px] h-[18px]" />
                WhatsApp
              </a>
              <a
                href={`tel:${contactTel}`}
                className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-gradient-to-r from-[#d6b357] to-[#c9a449] text-[#001f3f] text-sm font-bold hover:from-[#c9a449] hover:to-[#b8913f] transition-colors"
              >
                <Phone className="w-4 h-4" />
                Call
              </a>
              <a
                href={`mailto:${contactEmail}?subject=Inquiry:%20${encodeURIComponent(row.title)}`}
                className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl border border-[#d1d5db] text-[#0f2940] text-sm font-bold hover:border-[#001f3f] transition-colors"
              >
                <Mail className="w-4 h-4" />
                Email
              </a>
            </div>
          </aside>
        </div>
      </div>

      <Footer />
    </div>
  )
}
