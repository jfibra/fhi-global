"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Share2 } from "lucide-react"
import { gaEvent } from "@/lib/ga"
import { SharePanel } from "@/components/share-panel"
import { SITE_URL } from "@/lib/seo"

/**
 * Share a news story from a card. Phones open their own share sheet; other
 * screens get the site-wide SharePanel as a small centred dialog (in a
 * portal, so a scrolling carousel can't clip it). The button sits over the
 * card's photo, outside the card's link, so a tap never opens the article.
 */
export function ShareNews({ slug, title, className = "" }: { slug: string; title: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const url = `${SITE_URL.replace(/\/$/, "")}/news/${slug}`

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  const onButton = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const touch = window.matchMedia("(pointer: coarse)").matches
    if (touch && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: title, url })
        gaEvent("share", { method: "native", content_type: "news", item_id: slug })
        return
      } catch (err) {
        if ((err as Error).name === "AbortError") return
      }
    }
    setOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={onButton}
        aria-label={`Share ${title}`}
        aria-haspopup="dialog"
        className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-[#0d1117] shadow-[0_2px_10px_rgba(0,0,0,0.18)] transition-colors hover:bg-[#d6b357] ${className}`}
      >
        <Share2 className="h-4 w-4" strokeWidth={2} />
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="Share this story">
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-[#06182e]/45 backdrop-blur-[2px]" />
            <SharePanel
              url={url}
              title={title}
              text={title}
              heading="Share this story"
              position="fixed"
              className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              onPick={(method) => {
                gaEvent("share", { method, content_type: "news", item_id: slug })
                setOpen(false)
              }}
            />
          </div>,
          document.body,
        )}
    </>
  )
}
