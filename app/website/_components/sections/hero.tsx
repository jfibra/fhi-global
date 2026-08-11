"use client"

// Hero — headline over the banner photo and the glass stat strip along the
// bottom. The broker contact/RERA card lives ONLY in the link-share
// thumbnail now (see ../og-hero.tsx), not on the page.

import { useEffect, useRef, useState } from "react"
import { Building2, Play, X } from "lucide-react"
import { BRAND_GLASS_SOFT, BRAND_GRADIENT, BRAND_TO, BRAND_TO_A0, BRAND_TO_A90, GOLD, GOLD_A50, HERO_STAT_ICON_FALLBACK, INK, NAVY, SAMPLE_DATA, STAT_ICONS, type WebsiteData } from "../../_data"

// YouTube / Vimeo / Facebook / Instagram / TikTok URLs become embeddable
// player URLs (portrait platforms get a 9:16 modal); anything else (e.g. a
// direct .mp4) plays through a native <video> tag instead. Facebook,
// Instagram and TikTok embeds only work for PUBLIC videos.
// cropTop hides platform chrome (e.g. Instagram's header/footer): the iframe
// is shifted up by that many px and oversized so only the video area shows.
// aspect overrides the modal window's padding-bottom %. zoom scales the
// iframe so letterboxed video (Instagram's fixed 4:5 media box) fills the
// window — the platform's black side bars get pushed outside the clip.
// needsSize: Facebook's plugin sizes its player from the iframe dimensions AT
// LOAD TIME — mount it only after the modal box is measured, with explicit
// width/height params, or the video renders tiny at the top until a refresh.
type VideoEmbed = { src: string; portrait?: boolean; cropTop?: number; aspect?: number; zoom?: number; needsSize?: boolean }

function toEmbed(url: string): VideoEmbed | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, "")
    const seg = u.pathname.split("/").filter(Boolean)
    if (host === "youtu.be" && seg[0]) {
      return { src: `https://www.youtube-nocookie.com/embed/${seg[0]}?autoplay=1` }
    }
    if (host.endsWith("youtube.com")) {
      const v = u.searchParams.get("v")
      if (u.pathname === "/watch" && v) return { src: `https://www.youtube-nocookie.com/embed/${v}?autoplay=1` }
      if ((seg[0] === "shorts" || seg[0] === "embed" || seg[0] === "live") && seg[1]) {
        return { src: `https://www.youtube-nocookie.com/embed/${seg[1]}?autoplay=1`, portrait: seg[0] === "shorts" }
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
    return null
  } catch {
    return null
  }
}

export function HeroSection({ data = SAMPLE_DATA }: { data?: WebsiteData }) {
  const { hero } = data
  const video = (hero.video ?? "").trim()
  const embed = video ? toEmbed(video) : null
  const [videoOpen, setVideoOpen] = useState(false)
  // Measured modal box — size-sensitive embeds (Facebook) mount only after
  // this lands so the plugin loads with its final dimensions.
  const videoBoxRef = useRef<HTMLDivElement>(null)
  const [videoBox, setVideoBox] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    if (!videoOpen) return
    const raf = requestAnimationFrame(() => {
      const el = videoBoxRef.current
      if (el) setVideoBox({ w: el.clientWidth, h: el.clientHeight })
    })
    return () => cancelAnimationFrame(raf)
  }, [videoOpen])
  const closeVideo = () => {
    setVideoOpen(false)
    setVideoBox(null)
  }
  const embedSrc = embed
    ? embed.needsSize
      ? videoBox
        ? `${embed.src}&width=${videoBox.w}&height=${videoBox.h}`
        : null
      : embed.src
    : null
  // Left-side dark wash (0–100) so the headline stays readable on bright
  // photos; at 0 the banner renders with no overlay at all.
  const overlay = Math.min(100, Math.max(0, hero.overlay ?? 0)) / 100
  // Banner focal point + zoom — which part of an oversized photo the crop
  // shows, and how far in. Zoom scales around the focal point so the two
  // controls cooperate.
  const posX = Math.min(100, Math.max(0, hero.posX ?? 50))
  const posY = Math.min(100, Math.max(0, hero.posY ?? 50))
  const zoom = Math.min(300, Math.max(100, hero.zoom ?? 100)) / 100
  return (
    <section id="home" className="relative scroll-mt-[72px] overflow-hidden" style={{ backgroundColor: INK }}>
      {/* Banner photo — full-bleed. On mobile the stacked content is far
          taller than the photo's aspect, so its lower half is scrimmed to
          SOLID ink: only the top of the photo shows (like a banner) and the
          broker card sits on clean ink, with no seams or leftover bands. */}
      <div className="absolute inset-0">
        {hero.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero.image}
            alt=""
            aria-hidden
            className="h-full w-full object-cover"
            style={{
              objectPosition: `${posX}% ${posY}%`,
              transform: zoom > 1 ? `scale(${zoom})` : undefined,
              transformOrigin: `${posX}% ${posY}%`,
            }}
          />
        )}
        {overlay > 0 && (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: `linear-gradient(90deg, rgba(0,0,0,${overlay}) 0%, rgba(0,0,0,${overlay * 0.55}) 38%, rgba(0,0,0,0) 68%)`,
            }}
          />
        )}
        <div
          className="absolute inset-0 lg:hidden"
          style={{ background: `linear-gradient(180deg, ${BRAND_TO_A0} 300px, ${BRAND_TO_A90} 520px, ${BRAND_TO} 620px)` }}
          aria-hidden
        />
      </div>
      <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8">
        <div className="flex min-h-[420px] items-center gap-8 py-12 lg:min-h-[520px] lg:py-16">
          {/* Left: headline */}
          <div className="w-full max-w-xl">
            <h1 className="font-serif text-[34px] leading-[1.14] font-bold tracking-tight sm:text-[54px] sm:leading-[1.1]" style={{ color: hero.headlineColor || NAVY }}>
              <span className="whitespace-pre-line">{hero.headline}</span>{" "}
              <span style={{ color: hero.headlineAccentColor || GOLD }}>{hero.headlineAccent}</span>
            </h1>
            <p className="mt-5 max-w-sm text-[14.5px] leading-relaxed" style={{ color: hero.descriptionColor || "#3d4451" }}>
              {hero.description}
            </p>
            <div className="mt-8 flex flex-wrap gap-2.5 sm:gap-3">
              <a
                href="#projects"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-bold text-white sm:gap-2 sm:px-6 sm:py-3 sm:text-[13px]"
                style={{ background: BRAND_GRADIENT }}
              >
                <Building2 className="h-3.5 w-3.5" />Explore Projects
              </a>
              {video && (
                <button
                  type="button"
                  onClick={() => setVideoOpen(true)}
                  className="inline-flex items-center gap-1.5 border border-white/25 px-4 py-2.5 text-[12px] font-bold text-white backdrop-blur-md transition-colors hover:bg-white/10 sm:gap-2 sm:px-6 sm:py-3 sm:text-[13px]"
                  style={{ backgroundColor: BRAND_GLASS_SOFT }}
                >
                  <Play className="h-3.5 w-3.5" />Featured Video
                </button>
              )}
            </div>

          </div>
        </div>
      </div>


      {/* Stat strip — ONE dark-glass band that RESPECTS the page's left
          padding (its left edge lines up with the headline/buttons) and is
          only as wide as the stats; photo stays visible below. Hidden on
          mobile — the hero is already tall with the inline broker card. */}
      {hero.stats.length > 0 && (
      <div className="relative mx-auto mb-12 hidden max-w-[1400px] px-5 sm:px-8 lg:block">
        <div
          className="grid max-w-full grid-cols-2 gap-x-6 gap-y-4 border-y border-white/10 px-4 py-4 backdrop-blur-md sm:inline-flex sm:flex-wrap sm:items-center sm:gap-x-10 sm:pl-5 sm:pr-10"
          style={{ backgroundColor: BRAND_GLASS_SOFT }}
        >
          {hero.stats.map(({ icon, value, label }, i) => {
            const Icon = STAT_ICONS[icon ?? HERO_STAT_ICON_FALLBACK[i % HERO_STAT_ICON_FALLBACK.length]]
            return (
              <div key={`${label}-${i}`} className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: GOLD }}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border" style={{ borderColor: GOLD_A50, color: GOLD }}>
                    <Icon className="h-4 w-4" strokeWidth={1.6} />
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block text-[19px] font-bold leading-tight text-white sm:whitespace-nowrap">{value}</span>
                  <span className="block text-[9.5px] font-bold uppercase tracking-[0.16em] text-white/60 sm:whitespace-nowrap">{label}</span>
                </span>
              </div>
            )
          })}
        </div>
      </div>
      )}

      {/* Featured video modal */}
      {videoOpen && video && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
          onClick={closeVideo}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={closeVideo}
            aria-label="Close video"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center text-white/80 transition-colors hover:text-white"
          >
            <X className="h-7 w-7" />
          </button>
          <div className={`w-full ${embed?.portrait ? "max-w-[420px]" : "max-w-4xl"}`} onClick={(e) => e.stopPropagation()}>
            <div ref={videoBoxRef} className="relative w-full bg-black" style={{ paddingBottom: embed?.aspect ? `${embed.aspect}%` : embed?.portrait ? "177.78%" : "56.25%" }}>
              {embed && embedSrc ? (
                embed.cropTop !== undefined ? (
                  <div className="absolute inset-0 overflow-hidden bg-black">
                    <iframe
                      src={embedSrc}
                      title="Featured video"
                      className="absolute left-0 w-full"
                      style={{
                        top: -Math.round((embed.cropTop ?? 0) * (embed.zoom ?? 1)),
                        height: `calc(100% + ${(embed.cropTop ?? 0) + 600}px)`,
                        transform: embed.zoom ? `scale(${embed.zoom})` : undefined,
                        transformOrigin: "top center",
                      }}
                      allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <iframe
                    src={embedSrc}
                    title="Featured video"
                    className="absolute inset-0 h-full w-full bg-black"
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write"
                    allowFullScreen
                  />
                )
              ) : embed ? null : (
                <video src={video} controls autoPlay className="absolute inset-0 h-full w-full bg-black" />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
