"use client"

// Full-screen player for a video LINK (lib/video-embed.ts). Mounted only when
// someone clicks play, so the page never loads a player (or the video) up
// front. Shared by the agent website hero and event pages.

import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { toEmbed } from "@/lib/video-embed"

export function VideoModal({ url, title = "Video", onClose }: { url: string; title?: string; onClose: () => void }) {
  const embed = toEmbed(url)
  // Measured modal box — size-sensitive embeds (Facebook) mount only after
  // this lands so the plugin loads with its final dimensions.
  const videoBoxRef = useRef<HTMLDivElement>(null)
  const [videoBox, setVideoBox] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const el = videoBoxRef.current
      if (el) setVideoBox({ w: el.clientWidth, h: el.clientHeight })
    })
    return () => cancelAnimationFrame(raf)
  }, [])
  const embedSrc = embed
    ? embed.needsSize
      ? videoBox
        ? `${embed.src}&width=${videoBox.w}&height=${videoBox.h}`
        : null
      : embed.src
    : null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
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
                  title={title}
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
                title={title}
                className="absolute inset-0 h-full w-full bg-black"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write"
                allowFullScreen
              />
            )
          ) : embed ? null : (
            <video src={url} controls autoPlay className="absolute inset-0 h-full w-full bg-black" />
          )}
        </div>
      </div>
    </div>
  )
}
