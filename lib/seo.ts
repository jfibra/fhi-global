import type { Metadata } from "next"

export const DEFAULT_PREVIEW_IMAGE_URL =
  "https://hefwmaoborpfuyhbguzv.supabase.co/storage/v1/object/public/fhi_global/fhi%20global.jpg"

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fhiglobal.ae"

function buildCanonical(pathname: string | undefined) {
  if (!pathname) return undefined
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`
  return `${SITE_URL}${path}`
}

type CreatePageMetadataOptions = {
  title: string
  description?: string
  imageUrl?: string | null
  openGraphTitle?: string
  openGraphDescription?: string
  pathname?: string
  keywords?: string[]
}

export function createPageMetadata({
  title,
  description,
  imageUrl,
  openGraphTitle,
  openGraphDescription,
  pathname,
  keywords,
}: CreatePageMetadataOptions): Metadata {
  const finalImageUrl = imageUrl ?? DEFAULT_PREVIEW_IMAGE_URL
  const ogTitle = openGraphTitle ?? title
  const ogDescription = openGraphDescription ?? description
  const canonical = buildCanonical(pathname)

  return {
    title,
    description,
    metadataBase: new URL(SITE_URL),
    keywords,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: "website",
      url: canonical,
      images: finalImageUrl ? [{ url: finalImageUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: finalImageUrl ? [finalImageUrl] : undefined,
    },
  }
}
