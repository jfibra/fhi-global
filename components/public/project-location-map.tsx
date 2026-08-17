"use client"

// The project's location: a road map with a marker, plus Satellite and
// Street View tabs. The old cinematic "3D Tour" was removed — its 3D-mesh
// probe made every visit heavy, and its script loader used onLoad, which
// never fires when the Maps script is already on the page (any visit that
// came from another map page), leaving the map on a spinner forever.
// onReady fires on every mount, loaded or cached.
//
// Coordinates are optional: only a handful of projects store lat/lng, so the
// address is geocoded once in the browser and cached for the session.

import { useCallback, useEffect, useRef, useState } from "react"
import Script from "next/script"
import { ExternalLink, Layers, Loader2, Map as MapIcon, MapPin, PersonStanding } from "lucide-react"

type View = "map" | "satellite" | "street"
type LatLng = { lat: number; lng: number }

// Session cache so revisits and view switches never re-geocode.
const geocodeCache = new Map<string, LatLng>()

const VIEWS: Array<{ key: View; label: string; icon: typeof MapIcon }> = [
  { key: "map", label: "Map", icon: MapIcon },
  { key: "satellite", label: "Satellite", icon: Layers },
  { key: "street", label: "Street View", icon: PersonStanding },
]

/** Camera framings per view. */
const CAMERA = {
  map: { type: "roadmap", zoom: 15 },
  satellite: { type: "hybrid", zoom: 16 },
} as const

export function ProjectLocationMap({
  apiKey,
  projectName,
  address,
  lat,
  lng,
}: {
  apiKey: string
  projectName: string
  /** Human address used for geocoding and the "open in Maps" link. */
  address: string
  lat?: number | null
  lng?: number | null
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const streetRef = useRef<HTMLDivElement>(null)
  const mapObj = useRef<google.maps.Map | null>(null)
  const panoObj = useRef<google.maps.StreetViewPanorama | null>(null)

  const [ready, setReady] = useState(false)
  const [view, setView] = useState<View>("map")
  // Stored coordinates win; a cached geocode from an earlier visit is next.
  // Resolved in the initializer so no effect sets state synchronously.
  const [center, setCenter] = useState<LatLng | null>(() => {
    if (typeof lat === "number" && typeof lng === "number") return { lat, lng }
    return geocodeCache.get(address || projectName) ?? null
  })
  const [error, setError] = useState<string | null>(null)
  const [noStreetView, setNoStreetView] = useState(false)

  const query = address || projectName

  // Geocode once the script is up (unless coordinates already resolved).
  useEffect(() => {
    if (!ready || center) return
    const geocoder = new google.maps.Geocoder()
    let cancelled = false
    geocoder
      .geocode({ address: query, componentRestrictions: { country: "AE" } })
      .then((res) => {
        if (cancelled) return
        const loc = res.results?.[0]?.geometry?.location
        if (!loc) {
          setError("We couldn't pin this address on the map.")
          return
        }
        const point = { lat: loc.lat(), lng: loc.lng() }
        geocodeCache.set(query, point)
        setCenter(point)
      })
      .catch(() => {
        if (!cancelled) setError("We couldn't pin this address on the map.")
      })
    return () => { cancelled = true }
  }, [ready, center, query])

  /** Point the raster camera at one of the framings (creating once). */
  const frame = useCallback(
    (which: keyof typeof CAMERA, point: LatLng) => {
      if (!mapRef.current) return
      const cam = CAMERA[which]
      if (!mapObj.current) {
        mapObj.current = new google.maps.Map(mapRef.current, {
          center: point,
          zoom: cam.zoom,
          mapTypeId: cam.type,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          gestureHandling: "cooperative",
        })
        new google.maps.Marker({ position: point, map: mapObj.current, title: projectName })
      } else {
        const map = mapObj.current
        map.setCenter(point)
        map.setMapTypeId(cam.type)
        map.setZoom(cam.zoom)
      }
    },
    [projectName],
  )

  /** Build (or re-point) Street View, flagging when there's no nearby pano. */
  const paintStreet = useCallback((point: LatLng) => {
    if (!streetRef.current) return
    const service = new google.maps.StreetViewService()
    service
      .getPanorama({ location: point, radius: 220 })
      .then(({ data }) => {
        const pano = data.location?.pano
        setNoStreetView(false)
        if (!panoObj.current) {
          panoObj.current = new google.maps.StreetViewPanorama(streetRef.current!, {
            pano,
            pov: { heading: 0, pitch: 2 },
            zoom: 0,
            addressControl: false,
            fullscreenControl: true,
            motionTracking: false,
            motionTrackingControl: false,
          })
        } else if (pano) {
          panoObj.current.setPano(pano)
        }
      })
      .catch(() => setNoStreetView(true))
  }, [])

  // Paint whatever the current view calls for.
  useEffect(() => {
    if (!ready || !center) return
    if (view === "street") paintStreet(center)
    else frame(view, center)
  }, [ready, center, view, frame, paintStreet])

  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`

  return (
    <div className="border border-[#e5e8ec] bg-white">
      {/* Same exact src as the buy/rent/developers maps, so next/script
          dedupes when a visitor navigates between them. onReady (NOT onLoad)
          is what makes that safe: it also fires when the script is already
          on the page from a previous route. */}
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`}
        strategy="afterInteractive"
        onReady={() => setReady(true)}
        onError={() => setError("The map failed to load.")}
      />

      {/* Toolbar — view tabs + the escape hatch to real Google Maps. */}
      <div className="flex flex-wrap items-center gap-1 border-b border-[#eef0f3] p-2">
        {VIEWS.map(({ key, label, icon: Icon }) => {
          const active = view === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              disabled={!ready || !center}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold transition-colors disabled:opacity-50 ${
                active ? "bg-[#001f3f] text-white" : "text-[#5f6368] hover:bg-[#f5f6f8]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          )
        })}
        <a
          href={mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#5f6368] hover:text-[#001f3f] transition-colors"
        >
          Open in Google Maps <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Canvas — map and Street View are separate surfaces, toggled. */}
      <div className="relative bg-[#eef1f5] overflow-hidden h-[380px] sm:h-[460px]">
        <div ref={mapRef} className={`absolute inset-0 ${view === "street" ? "hidden" : ""}`} />
        <div ref={streetRef} className={`absolute inset-0 ${view === "street" ? "" : "hidden"}`} />

        {(!ready || (!center && !error)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[#9ca3af]">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-xs">Locating {projectName}…</span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6 bg-[#f5f6f8]">
            <MapPin className="w-7 h-7 text-[#cdd2d9]" />
            <p className="text-sm text-[#6b7280]">{error}</p>
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-[#b8913f] hover:underline"
            >
              Search this address on Google Maps
            </a>
          </div>
        )}

        {view === "street" && noStreetView && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6 bg-[#f5f6f8]">
            <PersonStanding className="w-7 h-7 text-[#cdd2d9]" />
            <p className="text-sm text-[#6b7280]">
              No Street View imagery near this plot yet — common for new developments.
            </p>
            <button
              type="button"
              onClick={() => setView("satellite")}
              className="text-xs font-semibold text-[#b8913f] hover:underline"
            >
              See the satellite view instead
            </button>
          </div>
        )}
      </div>

      {address && (
        <p className="flex items-center gap-2 border-t border-[#eef0f3] px-4 py-3 text-xs text-[#6b7280]">
          <MapPin className="w-3.5 h-3.5 text-[#b8913f] shrink-0" />
          <span className="truncate">{address}</span>
        </p>
      )}
    </div>
  )
}
