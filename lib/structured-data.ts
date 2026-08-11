import { SITE_URL, absoluteUrl } from "@/lib/seo"
import { SOCIAL_URLS, isExternalSocial } from "@/lib/social"

/**
 * Schema.org builders — pure functions returning plain objects, following the
 * faqPageSchema precedent (lib/faqs.ts). Serialize at the emit site with
 * <JsonLd schema={...}/> (components/json-ld.tsx), which routes through
 * jsonLdScript() so DB-driven strings can never break out of the script tag.
 *
 * Ground rules:
 * - Schema mirrors VISIBLE content only — an ItemList carries the items the
 *   page actually renders, never the full catalog.
 * - `undefined` members are fine: JSON.stringify prunes them.
 * - Never HowTo (deprecated); FAQPage only where the FAQs render (homepage).
 */

/** Company contact facts — single source for schema, keep the visible strings
 *  on /contact and the footer in sync with these. */
export const FHI_PHONE = "+971 56 742 8288"
export const FHI_EMAIL = "info@fhiglobal.ae"

export type BreadcrumbItem = {
  name: string
  /** Site-relative path; omit on the final (current-page) crumb. */
  path?: string
}

export function breadcrumbList(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.path ? absoluteUrl(item.path) : undefined,
    })),
  }
}

/** Site-name recognition. Homepage only — Google reads WebSite from the root
 *  document. No SearchAction: the site has no crawlable search-results URL. */
export function webSiteSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "FHI Global",
    url: SITE_URL,
  }
}

/** The FHI Global brand entity (homepage). sameAs carries only real profile
 *  URLs — placeholder "#" entries in SOCIAL_URLS are filtered out, and bare
 *  platform domains (the old bug) corrupt entity reconciliation. */
export function fhiOrganizationSchema(): Record<string, unknown> {
  const sameAs = Object.values(SOCIAL_URLS).filter(isExternalSocial)
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "FHI Global",
    url: SITE_URL,
    logo: absoluteUrl("/android-chrome-512x512.png"),
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        telephone: FHI_PHONE,
        email: FHI_EMAIL,
        url: absoluteUrl("/contact"),
        areaServed: "AE",
        // English only — the site ships no Arabic content or hreflang.
        availableLanguage: ["en"],
      },
    ],
    sameAs: sameAs.length > 0 ? sameAs : undefined,
  }
}

/** A property developer's profile page (/{slug}). */
export function developerOrganizationSchema(dev: {
  name: string
  slug: string | null
  logo_url?: string | null
  description?: string | null
  address?: string | null
  website_url?: string | null
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: dev.name,
    url: dev.slug ? absoluteUrl(`/${dev.slug}`) : undefined,
    logo: dev.logo_url || undefined,
    description: dev.description || undefined,
    address: dev.address
      ? { "@type": "PostalAddress", streetAddress: dev.address, addressCountry: "AE" }
      : undefined,
    sameAs: dev.website_url ? [dev.website_url] : undefined,
  }
}

/** ItemList of the entries the page actually renders. */
export function itemListSchema(
  items: { name: string; path: string }[],
  name?: string,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  }
}

function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null
  // Number("") === 0 — an empty-string coordinate must read as absent, not as
  // (0,0) "Null Island" GeoCoordinates.
  if (typeof value === "string" && value.trim() === "") return null
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export type RealEstateListingInput = {
  name: string
  description?: string | null
  /** Site-relative canonical path of the listing/project page. */
  path: string
  images: (string | null | undefined)[]
  price?: number | string | null
  currency?: string | null
  city?: string | null
  /** Free-text street/locality line (e.g. [location, community].join(", ")). */
  street?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
  seller?: { name: string; path?: string | null; url?: string | null } | null
}

/** Property listing/project schema — the semantics the project page has always
 *  emitted: Offer only for a finite positive price, geo only when both
 *  coordinates parse, images filtered to truthy. */
export function realEstateListingSchema(input: RealEstateListingInput): Record<string, unknown> {
  const price = toFiniteNumber(input.price)
  const lat = toFiniteNumber(input.latitude)
  const lng = toFiniteNumber(input.longitude)
  const street = input.street?.trim()
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: input.name,
    description: input.description || input.name,
    url: absoluteUrl(input.path),
    image: input.images.filter(Boolean),
    offers:
      price != null && price > 0
        ? { "@type": "Offer", priceCurrency: (input.currency ?? "AED").toUpperCase(), price }
        : undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: input.city || undefined,
      streetAddress: street || undefined,
      addressCountry: "AE",
    },
    geo: lat != null && lng != null ? { "@type": "GeoCoordinates", latitude: lat, longitude: lng } : undefined,
    seller: input.seller
      ? {
          "@type": "Organization",
          name: input.seller.name,
          url: input.seller.path ? absoluteUrl(input.seller.path) : input.seller.url ?? undefined,
        }
      : undefined,
  }
}

/** event_date is a bare timestamp; render it with the fixed +04:00 Gulf offset
 *  (no DST in the UAE) — emitting server-local time would shift the instant. */
function toDubaiIso(iso: string): string | undefined {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return undefined
  const shifted = new Date(d.getTime() + 4 * 3_600_000)
  return shifted.toISOString().replace(/\.\d{3}Z$/, "+04:00")
}

export function eventSchema(event: {
  title: string
  description?: string | null
  /** Site-relative path of the event page. */
  path: string
  imageUrl?: string | null
  eventDate?: string | null
  venue?: string | null
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description || undefined,
    url: absoluteUrl(event.path),
    image: event.imageUrl || undefined,
    startDate: event.eventDate ? toDubaiIso(event.eventDate) : undefined,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.venue || "Dubai, UAE",
      address: { "@type": "PostalAddress", addressCountry: "AE" },
    },
    organizer: { "@type": "Organization", name: "FHI Global", url: SITE_URL },
  }
}

export type Office = { city: string; address: string; phone: string; email: string }

/** A physical FHI office (/contact). Hours mirror the visible string
 *  "Sun–Thu: 9:00 AM – 6:00 PM" — keep both in sync. */
export function realEstateAgentOfficeSchema(office: Office): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: `FHI Global — ${office.city}`,
    url: absoluteUrl("/contact"),
    telephone: office.phone,
    email: office.email,
    address: { "@type": "PostalAddress", streetAddress: office.address, addressCountry: "AE" },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
        opens: "09:00",
        closes: "18:00",
      },
    ],
    parentOrganization: { "@type": "Organization", name: "FHI Global", url: SITE_URL },
  }
}

/** The agent directory (/agents) — Person nodes carry no url because agents
 *  have no public profile URLs on the main site. */
export function personListSchema(people: { name: string; image?: string | null }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "FHI Global Agents",
    numberOfItems: people.length,
    itemListElement: people.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Person",
        name: p.name,
        image: p.image || undefined,
        worksFor: { "@type": "Organization", name: "FHI Global", url: SITE_URL },
      },
    })),
  }
}
