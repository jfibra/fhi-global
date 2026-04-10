"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { MapPin, Building2, Mail, Phone, Bed, Bath } from "lucide-react"

export type BuyPropertyCardData = {
  id: string
  name: string
  slug: string
  /** When set (e.g. agent listing), the price/title link goes here instead of `/projects/[slug]`. */
  detail_path?: string | null
  main_image: string | null
  /** Full gallery (developer project + sales-uploaded photos), in display order. */
  gallery_urls?: string[]
  description: string | null
  city: string | null
  location: string | null
  launch_price_from: number | null
  launch_price_to: number | null
  currency: string | null
  developers: { name: string; logo_url: string | null; slug: string | null } | null
  unit_type: string | null
  bedrooms: number | null
  bathrooms: number | null
  size_sqft: number | null
  size_sqm: number | null
}

function formatPrice(from: number | null, to: number | null, currency = "AED") {
  if (from == null) return "Price on request"
  const code = (currency || "AED").toUpperCase()
  const locale = code === "AED" ? "en-AE" : "en-US"
  const fmt = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 0 })
  if (code === "USD") {
    if (to != null && to !== from) return `$${fmt(from)} – $${fmt(to)}`
    return `$${fmt(from)}`
  }
  if (code === "AED") {
    if (to != null && to !== from) return `AED ${fmt(from)} – ${fmt(to)}`
    return `AED ${fmt(from)}`
  }
  const prefix = code === "PHP" ? "Php" : code
  if (to != null && to !== from) {
    return `${prefix} ${fmt(from)} – ${fmt(to)}`
  }
  return `${prefix} ${fmt(from)}`
}

const TEL = "+97143001234"
const EMAIL = "info@fhiglobal.com"
const WA = "97143001234"

/** Reference: light yellow buttons (Email / Call). */
const lightYellowBtn =
  "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#fff8e1] border border-[#f5e6a8] text-[#0f2940] text-sm font-semibold hover:bg-[#fff3cc] transition-colors"

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

export function BuyPropertyCard({ property }: { property: BuyPropertyCardData }) {
  const [imgIndex, setImgIndex] = useState(0)
  const images =
    property.gallery_urls && property.gallery_urls.length > 0
      ? property.gallery_urls
      : property.main_image
        ? [property.main_image]
        : []
  const n = Math.max(images.length, 1)
  const src = images[imgIndex] ?? null
  const detailHref = property.detail_path?.trim() || `/projects/${property.slug}`

  const loc = [property.city, property.location].filter(Boolean).join(", ") || "United Arab Emirates"
  const typeLabel = (property.unit_type || "Apartment").replace(/\b\w/g, (c) => c.toUpperCase())
  const areaPart =
    property.size_sqm != null
      ? `${property.size_sqm.toLocaleString("en-AE")} sqm`
      : property.size_sqft != null
        ? `${property.size_sqft.toLocaleString("en-AE")} sqft`
        : null
  const tagline =
    property.description?.trim() ||
    `Spacious 1BR Apartment | High Finishing | Prime Location`

  return (
    <article className="bg-white rounded-xl border border-[#d1d5db] shadow-sm overflow-hidden flex flex-col md:flex-row">
      <div className="relative w-full md:w-[min(44%,400px)] shrink-0 aspect-[4/3] md:aspect-auto md:min-h-[260px] bg-[#f3f4f6]">
        {src ? (
          <Image
            src={src}
            alt={property.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 400px"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[#94a3b8] gap-2">
            <Building2 className="w-12 h-12" />
            <span className="text-xs font-medium">No image</span>
          </div>
        )}

        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
          {Array.from({ length: Math.max(images.length, 1) }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={() => setImgIndex(i % n)}
              className={`h-1.5 rounded-full transition-all ${
                i === imgIndex ? "w-6 bg-[#d6b357]" : "w-1.5 bg-white/90"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="relative flex-1 flex flex-col p-5 md:p-6 min-w-0">
        {property.developers?.logo_url && (
          <div className="absolute top-4 right-4 md:top-5 md:right-5">
            <Image
              src={property.developers.logo_url}
              alt={property.developers.name}
              width={88}
              height={44}
              className="object-contain max-h-11 w-auto"
            />
          </div>
        )}

        <Link
          href={detailHref}
          className="font-['Outfit'] text-2xl md:text-[1.7rem] font-bold text-[#0f2940] leading-tight mb-3 pr-12 md:pr-28 block hover:text-[#d6b357] transition-colors w-fit max-w-full"
        >
          {formatPrice(
            property.launch_price_from,
            property.launch_price_to,
            property.currency ?? "AED"
          )}
        </Link>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[#4b5563] mb-3">
          <span className="font-semibold text-[#0f2940]">{typeLabel}</span>
          {property.bedrooms != null && (
            <span className="inline-flex items-center gap-1.5">
              <Bed className="w-4 h-4 text-[#d6b357]" strokeWidth={2} />
              <span>
                {property.bedrooms} Bed{property.bedrooms === 1 ? "" : "s"}
              </span>
            </span>
          )}
          {property.bathrooms != null && (
            <span className="inline-flex items-center gap-1.5">
              <Bath className="w-4 h-4 text-[#d6b357]" strokeWidth={2} />
              <span>
                {property.bathrooms} Bath{property.bathrooms === 1 ? "" : "s"}
              </span>
            </span>
          )}
          {areaPart && (
            <span>
              Area: <span className="font-medium text-[#374151]">{areaPart}</span>
            </span>
          )}
        </div>

        <p className="text-sm font-medium text-[#c17f2e] leading-relaxed line-clamp-2 mb-4">{tagline}</p>

        <div className="flex items-start gap-2 text-sm font-medium text-[#0f2940] mb-5">
          <MapPin className="w-4 h-4 text-[#d6b357] shrink-0 mt-0.5" />
          <span>{loc}</span>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2">
          <a
            href={`mailto:${EMAIL}?subject=Inquiry:%20${encodeURIComponent(property.name)}`}
            className={lightYellowBtn}
          >
            <Mail className="w-4 h-4 text-[#0f2940]" />
            Email
          </a>
          <a href={`tel:${TEL}`} className={lightYellowBtn}>
            <Phone className="w-4 h-4 text-[#0f2940]" />
            Call
          </a>
          <a
            href={`https://wa.me/${WA}?text=${encodeURIComponent(`Hi, I'm interested in ${property.name}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#d8f5e4] border border-[#86efac] text-[#166534] text-sm font-semibold hover:bg-[#c4eed8] transition-colors"
          >
            <WhatsAppGlyph className="w-[18px] h-[18px] text-[#25d366]" />
            WhatsApp
          </a>
        </div>
      </div>
    </article>
  )
}
