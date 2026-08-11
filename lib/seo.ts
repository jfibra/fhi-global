import type { Metadata } from "next"

/** Site-wide OG/Twitter fallback image (1200×630, lives in public/).
 *  Relative on purpose — createPageMetadata's metadataBase resolves it. */
export const DEFAULT_PREVIEW_IMAGE_URL = "/og-default.jpg"

/**
 * The retired default, on the legacy Supabase project that now answers HTTP
 * 402 (storage quota exceeded). Kept ONLY as a comparison sentinel: stored
 * data (e.g. news articles) still carries this exact URL as its "no real
 * image" placeholder, and that rejection logic must keep working.
 */
export const LEGACY_PREVIEW_IMAGE_URL =
  "https://hefwmaoborpfuyhbguzv.supabase.co/storage/v1/object/public/fhi_global/fhi%20global.jpg"

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fhiglobal.ae"

/** SITE_URL + path with exactly one slash between them. */
export function absoluteUrl(path: string): string {
  const base = SITE_URL.replace(/\/$/, "")
  return `${base}${path.startsWith("/") ? path : `/${path}`}`
}

/**
 * Serialize an object for a <script type="application/ld+json"> block.
 * Escapes "<" so untrusted strings (e.g. external article titles) can never
 * break out of the script element with a literal "</script>".
 */
export function jsonLdScript(schema: unknown): string {
  return JSON.stringify(schema).replace(/</g, "\\u003c")
}

/**
 * Truncate a title on a word boundary so the layout's " | Suffix" doesn't push
 * it past Google's ~60-char display cutoff. Only appends "…" when truncated.
 */
export function truncateTitle(title: string, max = 43): string {
  const t = (title ?? "").trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max + 1)
  const lastSpace = cut.lastIndexOf(" ")
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut.slice(0, max)).trimEnd()}…`
}

/**
 * Truncate a meta description on a word boundary (~155 chars is what SERPs
 * display). Returns "" for empty input; appends "…" only when truncated.
 */
export function truncateDescription(text: string | null | undefined, max = 155): string {
  const t = (text ?? "").trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max + 1)
  const lastSpace = cut.lastIndexOf(" ")
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut.slice(0, max)).trimEnd()}…`
}

function buildCanonical(pathname: string | undefined) {
  if (!pathname) return undefined
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`
  return `${SITE_URL}${path}`
}

type CreatePageMetadataOptions = {
  /**
   * Plain strings flow through the root layout's "%s | FHI Global" template —
   * never bake the brand into them. Pass { absolute } only when a curated
   * title (a CMS meta_title, a news headline with its sub-brand) must render
   * verbatim, bypassing the template.
   */
  title: string | { absolute: string }
  description?: string
  imageUrl?: string | null
  /** Intrinsic og:image dimensions — declare when known (e.g. 1200×630 cards). */
  imageWidth?: number
  imageHeight?: number
  imageAlt?: string
  openGraphTitle?: string
  openGraphDescription?: string
  /** og:type — "website" unless the page is an article or a person profile. */
  ogType?: "website" | "article" | "profile"
  robots?: Metadata["robots"]
  pathname?: string
  keywords?: string[]
}

export function createPageMetadata({
  title,
  description,
  imageUrl,
  imageWidth,
  imageHeight,
  imageAlt,
  openGraphTitle,
  openGraphDescription,
  ogType = "website",
  robots,
  pathname,
  keywords,
}: CreatePageMetadataOptions): Metadata {
  const finalImageUrl = imageUrl ?? DEFAULT_PREVIEW_IMAGE_URL
  const ogTitle = openGraphTitle ?? (typeof title === "string" ? title : title.absolute)
  const ogDescription = openGraphDescription ?? description
  const canonical = buildCanonical(pathname)

  return {
    title,
    description,
    metadataBase: new URL(SITE_URL),
    keywords,
    robots,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: ogType,
      url: canonical,
      images: finalImageUrl
        ? [{ url: finalImageUrl, width: imageWidth, height: imageHeight, alt: imageAlt ?? ogTitle }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: finalImageUrl ? [finalImageUrl] : undefined,
    },
  }
}
