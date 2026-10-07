import { SITE_URL, absoluteUrl } from "@/lib/seo"
import { eventLastDayStart } from "@/lib/events/dates"
import { venuePlace } from "@/lib/events/venue"
import { socialProfileUrls } from "@/lib/social"
import { COMPANY, companyMapsHref, companyPhoneE164 } from "@/lib/company"
import { isSinglePersonName } from "@/lib/agent-site"

/**
 * Schema.org builders — pure functions returning plain objects, following the
 * faqPageSchema precedent (lib/faqs.ts). Serialize at the emit site with
 * <JsonLd schema={...}/> (components/json-ld.tsx), which routes through
 * jsonLdScript() so DB-driven strings can never break out of the script tag.
 *
 * Ground rules:
 * - Schema mirrors VISIBLE content only — an ItemList carries the items the
 *   page actually renders, never the full catalog; the legal name and licence
 *   in the company node are the ones the footer, /contact and /about print.
 * - `undefined` members are fine: JSON.stringify prunes them.
 * - Never HowTo (deprecated); FAQPage only where the FAQs render on the page.
 * - Company facts come from lib/company.ts — never retype them here.
 */

/** The company node's @id. Every page that mentions FHI refers to this one id,
 *  so Google reconciles them to a single entity. */
export const ORG_ID = absoluteUrl("/#organization")
export const WEBSITE_ID = absoluteUrl("/#website")

const LOGO_URL = absoluteUrl("/android-chrome-512x512.png")

/**
 * A compact, typed reference to the company node for publisher / organizer /
 * worksFor / seller fields. Google reads one page at a time, so a bare
 * {"@id"} would leave those fields nameless on the page that emits them —
 * the reference carries the essentials, and the shared @id ties it to the
 * full node emitted on the home page, /contact and /about.
 */
export function orgRef(): Record<string, unknown> {
  return {
    "@type": "RealEstateAgent",
    "@id": ORG_ID,
    name: COMPANY.name,
    url: SITE_URL,
    logo: LOGO_URL,
  }
}

/**
 * A typed reference to the WebSite node (emitted in full on the home page) for `isPartOf`. Google reads one
 * page at a time, so — like orgRef() — it carries the essentials instead of a bare {"@id"}.
 */
export function webSiteRef(): Record<string, unknown> {
  return { "@type": "WebSite", "@id": WEBSITE_ID, name: COMPANY.name, url: SITE_URL }
}

/**
 * The @id of the Person on an agent's website. The site's own ProfilePage declares it as its main entity, and
 * the /agents roster names the same id for that agent, so Google reads one person, not two.
 */
export const agentPersonId = (sitePath: string) => `${absoluteUrl(sitePath)}#person`

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
    "@id": WEBSITE_ID,
    name: COMPANY.name,
    // Google's site-name feature reads these on the home page; "FHI Global" alone
    // loses to FHI 360 (the NGO) and to the half-dozen spellings in circulation.
    alternateName: COMPANY.alternateNames.length > 0 ? [...COMPANY.alternateNames] : undefined,
    url: SITE_URL,
    inLanguage: "en",
    publisher: orgRef(),
  }
}

/**
 * The FHI Global company node — emitted in full on the home page, /contact and
 * /about, referenced by @id everywhere else (orgRef()). A RealEstateAgent is a
 * LocalBusiness, so the address, geo and opening hours are valid on it.
 *
 * Identifiers (RERA ORN, trade licence) appear only when lib/company.ts has
 * them, and only because the footer, /contact and /about print the same
 * values — schema must mirror what the page shows. sameAs carries real profile
 * pages only (socialProfileUrls): no "#" placeholders, no wa.me chat link.
 */
export function fhiOrganizationSchema(): Record<string, unknown> {
  const sameAs = socialProfileUrls()
  const identifiers = [
    COMPANY.reraOrn ? { "@type": "PropertyValue", propertyID: "RERA ORN", name: "RERA ORN", value: COMPANY.reraOrn } : null,
    COMPANY.tradeLicence
      ? { "@type": "PropertyValue", propertyID: "Trade Licence No.", name: "Trade Licence No.", value: COMPANY.tradeLicence }
      : null,
  ].filter(Boolean)
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "@id": ORG_ID,
    name: COMPANY.name,
    legalName: COMPANY.legalName || undefined,
    alternateName: COMPANY.alternateNames.length > 0 ? [...COMPANY.alternateNames] : undefined,
    description:
      "Dubai-based real estate brokerage and property portal listing off-plan and ready properties from the UAE's leading developers.",
    url: SITE_URL,
    logo: LOGO_URL,
    image: absoluteUrl("/og-default.jpg"),
    telephone: companyPhoneE164(),
    email: COMPANY.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: COMPANY.address.street,
      addressLocality: COMPANY.address.locality,
      addressRegion: COMPANY.address.region,
      addressCountry: COMPANY.address.country,
    },
    geo: { "@type": "GeoCoordinates", latitude: COMPANY.geo.latitude, longitude: COMPANY.geo.longitude },
    hasMap: companyMapsHref(),
    // Mirrors the visible "Sunday to Thursday, 9:00 AM to 6:00 PM" on /contact.
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [...COMPANY.hours.days],
        opens: COMPANY.hours.opens,
        closes: COMPANY.hours.closes,
      },
    ],
    // Dubai first: the RERA registration is Dubai's. Wider claims wait on confirming
    // what the brokerage is licensed to advertise elsewhere.
    areaServed: [
      { "@type": "City", name: "Dubai" },
      { "@type": "Country", name: "United Arab Emirates" },
    ],
    identifier: identifiers.length > 0 ? identifiers : undefined,
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        telephone: companyPhoneE164(),
        email: COMPANY.email,
        url: absoluteUrl("/contact"),
        areaServed: "AE",
        // English only — the site ships no Arabic content or hreflang.
        availableLanguage: ["en"],
      },
    ],
    sameAs: sameAs.length > 0 ? sameAs : undefined,
  }
}

/** The developer's own entity node — shared by its page on this site and by every project
 *  that names it as the seller, so both describe ONE developer, not two. */
export const developerNodeId = (slug: string) => `${absoluteUrl(`/${slug}`)}#developer`

/**
 * A developer's page on this site (/{slug}): a CollectionPage of its projects
 * ABOUT the developer organization. The developer's `url` is its own website, not
 * this page — this page used to be declared as the developer's url, which made
 * fhiglobal.ae claim to be the developer. `address` is passed through as PLAIN TEXT,
 * exactly as the hero prints it: developers.address is free text that is often not a
 * structured address ("…Headquater-Dubai-UAE"), so no PostalAddress or country is
 * invented from it.
 */
export function developerPageSchema(dev: {
  name: string
  slug: string
  logo_url?: string | null
  description?: string | null
  website_url?: string | null
  address?: string | null
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${dev.name} projects`,
    url: absoluteUrl(`/${dev.slug}`),
    isPartOf: webSiteRef(),
    about: {
      "@type": "Organization",
      "@id": developerNodeId(dev.slug),
      name: dev.name,
      url: dev.website_url || undefined,
      logo: dev.logo_url || undefined,
      description: dev.description?.trim() || undefined,
      address: dev.address?.trim() || undefined,
      sameAs: dev.website_url ? [dev.website_url] : undefined,
    },
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
  /** The top of the range, when the page shows "from X to Y" (a project's launch prices). */
  priceTo?: number | string | null
  /**
   * "exact" (default): the page states THE price — an agent's own listing — and becomes an Offer.
   * "from": the page states a starting price, perhaps a range (a developer's project) and becomes an
   * AggregateOffer with lowPrice/highPrice; an Offer carrying `price` would say the starting price IS the price.
   */
  priceKind?: "exact" | "from"
  currency?: string | null
  /** An off-plan project is on pre-sale. Completed projects make no availability claim — "InStock" would be an unseen stock claim. */
  offPlan?: boolean
  city?: string | null
  /** Free-text street/locality line (e.g. [location, community].join(", ")). */
  street?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
  /** Who sells it: the developer (a project page) or FHI itself (an agent's listing; the default). null = say nothing. */
  seller?: Record<string, unknown> | null
}

/**
 * Property listing/project schema. A RealEstateListing is a WebPage, so the
 * place sits in `about` (address and geo are not WebPage properties — they were
 * on the listing itself) and the sale in an Offer, which exists only for a finite
 * positive price (an Offer without one is a validator warning and asserts nothing).
 * Images are deduped and capped at 10 — project pages carried up to 71 identical
 * URLs.
 */
export function realEstateListingSchema(input: RealEstateListingInput): Record<string, unknown> {
  const price = toFiniteNumber(input.price)
  const priceTo = toFiniteNumber(input.priceTo)
  const lat = toFiniteNumber(input.latitude)
  const lng = toFiniteNumber(input.longitude)
  const street = input.street?.trim()
  // Free-text cities come with stray spaces ("Dubai " is on a handful of project pages).
  const city = input.city?.trim()
  const images = [...new Set(input.images.filter((u): u is string => Boolean(u)))].slice(0, 10)
  const seller = input.seller === undefined ? orgRef() : input.seller ?? undefined
  const priceCurrency = (input.currency ?? "AED").toUpperCase()
  const availability = input.offPlan ? "https://schema.org/PreSale" : undefined
  const offers =
    price == null || price <= 0
      ? undefined
      : input.priceKind === "from"
        ? {
            "@type": "AggregateOffer",
            priceCurrency,
            lowPrice: price,
            // A range only when the top really is above the bottom — "from X to X" is one price.
            highPrice: priceTo != null && priceTo > price ? priceTo : undefined,
            availability,
            seller,
          }
        : { "@type": "Offer", priceCurrency, price, availability, seller }
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: input.name,
    description: input.description?.trim() || input.name,
    url: absoluteUrl(input.path),
    isPartOf: webSiteRef(),
    image: images.length > 0 ? images : undefined,
    about: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: city || undefined,
        streetAddress: street || undefined,
        addressCountry: "AE",
      },
      geo: lat != null && lng != null ? { "@type": "GeoCoordinates", latitude: lat, longitude: lng } : undefined,
    },
    offers,
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

/**
 * An agent hosting their own event. Names the person, links their website only when they have a published one.
 * A couple or team name ("Carlos & Michelle Guinto") is not one Person — the agent-site pages leave Person
 * markup off for it too — so it is named as an Organization (and, being no employee, without `worksFor`).
 */
export function personOrganizer(name: string, sitePath?: string | null): Record<string, unknown> {
  const url = sitePath ? absoluteUrl(sitePath) : undefined
  if (!isSinglePersonName(name)) return { "@type": "Organization", name, url }
  return { "@type": "Person", name, url, worksFor: orgRef() }
}

/** A sister brand running a company event (Filipino Homes, Homes PH, …) — the organizer the page's brand chip shows. */
export function brandOrganizer(name: string): Record<string, unknown> {
  return { "@type": "Organization", name }
}

/**
 * Event schema, or null when the page cannot honestly be an event Google can
 * show: no date, or no venue evidence (see lib/events/venue.ts). Returning null
 * leaves the node out — the caller keeps its breadcrumb. Before this, a missing
 * venue became the made-up place "Dubai, UAE" (company events) or "To be
 * announced" (agents'), and every Manila roadshow was stamped country "AE".
 *
 * Times: the stored timestamp is read as Dubai wall time (+04:00), which is what
 * the page prints ("GST"). For a venue outside the UAE that offset is a guess —
 * the organiser may have typed Manila time — so dates are emitted without a time
 * there; four hours cannot move a morning start onto another day.
 *
 * `organizer`: undefined = FHI Global, null = leave it out, otherwise the node.
 */
export function eventSchema(event: {
  title: string
  description?: string | null
  /** Site-relative path of the page this schema belongs to (its canonical copy). */
  path: string
  imageUrl?: string | null
  eventDate?: string | null
  /** Consecutive days (migration 071) — gives the event its endDate. */
  eventDays?: number | null
  /** Per-day start times (072). */
  dayTimes?: unknown
  venue?: string | null
  /** The pin picked with the venue (migration 068), when there is one. */
  latitude?: number | string | null
  longitude?: number | string | null
  organizer?: Record<string, unknown> | null
}): Record<string, unknown> | null {
  if (!event.eventDate) return null
  const place = venuePlace(event.venue, event.latitude, event.longitude)
  if (!place) return null

  // Gulf wall time is only known for a UAE venue; anywhere else (or an unknown country) the date alone is honest.
  const withTime = place.countryCode === "AE"
  const start = toDubaiIso(event.eventDate)
  if (!start) return null
  const lastDay = (event.eventDays ?? 1) > 1 ? eventLastDayStart(event.eventDate, event.eventDays, event.dayTimes) : null
  const lastIso = lastDay ? toDubaiIso(lastDay.toISOString()) : undefined
  const url = absoluteUrl(event.path)

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": `${url}#event`,
    name: event.title,
    description: event.description?.trim() || undefined,
    url,
    image: event.imageUrl || undefined,
    startDate: withTime ? start : start.slice(0, 10),
    // A multi-day event runs through the whole last day, so its end is the date alone.
    endDate: lastIso ? lastIso.slice(0, 10) : undefined,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: place.name,
      address:
        place.streetAddress || place.countryCode
          ? {
              "@type": "PostalAddress",
              streetAddress: place.streetAddress,
              addressLocality: place.locality,
              addressCountry: place.countryCode,
            }
          : place.text,
      geo: place.geo ? { "@type": "GeoCoordinates", latitude: place.geo.latitude, longitude: place.geo.longitude } : undefined,
    },
    organizer: event.organizer === undefined ? orgRef() : event.organizer ?? undefined,
  }
}

/** FAQ rich results — the questions must be visibly rendered on the page
 *  with the same wording, or Google treats the markup as spam. */
export function faqPageSchema(faqs: { q: string; a: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  }
}

/**
 * The WebPage node for /about and /contact: a plain WebPage subtype (AboutPage / ContactPage) that sits in
 * the site and is ABOUT the company node. Those two pages already emit the full company node and a
 * breadcrumb; this is what ties the page itself to them. Not for guide pages — reviewedGuideSchemas owns the
 * "#webpage" id there.
 */
export function webPageSchema(input: {
  type?: "WebPage" | "AboutPage" | "ContactPage"
  path: string
  name: string
  description?: string | null
}): Record<string, unknown> {
  const url = absoluteUrl(input.path)
  return {
    "@context": "https://schema.org",
    "@type": input.type ?? "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: input.name,
    description: input.description?.trim() || undefined,
    inLanguage: "en",
    isPartOf: webSiteRef(),
    about: orgRef(),
  }
}

/**
 * A buyer guide that a named licensed person has reviewed, as two schema nodes: the WebPage (where
 * `reviewedBy` and `lastReviewed` live — they are WebPage properties, not Article's) and the Article
 * that is its main entity, authored and published by the company node. The reviewer is credited as
 * reviewer, not as author: they checked the copy, they did not necessarily write it.
 *
 * Emit ONLY when the page also prints the reviewer line and, if sources are cited, the Sources list —
 * schema mirrors visible content. Until the owner supplies a reviewer nothing calls this.
 */
export function reviewedGuideSchemas(input: {
  path: string
  headline: string
  description: string
  image: string
  /** YYYY-MM-DD the reviewer last checked the page. */
  reviewedAt: string
  /** YYYY-MM-DD the copy last changed; defaults to the review date. */
  modifiedAt?: string
  reviewer: { name: string; role?: string; brn?: string }
  sources?: { label: string; url: string }[]
}): Record<string, unknown>[] {
  const url = absoluteUrl(input.path)
  const webPageId = `${url}#webpage`
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": webPageId,
      url,
      name: input.headline,
      inLanguage: "en",
      isPartOf: webSiteRef(),
      lastReviewed: input.reviewedAt,
      reviewedBy: {
        "@type": "Person",
        name: input.reviewer.name,
        jobTitle: input.reviewer.role || undefined,
        identifier: input.reviewer.brn
          ? { "@type": "PropertyValue", propertyID: "RERA BRN", value: input.reviewer.brn }
          : undefined,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "@id": `${url}#article`,
      headline: input.headline,
      description: input.description,
      image: [input.image],
      dateModified: input.modifiedAt ?? input.reviewedAt,
      inLanguage: "en",
      mainEntityOfPage: { "@id": webPageId },
      author: orgRef(),
      publisher: orgRef(),
      citation: input.sources?.length
        ? input.sources.map((s) => ({ "@type": "CreativeWork", name: s.label, url: s.url }))
        : undefined,
    },
  ]
}

/** The agent directory (/agents). A Person carries a url only when the agent
 *  has a published Website Builder site (site-relative path) — agents have no
 *  profile pages on the main site. */
export function personListSchema(
  people: { name: string; image?: string | null; path?: string | null }[],
): Record<string, unknown> {
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
        // The same node the agent's own site declares as its profile's main entity.
        "@id": p.path ? agentPersonId(p.path) : undefined,
        name: p.name,
        image: p.image || undefined,
        url: p.path ? absoluteUrl(p.path) : undefined,
        worksFor: orgRef(),
      },
    })),
  }
}

/**
 * An agent's website (/website/<slug>) as a ProfilePage about one Person who works
 * for the company node. Only what the page itself shows or states: name, title,
 * the description, portrait, social profiles and — when it passes the plausibility
 * checks and is rendered — the BRN. No phone or e-mail: they sit behind a "Contact
 * me" menu and are not text on the page, so they would be published to scrapers
 * without being visible content. The caller omits this entirely for a couple or
 * team name ("Carlos & Michelle Guinto" is not one Person).
 */
export function agentProfileSchema(input: {
  /** Site-relative path of the agent's site. */
  path: string
  name: string
  jobTitle?: string | null
  description?: string | null
  image?: string | null
  sameAs?: string[]
  /** A plausible RERA BRN, or null. */
  brn?: string | null
  dateModified?: string | null
}): Record<string, unknown> {
  const url = absoluteUrl(input.path)
  const image = input.image ? (input.image.startsWith("/") ? absoluteUrl(input.image) : input.image) : undefined
  const sameAs = (input.sameAs ?? []).filter((u) => /^https?:\/\//i.test(u))
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${url}#profile`,
    url,
    name: input.name,
    dateModified: input.dateModified ? input.dateModified.slice(0, 10) : undefined,
    isPartOf: webSiteRef(),
    mainEntity: {
      "@type": "Person",
      "@id": agentPersonId(input.path),
      name: input.name,
      jobTitle: input.jobTitle?.trim() || undefined,
      description: input.description?.trim() || undefined,
      image,
      url,
      sameAs: sameAs.length > 0 ? sameAs : undefined,
      identifier: input.brn ? { "@type": "PropertyValue", propertyID: "RERA BRN", name: "RERA BRN", value: input.brn } : undefined,
      worksFor: orgRef(),
    },
  }
}
