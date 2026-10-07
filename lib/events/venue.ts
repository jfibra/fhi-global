/**
 * What an event's venue text and map pin say about WHERE it is — for the Event
 * schema's `location`.
 *
 * Events store a free-text venue (usually "Name, formatted address" from the
 * Places picker, sometimes typed by hand) and, when picked from a suggestion,
 * a pin. They store no country, so the schema used to claim "AE" for every
 * company event — including the Manila roadshows — and nothing at all for an
 * agent's. Google needs a real address on an Event to show it, and a wrong
 * country is worse than none, so the country is read from evidence in this
 * order: a country NAMED at the end of the text (explicit), then the pin, then a
 * country mentioned more loosely in the text, then — for a venue typed by hand
 * with no pin — a UAE emirate named in it (unless it also names a Philippine place).
 *
 * Pure and dependency-free.
 */

export type VenuePlace = {
  /** What the page calls the venue ("Richmonde Hotel Ortigas"). */
  name: string
  /** The street part when the text carries one ("21 San Miguel Ave, Ortigas Center, Pasig…"). */
  streetAddress?: string
  /** ISO 3166-1 alpha-2, when it can be established. */
  countryCode?: string
  /** The emirate, when the text names one ("Dubai") — what schema.org calls the address locality. */
  locality?: string
  geo?: { latitude: number; longitude: number }
  /** The venue text as typed — the address fallback when nothing could be split out. */
  text: string
}

const finite = (v: unknown): number | null => {
  if (v == null || (typeof v === "string" && v.trim() === "")) return null
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * The country a coordinate falls in — only for the two places FHI runs events
 * (the UAE, and the Philippines roadshows); anywhere else is "unknown" and the
 * text gets a chance to say. Bounding boxes, deliberately generous: a pin is
 * only ever used to choose between these two.
 */
export function countryFromCoordinates(lat: number, lng: number): string | null {
  // Qatar's peninsula ends at ~51.65°E and the UAE's inhabited coast starts east of it.
  if (lat >= 22.4 && lat <= 26.2 && lng >= 51.65 && lng <= 56.6) return "AE"
  // Sabah (Malaysia) sits inside the plain 116–127°E box below ~7.5°N: down there only the Sulu islands
  // (east of ~119.3°E) are Philippine; Palawan and everything north of it starts at ~116.6°E.
  if (lat >= 4.5 && lat <= 21.5 && lng <= 127 && lng >= (lat >= 7.6 ? 116.6 : 119.3)) return "PH"
  return null
}

// Names people write after an address, beyond the official English names.
const COUNTRY_ALIASES: Record<string, string> = {
  uae: "AE", "u.a.e": "AE", "u.a.e.": "AE", ph: "PH", usa: "US", "u.s.a": "US", uk: "GB", "u.k": "GB",
  "great britain": "GB", england: "GB", scotland: "GB", wales: "GB",
}

let regionIndex: Map<string, string> | null = null

/** "Philippines" → "PH", "United Arab Emirates" → "AE" (English region names from Intl, built once). */
function regionByName(name: string): string | null {
  const key = name.trim().toLowerCase()
  if (key.length < 2) return null
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key]
  if (!regionIndex) {
    regionIndex = new Map()
    try {
      const names = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" })
      for (let a = 65; a <= 90; a++) {
        for (let b = 65; b <= 90; b++) {
          const code = String.fromCharCode(a, b)
          const label = names.of(code)
          // First write wins: "UK" is an exceptional reservation that Intl also names "United Kingdom", and
          // letting it overwrite "GB" made the schema say addressCountry "UK" — not an ISO code.
          const key = label?.toLowerCase()
          if (label && label !== code && key && !regionIndex.has(key)) regionIndex.set(key, code)
        }
      }
    } catch {
      // No Intl region data: the aliases above still cover the UAE and the Philippines' "PH".
    }
  }
  return regionIndex.get(key) ?? null
}

// Countries believed from the last word of a venue name (see trailingCountry).
const LOOSE_COUNTRIES = new Set(["AE", "PH", "GB", "US"])

/**
 * A country named at the end of the text — "…, Philippines", "… - United Arab Emirates", "Albustan UAE".
 * `explicit` = the whole last segment IS the country (", Qatar"); a country that is merely the last WORD of a
 * name ("Hotel Georgia") is only a hint, because it is as likely part of the name as a country.
 */
function trailingCountry(text: string): { code: string; rest: string; explicit: boolean } | null {
  const segments = text.split(/,| - /).map((s) => s.trim()).filter(Boolean)
  const last = segments[segments.length - 1]
  if (!last) return null
  const whole = regionByName(last)
  if (whole) return { code: whole, rest: text.slice(0, text.lastIndexOf(last)).replace(/[,\s-]+$/, "").trim(), explicit: true }
  const words = last.split(" ")
  const word = words[words.length - 1]
  const code = words.length > 1 ? regionByName(word) : null
  // A country that is merely the last WORD of a name is only believed for the places this site runs events in
  // ("Albustan UAE", "Ortigas Center Philippines"): "Hotel Georgia", "Park Hyatt Jordan" and "Hotel Jamaica"
  // are names, not addresses.
  return code && LOOSE_COUNTRIES.has(code)
    ? { code, rest: text.slice(0, text.lastIndexOf(word)).replace(/[,\s-]+$/, "").trim(), explicit: false }
    : null
}

// A venue typed by hand with no pin ("Hyatt Place Dubai Al Rigga") names no country, but names its emirate.
const UAE_EMIRATES: Array<[RegExp, string]> = [
  [/\babu dhabi\b/i, "Abu Dhabi"],
  [/\bdubai\b/i, "Dubai"],
  [/\bsharjah\b/i, "Sharjah"],
  [/\bajman\b/i, "Ajman"],
  [/\bras al[- ]khaimah\b/i, "Ras Al Khaimah"],
  [/\bfujairah\b/i, "Fujairah"],
  [/\bumm al[- ]quwain\b/i, "Umm Al Quwain"],
]
// …unless it names a Philippine place too ("Dubai-style roadshow, Makati"): then it could be either, so it says nothing.
const PHILIPPINE_MARKERS =
  /\b(manila|ortigas|makati|pasig|taguig|bgc|bonifacio global|quezon|mandaluyong|pasay|paranaque|las pinas|muntinlupa|alabang|marikina|caloocan|antipolo|cebu|davao|bacolod|iloilo|cagayan de oro|pampanga|clark|subic|baguio|tagaytay|cavite|laguna|batangas|bulacan|boracay|palawan)\b/i

function emirateIn(text: string): string | undefined {
  if (PHILIPPINE_MARKERS.test(text)) return undefined
  return UAE_EMIRATES.find(([re]) => re.test(text))?.[1]
}

/** After "Name, " — does the remainder read as an address rather than part of a name ("Richmonde Hotel, Ortigas")? */
const looksLikeAddress = (tail: string) => /\d/.test(tail) || tail.includes(" - ") || tail.split(", ").length >= 2

/**
 * The place for an event, or null when the data cannot honestly support one:
 * no venue text, or no evidence of a country (neither a usable pin nor a country
 * in the text). A null here means the Event node is left out — a page that
 * cannot say where it is is not an event Google can show.
 */
export function venuePlace(venue: string | null | undefined, lat?: unknown, lng?: unknown): VenuePlace | null {
  const text = (venue ?? "").replace(/\s+/g, " ").trim()
  if (!text) return null

  const latitude = finite(lat)
  const longitude = finite(lng)
  const geo = latitude != null && longitude != null ? { latitude, longitude } : undefined

  const trailing = trailingCountry(text)
  const pinCountry = geo ? countryFromCoordinates(geo.latitude, geo.longitude) : null
  const emirate = pinCountry && pinCountry !== "AE" ? undefined : emirateIn(text)
  // A country the text NAMES outright beats the pin box (the UAE box also covers Qatar and Bahrain); a country
  // that is only the last word of the text fills in when the pin says nothing, and a UAE emirate in the text
  // is the last resort for a venue typed by hand with no pin at all.
  const countryCode =
    (trailing?.explicit ? trailing.code : null) ?? pinCountry ?? trailing?.code ?? (!geo && emirate ? "AE" : null) ?? undefined
  if (!geo && !countryCode) return null
  // The emirate only counts as the locality when the venue really is in the UAE: "Dubai Property Roadshow,
  // Taal Vista Hotel, Tagaytay, Philippines" is a Philippine address whose event NAME mentions Dubai.
  const locality = countryCode === "AE" ? emirate : undefined

  // Strip the country from the name only when it really was one: a pin that already settled the country
  // must not turn "Hotel Georgia" into "Hotel".
  const countryWasText = trailing != null && (trailing.explicit || countryCode === trailing.code)
  const body = countryWasText ? trailing.rest || text : text
  let name = body
  let streetAddress: string | undefined
  const comma = body.indexOf(", ")
  if (comma > 0 && looksLikeAddress(body.slice(comma + 2))) {
    name = body.slice(0, comma)
    streetAddress = body.slice(comma + 2)
  } else if (comma < 0 && body.includes(" - ")) {
    // "Omar Bin Al Khattab St - Al Muraqqabat - Deira - Dubai": the text IS the address.
    name = body.split(" - ")[0]
    streetAddress = body
  }
  // Google's formatted addresses separate the parts with " - " in the UAE; an address line reads with commas.
  if (streetAddress) streetAddress = streetAddress.replace(/\s+-\s+/g, ", ")

  return { name, streetAddress, countryCode, locality, geo, text }
}
