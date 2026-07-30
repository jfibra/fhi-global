/**
 * The company's own social profiles.
 *
 * These links used to be duplicated in four places (top bar, header drawer,
 * and both footers) and had already drifted apart — two carried a stale
 * facebook.com/share/… URL while two were still "#". Keep them here so one
 * edit updates every icon.
 *
 * "#" means the account isn't published yet; callers use `isExternalSocial`
 * to decide whether to open in a new tab.
 */
export const SOCIAL_URLS = {
  facebook: "https://www.facebook.com/fhiglobal",
  instagram: "#",
} as const

/** True for a real profile link, false for an unpublished "#" placeholder. */
export function isExternalSocial(href: string): boolean {
  return href.startsWith("http")
}
