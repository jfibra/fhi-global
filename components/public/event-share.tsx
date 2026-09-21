"use client"

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { QRCodeSVG } from "qrcode.react"
import QRCode from "qrcode"
import { Check, Copy, Download, Link2, Mail, MessageCircle, Send, Share2, X } from "lucide-react"

/**
 * Share button + modal for the public event page: QR of the page (with a
 * 1024px PNG download for print/screens), copy link, the native share sheet,
 * and direct links to the channels our audience actually uses.
 *
 * The shared URL is the clean canonical page (no ?src=qr) — scan-tracking is
 * for the printed registration QRs, not for links people pass around.
 */

// Brand glyphs lucide doesn't carry (Facebook's is deprecated there).
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  )
}

function XLogoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  )
}

function ChannelButton({
  label,
  href,
  bg,
  children,
}: {
  label: string
  href: string
  bg: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col items-center gap-2 group"
    >
      <span
        className="w-12 h-12 rounded-full flex items-center justify-center text-white transition-transform group-hover:scale-110 group-active:scale-95"
        style={{ backgroundColor: bg }}
      >
        {children}
      </span>
      <span className="text-xs font-semibold text-white/85">{label}</span>
    </a>
  )
}

/**
 * `window.location.origin` without a setState-in-effect round trip: the server
 * snapshot is empty so markup matches on hydration, then the client fills in
 * the real origin. Same pattern as share-profile-link.tsx.
 */
const noopSubscribe = () => () => {}
function useOrigin(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  )
}

export function EventShare({ slug, title, subtitle }: { slug: string; title: string; subtitle: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const origin = useOrigin()
  const url = origin ? `${origin}/events/${slug}` : ""

  // Lock page scroll and close on Escape while the modal is up.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  const copy = useCallback(async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      /* clipboard blocked — the input is selectable, copying by hand still works */
    }
  }, [url])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  const shareViaApp = useCallback(async () => {
    if (!url) return
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        /* sheet dismissed or unsupported — fall through to copying */
      }
    }
    void copy()
  }, [url, title, copy])

  const downloadQr = useCallback(async () => {
    if (!url) return
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 1024,
        margin: 2,
        color: { dark: "#001f3f", light: "#ffffff" },
      })
      const a = document.createElement("a")
      a.href = dataUrl
      a.download = `${slug}-qr.png`
      a.click()
    } catch {
      /* generation failed — the on-screen QR is still scannable */
    }
  }, [url, slug])

  const encodedUrl = encodeURIComponent(url)
  const encodedText = encodeURIComponent(title)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute top-4 right-4 z-10 inline-flex items-center gap-2 bg-white/95 px-4 py-2 text-sm font-bold text-[#0f2940] hover:bg-white transition-colors"
      >
        <Share2 className="w-4 h-4" />
        Share
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Share this page"
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-[#111527] border border-white/10 shadow-2xl p-6 sm:p-8"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-5">
              <div className="min-w-0">
                <h3 className="font-['Outfit'] text-xl font-bold text-white">Share this page</h3>
                <p className="text-sm text-white/70 mt-1 leading-snug">{subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="shrink-0 w-9 h-9 flex items-center justify-center text-[#d6b357] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* QR */}
            <div className="flex flex-col items-center gap-4">
              <span className="rounded-2xl bg-white p-4 ring-2 ring-[#d6b357]">
                {url && <QRCodeSVG value={url} size={200} level="M" fgColor="#001f3f" />}
              </span>
              <button
                type="button"
                onClick={downloadQr}
                className="inline-flex items-center gap-2 rounded-full border border-[#d6b357]/60 px-5 py-2.5 text-sm font-bold text-[#d6b357] hover:bg-[#d6b357]/10 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download QR (1024px)
              </button>
            </div>

            {/* Copy link */}
            <div className="mt-5 flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3">
              <Link2 className="w-4 h-4 shrink-0 text-[#d6b357]" />
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Event page link"
                className="flex-1 min-w-0 bg-transparent text-sm text-white/90 focus:outline-none truncate"
              />
              <button
                type="button"
                onClick={copy}
                aria-label={copied ? "Link copied" : "Copy link"}
                className="shrink-0 text-[#d6b357] hover:text-white transition-colors"
              >
                {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>

            {/* Native share sheet */}
            <button
              type="button"
              onClick={shareViaApp}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#d6b357] px-5 py-3.5 text-base font-bold text-[#001f3f] hover:bg-[#e0c477] active:scale-[0.99] transition-all"
            >
              <Share2 className="w-5 h-5" />
              Share via app…
            </button>

            {/* Direct channels */}
            <p className="mt-6 mb-4 text-center text-xs font-bold uppercase tracking-[0.25em] text-[#d6b357]">
              Or share directly
            </p>
            <div className="grid grid-cols-3 gap-y-5">
              <ChannelButton label="Facebook" bg="#1877f2" href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}>
                <FacebookIcon className="w-5 h-5" />
              </ChannelButton>
              <ChannelButton label="WhatsApp" bg="#25d366" href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`}>
                <WhatsAppIcon className="w-5 h-5" />
              </ChannelButton>
              <ChannelButton label="Viber" bg="#7360f2" href={`viber://forward?text=${encodedText}%20${encodedUrl}`}>
                <MessageCircle className="w-5 h-5" />
              </ChannelButton>
              <ChannelButton label="Telegram" bg="#29a9eb" href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`}>
                <Send className="w-5 h-5" />
              </ChannelButton>
              <ChannelButton label="X" bg="#111111" href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`}>
                <XLogoIcon className="w-4 h-4" />
              </ChannelButton>
              <ChannelButton label="Email" bg="#6b7280" href={`mailto:?subject=${encodedText}&body=${encodedUrl}`}>
                <Mail className="w-5 h-5" />
              </ChannelButton>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
