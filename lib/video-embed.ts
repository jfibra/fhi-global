// Video LINKS → embeddable players. Videos are never uploaded (heavy to store
// and serve, slow to start); a page carries the platform's link and plays it
// only when someone clicks. Shared by the agent website hero and event pages.
//
// YouTube / Vimeo / Facebook / Instagram / TikTok / Google Drive URLs become
// embeddable player URLs (portrait platforms get a 9:16 modal); anything else
// (e.g. a direct .mp4) plays through a native <video> tag instead. Facebook,
// Instagram and TikTok embeds only work for PUBLIC videos; a Drive file must be
// shared "Anyone with the link".
// cropTop hides platform chrome (e.g. Instagram's header/footer): the iframe
// is shifted up by that many px and oversized so only the video area shows.
// aspect overrides the modal window's padding-bottom %. zoom scales the
// iframe so letterboxed video (Instagram's fixed 4:5 media box) fills the
// window — the platform's black side bars get pushed outside the clip.
// needsSize: Facebook's plugin sizes its player from the iframe dimensions AT
// LOAD TIME — mount it only after the modal box is measured, with explicit
// width/height params, or the video renders tiny at the top until a refresh.
// thumbs: the video's own poster frames, best first — YouTube only (the other
// platforms have no token-free thumbnail, so callers bring their own image).
export type VideoEmbed = { src: string; portrait?: boolean; cropTop?: number; aspect?: number; zoom?: number; needsSize?: boolean; thumbs?: string[] }

// maxresdefault is sharp but exists only for HD uploads; hqdefault exists for
// every video.
function youtubeThumbs(id: string): string[] | undefined {
  if (!/^[\w-]{6,}$/.test(id)) return undefined
  return [`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${id}/hqdefault.jpg`]
}

export function toEmbed(url: string): VideoEmbed | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, "")
    const seg = u.pathname.split("/").filter(Boolean)
    if (host === "youtu.be" && seg[0]) {
      return { src: `https://www.youtube-nocookie.com/embed/${seg[0]}?autoplay=1`, thumbs: youtubeThumbs(seg[0]) }
    }
    if (host.endsWith("youtube.com")) {
      const v = u.searchParams.get("v")
      if (u.pathname === "/watch" && v) return { src: `https://www.youtube-nocookie.com/embed/${v}?autoplay=1`, thumbs: youtubeThumbs(v) }
      if ((seg[0] === "shorts" || seg[0] === "embed" || seg[0] === "live") && seg[1]) {
        return { src: `https://www.youtube-nocookie.com/embed/${seg[1]}?autoplay=1`, portrait: seg[0] === "shorts", thumbs: youtubeThumbs(seg[1]) }
      }
    }
    if (host === "vimeo.com" && seg[0] && /^\d+$/.test(seg[0])) {
      return { src: `https://player.vimeo.com/video/${seg[0]}?autoplay=1` }
    }
    if (host.endsWith("facebook.com") || host === "fb.watch") {
      const portrait = seg[0] === "reel" || seg[0] === "reels"
      return {
        src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true`,
        portrait,
        needsSize: true,
      }
    }
    if (host.endsWith("instagram.com") && seg[1] && ["p", "reel", "reels", "tv"].includes(seg[0])) {
      const kind = seg[0] === "reels" ? "reel" : seg[0]
      const src = `https://www.instagram.com/${kind}/${seg[1]}/embed`
      // Reels are 9:16 letterboxed inside Instagram's 4:5 media box — zoom by
      // (16/9)/(5/4) so the video fills a true 9:16 window. Feed posts (/p/)
      // keep the 4:5 box as-is.
      if (kind === "p") return { src, portrait: true, cropTop: 54, aspect: 125 }
      return { src, portrait: true, cropTop: 54, zoom: 16 / 9 / (5 / 4) }
    }
    if (host.endsWith("tiktok.com")) {
      const m = u.pathname.match(/\/video\/(\d+)/)
      // player/v1 (same endpoint filipinohomes-final uses) is TikTok's clean
      // player: video + controls only, no profile/likes/"Watch now" chrome,
      // and it letterboxes itself to the frame. The 16:9 window is the
      // default since TikTok hosts landscape videos too — portrait clips
      // simply pillarbox inside it.
      if (m) return { src: `https://www.tiktok.com/player/v1/${m[1]}?autoplay=1&rel=0` }
    }
    if (host === "drive.google.com") {
      // /file/d/<id>/view (or /edit, /preview) — Drive's own player page.
      const m = u.pathname.match(/\/file\/d\/([\w-]+)/)
      if (m) return { src: `https://drive.google.com/file/d/${m[1]}/preview` }
    }
    return null
  } catch {
    return null
  }
}

/**
 * A video link an event can carry: one of the platforms above. Direct video
 * files are deliberately not accepted — a raw .mp4 is exactly the heavy,
 * slow-to-start download this avoids, and the CSP's media-src only plays
 * same-origin files anyway.
 */
export function isPlayableVideoUrl(url: string): boolean {
  return toEmbed(url) !== null
}
