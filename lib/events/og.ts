import { SITE_URL } from "@/lib/seo"

/**
 * The link-share picture for an event page (app/og/event): a 1200×630 JPEG
 * made from the poster. The version changes with the poster, so Facebook and
 * WhatsApp fetch a new picture when it's replaced. No poster → the site's
 * default card (undefined here).
 */
export function eventOgImage(event: { id: string; slug: string | null; image_url: string | null }) {
  if (!event.image_url) return {}
  let h = 2166136261
  for (let i = 0; i < event.image_url.length; i++) h = Math.imul(h ^ event.image_url.charCodeAt(i), 16777619)
  const v = (h >>> 0).toString(36)
  return {
    imageUrl: `${SITE_URL.replace(/\/$/, "")}/og/event/${encodeURIComponent(event.slug ?? event.id)}?v=${v}`,
    imageWidth: 1200,
    imageHeight: 630,
  }
}
