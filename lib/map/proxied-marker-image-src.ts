/**
 * Same-origin URL for map marker canvas drawing (avoids CORS taint from Supabase/S3/CDN).
 * Use only in the browser (e.g. inside useEffect).
 */
export function proxiedMarkerImageSrc(raw: string): string {
  if (typeof window === "undefined") return raw
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  try {
    const u = new URL(trimmed)
    if (u.origin === window.location.origin) return trimmed
  } catch {
    if (trimmed.startsWith("/")) return trimmed
    return trimmed
  }
  return `${window.location.origin}/api/map-marker-image?url=${encodeURIComponent(trimmed)}`
}
