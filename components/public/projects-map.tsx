"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import Script from "next/script"
import Image from "next/image"
import Link from "next/link"
import Supercluster from "supercluster"
import { ArrowUpRight, Building2, CalendarClock, Crosshair, Layers, LocateFixed, MapPin, Minus, Plus, X } from "lucide-react"

/**
 * /projects?view=map — Bayut-style split view. The list on the left follows
 * the map on the right (only the projects inside the current view), the map
 * stays pinned while the list scrolls with the page.
 *
 * Built for smoothness: every marker lives in ONE OverlayView layer (a
 * single DOM container in the map's pane, so dragging moves them for free),
 * clusters are computed with supercluster (a few ms for the whole catalogue)
 * and only when the map comes to rest (`idle`), markers are diffed by key
 * rather than rebuilt, and the list renders in batches. Projects sharing one
 * point (a community centre used for many projects) never split, so their
 * cluster lists them instead of zooming forever.
 */

export type MapProject = {
  id: string
  name: string
  href: string
  image: string | null
  lat: number
  lng: number
  /** "AED 1.2M", or null when the price is on request. */
  price: string | null
  handover: string | null
  area: string | null
  developer: string | null
  developerLogo: string | null
  /** Background baked into the logo, detected at upload (developers.logo_bg). */
  developerLogoBg: string | null
  status: string | null
}

type Item =
  | { kind: "cluster"; key: string; id: number; count: number; lat: number; lng: number; leaves: number[] }
  | { kind: "point"; key: string; i: number; lat: number; lng: number }

type Layer = {
  setItems: (items: Item[]) => void
  mark: (key: string | null, cls: "is-hot" | "is-sel") => void
  setPopup: (pos: { lat: number; lng: number } | null) => void
  popupEl: HTMLDivElement
  destroy: () => void
}

/** Clusters stay clustered up to here, so points on one spot never split; the map itself stops at MAP_MAX_ZOOM. */
const CLUSTER_MAX_ZOOM = 21
const MAP_MAX_ZOOM = 18
/** Where "Show on map" lands: close enough to read the community. */
const PROJECT_ZOOM = 15
const BATCH = 20
const UAE = { lat: 24.9, lng: 55.2 }

const STATUS: Record<string, string> = {
  pre_launch: "Pre-launch",
  launch: "Launching now",
  under_construction: "Under construction",
  completed: "Ready to move",
}

/** A calm, light map so the navy markers carry the page (no POIs, no transit). */
const STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f1f2f4" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e9e2cf" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#dccf9f" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#eaecef" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#bcd9ec" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#5d7f99" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#c6ccd4" }] },
]

const fmtCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K` : String(n))

/** Wide enough for a card floating above its pin; phones get a card across the map's top instead (clear of the site's WhatsApp button). */
const WIDE = "(min-width: 640px)"
const subscribeWide = (cb: () => void) => {
  const mq = window.matchMedia(WIDE)
  mq.addEventListener("change", cb)
  return () => mq.removeEventListener("change", cb)
}
const useWide = () => useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => true)

function PinCard({ p, onClose, row = false }: { p: MapProject; onClose: () => void; row?: boolean }) {
  return (
    <>
      <button
        type="button"
        onClick={onClose}
        className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#374151] shadow"
        aria-label="Close"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <Link href={p.href} className={`group ${row ? "flex" : "block"}`}>
        <span className={`relative block shrink-0 overflow-hidden bg-[#eef1f5] ${row ? "h-auto min-h-[112px] w-[118px]" : "h-[120px] w-full"}`}>
          {p.image && (
            <Image src={p.image} alt={p.name} fill sizes={row ? "118px" : "260px"} className="object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
          )}
        </span>
        <span className="block min-w-0 flex-1 p-3">
          <span className="block truncate pr-6 font-['Outfit'] text-[15px] font-bold text-[#0d1117]">{p.name}</span>
          {p.area && <span className="mt-0.5 block truncate text-[12px] text-[#6b7280]">{p.area}</span>}
          <span className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[12.5px]">
            <span className="font-['Outfit'] font-bold text-[#0d1117]">{p.price ? `From ${p.price}` : "Price on request"}</span>
            {p.handover && (
              <span className="inline-flex items-center gap-1 text-[#6b7280]">
                <CalendarClock className="h-3.5 w-3.5 text-[#b8913f]" /> {p.handover}
              </span>
            )}
          </span>
          <span className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-bold text-[#8a6d2b]">
            View project <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </span>
      </Link>
    </>
  )
}

/**
 * Every marker in one OverlayView: one container in the map's mouse-target
 * pane (drag moves it with the tiles, no per-frame work) and one anchor per
 * marker, positioned in draw(). Created only once the Maps API has loaded,
 * because OverlayView doesn't exist before then.
 */
function createLayer(
  map: google.maps.Map,
  on: {
    cluster: (it: Extract<Item, { kind: "cluster" }>) => void
    point: (i: number) => void
    hover: (it: Item | null) => void
    label: (i: number) => { text: string; aria: string }
  },
): Layer {
  class MarkerLayer extends google.maps.OverlayView {
    root = document.createElement("div")
    popupEl = document.createElement("div")
    anchors = new Map<string, { el: HTMLDivElement; pos: google.maps.LatLng }>()
    popupPos: google.maps.LatLng | null = null
    marks: Record<string, string | null> = { "is-hot": null, "is-sel": null }

    constructor() {
      super()
      this.root.className = "pm-layer"
      this.popupEl.className = "pm-popup-at"
      this.popupEl.style.display = "none"
      google.maps.OverlayView.preventMapHitsAndGesturesFrom(this.popupEl)
    }
    onAdd() {
      const panes = this.getPanes()
      panes?.overlayMouseTarget.appendChild(this.root)
      panes?.floatPane.appendChild(this.popupEl)
    }
    onRemove() {
      this.root.remove()
      this.popupEl.remove()
    }
    draw() {
      const proj = this.getProjection()
      if (!proj) return
      for (const { el, pos } of this.anchors.values()) {
        const p = proj.fromLatLngToDivPixel(pos)
        if (p) el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`
      }
      if (this.popupPos) {
        const p = proj.fromLatLngToDivPixel(this.popupPos)
        if (p) this.popupEl.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`
      }
    }
    setItems(items: Item[]) {
      const keep = new Set(items.map((it) => it.key))
      for (const [key, a] of this.anchors) {
        if (!keep.has(key)) {
          a.el.remove()
          this.anchors.delete(key)
        }
      }
      for (const it of items) {
        if (this.anchors.has(it.key)) continue
        const at = document.createElement("div")
        at.className = `pm-at ${it.kind === "cluster" ? "pm-at--cl" : "pm-at--pt"}`
        const btn = document.createElement("button")
        btn.type = "button"
        if (it.kind === "cluster") {
          const size = Math.round(34 + Math.min(20, Math.log2(it.count) * 4.5))
          btn.className = "pm-cl"
          btn.style.setProperty("--s", `${size}px`)
          btn.textContent = fmtCount(it.count)
          btn.setAttribute("aria-label", `${it.count} projects here`)
        } else {
          const { text, aria } = on.label(it.i)
          btn.className = "pm-pin"
          btn.textContent = text
          btn.setAttribute("aria-label", aria)
        }
        btn.addEventListener("click", (e) => {
          e.stopPropagation()
          if (it.kind === "cluster") on.cluster(it)
          else on.point(it.i)
        })
        btn.addEventListener("mouseenter", () => on.hover(it))
        btn.addEventListener("mouseleave", () => on.hover(null))
        google.maps.OverlayView.preventMapHitsFrom(btn)
        at.appendChild(btn)
        this.root.appendChild(at)
        this.anchors.set(it.key, { el: at, pos: new google.maps.LatLng(it.lat, it.lng) })
      }
      // Re-apply hover / selection to whichever anchors now carry them.
      for (const [cls, key] of Object.entries(this.marks)) this.applyMark(key, cls)
      this.draw()
    }
    applyMark(key: string | null, cls: string) {
      for (const a of this.anchors.values()) a.el.classList.remove(cls)
      if (key) this.anchors.get(key)?.el.classList.add(cls)
    }
    mark(key: string | null, cls: "is-hot" | "is-sel") {
      this.marks[cls] = key
      this.applyMark(key, cls)
    }
    setPopup(pos: { lat: number; lng: number } | null) {
      this.popupPos = pos ? new google.maps.LatLng(pos.lat, pos.lng) : null
      this.popupEl.style.display = pos ? "block" : "none"
      this.draw()
    }
  }
  const layer = new MarkerLayer()
  layer.setMap(map)
  return {
    setItems: (items) => layer.setItems(items),
    mark: (key, cls) => layer.mark(key, cls),
    setPopup: (pos) => layer.setPopup(pos),
    popupEl: layer.popupEl,
    destroy: () => layer.setMap(null),
  }
}

export function ProjectsMap({
  apiKey,
  projects,
  unpinned,
  listHref,
}: {
  apiKey: string
  /** The filtered catalogue with coordinates, in the listing's order. */
  projects: MapProject[]
  /** Filtered projects with no coordinates: in the list view only. */
  unpinned: number
  /** The same filters in list view. */
  listHref: string
}) {
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const layerRef = useRef<Layer | null>(null)
  const keyOf = useRef(new Map<number, string>())
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [popupEl, setPopupEl] = useState<HTMLDivElement | null>(null)
  const [inView, setInView] = useState<number[] | null>(null)
  const [spot, setSpot] = useState<number[] | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [limit, setLimit] = useState(BATCH)
  const [satellite, setSatellite] = useState(false)
  const [moved, setMoved] = useState(false)
  const wide = useWide()

  const index = useMemo(() => {
    // extent 256 = Google's tile size, so `radius` is in real screen pixels
    // (supercluster assumes 512 px tiles, which halved it and let markers overlap).
    const sc = new Supercluster<{ i: number }>({ radius: 84, extent: 256, maxZoom: CLUSTER_MAX_ZOOM, minPoints: 2 })
    sc.load(projects.map((p, i) => ({ type: "Feature" as const, properties: { i }, geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] } })))
    return sc
  }, [projects])

  // The map is built once; these refs hand it the current data, so a filter
  // change refreshes the markers instead of rebuilding the map.
  const indexRef = useRef(index)
  const projectsRef = useRef(projects)
  const reclusterRef = useRef<() => void>(() => {})

  const mapBoxRef = useRef<HTMLDivElement>(null)
  const glideToken = useRef(0)

  /**
   * Fly the camera to a point like Bayut does: out until the target is on
   * screen (so the pan can glide instead of jump), across, then in one level
   * at a time — each step is Google's own animated zoom. A newer glide, or
   * the user grabbing the map, cancels the one in flight.
   */
  const glideTo = useCallback(async (target: { lat: number; lng: number }, zoomTo: number) => {
    const map = mapRef.current
    if (!map) return false
    const token = ++glideToken.current
    const alive = () => token === glideToken.current && mapRef.current === map
    const settle = () =>
      new Promise<void>((resolve) => {
        const l = google.maps.event.addListenerOnce(map, "idle", () => resolve())
        window.setTimeout(() => {
          l.remove()
          resolve()
        }, 650)
      })
    const pt = new google.maps.LatLng(target.lat, target.lng)
    for (let n = 0; n < 8 && alive(); n++) {
      if (map.getBounds()?.contains(pt) || (map.getZoom() ?? 8) <= 7) break
      map.setZoom((map.getZoom() ?? 8) - 1)
      await settle()
    }
    if (!alive()) return false
    map.panTo(pt)
    await settle()
    for (let n = 0; n < 14 && alive(); n++) {
      const z = map.getZoom() ?? 8
      if (z >= zoomTo) break
      map.setZoom(z + 1)
      await settle()
    }
    return alive()
  }, [])

  /** From the list: bring the map into view on a phone, fly to the project, open its card. */
  const showOnMap = useCallback(
    async (i: number) => {
      const p = projectsRef.current[i]
      if (!p || !mapRef.current) return
      if (window.innerWidth < 1024) {
        mapBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
        await new Promise((r) => window.setTimeout(r, 450))
      }
      setSelected(null)
      setMoved(true)
      const arrived = await glideTo({ lat: p.lat, lng: p.lng }, Math.max(PROJECT_ZOOM, Math.round(mapRef.current?.getZoom() ?? 0)))
      if (arrived) setSelected(i)
    },
    [glideTo],
  )

  // The Maps script is shared with /buy, /rent and /developers: next/script
  // dedupes by src, so when it's already loaded onLoad never fires again.
  useEffect(() => {
    if (!window.google?.maps?.Map) return
    const t = window.setTimeout(() => setReady(true), 0)
    return () => window.clearTimeout(t)
  }, [])

  const fitAll = useCallback(() => {
    const map = mapRef.current
    const list = projectsRef.current
    if (!map) return
    if (list.length === 0) {
      map.setCenter(UAE)
      map.setZoom(8)
    } else if (list.length === 1) {
      map.setCenter({ lat: list[0].lat, lng: list[0].lng })
      map.setZoom(14)
    } else {
      const b = new google.maps.LatLngBounds()
      for (const p of list) b.extend({ lat: p.lat, lng: p.lng })
      map.fitBounds(b, 48)
    }
    setMoved(false)
  }, [])

  // Build the map once the script is ready.
  useEffect(() => {
    if (!ready || !mapEl.current || mapRef.current) return
    const map = new google.maps.Map(mapEl.current, {
      center: UAE,
      zoom: 8,
      maxZoom: MAP_MAX_ZOOM,
      minZoom: 6,
      styles: STYLE,
      disableDefaultUI: true,
      clickableIcons: false,
      gestureHandling: "greedy",
      backgroundColor: "#eef0f2",
    })
    mapRef.current = map

    const layer = createLayer(map, {
      cluster: (it) => {
        const target = indexRef.current.getClusterExpansionZoom(it.id)
        if (target > MAP_MAX_ZOOM) {
          // One spot, several projects: list them rather than zoom forever.
          setSpot(it.leaves)
          setSelected(null)
          setLimit(BATCH)
          map.panTo({ lat: it.lat, lng: it.lng })
          return
        }
        setMoved(true)
        void glideTo({ lat: it.lat, lng: it.lng }, Math.min(target, MAP_MAX_ZOOM))
      },
      point: (i) => {
        const p = projectsRef.current[i]
        if (!p) return
        setSelected(i)
        map.panTo({ lat: p.lat, lng: p.lng })
      },
      hover: (it) => setHover(it?.kind === "point" ? it.i : null),
      label: (i) => {
        const p = projectsRef.current[i]
        return { text: p?.price ?? "On request", aria: p ? `${p.name}${p.price ? `, from ${p.price}` : ""}` : "Project" }
      },
    })
    layerRef.current = layer

    const recluster = () => {
      const b = map.getBounds()
      if (!b) return
      const idx = indexRef.current
      const list = projectsRef.current
      const ne = b.getNorthEast()
      const sw = b.getSouthWest()
      const z = Math.round(map.getZoom() ?? 8)
      const keys = new Map<number, string>()
      const items: Item[] = idx.getClusters([sw.lng(), sw.lat(), ne.lng(), ne.lat()], z).map((f) => {
        const [lng, lat] = f.geometry.coordinates
        const props = f.properties as { cluster?: boolean; cluster_id?: number; point_count?: number; i?: number }
        if (props.cluster && props.cluster_id != null) {
          const id = props.cluster_id
          const key = `c${id}`
          const leaves = idx.getLeaves(id, Infinity).map((l) => l.properties.i)
          for (const i of leaves) keys.set(i, key)
          return { kind: "cluster" as const, key, id, count: props.point_count ?? leaves.length, lat, lng, leaves }
        }
        const i = props.i as number
        keys.set(i, `p${i}`)
        return { kind: "point" as const, key: `p${i}`, i, lat, lng }
      })
      keyOf.current = keys
      layer.setItems(items)
      setPopupEl((cur) => cur ?? layer.popupEl)
      setInView(list.map((p, i) => (b.contains({ lat: p.lat, lng: p.lng }) ? i : -1)).filter((i) => i >= 0))
      setLimit(BATCH)
    }
    reclusterRef.current = recluster

    const listeners = [
      map.addListener("idle", recluster),
      map.addListener("dragstart", () => {
        glideToken.current++ // the user took over: stop any flight
        setMoved(true)
      }),
      map.addListener("click", () => setSelected(null)),
    ]

    return () => {
      listeners.forEach((l) => l.remove())
      layer.destroy()
      layerRef.current = null
      mapRef.current = null
    }
  }, [ready, glideTo])

  // New data (a filter changed, or the map just appeared): fresh markers,
  // cleared selection, and the view fitted to the results.
  useEffect(() => {
    indexRef.current = index
    projectsRef.current = projects
    if (!ready) return
    layerRef.current?.setItems([])
    const t = window.setTimeout(() => {
      setSpot(null)
      setSelected(null)
      setHover(null)
      fitAll()
      reclusterRef.current()
    }, 0)
    return () => window.clearTimeout(t)
  }, [index, projects, ready, fitAll])

  // Hover from either side lights the marker (or the cluster holding it).
  useEffect(() => {
    layerRef.current?.mark(hover == null ? null : keyOf.current.get(hover) ?? null, "is-hot")
  }, [hover, inView])
  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    const p = selected == null ? null : projects[selected]
    layer.mark(p && selected != null ? keyOf.current.get(selected) ?? null : null, "is-sel")
    // Phones show the card across the map's top, not above the pin.
    layer.setPopup(p && wide ? { lat: p.lat, lng: p.lng } : null)
  }, [selected, inView, projects, wide])

  useEffect(() => {
    mapRef.current?.setMapTypeId(satellite ? "hybrid" : "roadmap")
  }, [satellite])

  const zoom = (d: number) => {
    const map = mapRef.current
    if (!map) return
    map.setZoom(Math.max(6, Math.min(MAP_MAX_ZOOM, (map.getZoom() ?? 8) + d)))
    setMoved(true)
  }

  const list = spot ?? inView ?? projects.map((_, i) => i)
  const shown = list.slice(0, limit)
  const sel = selected != null ? projects[selected] : null

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-[minmax(420px,44%)_1fr]">
      {apiKey.trim() && (
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`}
          strategy="afterInteractive"
          onLoad={() => setReady(true)}
          onError={() => setFailed(true)}
        />
      )}

      {/* ── The list: whatever the map is showing ── */}
      <section className="order-2 px-4 pb-16 pt-5 sm:px-6 lg:order-none lg:px-8" aria-live="polite">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          {spot ? (
            <>
              <h2 className="font-['Outfit'] text-[20px] font-bold text-[#0d1117]">
                {spot.length} projects at this spot
              </h2>
              <button type="button" onClick={() => setSpot(null)} className="text-[13px] font-bold text-[#001f3f] underline-offset-4 hover:text-[#b8913f] hover:underline">
                Back to the map area
              </button>
            </>
          ) : (
            <h2 className="font-['Outfit'] text-[20px] font-bold text-[#0d1117]">
              {list.length} {list.length === 1 ? "project" : "projects"} {inView ? "in this map area" : "on the map"}
            </h2>
          )}
          {unpinned > 0 && (
            <Link href={listHref} className="text-[12.5px] text-[#6b7280] underline-offset-4 hover:text-[#001f3f] hover:underline">
              +{unpinned} without a map pin, in list view
            </Link>
          )}
        </div>

        {list.length === 0 ? (
          <div className="border border-[#e5e8ec] bg-white px-6 py-12 text-center">
            <p className="font-['Outfit'] text-[17px] font-bold text-[#0d1117]">Nothing in this part of the map</p>
            <p className="mt-1 text-[14px] text-[#6b7280]">Zoom out or drag the map to see more projects.</p>
            {moved && (
              <button type="button" onClick={fitAll} className="mt-4 inline-flex items-center gap-2 bg-[#0d1117] px-5 py-2.5 text-[13px] font-bold text-white hover:bg-[#001f3f]">
                <LocateFixed className="h-4 w-4 text-[#d6b357]" /> Show all projects
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {shown.map((i, n) => {
              const p = projects[i]
              const on = hover === i || selected === i
              return (
                <li
                  key={p.id}
                  className="pm-li"
                  style={{ ["--n" as string]: Math.min(n, 8) }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  <article className={`pm-card group relative flex gap-3.5 border bg-white p-2.5 sm:gap-4 ${on ? "pm-card--on" : "border-[#e5e8ec]"}`}>
                    <Link href={p.href} className="relative block h-[128px] w-[124px] shrink-0 overflow-hidden bg-[#eef1f5] sm:h-[140px] sm:w-[176px]">
                      {p.image ? (
                        <Image
                          src={p.image}
                          alt={p.name}
                          fill
                          sizes="176px"
                          loading={n < 3 ? "eager" : "lazy"}
                          fetchPriority={n < 2 ? "high" : "auto"}
                          className="object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                        />
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold uppercase tracking-[0.14em] text-[#9ca3af]">No image</span>
                      )}
                      {p.status && STATUS[p.status] && (
                        <span className="absolute left-2 top-2 bg-[#0a2647]/90 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-white">{STATUS[p.status]}</span>
                      )}
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col py-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-1 font-['Outfit'] text-[16px] font-bold leading-snug text-[#0d1117] sm:text-[17px]">
                          <Link href={p.href} className="transition-colors hover:text-[#8a6d2b]">{p.name}</Link>
                        </h3>
                        <button
                          type="button"
                          onClick={() => void showOnMap(i)}
                          className="pm-show"
                          aria-label={`Show ${p.name} on the map`}
                          title="Show on map"
                        >
                          <Crosshair className="h-4 w-4" />
                        </button>
                      </div>
                      {p.area && (
                        <p className="mt-0.5 flex items-center gap-1 text-[12.5px] text-[#6b7280]">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#b8913f]" />
                          <span className="truncate">{p.area}</span>
                        </p>
                      )}
                      <div className="mt-2 grid grid-cols-2 gap-px bg-[#e8eaed]">
                        <div className="bg-[#f6f7f9] px-2.5 py-1.5">
                          <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#9ca3af]">From</p>
                          <p className="truncate font-['Outfit'] text-[14px] font-bold text-[#0d1117]">{p.price ?? "On request"}</p>
                        </div>
                        <div className="bg-[#f6f7f9] px-2.5 py-1.5">
                          <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#9ca3af]">Handover</p>
                          <p className="truncate font-['Outfit'] text-[14px] font-bold text-[#0d1117]">{p.handover ?? "—"}</p>
                        </div>
                      </div>
                      {p.developer && (
                        <div className="mt-auto flex items-center gap-2 pt-2">
                          <span
                            className="flex h-8 min-w-[44px] max-w-[96px] shrink-0 items-center justify-center border border-[#eceef1] px-1.5"
                            style={{ backgroundColor: p.developerLogoBg ?? "#ffffff" }}
                          >
                            {p.developerLogo ? (
                              <Image
                                src={p.developerLogo}
                                // SVG bypasses the optimizer (which rejects it).
                                unoptimized={p.developerLogo.toLowerCase().includes(".svg")}
                                alt={`${p.developer} logo`}
                                width={88}
                                height={26}
                                className="h-[22px] w-auto max-w-[84px] object-contain"
                                style={{ width: "auto" }}
                              />
                            ) : (
                              <Building2 className="h-4 w-4 text-[#001f3f]/50" />
                            )}
                          </span>
                          <span className="truncate text-[12px] font-semibold text-[#4b5563]">{p.developer}</span>
                        </div>
                      )}
                    </div>
                  </article>
                </li>
              )
            })}
          </ul>
        )}
        {list.length > limit && (
          <button
            type="button"
            onClick={() => setLimit((n) => n + BATCH)}
            className="mt-5 w-full border border-[#e5e8ec] bg-white py-3 text-[14px] font-bold text-[#0d1117] transition-colors hover:border-[#d6b357] hover:text-[#8a6d2b]"
          >
            Show {Math.min(BATCH, list.length - limit)} more of {list.length - limit}
          </button>
        )}
      </section>

      {/* ── The map: pinned beside the list on wide screens ── */}
      <div
        ref={mapBoxRef}
        className="relative order-1 h-[62svh] min-h-[380px] scroll-mt-20 bg-[#eef0f2] lg:sticky lg:top-[72px] lg:order-none lg:h-[calc(100dvh-72px)]"
      >
        {!apiKey.trim() || failed ? (
          <div className="flex h-full items-center justify-center p-8 text-center text-[14px] text-[#6b7280]">
            The map couldn&apos;t load right now. The list still shows every project.
          </div>
        ) : (
          <>
            <div ref={mapEl} className="absolute inset-0" aria-label="Map of projects" role="region" />
            {!ready && <div className="pm-skeleton absolute inset-0" aria-hidden="true" />}

            {/* Controls, top-right so they're on screen before the map pins */}
            <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => setSatellite((s) => !s)}
                className="pm-ctl"
                aria-pressed={satellite}
                aria-label={satellite ? "Map view" : "Satellite view"}
              >
                <Layers className="h-4 w-4" />
                <span className="hidden sm:inline">{satellite ? "Map" : "Satellite"}</span>
              </button>
              <div className="flex flex-col overflow-hidden border border-[#e5e8ec] bg-white shadow-[0_6px_18px_-8px_rgba(0,20,40,0.35)]">
                <button type="button" onClick={() => zoom(1)} className="pm-zoom" aria-label="Zoom in">
                  <Plus className="h-4 w-4" />
                </button>
                <span className="h-px bg-[#e5e8ec]" aria-hidden="true" />
                <button type="button" onClick={() => zoom(-1)} className="pm-zoom" aria-label="Zoom out">
                  <Minus className="h-4 w-4" />
                </button>
              </div>
              {moved && (
                <button type="button" onClick={fitAll} className="pm-ctl" aria-label="Show all projects">
                  <LocateFixed className="h-4 w-4" />
                  <span className="hidden sm:inline">Show all</span>
                </button>
              )}
            </div>
            {sel && !wide && (
              <div className="pm-popup pm-popup--row absolute left-3 right-[64px] top-3 z-20">
                <PinCard p={sel} onClose={() => setSelected(null)} row />
              </div>
            )}
          </>
        )}
      </div>

      {/* The selected project, floating above its pin */}
      {popupEl &&
        sel &&
        wide &&
        createPortal(
          <div className="pm-popup">
            <PinCard p={sel} onClose={() => setSelected(null)} />
          </div>,
          popupEl,
        )}
    </div>
  )
}
