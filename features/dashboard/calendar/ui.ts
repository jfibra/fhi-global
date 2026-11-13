import type { CalendarItem, CalendarLayer } from "@/lib/calendar/types"

/**
 * Shared bits of the admin Calendar page: Dubai dates, the month/week grids,
 * and one colour per layer (tint for a chip, strong for a dot) — the same
 * tints the mock-up was approved with.
 */

export const DAY_MS = 86400e3

export const dubaiToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" })
export const shiftDay = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
/** 0 = Monday … 6 = Sunday. */
export const weekdayIndex = (iso: string) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7
export const mondayOf = (iso: string) => shiftDay(iso, -weekdayIndex(iso))
export const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`
export const nextMonthStart = (iso: string) => {
  const [y, m] = iso.slice(0, 7).split("-").map(Number)
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`
}
export const prevMonthStart = (iso: string) => {
  const [y, m] = iso.slice(0, 7).split("-").map(Number)
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`
}
export const monthEnd = (iso: string) => shiftDay(nextMonthStart(iso), -1)

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AE", { ...opts, timeZone: "UTC" })
export const monthLabel = (iso: string) => fmt(iso, { month: "long", year: "numeric" })
export const dayNumber = (iso: string) => String(Number(iso.slice(8, 10)))
export const weekdayShort = (iso: string) => fmt(iso, { weekday: "short" }).toUpperCase()
export const weekdayLong = (iso: string) => fmt(iso, { weekday: "long" })
export const dayLabel = (iso: string) => fmt(iso, { weekday: "short", day: "numeric", month: "short" })
export const longDayLabel = (iso: string) => fmt(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" })

/** "16 to 22 November" or "30 Nov to 6 Dec" for a Monday-first week. */
export function weekLabel(monday: string): string {
  const sunday = shiftDay(monday, 6)
  if (monday.slice(0, 7) === sunday.slice(0, 7)) return `${dayNumber(monday)} to ${dayNumber(sunday)} ${fmt(monday, { month: "long" })}`
  return `${dayNumber(monday)} ${fmt(monday, { month: "short" })} to ${dayNumber(sunday)} ${fmt(sunday, { month: "short" })}`
}

/** The month grid: Monday-first rows that cover the whole month. */
export function monthGrid(month: string): string[][] {
  const first = mondayOf(monthStart(month))
  const last = monthEnd(month)
  const rows: string[][] = []
  for (let d = first; d <= last; d = shiftDay(d, 7)) rows.push(Array.from({ length: 7 }, (_, i) => shiftDay(d, i)))
  return rows
}

export const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

export type LayerColour = { bg: string; text: string; dot: string }

export const LAYER_COLOURS: Record<CalendarLayer, LayerColour> = {
  event: { bg: "#ede9fe", text: "#4c1d95", dot: "#7c3aed" },
  project: { bg: "#e0f2fe", text: "#0c4a6e", dot: "#0284c7" },
  deal: { bg: "#d1fae5", text: "#064e3b", dot: "#059669" },
  birthday: { bg: "#fce7f3", text: "#831843", dot: "#db2777" },
  document: { bg: "#ffe4e6", text: "#881337", dot: "#e11d48" },
  entry: { bg: "#fdf3d6", text: "#5c4a12", dot: "#b8913f" },
  holiday: { bg: "#ccfbf1", text: "#134e4a", dot: "#0d9488" },
  automatic: { bg: "#f1f5f9", text: "#334155", dot: "#64748b" },
}

const WARN: LayerColour = { bg: "#fef3c7", text: "#78350f", dot: "#d97706" }

export const colourOf = (item: Pick<CalendarItem, "layer" | "tone">): LayerColour => (item.tone === "warn" ? WARN : LAYER_COLOURS[item.layer])

/** What comes first inside a day: the things people act on, then the many birthdays, then the automatic emails. */
const LAYER_RANK: Record<CalendarLayer, number> = { entry: 0, event: 1, project: 2, deal: 3, document: 4, holiday: 5, birthday: 6, automatic: 7 }

/** Items grouped by day; inside a day a stuck deal first, then by layer rank, then time. */
export function byDay(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const m = new Map<string, CalendarItem[]>()
  for (const it of items) m.set(it.date, [...(m.get(it.date) ?? []), it])
  for (const list of m.values()) list.sort((a, b) => Number(b.tone === "warn") - Number(a.tone === "warn") || LAYER_RANK[a.layer] - LAYER_RANK[b.layer] || (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title))
  return m
}

// ─── Which layers are on, remembered per browser ─────────────────────────────
//
// A tiny external store for useSyncExternalStore: localStorage when it works,
// memory when it is blocked (private window). The snapshot is the raw string,
// so it is referentially stable; the server snapshot is "" (the defaults), so
// hydration never mismatches.

export const LAYERS_STORAGE_KEY = "fhi-calendar-layers"
const layerListeners = new Set<() => void>()
let layersInMemory = ""

export function subscribeLayers(cb: () => void): () => void {
  layerListeners.add(cb)
  window.addEventListener("storage", cb)
  return () => {
    layerListeners.delete(cb)
    window.removeEventListener("storage", cb)
  }
}

export function layersSnapshot(): string {
  try {
    return window.localStorage.getItem(LAYERS_STORAGE_KEY) ?? layersInMemory
  } catch {
    return layersInMemory
  }
}

export const layersServerSnapshot = () => ""

export function parseLayers(raw: string, fallback: CalendarLayer[]): CalendarLayer[] {
  if (!raw) return fallback
  try {
    const list = JSON.parse(raw)
    return Array.isArray(list) ? (list.filter((x) => typeof x === "string") as CalendarLayer[]) : fallback
  } catch {
    return fallback
  }
}

export function storeLayers(layers: CalendarLayer[]): void {
  layersInMemory = JSON.stringify(layers)
  try {
    window.localStorage.setItem(LAYERS_STORAGE_KEY, layersInMemory)
  } catch {
    // Private window or blocked storage: the choice lives in memory for this visit.
  }
  for (const cb of layerListeners) cb()
}
