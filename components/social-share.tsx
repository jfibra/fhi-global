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
  variant?: "light" | "dark"
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

  const isDark = variant === "dark"
  const wrapClass = isDark
    ? "mt-4 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-xl p-4"
    : "rounded-2xl border border-[#e8eaed] bg-white p-4"
  const titleClass = isDark ? "text-xs font-bold uppercase tracking-widest text-white/70" : "text-xs font-bold uppercase tracking-widest text-[#6b7280]"
  const btnBase = isDark
    ? "inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/90 hover:bg-white/15 transition-colors"
    : "inline-flex items-center gap-2 rounded-xl border border-[#e8eaed] bg-white px-3 py-2 text-xs font-semibold text-[#0d1117] hover:bg-[#fafafa] transition-colors"
  const iconClass = isDark ? "w-3.5 h-3.5 text-white/80" : "w-3.5 h-3.5 text-[#001f3f]"

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
      <div className="flex items-center justify-between gap-4 mb-3">
        <p className={titleClass}>Share</p>
        <div className={isDark ? "text-[11px] text-white/50" : "text-[11px] text-[#9ca3af]"}>
          {url ? (
            <span className="inline-flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5" /> {url.replace(/^https?:\/\//, "")}
            </span>
          ) : (
            <span>Loadingâ€¦</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onCopy} className={btnBase} disabled={!url}>
          {copied ? <Check className={iconClass} /> : <Copy className={iconClass} />}
          {copied ? "Copied" : "Copy"}
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
