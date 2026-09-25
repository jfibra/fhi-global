"use client"

import { useState } from "react"
import { Play } from "lucide-react"
import { VideoModal } from "@/components/public/video-modal"

/** "Watch video" on an event page — the player loads only after the click. */
export function EventVideoButton({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#d6b357] text-[#001f3f] text-sm font-bold hover:bg-[#c9a449] transition-colors"
      >
        <Play className="w-4 h-4" /> Watch video
      </button>
      {open && <VideoModal url={url} title={title} onClose={() => setOpen(false)} />}
    </>
  )
}
