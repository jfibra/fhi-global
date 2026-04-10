"use client"

import { useEffect, useRef, useState } from "react"
import Script from "next/script"
import Link from "next/link"
import { MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { proxiedMarkerImageSrc } from "@/lib/map/proxied-marker-image-src"

export type BuyMapMarker = {
  id: string
  lat: number
  lng: number
  title: string
  slug: string
  /** When set, info-window link uses this path instead of `/projects/[slug]`. */
  detail_href?: string | null
  /** Property hero image for circular map pin; optional. */
  image_url: string | null
  price_label?: string
  bedrooms?: number | null
  bathrooms?: number | null
  area_label?: string | null
  location_label?: string | null
}

const DUBAI = { lat: 25.2048, lng: 55.2708 }
const ICON_PX = 52

function esc(v: string) {
  return v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function mapPreviewCardHtml(m: BuyMapMarker) {
  const img = m.image_url?.trim()
    ? `<img src="${proxiedMarkerImageSrc(m.image_url)}" alt="" style="width:78px;height:78px;object-fit:cover;border-radius:10px;flex-shrink:0;background:#e5e7eb;" />`
    : `<div style="width:78px;height:78px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:#e5e7eb;color:#64748b;font-size:11px;flex-shrink:0;">No image</div>`
  const specs = [
    typeof m.bedrooms === "number" ? `🛏 ${m.bedrooms}` : "",
    typeof m.bathrooms === "number" ? `🛁 ${m.bathrooms}` : "",
    m.area_label ? m.area_label : "",
  ]
    .filter(Boolean)
    .join("   ")
  const location = m.location_label ?? m.title
  const price = m.price_label ?? "Price on request"
  const href = m.detail_href?.trim() || `/projects/${m.slug}`
  const specsHtml = specs
    ? `<div style="font-size:12px;color:#4b5563;line-height:1.35;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(specs)}</div>`
    : ""
  return `
    <a href="${esc(href)}" style="display:flex;gap:10px;align-items:flex-start;min-width:260px;max-width:320px;text-decoration:none;color:inherit;">
      ${img}
      <div style="min-width:0;">
        <div style="font-size:24px;font-weight:700;line-height:1.15;color:#1f2937;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(price)}</div>
        ${specsHtml}
        <div style="font-size:12px;color:#374151;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(location)}</div>
      </div>
    </a>
  `
}

function drawFallbackPin(ctx: CanvasRenderingContext2D, size: number) {
  const c = size / 2
  ctx.beginPath()
  ctx.arc(c, c, c - 3, 0, Math.PI * 2)
  ctx.fillStyle = "#e5edf5"
  ctx.fill()
  ctx.strokeStyle = "#0f2940"
  ctx.lineWidth = 2.5
  ctx.stroke()
}

/** Circular marker PNG (property photo or fallback). */
function propertyMarkerIconDataUrl(imageUrl: string | null): Promise<string> {
  const size = ICON_PX
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      resolve("")
      return
    }

    if (!imageUrl?.trim()) {
      drawFallbackPin(ctx, size)
      resolve(canvas.toDataURL("image/png"))
      return
    }

    const img = new Image()
    img.onload = () => {
      drawFallbackPin(ctx, size)
      ctx.save()
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, size / 2 - 5, 0, Math.PI * 2)
      ctx.closePath()
      ctx.clip()
      const iw = img.naturalWidth || img.width
      const ih = img.naturalHeight || img.height
      const cover = Math.max(iw, ih)
      const sx = (iw - cover) / 2
      const sy = (ih - cover) / 2
      ctx.drawImage(img, sx, sy, cover, cover, 4, 4, size - 8, size - 8)
      ctx.restore()
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
      ctx.strokeStyle = "#0f2940"
      ctx.lineWidth = 2.5
      ctx.stroke()
      resolve(canvas.toDataURL("image/png"))
    }
    img.onerror = () => {
      drawFallbackPin(ctx, size)
      resolve(canvas.toDataURL("image/png"))
    }
    img.src = proxiedMarkerImageSrc(imageUrl)
  })
}

function loadErrorMessage(err: string) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 min-h-[420px] flex flex-col items-center justify-center text-center px-6">
      <p className="text-sm font-medium text-amber-900 mb-1">Map could not load</p>
      <p className="text-xs text-amber-800/90 max-w-md">{err}</p>
    </div>
  )
}

export function BuyGoogleMap({
  apiKey,
  markers,
  listViewHref = "/buy",
  fillHeight = false,
  className,
}: {
  apiKey: string
  markers: BuyMapMarker[]
  /** Preserves current buy filters; omit `view=map`. Built on the server from `searchParams`. */
  listViewHref?: string
  /** Taller map for split layout (list left / map right). */
  fillHeight?: boolean
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerObjsRef = useRef<google.maps.Marker[]>([])
  const [scriptReady, setScriptReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  if (!apiKey.trim()) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-[#e8eaed] bg-gradient-to-br from-[#f0f9ff] to-[#e0f2fe] min-h-[420px] flex flex-col items-center justify-center text-center px-6",
          className,
        )}
      >
        <MapPin className="w-10 h-10 text-[#001f3f] mb-3" />
        <p className="font-['Outfit'] text-lg font-semibold text-[#001f3f] mb-2">Map view</p>
        <p className="text-sm text-[#64748b] max-w-sm mb-2">
          Add <code className="text-xs bg-white/80 px-1 rounded">GOOGLE_MAPS_API_KEY</code> or{" "}
          <code className="text-xs bg-white/80 px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to your{" "}
          <code className="text-xs bg-white/80 px-1 rounded">.env</code> file, then restart the dev server.
        </p>
        <p className="text-xs text-[#94a3b8]">Enable Maps JavaScript API and restrict the key by HTTP referrer.</p>
      </div>
    )
  }

  useEffect(() => {
    if (!scriptReady || !containerRef.current || typeof window === "undefined" || !window.google?.maps) return

    const g = window.google.maps
    const valid = markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
    const center =
      valid.length === 0 ? DUBAI : valid.length === 1 ? { lat: valid[0].lat, lng: valid[0].lng } : DUBAI

    const panes = () => {
      const map = mapRef.current
      if (!map) return
      g.event.trigger(map, "resize")
    }

    if (!mapRef.current) {
      mapRef.current = new g.Map(containerRef.current, {
        center,
        zoom: valid.length === 1 ? 13 : 10,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
      })
      requestAnimationFrame(() => {
        requestAnimationFrame(panes)
      })
    } else {
      mapRef.current.setCenter(center)
      panes()
    }

    const map = mapRef.current
    markerObjsRef.current.forEach((mk) => mk.setMap(null))
    markerObjsRef.current = []

    let cancelled = false

    ;(async () => {
      const iconUrls = await Promise.all(valid.map((m) => propertyMarkerIconDataUrl(m.image_url)))
      if (cancelled || !mapRef.current) return

      markerObjsRef.current.forEach((mk) => mk.setMap(null))
      markerObjsRef.current = []
      const info = new g.InfoWindow()

      valid.forEach((m, i) => {
        const dataUrl = iconUrls[i]
        const icon: google.maps.Icon | undefined = dataUrl
          ? {
              url: dataUrl,
              scaledSize: new g.Size(ICON_PX, ICON_PX),
              anchor: new g.Point(ICON_PX / 2, ICON_PX / 2),
            }
          : undefined

        const mk = new g.Marker({
          map,
          position: { lat: m.lat, lng: m.lng },
          title: m.title,
          icon,
        })
        mk.addListener("click", () => {
          info.setContent(mapPreviewCardHtml(m))
          info.open({ map, anchor: mk })
        })
        markerObjsRef.current.push(mk)
      })

      if (valid.length > 1) {
        const bounds = new g.LatLngBounds()
        valid.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }))
        map.fitBounds(bounds, 56)
        requestAnimationFrame(panes)
      }

      if (valid.length === 0) {
        map.setCenter(DUBAI)
        map.setZoom(10)
      }

      if (valid.length === 1) {
        requestAnimationFrame(panes)
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(panes)
      })
    })()

    if (!fillHeight || typeof ResizeObserver === "undefined") {
      return () => {
        cancelled = true
        markerObjsRef.current.forEach((mk) => mk.setMap(null))
        markerObjsRef.current = []
      }
    }

    const el = containerRef.current
    const ro = new ResizeObserver(() => {
      panes()
    })
    ro.observe(el)

    return () => {
      cancelled = true
      ro.disconnect()
      markerObjsRef.current.forEach((mk) => mk.setMap(null))
      markerObjsRef.current = []
    }
  }, [scriptReady, markers, apiKey, fillHeight])

  if (loadError) {
    return loadErrorMessage(loadError)
  }

  return (
    <div
      className={cn(
        "border border-[#e8eaed] overflow-hidden bg-[#e8eaed] relative",
        fillHeight
          ? "rounded-2xl flex flex-col w-full min-w-0 max-w-full min-h-[min(55vh,520px)] lg:h-[calc(100vh-9rem)] lg:min-h-[480px]"
          : "rounded-2xl min-h-[420px]",
        className,
      )}
    >
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`}
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => setLoadError("Failed to load the Google Maps script. Check the API key and network.")}
      />
      <div
        ref={containerRef}
        className={cn(
          "w-full",
          fillHeight ? "flex-1 w-full min-h-[min(50vh,480px)] lg:min-h-0" : "min-h-[420px] h-[min(55vh,560px)]",
        )}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-white/95 border-t border-[#e8eaed] px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748b]">
        <span>
          {markers.length === 0
            ? "No map pins for the current results — listings need a linked project with coordinates, or we show Dubai by default."
            : `${markers.length} location${markers.length === 1 ? "" : "s"} on map`}
        </span>
        <Link href={listViewHref} className="text-[#001f3f] font-semibold hover:text-[#d6b357]">
          List view
        </Link>
      </div>
    </div>
  )
}
