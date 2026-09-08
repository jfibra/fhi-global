"use client"

import { useState } from "react"
import Image from "next/image"
import { ExternalLink, Play, Rotate3d } from "lucide-react"
import type { MediaEmbed } from "@/lib/media-embed"

/**
 * One media tile on the project page: a 16:9 poster with a play button that
 * swaps itself for the real player when clicked. Nothing heavy loads until
 * then — 35 Kuula tours autoloading on first paint would wreck LCP/INP.
 *
 * Poster: a YouTube video shows its own thumbnail; tours and Vimeo use the
 * project's photo (passed in) with a 360°/video badge, the way the portals do.
 * Rows that cannot be framed (Drive folders, unknown hosts) render the same
 * tile as an outbound link so the section never looks broken.
 */
export function MediaEmbedCard({
  embed,
  label,
  title,
  poster,
}: {
  embed: MediaEmbed
  label: string
  title: string
  poster?: string | null
}) {
  const [active, setActive] = useState(false)
  const posterSrc = embed.kind === "youtube" ? embed.thumb : poster ?? null
  const Icon = label.startsWith("360") ? Rotate3d : Play
  const canEmbed = embed.kind !== "link"

  const posterLayer = (
    <>
      {posterSrc ? (
        <Image
          src={posterSrc}
          alt={`${title} — ${label.toLowerCase()} preview`}
          fill
          sizes="(min-width: 1024px) 45vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#001f3f] to-[#0d1117]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/20" />
      <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#001f3f]">
        <Icon className="h-3.5 w-3.5 text-[#b8913f]" /> {label}
      </span>
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#d6b357] bg-[#001f3f]/85 shadow-xl transition-transform duration-300 group-hover:scale-110">
          {canEmbed ? (
            <Play className="ml-1 h-6 w-6 fill-[#d6b357] text-[#d6b357]" />
          ) : (
            <ExternalLink className="h-6 w-6 text-[#d6b357]" />
          )}
        </span>
      </span>
      <span className="absolute bottom-4 left-4 right-4 text-[15px] font-semibold text-white drop-shadow">
        {canEmbed ? `${label === "Video" ? "Watch" : "Explore"} ${title}` : `Open ${label.toLowerCase()} of ${title}`}
      </span>
    </>
  )

  return (
    <figure>
      <div className="relative aspect-video overflow-hidden bg-[#0d1117]">
        {active && canEmbed ? (
          <iframe
            src={embed.src}
            title={`${title} — ${label}`}
            className="absolute inset-0 h-full w-full"
            loading="lazy"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope; xr-spatial-tracking"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : canEmbed ? (
          <button
            type="button"
            onClick={() => setActive(true)}
            aria-label={`Play ${label.toLowerCase()} of ${title}`}
            className="group absolute inset-0 block w-full text-left"
          >
            {posterLayer}
          </button>
        ) : (
          <a
            href={embed.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${label.toLowerCase()} of ${title} in a new tab`}
            className="group absolute inset-0 block"
          >
            {posterLayer}
          </a>
        )}
      </div>
      <figcaption className="mt-2 flex items-center justify-between gap-3 text-xs text-[#6b7280]">
        <span className="font-semibold uppercase tracking-wider text-[#9ca3af]">{label}</span>
        <a
          href={embed.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-[#001f3f] hover:text-[#b8913f] transition-colors"
        >
          Open in new tab <ExternalLink className="h-3 w-3" />
        </a>
      </figcaption>
    </figure>
  )
}
