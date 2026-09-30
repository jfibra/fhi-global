"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Check, Loader2, MapPin, X } from "lucide-react"

/**
 * The event form's venue box: type a few letters and Google suggests real
 * places ("Manila Marriott Hotel, Pasay City…"); picking one stores its exact
 * coordinates, so the public event page can show it on a map. Typing freely
 * still works — the venue is then text only, with no pin (the page shows no
 * map rather than guessing a spot from "Manila").
 *
 * Talks to Places API (New) straight from the browser: the Maps key is
 * HTTP-referrer restricted, which Google accepts there (the legacy Places
 * service refuses such keys). The key comes from /api/admin/maps-key. One
 * session token spans the typing and the pick, so Google bills it as one
 * lookup.
 */

export type VenuePin = { lat: number; lng: number; placeId: string }

type Suggestion = { placeId: string; main: string; secondary: string }

const AUTOCOMPLETE = "https://places.googleapis.com/v1/places:autocomplete"

let keyPromise: Promise<string | null> | null = null
function mapsKey(): Promise<string | null> {
  keyPromise ??= fetch("/api/admin/maps-key", { cache: "no-store" })
    .then(async (r) => (r.ok ? (((await r.json()) as { key?: string }).key ?? null) : null))
    .catch(() => null)
  return keyPromise
}

const newToken = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()))

export function VenueAutocomplete({
  value,
  pin,
  onChange,
  inputClassName,
  placeholder,
}: {
  value: string
  pin: VenuePin | null
  /** Every change: the venue text, and the pin (null when typed, not picked). */
  onChange: (venue: string, pin: VenuePin | null) => void
  inputClassName: string
  placeholder?: string
}) {
  const [items, setItems] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const token = useRef(newToken())
  const typed = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  // Suggestions for what was typed (not for text set by a pick or on open).
  useEffect(() => {
    if (!typed.current) return
    const q = value.trim()
    if (q.length < 3) return
    let live = true
    const t = window.setTimeout(async () => {
      const key = await mapsKey()
      if (!key) {
        if (live) setUnavailable(true)
        return
      }
      setLoading(true)
      try {
        const res = await fetch(AUTOCOMPLETE, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
          body: JSON.stringify({ input: q, sessionToken: token.current }),
        })
        const json = (await res.json()) as {
          suggestions?: { placePrediction?: { placeId: string; structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } }; text?: { text: string } } }[]
        }
        if (!live) return
        const next = (json.suggestions ?? [])
          .map((s) => s.placePrediction)
          .filter((p): p is NonNullable<typeof p> => !!p?.placeId)
          .map((p) => ({
            placeId: p.placeId,
            main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
            secondary: p.structuredFormat?.secondaryText?.text ?? "",
          }))
          .slice(0, 6)
        setItems(next)
        setOpen(next.length > 0)
        setActive(-1)
      } catch {
        if (live) setItems([])
      } finally {
        if (live) setLoading(false)
      }
    }, 250)
    return () => {
      live = false
      window.clearTimeout(t)
    }
  }, [value])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  const pick = async (s: Suggestion) => {
    setOpen(false)
    typed.current = false
    const key = await mapsKey()
    if (!key) return
    setLoading(true)
    try {
      const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(s.placeId)}?sessionToken=${encodeURIComponent(token.current)}`, {
        headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "id,displayName,formattedAddress,location" },
      })
      const p = (await res.json()) as { id?: string; displayName?: { text?: string }; formattedAddress?: string; location?: { latitude?: number; longitude?: number } }
      const name = p.displayName?.text?.trim() || s.main
      const address = p.formattedAddress?.trim() || s.secondary
      // "Manila Marriott Hotel, 2 Resorts Drive, …, Pasay City" — the name once.
      const venue = (address && !address.toLowerCase().startsWith(name.toLowerCase()) ? `${name}, ${address}` : address || name).slice(0, 300)
      const lat = p.location?.latitude
      const lng = p.location?.longitude
      onChange(venue, typeof lat === "number" && typeof lng === "number" ? { lat, lng, placeId: p.id ?? s.placeId } : null)
    } catch {
      onChange(`${s.main}${s.secondary ? `, ${s.secondary}` : ""}`.slice(0, 300), null)
    } finally {
      setLoading(false)
      token.current = newToken()
    }
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || items.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((a) => (a + 1) % items.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => (a - 1 + items.length) % items.length)
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault()
      void pick(items[active])
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          className={`${inputClassName} pr-9`}
          value={value}
          onChange={(e) => {
            typed.current = true
            // Too short to search: drop the old suggestions.
            if (e.target.value.trim().length < 3) {
              setItems([])
              setOpen(false)
            }
            // Typing changes the place, so an earlier pin no longer applies.
            onChange(e.target.value, null)
          }}
          onFocus={() => items.length > 0 && setOpen(true)}
          onKeyDown={onKey}
          placeholder={placeholder}
          maxLength={300}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-[#9ca3af]" /> : <MapPin className={`h-4 w-4 ${pin ? "text-emerald-600" : "text-[#d6b357]"}`} />}
        </span>
      </div>

      {open && items.length > 0 && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-40 mt-1 max-h-72 overflow-auto border border-[#e5e7eb] bg-white py-1 shadow-[0_18px_40px_-16px_rgba(0,20,40,0.35)]">
          {items.map((s, i) => (
            <li key={s.placeId} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void pick(s)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left ${i === active ? "bg-[#f4f6f9]" : ""}`}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#d6b357]" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[#111827]">{s.main}</span>
                  {s.secondary && <span className="block truncate text-xs text-[#6b7280]">{s.secondary}</span>}
                </span>
              </button>
            </li>
          ))}
          <li className="px-3 pb-1 pt-1.5 text-right text-[10px] text-[#9ca3af]">Suggestions by Google</li>
        </ul>
      )}

      {pin ? (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-emerald-700">
          <Check className="h-3.5 w-3.5" /> Pinned on the map
          <a href={`https://www.google.com/maps/search/?api=1&query=${pin.lat},${pin.lng}&query_place_id=${encodeURIComponent(pin.placeId)}`} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
            Check the spot
          </a>
          <button type="button" onClick={() => onChange(value, null)} className="inline-flex items-center gap-0.5 text-[#6b7280] hover:text-rose-600">
            <X className="h-3 w-3" /> Remove pin
          </button>
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-[#9ca3af]">
          {unavailable ? "Place suggestions are unavailable right now — type the full address." : "Start typing and pick a suggestion to pin the exact place on the event page's map."}
        </p>
      )}
    </div>
  )
}
