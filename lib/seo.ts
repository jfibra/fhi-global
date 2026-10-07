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

/**
 * Snippet / preview limits for an indexable page. Pages are indexable by
 * default, so nothing says "index, follow" — but without max-image-preview:large
 * Google shows only small thumbnails (and skips Discover), which matters for a
 * property site. These used to ride on a blanket X-Robots-Tag header, now
 * removed (it contradicted every page-level noindex). createPageMetadata applies
 * them to every page that does not choose its own robots; app/layout.tsx applies
 * them as the site default.
 */
export const INDEXABLE_ROBOTS: NonNullable<Metadata["robots"]> = {
  "max-image-preview": "large",
  "max-snippet": -1,
  "max-video-preview": -1,
}

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

// A cut that ends on one of these reads as a broken sentence ("Apartment for Sale in").
const DANGLING_TAIL = /\s+(?:in|for|at|of|the|and|to|with|a|an|&)$/i

/**
 * Truncate a title on a word boundary so the layout's " | Suffix" doesn't push
 * it past Google's ~60-char display cutoff. Only appends "…" when truncated.
 *
 * `{ ellipsis: false }` is for titles that ARE a phrase rather than a sentence (a listing's
 * "2 Bedroom Apartment for Sale in Azizi Venice"): the cut drops trailing punctuation and any
 * dangling connective and ends clean, without the "…".
 */
export function truncateTitle(title: string, max = 43, opts: { ellipsis?: boolean } = {}): string {
  const t = (title ?? "").trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max + 1)
  const lastSpace = cut.lastIndexOf(" ")
  const head = (lastSpace > 20 ? cut.slice(0, lastSpace) : cut.slice(0, max)).trimEnd()
  if (opts.ellipsis !== false) return `${head}…`
  let clean = head.replace(/[\s,;:.\-–—/&+]+$/, "")
  while (DANGLING_TAIL.test(clean)) clean = clean.replace(DANGLING_TAIL, "").replace(/[\s,;:.\-–—/&+]+$/, "")
  return clean
}

/**
 * The first variant that fits `max` characters, else the last one truncated. Plain titles go through
 * the root "%s | FHI Global" template (+13 characters), so 47 keeps the rendered title within the ~60
 * Google shows — list the most informative variant first.
 */
export function pickFittingTitle(variants: string[], max = 47): string {
  return variants.find((v) => v.length <= max) ?? truncateTitle(variants[variants.length - 1] ?? "", max)
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
  /**
   * Leave og:image / twitter:image out so the route's own file-based
   * opengraph-image.tsx applies. Next only uses that file when the level's
   * openGraph / twitter has no `images` key at all — an `images: undefined`
   * would still shadow it — so the keys are omitted rather than set empty.
   */
  useFileImage?: boolean
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
  useFileImage = false,
}: CreatePageMetadataOptions): Metadata {
  const finalImageUrl = useFileImage ? null : (imageUrl ?? DEFAULT_PREVIEW_IMAGE_URL)
  // The default card (og-default.jpg) is 1200×630; declared, or Facebook can skip it on a first share.
  const finalWidth = imageUrl ? imageWidth : (imageWidth ?? 1200)
  const finalHeight = imageUrl ? imageHeight : (imageHeight ?? 630)
  const ogTitle = openGraphTitle ?? (typeof title === "string" ? title : title.absolute)
  const ogDescription = openGraphDescription ?? description
  const canonical = buildCanonical(pathname)

  return {
    title,
    description,
    metadataBase: new URL(SITE_URL),
    keywords,
    // A page that passes its own robots (noindex facets, private pages) replaces
    // this entirely; every other page carries the preview limits.
    robots: robots ?? INDEXABLE_ROBOTS,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      siteName: "FHI Global",
      type: ogType,
      url: canonical,
      ...(finalImageUrl
        ? { images: [{ url: finalImageUrl, width: finalWidth, height: finalHeight, alt: imageAlt ?? ogTitle }] }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      ...(finalImageUrl ? { images: [finalImageUrl] } : {}),
    },
  }
}
