/**
 * The company's facts — the one place the brand, legal entity, licence,
 * address, contact details and opening hours live. They used to be copied into
 * a dozen files (footer, /contact, /about, the home hero, llms.txt, every
 * JSON-LD node) and had already drifted apart.
 *
 * Pure data and helpers: nothing here may import sharp, lib/og-picture or
 * lib/trakheesi, so any page, client component or route handler can import it
 * without an outputFileTracingIncludes entry.
 *
 * An empty string means "not published yet". Every renderer skips empty
 * values, so adding or correcting a fact is a one-line edit in this file and
 * the footer, the contact page and the structured data all follow.
 */

type Company = {
  /** The brand as shown in the header, titles and schema `name`. */
  name: string
  /** The registered entity — shown in the footer copyright line and schema `legalName`. */
  legalName: string
  /** Other spellings of the brand in circulation (press, Property Finder, Facebook). */
  alternateNames: readonly string[]
  /** RERA brokerage Office Registration Number (ORN). Source: the Property Finder broker record — confirm with compliance. */
  reraOrn: string
  /** DET/DED trade-licence number — not published anywhere yet, so empty. */
  tradeLicence: string
  /** `street` carries the district (Deira) as the listings and GBP print it; `locality` is the CITY, which is what citation sites and schema match on. */
  address: { street: string; locality: string; region: string; country: string }
  /** The Rigga Business Center building. From OpenStreetMap — confirm against the Google Business Profile pin. */
  geo: { latitude: number; longitude: number }
  /** Display form, e.g. "+971 56 742 8288". */
  phone: string
  /** Digits only, no "+", the form wa.me expects. */
  whatsapp: string
  email: string
  hours: { days: readonly string[]; opens: string; closes: string; label: string }
  /** Text query for the "Open in Google Maps" link until the Business Profile pin is corrected. */
  mapsQuery: string
  /** The Google Business Profile's own link (maps.app.goo.gl/… or the CID URL), once the profile is claimed and its pin fixed. Wins over `mapsQuery`. */
  mapsUrl: string
}

export const COMPANY: Company = {
  name: "FHI Global",
  // TO-CONFIRM(owner): check the registered name against the DET trade licence (older snippets still say "FHI Global Real Estate LLC"). Blank it to hide it everywhere until confirmed.
  legalName: "FHI Global Property LLC",
  alternateNames: ["FHI Global Property", "FHI Global Properties", "FHI Global Dubai"],
  // TO-CONFIRM(owner): taken from the Property Finder broker record — confirm against the DLD/RERA broker register. Blank it to hide it everywhere until confirmed.
  reraOrn: "48254",
  // BLOCKER(compliance): the DET trade-licence number and its issuer are not supplied yet; nothing prints while this is empty.
  tradeLicence: "",
  address: {
    street: "Office 98, 3rd Floor, Rigga Business Center (Ibis Hotel Building), Al Rigga, Deira",
    locality: "Dubai",
    region: "Dubai",
    country: "AE",
  },
  // TO-CONFIRM(owner): from OpenStreetMap — compare with the Google Business Profile pin (the listing's pin is currently ~170 km off).
  geo: { latitude: 25.2653, longitude: 55.32133 },
  phone: "+971 56 742 8288",
  whatsapp: "971567428288",
  email: "info@fhiglobal.ae",
  // TO-CONFIRM(owner): opening hours, as printed on /contact and published in the structured data.
  hours: {
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
    opens: "09:00",
    closes: "18:00",
    // The string /contact prints — schema and page must say the same thing.
    label: "Sunday to Thursday, 9:00 AM to 6:00 PM",
  },
  mapsQuery: "Rigga Business Center, Al Rigga, Deira, Dubai",
  mapsUrl: "",
}

/** "Office 98, …, Al Rigga, Deira, Dubai, UAE" — the one-line address the pages print. */
export function companyAddressLine(): string {
  const { street, locality } = COMPANY.address
  return [street, locality, "UAE"].filter(Boolean).join(", ")
}

/** "+971567428288" — the form Google Business Profile, Property Finder and schema normalise to. */
export function companyPhoneE164(): string {
  return COMPANY.phone.replace(/[^\d+]/g, "")
}

/** tel: link with the formatting stripped. */
export function companyPhoneHref(): string {
  return `tel:${companyPhoneE164()}`
}

/** wa.me chat link, optionally with a prefilled message. */
export function companyWhatsappHref(text?: string): string {
  const base = `https://wa.me/${COMPANY.whatsapp}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

export function companyMapsHref(): string {
  return COMPANY.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(COMPANY.mapsQuery)}`
}

/** "RERA ORN 48254", or "" until the number is published. */
export function companyReraLine(): string {
  return COMPANY.reraOrn ? `RERA ORN ${COMPANY.reraOrn}` : ""
}

/** The regulator identifiers that are actually published, as display strings: ["RERA ORN 48254"]. */
export function companyLicenceParts(): string[] {
  const parts: string[] = []
  const rera = companyReraLine()
  if (rera) parts.push(rera)
  if (COMPANY.tradeLicence) parts.push(`Trade Licence ${COMPANY.tradeLicence}`)
  return parts
}

/** "RERA ORN 48254" (or "" when nothing is published). */
export function companyLicenceLine(): string {
  return companyLicenceParts().join(" · ")
}

/** "FHI Global Property LLC · RERA ORN 48254" — the identity line for footers and About. */
export function companyLegalLine(): string {
  return [COMPANY.legalName, ...companyLicenceParts()].filter(Boolean).join(" · ")
}
