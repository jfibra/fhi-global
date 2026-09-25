"use client"

// The agent side of Events (migration 057). An agent's events are published on
// their own Website Builder site, so their Events page either sends them to
// build that site first, or shows where their events go and the one link + QR
// to hand clients — so nobody wonders where an event went after publishing.

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { QRCodeCanvas } from "qrcode.react"
import { AlertTriangle, Check, Copy, Download, ExternalLink, Globe, MonitorSmartphone, Send, Sparkles, Users } from "lucide-react"
import { websiteEventsPath } from "@/lib/events/paths"

export function CreateWebsiteFirst({ websiteBuilderHref }: { websiteBuilderHref: string }) {
  return (
    <div className="border border-[#e8eaed] bg-white">
      <div className="h-[3px] bg-[#d6b357]" aria-hidden />
      <div className="flex flex-col items-center gap-5 px-6 py-12 text-center">
        <span className="flex h-16 w-16 items-center justify-center bg-[#001f3f]">
          <Globe className="h-8 w-8 text-[#d6b357]" />
        </span>
        <div className="max-w-lg">
          <h2 className="font-['Outfit'] text-2xl font-bold text-[#0d1117]">Create your website first</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
            Your events are published on <strong className="text-[#374151]">your own website</strong> — that&apos;s
            where your clients see them and register. Build it in the Website Builder (it only takes a few
            minutes), then come back here to create your event.
          </p>
        </div>
        <Link
          href={websiteBuilderHref}
          className="inline-flex items-center gap-2 bg-[#001f3f] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#00356b]"
        >
          <Sparkles className="h-4 w-4 text-[#d6b357]" />
          Create my website
        </Link>
        <p className="text-xs text-[#9ca3af]">Company events on fhiglobal.ae/events are run by the admin team.</p>
      </div>
    </div>
  )
}

const STEPS = [
  { icon: Sparkles, title: "Create", text: "Add an event with its poster, date, venue and the questions your registration form asks." },
  { icon: MonitorSmartphone, title: "Publish", text: "It appears straight away in the Events section of your website — not on the company events page." },
  { icon: Send, title: "Share", text: "Send clients the link or QR below. Each event also has its own page and a Flyer with its QR." },
  { icon: Users, title: "Follow up", text: "Registrations, the raffle and certificates are on each event card below — only you (and admins) see them." },
]

export function EventsWebsiteGuide({
  siteSlug,
  isPublished,
  origin,
  websiteBuilderHref,
}: {
  siteSlug: string
  isPublished: boolean
  origin: string
  websiteBuilderHref: string
}) {
  const url = origin ? `${origin}${websiteEventsPath(siteSlug)}` : ""
  const [copied, setCopied] = useState(false)
  const qrWrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      /* clipboard blocked — the link box is selectable, copying by hand still works */
    }
  }

  const downloadQr = () => {
    const canvas = qrWrap.current?.querySelector("canvas")
    if (!canvas) return
    const a = document.createElement("a")
    a.href = canvas.toDataURL("image/png")
    a.download = "my-events-qr.png"
    a.click()
  }

  return (
    <div className="border border-[#d6b357]/50 bg-white">
      <div className="h-[3px] bg-[#d6b357]" aria-hidden />
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a6d2a]">Where your events go</p>
          <h2 className="mt-1 font-['Outfit'] text-xl font-bold text-[#0d1117]">Your events live on your website</h2>

          {!isPublished && (
            <p className="mt-3 flex flex-wrap items-center gap-2 border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Your website is hidden right now, so clients can&apos;t see your events.
              <Link href={websiteBuilderHref} className="underline underline-offset-2">Publish it in the Website Builder</Link>
            </p>
          )}

          <ol className="mt-4 grid gap-3 sm:grid-cols-2">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#001f3f] text-xs font-bold text-[#d6b357]">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-[#0d1117]">
                    <Icon className="h-3.5 w-3.5 text-[#b8913f]" /> {title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-[#6b7280]">{text}</span>
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-5">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#374151]">Your events link — give this to clients</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Your events link"
                className="min-w-0 flex-1 border border-[#dfe3e8] bg-[#f8fafc] px-3 py-2.5 text-sm text-[#0d1117] focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void copy()}
                  className="inline-flex items-center gap-1.5 bg-[#001f3f] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#00356b]"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <a
                  href={url || websiteEventsPath(siteSlug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 border border-[#e5e5e5] px-4 py-2.5 text-sm font-bold text-[#374151] transition-colors hover:border-[#001f3f] hover:text-[#001f3f]"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* The same link as a QR — for a phone screen, a slide or a printout */}
        <div className="flex flex-col items-center gap-2 border border-[#e8eaed] bg-[#fafbfc] p-4 lg:w-52">
          <div ref={qrWrap} className="bg-white p-2">
            {url ? (
              <QRCodeCanvas value={url} size={148} level="M" marginSize={1} />
            ) : (
              <div className="h-[148px] w-[148px] animate-pulse bg-[#f3f4f6]" />
            )}
          </div>
          <p className="text-center text-[11px] leading-snug text-[#6b7280]">Scan to open your events</p>
          <button
            type="button"
            onClick={downloadQr}
            disabled={!url}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#001f3f] hover:underline disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Download QR
          </button>
        </div>
      </div>
    </div>
  )
}
