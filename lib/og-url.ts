import { DEFAULT_PREVIEW_IMAGE_URL, LEGACY_PREVIEW_IMAGE_URL, absoluteUrl } from "@/lib/seo"

/**
 * URLs of the share cards (/og/…) and the cache-busting version they carry.
 *
 * A card is a pure function of the data it draws, so its URL carries a hash of exactly that data
 * (?v=…): an edit gives a new URL, a scraper or the CDN fetches it afresh, and the old one may stay
 * cached for a day. A content hash rather than `updated_at` because it also covers writes that bypass
 * updated_at (a logo background set by the upload route, a direct SQL edit) and fields that live on
 * another row (a project card draws its developer's name).
 *
 * Pure — no server-only imports — so metadata code on any page can use it.
 */

/** Bump after a layout change to a card (or to re-key a bad card that got cached): every card URL changes at once. */
export const OG_DESIGN_REV = "1"

/** The size every card declares in og:image:width/height — Facebook draws the FIRST share only when it knows it. */
export const OG_CARD_DIMS = { imageWidth: 1200, imageHeight: 630 } as const

/** FNV-1a over the parts (unit-separator joined), base 36 — short, stable, and the same scheme lib/events/og.ts uses. */
export function ogVersion(...parts: Array<string | number | null | undefined>): string {
  const text = parts.map((p) => (p == null ? "" : String(p))).join("\u001f")
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36)
}

/** The absolute URL of a card, with its version token when it has one. */
export function ogCardUrl(path: string, version?: string): string {
  const url = absoluteUrl(path)
  return version ? `${url}?v=${version}` : url
}

/**
 * Metadata fields for a card — spread straight into createPageMetadata. `versionParts` is everything the
 * card draws; OG_DESIGN_REV is mixed in so a layout change re-keys every card.
 */
export function ogCardImage(
  path: string,
  ...versionParts: Array<string | number | null | undefined>
): { imageUrl: string; imageWidth: 1200; imageHeight: 630 } {
  return { imageUrl: ogCardUrl(path, ogVersion(OG_DESIGN_REV, ...versionParts)), ...OG_CARD_DIMS }
}

/** The one rule for which story photo a news card uses: the featured image, else the thumbnail, never a site placeholder. */
export function newsOgPhoto(article: { featuredImage?: string | null; img?: string | null }): string | undefined {
  const isPlaceholder = (u: string | null | undefined) => !u || u === DEFAULT_PREVIEW_IMAGE_URL || u === LEGACY_PREVIEW_IMAGE_URL
  if (!isPlaceholder(article.featuredImage)) return article.featuredImage ?? undefined
  if (!isPlaceholder(article.img)) return article.img ?? undefined
  return undefined
}
