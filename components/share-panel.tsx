"use client"

import { useState, type ComponentType, type SVGProps } from "react"
import { Check, Link2, Mail } from "lucide-react"
import { FacebookLogo, LinkedInLogo, WhatsAppLogo, XLogo } from "@/components/brand-icons"

/**
 * The panel behind every Share button on the site: the networks that share a
 * link reliably from a browser — Facebook, WhatsApp, X, LinkedIn — plus Email
 * and Copy link, each on its brand colour under its real mark. (Telegram's
 * t.me/share page needs the desktop app and looks broken without it, so it is
 * left to the phone's own share sheet, which the buttons open on touch
 * screens.) The caller owns the trigger, the open state and where the card
 * sits (`className`), and hears which channel was used through `onPick`.
 */

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

const TILE = "flex w-full flex-col items-center gap-2 rounded-xl px-1 py-3 text-[11.5px] font-semibold text-[#001f3f] transition-colors hover:bg-[#f6f4ee]"
const BADGE = "flex h-12 w-12 items-center justify-center rounded-full text-white"

export function SharePanel({
  url,
  title,
  text,
  heading = "Share this project",
  className = "",
  position = "absolute",
  onPick,
}: {
  url: string
  /** Subject line of the email. */
  title: string
  /** The sentence that travels with the link. */
  text: string
  heading?: string
  /** Where the card sits relative to its `relative` parent, e.g. "bottom-full left-0 mb-3". */
  className?: string
  /** "fixed" for a card rendered in a portal (e.g. from inside a scrolling carousel that would clip it). */
  position?: "absolute" | "fixed"
  /** A channel was used (its key, or "copy" / "email"); the caller tracks it and closes. */
  onPick: (method: string) => void
}) {
  const [copied, setCopied] = useState(false)

  const pick = (n: Network) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (n.popup) {
      e.preventDefault()
      window.open(n.href(url, text), `share-${n.key}`, "width=620,height=560,noopener")
    }
    onPick(n.key)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => {
        setCopied(false)
        onPick("copy")
      }, 1400)
    } catch {
      /* clipboard blocked: the other tiles still work */
    }
  }

  return (
    <div
      role="menu"
      aria-label={heading}
      className={`${position} z-30 w-[300px] rounded-2xl border border-[#e8e5dc] bg-white p-3 text-[#001f3f] shadow-[0_24px_60px_-20px_rgba(0,20,40,0.6)] ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a919c]">{heading}</p>
      <div className="grid grid-cols-3 gap-1">
        {NETWORKS.map((n) => (
          <a key={n.key} role="menuitem" href={n.href(url, text)} target="_blank" rel="noopener noreferrer" onClick={pick(n)} className={TILE}>
            <span className={BADGE} style={{ backgroundColor: n.color }}>
              <n.Logo className="h-6 w-6" />
            </span>
            {n.label}
          </a>
        ))}
        <a
          role="menuitem"
          href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`}
          onClick={() => onPick("email")}
          className={TILE}
        >
          <span className={BADGE} style={{ backgroundColor: "#4b5563" }}>
            <Mail className="h-5 w-5" strokeWidth={2} />
          </span>
          Email
        </a>
        <button type="button" role="menuitem" onClick={() => void copy()} className={TILE}>
          <span className={BADGE} style={{ backgroundColor: copied ? "#15803d" : "#d6b357" }}>
            {copied ? <Check className="h-5 w-5" strokeWidth={2.5} /> : <Link2 className="h-5 w-5" strokeWidth={2} />}
          </span>
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  )
}
