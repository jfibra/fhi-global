// Shared allowlist of remote image hosts we actually serve listing/project
// media from. Used by /api/image-proxy (browser-side canvas exports) and
// /og/listing (server-side satori fetch) so neither can be turned into an
// open proxy / SSRF vector via attacker-controlled image URLs.

export function isAllowedImageHost(host: string): boolean {
  const h = host.toLowerCase()
  let s3Host = ""
  try {
    s3Host = process.env.S3_PUBLIC_URL ? new URL(process.env.S3_PUBLIC_URL).host.toLowerCase() : ""
  } catch {
    s3Host = ""
  }
  return (
    h === s3Host ||
    h.endsWith(".amazonaws.com") ||
    h.endsWith(".cloudfront.net") ||
    h.endsWith(".supabase.co") ||
    h.endsWith(".supabase.in")
  )
}

/** True only for a well-formed https URL on an allowlisted image host. */
export function isSafeRemoteImageUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  return u.protocol === "https:" && isAllowedImageHost(u.host)
}
