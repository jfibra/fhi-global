"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import {
  Copy,
  Check,
  Facebook,
  Linkedin,
  Twitter,
  Send,
  Mail,
  Link as LinkIcon,
} from "lucide-react"

type SocialShareProps = {
  title: string
  text?: string
  /** "bare" drops the card, heading and URL — for callers that supply
   *  their own panel (the project hero). Renders icon-over-label tiles. */
  variant?: "light" | "dark" | "bare"
}

export function SocialShare({ title, text, variant = "light" }: SocialShareProps) {
  const pathname = usePathname()
  const [url, setUrl] = useState<string>("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    setUrl(`${window.location.origin}${pathname}`)
  }, [pathname])

  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(t)
  }, [copied])

  const shareText = text ?? title
  const links = useMemo(() => {
    if (!url) return null

    const u = encodeURIComponent(url)
    const t = encodeURIComponent(shareText)
    const subject = encodeURIComponent(title)
    const body = encodeURIComponent(`${shareText}\n\n${url}`)

    return {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      twitter: `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`,
      telegram: `https://t.me/share/url?url=${u}&text=${t}`,
      email: `mailto:?subject=${subject}&body=${body}`,
    }
  }, [shareText, title, url])

  const isBare = variant === "bare"
  const isDark = variant === "dark"
  const wrapClass = isBare
    ? ""
    : isDark
    ? "mt-4 rounded-2xl bg-[#0a1f38]/90 backdrop-blur-md ring-1 ring-[#d6b357]/30 shadow-[0_16px_44px_-16px_rgba(0,10,25,0.6)] p-4 sm:p-5"
    : "rounded-2xl border border-[#e8eaed] bg-white p-4"
  const titleClass = isDark
    ? "text-xs font-bold uppercase tracking-[0.2em] text-[#d6b357]"
    : "text-xs font-bold uppercase tracking-widest text-[#6b7280]"
  const btnBase = isBare
    ? "group inline-flex w-[62px] flex-col items-center gap-1.5 py-1 text-[10.5px] font-semibold text-white/70 hover:text-[#d6b357] transition-colors"
    : isDark
    ? "inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white hover:border-[#d6b357]/70 hover:bg-[#d6b357]/15 hover:text-[#f0d890] transition-colors"
    : "inline-flex items-center gap-2 rounded-xl border border-[#e8eaed] bg-white px-3 py-2 text-xs font-semibold text-[#0d1117] hover:bg-[#fafafa] transition-colors"
  const iconClass = isBare
    ? "w-[18px] h-[18px] text-[#d6b357]"
    : isDark ? "w-3.5 h-3.5 text-[#d6b357]" : "w-3.5 h-3.5 text-[#001f3f]"

  async function onCopy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // ignore
    }
  }

  return (
    <div className={wrapClass}>
      {!isBare && (
        <div className="flex items-center justify-between gap-4 mb-3">
          <p className={titleClass}>Share</p>
          <div className={isDark ? "text-[11px] text-white/60" : "text-[11px] text-[#9ca3af]"}>
            {url ? (
              <span className="inline-flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5" /> {url.replace(/^https?:\/\//, "")}
              </span>
            ) : (
              <span>Loading…</span>
            )}
          </div>
        </div>
      )}

      <div className={isBare ? "flex flex-wrap gap-x-1 gap-y-3" : "flex flex-wrap gap-2"}>
        <button type="button" onClick={onCopy} className={btnBase} disabled={!url}>
          {copied ? <Check className={iconClass} /> : <Copy className={iconClass} />}
          {copied ? "Copied" : isBare ? "Copy Link" : "Copy"}
        </button>

        {links ? (
          <>
            <a className={btnBase} href={links.facebook} target="_blank" rel="noopener noreferrer">
              <Facebook className={iconClass} /> Facebook
            </a>
            <a className={btnBase} href={links.twitter} target="_blank" rel="noopener noreferrer">
              <Twitter className={iconClass} /> X
            </a>
            <a className={btnBase} href={links.linkedin} target="_blank" rel="noopener noreferrer">
              <Linkedin className={iconClass} /> LinkedIn
            </a>
            <a className={btnBase} href={links.whatsapp} target="_blank" rel="noopener noreferrer">
              <Send className={iconClass} /> WhatsApp
            </a>
            <a className={btnBase} href={links.telegram} target="_blank" rel="noopener noreferrer">
              <Send className={iconClass} /> Telegram
            </a>
            <a className={btnBase} href={links.email}>
              <Mail className={iconClass} /> Email
            </a>
          </>
        ) : null}
      </div>
    </div>
  )
}
