"use client"

import { Fragment, useRef, useState } from "react"
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react"
import { Check, Copy, Download, ExternalLink, MessageCircle } from "lucide-react"

/**
 * One shareable link as a QR card — the card the Invite and Buyers Link pages
 * draw, sized for the Links page grid: QR, the address, Download QR, Share on
 * WhatsApp, Copy and Open. `dark` is the navy variant (Global Partners,
 * Sellers Link), as on those pages.
 */
export function ShareLinkCard({
  title,
  qrTitle,
  note,
  url,
  share,
  qrFile,
  dark = false,
  logo,
  problem,
  onRetry,
}: {
  title: string
  qrTitle: string
  note: string
  /** Empty while loading. */
  url: string
  share: (url: string) => string
  qrFile: string
  dark?: boolean
  logo?: { src: string; alt: string }
  /** Why the link can't be shared (failed to load, switched off). */
  problem?: string | null
  onRetry?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const canvasRef = useRef<HTMLDivElement>(null)

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }
  const download = () => {
    const canvas = canvasRef.current?.querySelector("canvas")
    if (!canvas) return
    const a = document.createElement("a")
    a.href = canvas.toDataURL("image/png")
    a.download = qrFile
    a.click()
  }

  const outline = dark
    ? "border-white/25 text-white hover:border-[#d6b357] hover:text-[#d6b357]"
    : "border-[#e5e5e5] text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f]"

  return (
    <div className={`flex flex-col items-center rounded-2xl border p-5 ${dark ? "border-[#d6b357]/50 bg-[#001f3f] text-white" : "border-[#e8eaed] bg-white"}`}>
      <p className={`self-start text-[11px] font-bold uppercase tracking-[0.14em] ${dark ? "text-[#d6b357]" : "text-[#b8913f]"}`}>{title}</p>
      {logo && (
        <div className="mt-3 flex w-full items-center justify-center rounded-xl bg-white px-4 py-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo.src} alt={logo.alt} className="h-12 w-auto" />
        </div>
      )}
      <div className="mt-4 rounded-2xl border-4 border-[#d6b357] bg-white p-3">
        {url ? (
          <QRCodeSVG value={url} size={160} level="M" fgColor="#001f3f" />
        ) : (
          <div className={`h-[160px] w-[160px] rounded-xl bg-[#f3f4f6] ${problem ? "" : "animate-pulse"}`} />
        )}
      </div>
      <p className={`mt-3 text-center font-['Outfit'] text-[16px] font-bold ${dark ? "text-[#d6b357]" : "text-[#001f3f]"}`}>{qrTitle}</p>
      <p className={`mt-1 text-center text-[11.5px] leading-relaxed ${dark ? "text-white/70" : "text-[#6b7280]"}`}>{note}</p>

      {problem ? (
        <div className="mt-3 w-full text-center">
          <p className={`text-xs ${dark ? "text-rose-300" : "text-rose-600"}`}>{problem}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className={`mt-2 text-xs font-bold underline ${dark ? "text-white" : "text-[#001f3f]"}`}>
              Try again
            </button>
          )}
        </div>
      ) : (
        url && (
          <p
            className={`mt-3 w-full select-all break-words rounded-lg px-3 py-2 text-center font-mono text-[11px] leading-relaxed ${dark ? "bg-white/10 text-white/85" : "bg-[#f4f6f9] text-[#374151]"}`}
            title={url}
          >
            {/* Line breaks only after a slash or before a query, so names stay whole. */}
            {url
              .replace(/^https?:\/\//, "")
              .split(/(?=[/?&])/)
              .map((part, i) => (
                <Fragment key={i}>
                  {i > 0 && <wbr />}
                  {part}
                </Fragment>
              ))}
          </p>
        )
      )}

      {/* Hidden high-resolution canvas for the PNG download. */}
      <div ref={canvasRef} className="hidden" aria-hidden>
        {url && <QRCodeCanvas value={url} size={1024} level="M" fgColor="#001f3f" marginSize={4} />}
      </div>

      <div className="mt-auto w-full space-y-2 pt-4">
        <button
          type="button"
          onClick={download}
          disabled={!url}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-40 ${dark ? "bg-[#d6b357] text-[#001f3f] hover:bg-[#c8a544]" : "bg-[#001f3f] text-white hover:bg-[#00356b]"}`}
        >
          <Download className="h-4 w-4" />
          Download QR
        </button>
        <a
          href={url ? `https://wa.me/?text=${encodeURIComponent(share(url))}` : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!url}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#25d366] px-4 py-2.5 text-sm font-bold transition-colors hover:bg-[#25d366]/10 ${dark ? "text-[#7fe3a5]" : "text-[#128c4b]"} ${url ? "" : "pointer-events-none opacity-40"}`}
        >
          <MessageCircle className="h-4 w-4" />
          Share on WhatsApp
        </a>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void copy()}
            disabled={!url}
            className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors disabled:opacity-40 ${
              copied ? (dark ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-700") : outline
            }`}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy"}
          </button>
          <a
            href={url || undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!url}
            className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors ${outline} ${url ? "" : "pointer-events-none opacity-40"}`}
          >
            <ExternalLink className="h-4 w-4" />
            Open
          </a>
        </div>
      </div>
    </div>
  )
}
