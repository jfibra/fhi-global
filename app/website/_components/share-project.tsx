"use client"

import { useEffect, useRef, useState } from "react"
import { Share2 } from "lucide-react"
import { gaEvent } from "@/lib/ga"
import { SharePanel } from "@/components/share-panel"
import { GOLD, GOLD_TINT, NAVY } from "../_data"

/**
 * Share a project from an agent's website. Phones open their own share sheet
 * (Facebook, WhatsApp, Messenger, Instagram… whatever is installed); other
 * screens get the site-wide SharePanel (real logos on brand colours). The
 * shared link is the project on the agent's site, so whoever opens it sees
 * the agent's number (see lib/website-project-share.ts).
 */

export type ProjectShare = { url: string; title: string; text: string }

export function ShareProject({
  share,
  placement = "up",
  variant = "square",
}: {
  share: ProjectShare
  /** Which way the panel opens from the button. */
  placement?: "up" | "down"
  /** "square": the card's gold action tile. "pill": a labelled button. */
  variant?: "square" | "pill"
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)

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

  const onButton = async (e: React.MouseEvent) => {
    // The card around the button is a link: never let the tap open the project.
    e.preventDefault()
    e.stopPropagation()
    const touch = window.matchMedia("(pointer: coarse)").matches
    if (touch && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: share.title, text: share.text, url: share.url })
        gaEvent("share_project", { method: "native" })
        return
      } catch (err) {
        if ((err as Error).name === "AbortError") return // they closed the sheet
      }
    }
    setOpen((o) => !o)
  }

  // The card's tile sits at the card's right edge, the pill at the left of its row.
  const position = `${placement === "up" ? "bottom-full mb-2" : "top-full mt-2"} ${variant === "square" ? "right-0" : "left-0"}`

  return (
    <span ref={rootRef} className="relative z-10 inline-flex">
      {variant === "square" ? (
        <button
          type="button"
          onClick={onButton}
          aria-label={`Share ${share.title}`}
          aria-haspopup="menu"
          aria-expanded={open}
          className="group/action flex h-11 w-11 items-center justify-center transition-colors duration-300 hover:bg-[var(--wb-gold)]"
          style={{ backgroundColor: open ? GOLD : GOLD_TINT }}
        >
          <Share2
            className={`h-[17px] w-[17px] transition-colors duration-300 group-hover/action:text-white ${open ? "text-white" : ""}`}
            strokeWidth={1.9}
            style={open ? undefined : { color: GOLD }}
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={onButton}
          aria-haspopup="menu"
          aria-expanded={open}
          className="inline-flex h-12 items-center gap-2 border px-5 text-[14px] font-bold transition-colors hover:bg-[var(--wb-gold)] hover:text-white"
          style={{ borderColor: GOLD, color: NAVY }}
        >
          <Share2 className="h-4 w-4" strokeWidth={2} /> Share
        </button>
      )}

      {open && (
        <SharePanel
          url={share.url}
          title={share.title}
          text={share.text}
          className={position}
          onPick={(method) => {
            gaEvent("share_project", { method })
            setOpen(false)
          }}
        />
      )}
    </span>
  )
}
