import { companyWhatsappHref } from "@/lib/company"

/**
 * The company's own social profiles.
 *
 * These links used to be duplicated in four places (top bar, header drawer,
 * and both footers) and had already drifted apart — two carried a stale
 * facebook.com/share/… URL while two were still "#". Keep them here so one
 * edit updates every icon.
 *
 * "#" means the account isn't published yet: every renderer (top bar, header
 * drawer, footer) drops such an entry with `isExternalSocial`, so no dead "#"
 * anchor reaches the page. LinkedIn is linked from the top bar, the header and
 * the footer; Instagram and YouTube appear once a real URL is set here.
 */
export const SOCIAL_URLS = {
  facebook: "https://www.facebook.com/fhiglobal",
  /** The company WhatsApp line (lib/company.ts), same as the floating button. */
  whatsapp: companyWhatsappHref(),
  instagram: "#",
  /** The company page (found in the 2026-10-06 audit) — also the company node's `sameAs` in the structured data. */
  linkedin: "https://www.linkedin.com/company/fhi-global-property/",
  youtube: "#",
} as const

/** True for a real profile link, false for an unpublished "#" placeholder. */
export function isExternalSocial(href: string): boolean {
  return href.startsWith("http")
}

/**
 * The company's real profile pages, for Organization.sameAs. Excludes the "#"
 * placeholders and the wa.me chat link — a chat link is a contact channel, not
 * a profile, and bare/placeholder entries corrupt entity reconciliation.
 */
export function socialProfileUrls(): string[] {
  return Object.values(SOCIAL_URLS).filter((href) => isExternalSocial(href) && !href.startsWith("https://wa.me/"))
}
