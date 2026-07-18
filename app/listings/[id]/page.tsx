import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { MapPin, Building2, ArrowLeft, Mail, Phone } from "lucide-react"
import { createPageMetadata, SITE_URL } from "@/lib/seo"
import { fetchPublicAgentListingById } from "@/lib/buy/agent-listings-public"
import { pickUnit } from "@/lib/buy/listings-page-logic"
import { mergedListingGalleryUrls } from "@/lib/listing-gallery-urls"
import { ProjectGallery } from "@/components/public/project-gallery"
import { TopBar } from "@/components/topbar"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export const revalidate = 120

type Props = { params: Promise<{ id: string }> }

const TEL = "+971567428288"
const EMAIL = "info@fhiglobal.ae"
const WA = "971567428288"

const lightYellowBtn =
  "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#fff8e1] border border-[#f5e6a8] text-[#0f2940] text-sm font-semibold hover:bg-[#fff3cc] transition-colors"

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const { row, error } = await fetchPublicAgentListingById(id)
  if (error || !row) {
    return { title: "Listing | FHI Global" }
  }
  const description =
    row.description?.trim().slice(0, 155) ||
    `${row.title} — Browse this listing on FHI Global.`
  // The customized share card (see ShareCardModal / /og/listing). The
  // updated_at version param makes scrapers re-fetch after every save.
  const ogImageVersion = Date.parse(row.updated_at) || 0
  return createPageMetadata({
    title: `${row.title} | FHI Global`,
    description,
    pathname: `/listings/${row.id}`,
    imageUrl: `${SITE_URL.replace(/\/$/, "")}/og/listing/${row.id}?v=${ogImageVersion}`,
    keywords: [row.title, "UAE property", row.listing_kind === "rent" ? "rent" : "sale", "FHI Global"],
  })
}

export default async function PublicAgentListingPage({ params }: Props) {
  const { id } = await params
  const { row, error } = await fetchPublicAgentListingById(id)

  if (error) {
    return (
      <div className="min-h-screen bg-[#faf8f4] font-sans">
        <TopBar />
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-[#475569]">We couldn&apos;t load this listing. Please try again later.</p>
          <Link href="/buy" className="mt-6 inline-block text-[#d6b357] font-semibold hover:underline">
            Back to buy
          </Link>
        </div>
        <Footer />
      </div>
    )
  }

  if (!row) {
    notFound()
  }

  const proj = row.projects
  const u = proj ? pickUnit(proj.project_units) : null
  const own =
    row.price == null ? null : typeof row.price === "number" ? row.price : Number(row.price)
  const ownOk = own != null && Number.isFinite(own) ? own : null
  const galleryUrls = mergedListingGalleryUrls(proj, row.agent_listing_images)
  const galleryItems = galleryUrls.map((image_url, i) => ({ id: i + 1, image_url }))
  const loc = [proj?.city, proj?.location].filter(Boolean).join(", ") || "United Arab Emirates"
  const typeLabel = (row.unit_type?.trim() || u?.unit_type || "Property").replace(/\b\w/g, (c) => c.toUpperCase())
  const backHref = row.listing_kind === "rent" ? "/rent" : "/buy"

  return (
    <div className="min-h-screen bg-[#faf8f4] font-sans">
      <TopBar />
      <Header />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#0f2940] hover:text-[#d6b357] mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {row.listing_kind === "rent" ? "rent" : "buy"}
        </Link>

        <div className="bg-white rounded-2xl border border-[#e8eaed] shadow-sm overflow-hidden">
          {galleryItems.length > 0 ? (
            <div className="p-4 sm:p-6 border-b border-[#e8eaed]">
              <ProjectGallery images={galleryItems} />
            </div>
          ) : (
            <div className="relative w-full aspect-[16/9] max-h-[420px] bg-[#f3f4f6]">
              <div className="absolute inset-0 flex flex-col items-center justify-center text-[#94a3b8] gap-2">
                <Building2 className="w-16 h-16" />
                <span className="text-sm font-medium">No image</span>
              </div>
            </div>
          )}

          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-[#d6b357] mb-2">
                  {row.listing_kind === "rent" ? "For rent" : "For sale"} · Agent listing
                </p>
                <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-bold text-[#0f2940] leading-tight">
                  {row.title}
                </h1>
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

            <p className="text-xl sm:text-2xl font-bold text-[#0f2940] mb-4">
              {formatPriceLine(
                ownOk,
                proj?.launch_price_from ?? null,
                proj?.launch_price_to ?? null,
                row.currency?.trim() || proj?.currency || "AED",
              )}
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#4b5563] mb-6">
              <span className="font-semibold text-[#0f2940]">{typeLabel}</span>
              {u?.bedrooms != null && <span>{u.bedrooms} bed{u.bedrooms === 1 ? "" : "s"}</span>}
              {u?.bathrooms != null && <span>{u.bathrooms} bath{u.bathrooms === 1 ? "" : "s"}</span>}
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#d6b357]" />
                {loc}
              </span>
            </div>

            {row.description?.trim() && (
              <p className="text-[#374151] leading-relaxed whitespace-pre-wrap mb-8">{row.description.trim()}</p>
            )}

            {proj?.slug && (
              <p className="mb-8">
                <Link
                  href={`/projects/${proj.slug}`}
                  className="text-sm font-semibold text-[#001f3f] hover:text-[#d6b357] underline underline-offset-2"
                >
                  View developer project: {proj.name}
                </Link>
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-2 border-t border-[#e8eaed]">
              <a href={`mailto:${EMAIL}?subject=Inquiry:%20${encodeURIComponent(row.title)}`} className={lightYellowBtn}>
                <Mail className="w-4 h-4 text-[#0f2940]" />
                Email
              </a>
              <a href={`tel:${TEL}`} className={lightYellowBtn}>
                <Phone className="w-4 h-4 text-[#0f2940]" />
                Call
              </a>
              <a
                href={`https://wa.me/${WA}?text=${encodeURIComponent(`Hi, I'm interested in ${row.title}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#d8f5e4] border border-[#86efac] text-[#166534] text-sm font-semibold hover:bg-[#c4eed8] transition-colors"
              >
                <WhatsAppGlyph className="w-[18px] h-[18px] text-[#25d366]" />
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
