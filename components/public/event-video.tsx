"use client"

import { useState } from "react"
import Image from "next/image"
import { Play } from "lucide-react"
import { VideoModal } from "@/components/public/video-modal"
import { toEmbed } from "@/lib/video-embed"

/**
 * The event's video on its page: a 16:9 poster with a play button, styled like
 * a project page's media tile. Only the poster image loads with the page; the
 * player mounts after the click, in the full-screen VideoModal.
 *
 * Poster: a YouTube video shows its own frame (maxres, else hq — a missing one
 * 404s through the image optimizer and the next is tried); other platforms
 * have no free thumbnail, so the event's poster stands in; with neither, a
 * navy panel.
 */
export function EventVideo({ url, title, poster }: { url: string; title: string; poster?: string | null }) {
  const [open, setOpen] = useState(false)
  const covers = [...(toEmbed(url)?.thumbs ?? []), poster].filter((s): s is string => !!s)
  const [coverIdx, setCoverIdx] = useState(0)
  const cover = covers[coverIdx]

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Play ${title}`}
        className="group relative mb-7 block aspect-video w-full overflow-hidden bg-[#0d1117] text-left"
      >
        {cover ? (
          <Image
            key={cover}
            src={cover}
            alt={`${title} preview`}
            fill
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            onError={() => setCoverIdx((i) => i + 1)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#001f3f] to-[#0d1117]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/20" />
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#001f3f]">
          <Play className="h-3.5 w-3.5 text-[#b8913f]" /> Video
        </span>
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#d6b357] bg-[#001f3f]/85 shadow-xl transition-transform duration-300 group-hover:scale-110">
            <Play className="ml-1 h-6 w-6 fill-[#d6b357] text-[#d6b357]" />
          </span>
        </span>
        <span className="absolute bottom-4 left-4 right-4 text-[15px] font-semibold text-white drop-shadow">
          Watch video
        </span>
      </button>
      {open && <VideoModal url={url} title={title} onClose={() => setOpen(false)} />}
    </>
  )
}
