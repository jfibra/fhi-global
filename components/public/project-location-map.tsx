"use client"

// The project's location, staged for speed and show:
//
//   1. "pin"     — a plain road map with a marker. Cheap tiles, instant read.
//   2. "tour"    — one button flies the camera: satellite → 3D (photorealistic
//                  when available, 45° aerial otherwise) → a dive down into
//                  Street View. ~4.5 seconds of showmanship.
//   3. "explore" — afterwards the views become tabs (3D / Satellite / Street
//                  View) with smooth transitions, plus Replay.
//
// Photorealistic 3D: Google's Map3DElement (maps3d library) renders the
// Google-Earth-style city mesh. It needs the Map Tiles API enabled on the key
// and bills its own SKU, so it is feature-detected: if the library fails to
// load, everything silently falls back to 45° hybrid imagery, which Dubai has
// broadly. The tour never breaks either way.
//
// Coordinates are optional: only a handful of projects store lat/lng, so the
// address is geocoded once in the browser and cached for the session.

import { useCallback, useEffect, useRef, useState } from "react"
import Script from "next/script"
import {
  Box, Compass, ExternalLink, Layers, Loader2, MapPin, Minimize2, PersonStanding, Play, RotateCcw,
} from "lucide-react"

type View = "aerial3d" | "satellite" | "street"
type Stage = "pin" | "tour" | "explore"
type Pane = "map" | "photo" | "street"
type LatLng = { lat: number; lng: number }

/** The GA Map3DElement surface this component touches (no @types yet). */
interface Map3DEl extends HTMLElement {
  center: { lat: number; lng: number; altitude?: number }
  range: number
  tilt: number
  heading: number
  flyCameraAround?: (opts: {
    camera: { center: { lat: number; lng: number; altitude?: number }; tilt?: number; range?: number }
    durationMillis: number
    rounds: number
  }) => void
  stopCameraAnimation?: () => void
}

// Session cache so revisits and view switches never re-geocode.
const geocodeCache = new Map<string, LatLng>()

const VIEWS: Array<{ key: View; label: string; icon: typeof Box }> = [
  { key: "aerial3d", label: "3D View", icon: Box },
  { key: "satellite", label: "Satellite", icon: Layers },
  { key: "street", label: "Street View", icon: PersonStanding },
]

/** Raster camera framings. */
const CAMERA = {
  pin: { type: "roadmap", zoom: 15, tilt: 0 },
  satellite: { type: "hybrid", zoom: 16, tilt: 0 },
  aerial3d: { type: "hybrid", zoom: 19, tilt: 45 },
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
  const photoRef = useRef<HTMLDivElement>(null)
  const streetRef = useRef<HTMLDivElement>(null)
  // One instance of each surface across all stages and renders.
  const mapObj = useRef<google.maps.Map | null>(null)
  const photoObj = useRef<Map3DEl | null>(null)
  const panoObj = useRef<google.maps.StreetViewPanorama | null>(null)

  const [ready, setReady] = useState(false)
  const [stage, setStage] = useState<Stage>("pin")
  const [view, setView] = useState<View>("aerial3d")
  // null = still probing; the tour adapts to whichever answer arrives.
  const [photo3d, setPhoto3d] = useState<boolean | null>(null)
  // During the tour the timers drive which pane shows; null defers to view.
  const [tourPane, setTourPane] = useState<Pane | null>(null)
  // Stored coordinates win; a cached geocode from an earlier visit is next.
  // Resolved in the initializer so no effect sets state synchronously.
  const [center, setCenter] = useState<LatLng | null>(() => {
    if (typeof lat === "number" && typeof lng === "number") return { lat, lng }
    return geocodeCache.get(address || projectName) ?? null
  })
  const [error, setError] = useState<string | null>(null)
  const [noStreetView, setNoStreetView] = useState(false)
  const centerRef = useRef<LatLng | null>(null)
  useEffect(() => { centerRef.current = center }, [center])

  // The tour takes over the screen (CSS overlay, not the Fullscreen API —
  // iOS Safari has no requestFullscreen). Exit via the button or Escape;
  // the same DOM nodes just re-lay, so the map surfaces survive the resize.
  const [fullscreen, setFullscreen] = useState(false)
  useEffect(() => {
    if (!fullscreen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false) }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [fullscreen])

  // Which transition is playing: "dive" sinks into Street View, "streetExit"
  // + "rise" climb back out, "soft" pulses between map framings.
  const [anim, setAnim] = useState<null | "dive" | "rise" | "soft" | "streetExit">(null)
  const timers = useRef<number[]>([])
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }, [])
  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t))
    timers.current = []
  }, [])
  useEffect(() => clearTimers, [clearTimers])

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

  // Probe for photorealistic 3D once. Failure just means the raster fallback.
  useEffect(() => {
    if (!ready || photo3d !== null) return
    let cancelled = false
    const probe = async () => {
      try {
        const lib = (await Promise.race([
          (google.maps as unknown as { importLibrary: (n: string) => Promise<unknown> }).importLibrary("maps3d"),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 7000)),
        ])) as { Map3DElement?: new (opts: Record<string, unknown>) => Map3DEl }
        if (cancelled) return
        if (!lib?.Map3DElement || !photoRef.current) {
          setPhoto3d(false)
          return
        }
        const el = new lib.Map3DElement({
          // Aim straight at the project when we already know where it is —
          // the mesh starts streaming immediately, not on first view.
          center: { ...(centerRef.current ?? { lat: 25.2048, lng: 55.2708 }), altitude: 0 },
          range: 340,
          tilt: 67,
          heading: 0,
        })
        el.style.width = "100%"
        el.style.height = "100%"
        photoRef.current.appendChild(el)
        photoObj.current = el
        setPhoto3d(true)
      } catch {
        if (!cancelled) setPhoto3d(false)
      }
    }
    void probe()
    return () => { cancelled = true }
  }, [ready, photo3d])

  /** Point the raster camera at one of the fixed framings (creating once). */
  const frame = useCallback(
    (which: keyof typeof CAMERA, point: LatLng) => {
      if (!mapRef.current) return
      const cam = CAMERA[which]
      if (!mapObj.current) {
        mapObj.current = new google.maps.Map(mapRef.current, {
          center: point,
          zoom: cam.zoom,
          mapTypeId: cam.type,
          tilt: cam.tilt,
          heading: 0,
          rotateControl: true,
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
        map.setTilt(cam.tilt)
      }
    },
    [projectName],
  )

  /** Aim the photorealistic camera at the project. */
  const framePhoto = useCallback((point: LatLng) => {
    const el = photoObj.current
    if (!el) return
    try {
      el.stopCameraAnimation?.()
    } catch {
      // Not animating — fine.
    }
    el.center = { ...point, altitude: 0 }
    el.range = 320
    el.tilt = 67
  }, [])

  // Pre-warm the 3D mesh: aim it at the project as soon as both exist, so
  // its tiles stream while the visitor is still looking at the pin. By tour
  // time the scene is built instead of a gray blur.
  useEffect(() => {
    if (!photo3d || !center) return
    framePhoto(center)
  }, [photo3d, center, framePhoto])

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

  // Which pane should be visible right now.
  const pane: Pane =
    stage === "tour" && tourPane
      ? tourPane
      : stage === "pin"
        ? "map"
        : view === "street"
          ? "street"
          : view === "aerial3d" && photo3d
            ? "photo"
            : "map"

  // Paint whatever the current stage/view calls for. The tour drives the
  // camera itself through timers, so it's excluded here.
  useEffect(() => {
    if (!ready || !center || stage === "tour") return
    if (stage === "pin") {
      frame("pin", center)
      return
    }
    if (view === "street") paintStreet(center)
    else if (view === "aerial3d" && photo3d) framePhoto(center)
    else frame(view, center)
  }, [ready, center, stage, view, photo3d, frame, framePhoto, paintStreet])

  /**
   * The show: satellite → 3D (photorealistic fly-around when available, 45°
   * aerial otherwise) → dive into Street View.
   */
  const runTour = useCallback(() => {
    const map = mapObj.current
    if (!map || !center) return
    clearTimers()

    setFullscreen(true)
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) {
      // The tour IS motion — respect the setting and land at the destination.
      setStage("explore")
      setView("street")
      return
    }

    setStage("tour")
    setTourPane("map")
    setNoStreetView(false)
    map.panTo(center)

    // Beat 1 — satellite. Soft pulse while the imagery swaps underneath.
    setAnim("soft")
    later(() => frame("satellite", center), 240)
    later(() => setAnim(null), 620)

    const usePhoto = photo3d === true && photoObj.current

    if (usePhoto) {
      // Beat 2 — photorealistic 3D with a half-orbit around the tower.
      later(() => setAnim("soft"), 1150)
      later(() => {
        setTourPane("photo")
        framePhoto(center)
        try {
          photoObj.current?.flyCameraAround?.({
            camera: { center: { ...center, altitude: 90 }, tilt: 70, range: 340 },
            durationMillis: 2400,
            rounds: 0.5,
          })
        } catch {
          // Static framing still reads as 3D.
        }
      }, 1400)
      later(() => setAnim(null), 1780)

      // Beat 3 — dive out of the 3D mesh into Street View.
      later(() => setAnim("dive"), 4000)
      later(() => {
        setAnim(null)
        setTourPane(null)
        setStage("explore")
        setView("street")
      }, 4880)
    } else {
      // Beat 2 — 45° aerial, then a quarter-turn so the massing reads as 3D.
      later(() => setAnim("soft"), 1150)
      later(() => frame("aerial3d", center), 1400)
      later(() => setAnim(null), 1780)
      later(() => map.setHeading(90), 2350)

      // Beat 3 — two zoom steps under the scale-up fade, then street.
      later(() => {
        setAnim("dive")
        const z = map.getZoom() ?? 19
        later(() => map.setZoom(z + 1), 240)
        later(() => map.setZoom(z + 2), 500)
      }, 3050)
      later(() => {
        setAnim(null)
        setTourPane(null)
        setStage("explore")
        setView("street")
      }, 3930)
    }
  }, [center, photo3d, clearTimers, frame, framePhoto, later])

  /** Manual switching once exploring — each direction gets its transition. */
  const switchView = useCallback(
    (next: View) => {
      setView((current) => {
        if (next === current) return current
        clearTimers()
        setTourPane(null)
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        if (reduced) {
          setAnim(null)
          return next
        }

        if (next === "street" && current !== "street") {
          setAnim("dive")
          const map = mapObj.current
          if (map && center && current === "satellite") {
            map.panTo(center)
            const z = map.getZoom() ?? 16
            later(() => map.setZoom(z + 1), 240)
            later(() => map.setZoom(z + 2), 500)
          }
          later(() => {
            setAnim(null)
            setView("street")
          }, 880)
          return current
        }

        if (current === "street") {
          setAnim("streetExit")
          later(() => {
            setView(next)
            setAnim("rise")
            later(() => setAnim(null), 750)
          }, 520)
          return current
        }

        setAnim("soft")
        later(() => setView(next), 280)
        later(() => setAnim(null), 640)
        return current
      })
    },
    [center, clearTimers, later],
  )

  /** Spin the 3D camera 90° — the quickest proof a tower has depth. */
  const rotate = () => {
    if (pane === "photo" && photoObj.current) {
      photoObj.current.heading = ((photoObj.current.heading ?? 0) + 90) % 360
      return
    }
    const map = mapObj.current
    if (!map) return
    map.setHeading(((map.getHeading() ?? 0) + 90) % 360)
  }

  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[100] flex flex-col bg-white"
          : "border border-[#e5e8ec] bg-white"
      }
    >
      {/* Same exact src as the buy/rent/developers maps, so next/script
          dedupes when a visitor navigates between them — two Maps scripts
          with different params refuse to coexist. The default channel is
          weekly, which carries importLibrary + maps3d. */}
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`}
        strategy="afterInteractive"
        onLoad={() => setReady(true)}
        onError={() => setError("The map failed to load.")}
      />

      {/* Toolbar — what it holds depends on the stage. */}
      <div className="flex flex-wrap items-center gap-1 border-b border-[#eef0f3] p-2">
        {stage === "pin" && (
          <button
            type="button"
            onClick={runTour}
            disabled={!ready || !center}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#d6b357] text-[#1a1408] text-xs font-bold hover:brightness-95 disabled:opacity-50 transition-all"
          >
            <Play className="w-3.5 h-3.5" /> 3D Tour
          </button>
        )}

        {stage === "tour" && (
          <>
            <span className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#5f6368]">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#b8913f]" />
              Flying you down to street level…
            </span>
            <button
              type="button"
              onClick={() => {
                clearTimers()
                setAnim(null)
                setTourPane(null)
                setStage("explore")
                setView("street")
              }}
              className="px-3 py-2 text-xs font-semibold text-[#5f6368] hover:text-[#001f3f] transition-colors"
            >
              Skip
            </button>
          </>
        )}

        {stage === "explore" && (
          <>
            {VIEWS.map(({ key, label, icon: Icon }) => {
              const active = view === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => switchView(key)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold transition-colors ${
                    active ? "bg-[#001f3f] text-white" : "text-[#5f6368] hover:bg-[#f5f6f8]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              )
            })}
            {view === "aerial3d" && (
              <button
                type="button"
                onClick={rotate}
                title="Rotate the view 90°"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#b8913f] hover:bg-[#faf7ee] transition-colors"
              >
                <Compass className="w-3.5 h-3.5" /> Rotate
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                clearTimers()
                setAnim(null)
                setStage("pin")
                later(() => runTour(), 60)
              }}
              title="Replay the flight"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#5f6368] hover:text-[#001f3f] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Replay
            </button>
          </>
        )}

        <span className="ml-auto inline-flex items-center gap-1">
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#5f6368] hover:text-[#001f3f] transition-colors"
          >
            Open in Google Maps <ExternalLink className="w-3.5 h-3.5" />
          </a>
          {fullscreen && (
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#001f3f] text-white text-xs font-bold hover:bg-[#0a3d6b] transition-colors"
            >
              <Minimize2 className="w-3.5 h-3.5" /> Exit full screen
            </button>
          )}
        </span>
      </div>

      {/* Canvas — three stacked panes; transitions animate the whole stack. */}
      <div
        className={`relative bg-[#eef1f5] overflow-hidden ${
          fullscreen ? "flex-1 min-h-0" : "h-[380px] sm:h-[460px]"
        } ${
          anim === "dive" ? "animate-map-dive" : anim === "rise" ? "animate-map-rise" : anim === "soft" ? "animate-map-soft" : ""
        }`}
      >
        <div ref={mapRef} className={`absolute inset-0 ${pane === "map" ? "" : "hidden"}`} />
        {/* opacity-0 rather than hidden: a display:none WebGL canvas has no
            size and stops streaming; this way the mesh loads behind the pin. */}
        <div
          ref={photoRef}
          className={`absolute inset-0 transition-opacity duration-300 ${
            pane === "photo" ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        />
        <div
          ref={streetRef}
          className={`absolute inset-0 ${pane === "street" ? "" : "hidden"} ${
            anim === "streetExit" ? "animate-street-exit" : pane === "street" ? "animate-street-enter" : ""
          }`}
        />

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

        {pane === "street" && noStreetView && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6 bg-[#f5f6f8]">
            <PersonStanding className="w-7 h-7 text-[#cdd2d9]" />
            <p className="text-sm text-[#6b7280]">
              No Street View imagery near this plot yet — common for new developments.
            </p>
            <button
              type="button"
              onClick={() => switchView("aerial3d")}
              className="text-xs font-semibold text-[#b8913f] hover:underline"
            >
              See the 3D view instead
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
