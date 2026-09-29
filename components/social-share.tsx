"use client"

import { useEffect, useRef, useState, type ComponentType, type SVGProps } from "react"
import { usePathname } from "next/navigation"
import { Check, Link2, Mail, Share2 } from "lucide-react"
import { gaEvent } from "@/lib/ga"
import { FacebookLogo, LinkedInLogo, WhatsAppLogo, XLogo } from "@/components/brand-icons"

/**
 * Share the page. One "Share" button: phones open their own share sheet
 * (every app the visitor has, with its real icon); other screens get a panel
 * of the networks that share a link reliably from a browser — Facebook,
 * WhatsApp, X, LinkedIn — plus Email and Copy link, each under its real logo.
 * (Telegram's t.me/share page needs the desktop app and looks broken without
 * it, so it is left to the phone's sheet.) The link is the page itself; what
 * a post shows comes from the page's Open Graph tags.
 */

type SocialShareProps = {
  /** The headline that travels with the link (subject line, tweet, share sheet). */
  title: string
  /** The sentence that goes with it; defaults to the title. */
  text?: string
}

type Network = {
  key: string
  label: string
  color: string
  Logo: ComponentType<SVGProps<SVGSVGElement>>
  href: (url: string, text: string) => string
  /** Opens in a small window instead of a tab (Facebook's sharer is built for it). */
  popup?: boolean
}

const NETWORKS: Network[] = [
  { key: "facebook", label: "Facebook", color: "#1877f2", Logo: FacebookLogo, popup: true, href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { key: "whatsapp", label: "WhatsApp", color: "#25d366", Logo: WhatsAppLogo, href: (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t}\n${u}`)}` },
  { key: "x", label: "X", color: "#000000", Logo: XLogo, href: (u, t) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
  { key: "linkedin", label: "LinkedIn", color: "#0a66c2", Logo: LinkedInLogo, href: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}` },
]

export function SocialShare({ title, text }: SocialShareProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
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

  const pick = (n: Network) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (n.popup) {
      e.preventDefault()
      window.open(n.href(url(), shareText), `share-${n.key}`, "width=620,height=560,noopener")
    }
    track(n.key)
    setOpen(false)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url())
      setCopied(true)
      track("copy")
      window.setTimeout(() => {
        setCopied(false)
        setOpen(false)
      }, 1400)
    } catch {
      /* clipboard blocked: the other tiles still work */
    }
  }

  const tile = "flex w-full flex-col items-center gap-2 rounded-xl px-1 py-3 text-[11.5px] font-semibold text-[#001f3f] transition-colors hover:bg-[#f6f4ee]"
  const badge = "flex h-12 w-12 items-center justify-center rounded-full text-white"

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
        <div
          role="menu"
          aria-label="Share this project"
          className="absolute bottom-full left-0 z-30 mb-3 w-[300px] rounded-2xl border border-[#e8e5dc] bg-white p-3 text-[#001f3f] shadow-[0_24px_60px_-20px_rgba(0,20,40,0.6)]"
        >
          <p className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a919c]">Share this project</p>
          <div className="grid grid-cols-3 gap-1">
            {NETWORKS.map((n) => (
              <a key={n.key} role="menuitem" href={n.href(url(), shareText)} target="_blank" rel="noopener noreferrer" onClick={pick(n)} className={tile}>
                <span className={badge} style={{ backgroundColor: n.color }}>
                  <n.Logo className="h-6 w-6" />
                </span>
                {n.label}
              </a>
            ))}
            <a
              role="menuitem"
              href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${shareText}\n\n${url()}`)}`}
              onClick={() => {
                track("email")
                setOpen(false)
              }}
              className={tile}
            >
              <span className={badge} style={{ backgroundColor: "#4b5563" }}>
                <Mail className="h-5 w-5" strokeWidth={2} />
              </span>
              Email
            </a>
            <button type="button" role="menuitem" onClick={() => void copy()} className={tile}>
              <span className={badge} style={{ backgroundColor: copied ? "#15803d" : "#d6b357" }}>
                {copied ? <Check className="h-5 w-5" strokeWidth={2.5} /> : <Link2 className="h-5 w-5" strokeWidth={2} />}
              </span>
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
