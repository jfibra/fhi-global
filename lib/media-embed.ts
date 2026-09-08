import embedHosts from "@/lib/embed-hosts.json"

/**
 * Turns a project_media row (or projects.video_url) into something the
 * "Media & Virtual Tours" section can render inline instead of as a bare link.
 *
 * What the catalog actually holds (checked against live data): a couple of
 * YouTube videos, one Google Drive folder, and ~47 360° tours — most on Kuula,
 * the rest on a handful of developer tour platforms. So:
 *   youtube → click-to-play player with the real thumbnail (i.ytimg.com)
 *   vimeo   → click-to-play player (no free thumbnail without oEmbed)
 *   tour    → the provider's player in an iframe, but ONLY for hosts in
 *             lib/embed-hosts.json — the same list next.config.mjs puts in
 *             the CSP frame-src, so a host missing there can never render a
 *             blank blocked frame; it degrades to a link card instead
 *   link    → everything else (Drive folders, unknown hosts)
 *
 * Pure and dependency-free so both the server page and the client card can
 * import it. Short links (bit.ly → kuula.co) are resolved server-side BEFORE
 * classification — see the project page.
 */

export type MediaEmbed =
  | { kind: "youtube"; src: string; thumb: string; href: string }
  | { kind: "vimeo"; src: string; href: string }
  | { kind: "tour"; src: string; href: string }
  | { kind: "link"; href: string }

/** Hosts that only redirect — resolve before classifying. */
export const SHORT_LINK_HOSTS = ["bit.ly", "bitly.com", "tinyurl.com", "t.co", "rb.gy"]

export function isShortLink(url: string): boolean {
  try {
    return SHORT_LINK_HOSTS.includes(new URL(url).hostname.replace(/^www\./, ""))
  } catch {
    return false
  }
}

const TOUR_HOSTS = (embedHosts.virtualTourFrameHosts as string[]).map((origin) => origin.replace(/^https:\/\//, ""))

/** "*.example.com" matches any depth of subdomain; plain hosts match exactly. */
function isAllowedTourHost(host: string): boolean {
  return TOUR_HOSTS.some((pattern) =>
    pattern.startsWith("*.") ? host === pattern.slice(2) || host.endsWith(pattern.slice(1)) : host === pattern,
  )
}

function youtubeId(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "")
  const seg = u.pathname.split("/").filter(Boolean)
  if (host === "youtu.be") return seg[0] ?? null
  if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    if (u.pathname === "/watch") return u.searchParams.get("v")
    if (["shorts", "embed", "live", "v"].includes(seg[0] ?? "") && seg[1]) return seg[1]
  }
  return null
}

export function classifyMedia(url: string, mediaType?: string | null): MediaEmbed {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return { kind: "link", href: url }
  }
  const host = u.hostname.replace(/^www\./, "")

  const yt = youtubeId(u)
  if (yt && /^[\w-]{6,}$/.test(yt)) {
    return {
      kind: "youtube",
      // nocookie + rel=0 keeps the player on this video; autoplay only fires
      // after the visitor clicked the poster, so browsers allow it.
      src: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0&modestbranding=1`,
      // hqdefault exists for every video (maxresdefault does not).
      thumb: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
      href: url,
    }
  }

  if (host === "vimeo.com") {
    const id = u.pathname.split("/").find((s) => /^\d+$/.test(s))
    if (id) return { kind: "vimeo", src: `https://player.vimeo.com/video/${id}?autoplay=1`, href: url }
  }

  // Only rows typed as tours (or untyped) become frames — a "video" row on an
  // unknown host is a download/landing page, not a player.
  if (mediaType !== "video" && isAllowedTourHost(host)) {
    return { kind: "tour", src: url, href: url }
  }

  return { kind: "link", href: url }
}

/** Visible label per row — the one the card badge and the fallback link share. */
export function mediaLabel(embed: MediaEmbed, mediaType?: string | null): string {
  if (embed.kind === "youtube" || embed.kind === "vimeo" || mediaType === "video") return "Video"
  return "360° Virtual Tour"
}
