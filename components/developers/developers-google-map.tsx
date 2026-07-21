"use client"

import { useEffect, useRef, useState } from "react"
import Script from "next/script"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { proxiedMarkerImageSrc } from "@/lib/map/proxied-marker-image-src"
import type { DeveloperMapMarker } from "@/lib/developers/map-markers"

export type { DeveloperMapMarker }

const DUBAI = { lat: 25.2048, lng: 55.2708 }
const ICON_PX = 52

function loadErrorMessage(err: string) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 min-h-[420px] flex flex-col items-center justify-center text-center px-6">
      <p className="text-sm font-medium text-amber-900 mb-1">Map could not load</p>
      <p className="text-xs text-amber-800/90 max-w-md">{err}</p>
    </div>
  )
}

function drawFallbackCircle(ctx: CanvasRenderingContext2D, size: number) {
  const c = size / 2
  ctx.beginPath()
  ctx.arc(c, c, c - 3, 0, Math.PI * 2)
  ctx.fillStyle = "#e5edf5"
  ctx.fill()
  ctx.strokeStyle = "#0f2940"
  ctx.lineWidth = 2.5
  ctx.stroke()
}

/** Circular marker PNG as data URL (logo clipped or fallback). */
function markerIconDataUrl(logoUrl: string | null): Promise<string> {
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

    if (!logoUrl) {
      drawFallbackCircle(ctx, size)
      resolve(canvas.toDataURL("image/png"))
      return
    }

    const img = new Image()
    img.onload = () => {
      drawFallbackCircle(ctx, size)
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
      drawFallbackCircle(ctx, size)
      resolve(canvas.toDataURL("image/png"))
    }
    img.src = proxiedMarkerImageSrc(logoUrl)
  })
}

export function DevelopersGoogleMap({
  apiKey,
  markers,
  listViewHref = "/developers",
  fillHeight = false,
  className,
}: {
  apiKey: string
  markers: DeveloperMapMarker[]
  listViewHref?: string
  fillHeight?: boolean
  className?: string
}) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerObjsRef = useRef<google.maps.Marker[]>([])
  const [scriptReady, setScriptReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // The Maps script is shared across pages; when another page already loaded
  // it, next/script dedupes by src and never fires onLoad again — detect the
  // already-available API on mount or the map stays stuck on a gray box.
  useEffect(() => {
    if (typeof window !== "undefined" && window.google?.maps) {
      setScriptReady(true)
    }
  }, [])

  if (!apiKey.trim()) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-[#e8eaed] bg-gradient-to-br from-[#f0f9ff] to-[#e0f2fe] min-h-[420px] flex flex-col items-center justify-center text-center px-6",
          className,
        )}
      >
        <MapPin className="w-10 h-10 text-[#001f3f] mb-3" />
        <p className="font-['Outfit'] text-lg font-semibold text-[#001f3f] mb-2">Developers map</p>
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
        zoom: valid.length === 1 ? 12 : 10,
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
      const iconUrls = await Promise.all(valid.map((m) => markerIconDataUrl(m.logo_url)))
      if (cancelled || !mapRef.current) return

      markerObjsRef.current.forEach((mk) => mk.setMap(null))
      markerObjsRef.current = []

      valid.forEach((m, i) => {
        const url = iconUrls[i]
        const icon: google.maps.Icon | undefined = url
          ? {
              url,
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
          router.push(`/developers/${m.slug}`)
        })
        markerObjsRef.current.push(mk)
      })

      if (valid.length > 1) {
        const bounds = new g.LatLngBounds()
        valid.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }))
        map.fitBounds(bounds, 72)
      } else if (valid.length === 1) {
        map.setCenter({ lat: valid[0].lat, lng: valid[0].lng })
        map.setZoom(12)
      } else {
        map.setCenter(DUBAI)
        map.setZoom(10)
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
  }, [scriptReady, markers, apiKey, router, fillHeight])

  if (loadError) {
    return loadErrorMessage(loadError)
  }

  return (
    <div
      className={cn(
        "border border-[#e8eaed] overflow-hidden bg-[#e8eaed] relative",
        fillHeight
          ? "rounded-xl flex flex-col w-full min-w-0 max-w-full min-h-[min(55vh,520px)] lg:h-[calc(100vh-9rem)] lg:min-h-[480px]"
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
          fillHeight ? "flex-1 min-h-[min(50vh,480px)] lg:min-h-0" : "min-h-[420px] h-[min(55vh,560px)]",
        )}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-white/95 border-t border-[#e8eaed] px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748b]">
        <span>
          {markers.length === 0
            ? "No developers to plot."
            : `${markers.length} developer${markers.length === 1 ? "" : "s"} on map`}
        </span>
        <Link href={listViewHref} className="text-[#001f3f] font-semibold hover:text-[#d6b357]">
          List view
        </Link>
      </div>
    </div>
  )
}
