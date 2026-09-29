"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Share2 } from "lucide-react"
import { gaEvent } from "@/lib/ga"
import { SharePanel } from "@/components/share-panel"

/**
 * Share the page. One "Share" button: phones open their own share sheet
 * (every app the visitor has, with its real icon); other screens get the
 * SharePanel. The link is the page itself; what a post shows comes from the
 * page's Open Graph tags.
 */

type SocialShareProps = {
  /** The headline that travels with the link (subject line, share sheet). */
  title: string
  /** The sentence that goes with it; defaults to the title. */
  text?: string
}

export function SocialShare({ title, text }: SocialShareProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const shareText = text ?? title
  // Only ever read after a click, so the window is there.
  const url = () => `${window.location.origin}${pathname}`

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const track = (method: string) => gaEvent("share", { method, content_type: "project", item_id: pathname })

  const onButton = async () => {
    const touch = window.matchMedia("(pointer: coarse)").matches
    if (touch && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: shareText, url: url() })
        track("native")
        return
      } catch (err) {
        if ((err as Error).name === "AbortError") return // they closed the sheet
      }
    }
    setOpen((o) => !o)
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => void onButton()}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex h-11 items-center gap-2.5 rounded-full border px-5 text-[11px] font-bold uppercase tracking-[0.18em] transition-colors ${
          open ? "border-[#d6b357] bg-[#d6b357] text-[#001f3f]" : "border-[#d6b357]/80 text-white hover:bg-[#d6b357] hover:text-[#001f3f]"
        }`}
      >
        <Share2 className="h-4 w-4" strokeWidth={2} />
        Share
      </button>

      {open && (
        // Opens upward: the hero clips overflow, and this sits at its foot.
        <SharePanel
          url={url()}
          title={title}
          text={shareText}
          className="bottom-full left-0 mb-3"
          onPick={(method) => {
            track(method)
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}
