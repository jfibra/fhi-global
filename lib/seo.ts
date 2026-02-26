import type { Metadata } from "next"

export const DEFAULT_PREVIEW_IMAGE_URL =
  "https://hefwmaoborpfuyhbguzv.supabase.co/storage/v1/object/public/fhi_global/fhi%20global.jpg"

type CreatePageMetadataOptions = {
  title: string
  description?: string
  imageUrl?: string | null
  openGraphTitle?: string
  openGraphDescription?: string
}

export function createPageMetadata({
  title,
  description,
  imageUrl,
  openGraphTitle,
  openGraphDescription,
}: CreatePageMetadataOptions): Metadata {
  const finalImageUrl = imageUrl ?? DEFAULT_PREVIEW_IMAGE_URL
  const ogTitle = openGraphTitle ?? title
  const ogDescription = openGraphDescription ?? description

  return {
    title,
    description,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: "website",
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
