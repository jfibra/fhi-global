"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Link2, Mail, Share2 } from "lucide-react"
import { gaEvent } from "@/lib/ga"
import { GOLD, GOLD_TINT, NAVY } from "../_data"
import { WhatsAppIcon } from "./ui"

/**
 * Share a project from an agent's website. Phones open their own share sheet
 * (Facebook, WhatsApp, Messenger, Instagram… whatever is installed); other
 * screens get a small menu. The shared link is the project on the agent's
 * site, so whoever opens it sees the agent's number (see
 * lib/website-project-share.ts).
 */

export type ProjectShare = { url: string; title: string; text: string }

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H7.9v3h2.6V21h3z" />
    </svg>
  )
}

export function ShareProject({
  share,
  placement = "up",
  variant = "square",
}: {
  share: ProjectShare
  /** Which way the menu opens from the button. */
  placement?: "up" | "down"
  /** "square": the card's gold action tile. "pill": a labelled button. */
  variant?: "square" | "pill"
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
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

  const facebook = () => {
    const u = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(share.url)}`
    window.open(u, "fb-share", "width=620,height=560,noopener")
    gaEvent("share_project", { method: "facebook" })
    setOpen(false)
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(share.url)
      setCopied(true)
      gaEvent("share_project", { method: "copy" })
      window.setTimeout(() => {
        setCopied(false)
        setOpen(false)
      }, 1400)
    } catch {
      /* clipboard blocked: the link is still in the menu's other options */
    }
  }

  const item = "flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13.5px] font-semibold transition-colors hover:bg-[#f6f4ee]"

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
        <span
          role="menu"
          className={`absolute right-0 z-30 w-[216px] overflow-hidden border border-[#e8e5dc] bg-white py-1.5 shadow-[0_22px_48px_-16px_rgba(13,27,46,0.4)] ${
            placement === "up" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
          style={{ color: NAVY }}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="block px-4 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a919c]">Share this project</span>
          <button type="button" role="menuitem" onClick={facebook} className={item}>
            <FacebookIcon className="h-4 w-4 text-[#1877f2]" /> Facebook
          </button>
          <a
            role="menuitem"
            href={`https://wa.me/?text=${encodeURIComponent(`${share.text}\n${share.url}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              gaEvent("share_project", { method: "whatsapp" })
              setOpen(false)
            }}
            className={item}
          >
            <WhatsAppIcon className="h-4 w-4 text-[#25d366]" /> WhatsApp
          </a>
          <a
            role="menuitem"
            href={`mailto:?subject=${encodeURIComponent(share.title)}&body=${encodeURIComponent(`${share.text}\n\n${share.url}`)}`}
            onClick={() => {
              gaEvent("share_project", { method: "email" })
              setOpen(false)
            }}
            className={item}
          >
            <Mail className="h-4 w-4 text-[#6b7280]" /> Email
          </a>
          <button type="button" role="menuitem" onClick={() => void copy()} className={item}>
            {copied ? <Check className="h-4 w-4 text-[#15803d]" /> : <Link2 className="h-4 w-4 text-[#6b7280]" />}
            {copied ? "Link copied" : "Copy link"}
          </button>
        </span>
      )}
    </span>
  )
}
