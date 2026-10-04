"use client"

/**
 * Event flyer generator — 1080×1920 (9:16, story/status-ready), in three
 * designs to choose from (boss request, 2026-10-04):
 *   · Gold Gala  — navy stage, golden light rays, script "You're Invited" (the original)
 *   · Editorial  — ivory invitation, serif title, big date block
 *   · Ticket     — the poster as a photo print, details on an admission ticket
 * Each design is its own file under ./flyer/ and draws from the same scene
 * (poster, brand logo, registration QR, title, dates, venue, address). The
 * poster and logo load once; switching designs only redraws. The last design
 * picked is remembered in this browser.
 *
 * Remote photos load through the same-origin image proxy so the canvas stays
 * exportable.
 */

import { useEffect, useRef, useState } from "react"
import { QRCodeCanvas } from "qrcode.react"
import { Check, Download, Loader2, QrCode, X } from "lucide-react"
import { eventBrand } from "@/lib/events/brands"
import { H, W, flyerTarget, flyerWhen, loadImage, proxied, type FlyerEvent, type FlyerScene } from "./flyer/shared"
import { drawGala } from "./flyer/gala"
import { drawEditorial } from "./flyer/editorial"
import { drawTicket } from "./flyer/ticket"

type Design = "gala" | "editorial" | "ticket"

const DESIGNS: Array<{ id: Design; name: string; hint: string; swatch: [string, string] }> = [
  { id: "gala", name: "Gold Gala", hint: "Navy & gold, light rays", swatch: ["#001f3f", "#d6b357"] },
  { id: "editorial", name: "Editorial", hint: "Ivory invitation, serif title", swatch: ["#f6f1e7", "#0b2140"] },
  { id: "ticket", name: "Ticket", hint: "Admission ticket, QR stub", swatch: ["#04162e", "#ffffff"] },
]

const DRAW: Record<Design, (ctx: CanvasRenderingContext2D, s: FlyerScene) => void> = {
  gala: drawGala,
  editorial: drawEditorial,
  ticket: drawTicket,
}

const DESIGN_KEY = "fhi.eventFlyerDesign"

function savedDesign(): Design {
  try {
    const v = window.localStorage.getItem(DESIGN_KEY)
    return v === "editorial" || v === "ticket" ? v : "gala"
  } catch {
    return "gala"
  }
}

type Assets = { photo: HTMLImageElement | null; logo: HTMLImageElement | null }

async function loadAssets(event: FlyerEvent): Promise<Assets> {
  await document.fonts?.ready
  const [photo, logo] = await Promise.all([
    event.imageUrl ? loadImage(proxied(event.imageUrl)) : Promise.resolve(null),
    loadImage(eventBrand(event.brand).logo),
  ])
  return { photo, logo }
}

export function EventFlyerModal({
  event,
  origin,
  onClose,
}: {
  event: FlyerEvent
  origin: string
  onClose: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const qrRef = useRef<HTMLDivElement>(null)
  // A bare, print-sized QR (no flyer) for agents who drop it into their own designs.
  const qrOnlyRef = useRef<HTMLDivElement>(null)
  const [design, setDesign] = useState<Design>(savedDesign)
  const [assets, setAssets] = useState<Assets | null>(null)
  const rendering = assets === null

  // The poster and logo, once per event.
  useEffect(() => {
    let alive = true
    loadAssets(event).then((a) => alive && setAssets(a))
    return () => {
      alive = false
    }
  }, [event])

  // Draw the chosen design whenever it, the event or the QR changes.
  useEffect(() => {
    if (!assets) return
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    const fam = getComputedStyle(document.documentElement).getPropertyValue("--font-outfit").trim() || "Arial"
    const scene: FlyerScene = {
      event,
      brand: eventBrand(event.brand),
      photo: assets.photo,
      logo: assets.logo,
      qr: qrRef.current?.querySelector("canvas") ?? null,
      sans: `${fam}, Arial, sans-serif`,
      site: flyerTarget(event).label,
      when: flyerWhen(event),
    }
    ctx.save()
    ctx.clearRect(0, 0, W, H)
    DRAW[design](ctx, scene)
    ctx.restore()
  }, [assets, design, event, origin])

  const pick = (d: Design) => {
    setDesign(d)
    try {
      window.localStorage.setItem(DESIGN_KEY, d)
    } catch {
      /* private mode — the pick just isn't remembered */
    }
  }

  const fileSlug = () =>
    event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || event.id.slice(0, 8)

  const downloadQrOnly = () => {
    const canvas = qrOnlyRef.current?.querySelector("canvas")
    if (!canvas) return
    const a = document.createElement("a")
    a.href = canvas.toDataURL("image/png")
    a.download = `event-qr-${fileSlug()}.png`
    a.click()
  }

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement("a")
    a.href = canvas.toDataURL("image/png")
    a.download = `event-flyer-${design}-${fileSlug()}.png`
    a.click()
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="relative bg-white border border-[#e8eaed] shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-5">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-['Outfit'] font-bold text-[#001f3f]">Event flyer</h3>
          <button type="button" onClick={onClose} className="p-2 -mr-2 -mt-2 text-[#6b7280] hover:bg-[#f5f5f5]" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Design picker */}
        <div role="radiogroup" aria-label="Flyer design" className="mb-3 grid grid-cols-3 gap-2">
          {DESIGNS.map((d) => {
            const on = design === d.id
            return (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => pick(d.id)}
                className={`border-2 p-2 text-left transition-colors ${on ? "border-[#001f3f] bg-[#001f3f]/[0.03]" : "border-[#e5e5e5] hover:border-[#9ca3af]"}`}
              >
                <span className="flex h-7 overflow-hidden border border-black/10" aria-hidden="true">
                  <span className="flex-1" style={{ background: d.swatch[0] }} />
                  <span className="w-1/3" style={{ background: d.swatch[1] }} />
                </span>
                <span className="mt-1.5 flex items-center gap-1 text-xs font-bold text-[#0d1117]">
                  {on && <Check className="h-3 w-3 shrink-0 text-[#001f3f]" />}
                  {d.name}
                </span>
                <span className="block text-[10px] leading-snug text-[#6b7280]">{d.hint}</span>
              </button>
            )
          })}
        </div>

        <div className="relative overflow-hidden border border-[#e8eaed] bg-[#0a1220]">
          <canvas ref={canvasRef} width={W} height={H} className="w-full h-auto block" />
          {rendering && (
            <div className="absolute inset-0 bg-[#001428]/70 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Hidden QR source for the canvas composition */}
        <div ref={qrRef} className="hidden" aria-hidden>
          {origin && (
            <QRCodeCanvas
              value={`${origin}${flyerTarget(event).path}?src=qr#register`}
              size={512}
              level="M"
              fgColor="#001f3f"
              marginSize={2}
            />
          )}
        </div>

        {/* Hidden print-size QR for the bare download: 1024px, white margin, same link. */}
        <div ref={qrOnlyRef} className="hidden" aria-hidden>
          {origin && (
            <QRCodeCanvas
              value={`${origin}${flyerTarget(event).path}?src=qr#register`}
              size={1024}
              level="M"
              fgColor="#001f3f"
              bgColor="#ffffff"
              marginSize={4}
            />
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={download}
            disabled={rendering}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#001f3f] text-white text-sm font-bold hover:bg-[#00356b] transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Download flyer
          </button>
          <button
            type="button"
            onClick={downloadQrOnly}
            disabled={!origin}
            title="Just the registration QR as a PNG — for your own designs, tarpaulins and slides"
            className="inline-flex items-center justify-center gap-2 px-4 py-3 border border-[#001f3f] text-[#001f3f] text-sm font-bold hover:bg-[#001f3f] hover:text-white transition-colors disabled:opacity-50"
          >
            <QrCode className="w-4 h-4" />
            Download QR only
          </button>
        </div>
        <p className="mt-2 text-[11px] text-[#9ca3af] text-center">
          Flyer: 1080×1920 story size for WhatsApp status, Instagram and print — pick a design above. QR only: 1024×1024 PNG, scans to the registration form.
        </p>
      </div>
    </div>
  )
}
