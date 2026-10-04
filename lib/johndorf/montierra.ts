/**
 * Montierra (Johndorf Ventures Corporation) — the subdivision plan as data,
 * for the presentation at /johndorf/dashboard (boss, 2026-10-04).
 *
 * Everything about blocks, lots, clusters and areas is read off the plan
 * drawing (public/johndorf/montierra-plan.jpg): lot numbers, which cluster
 * each run of lots belongs to, the lot areas printed on them, and the
 * facilities. The townhouse specs are as Johndorf published them at launch;
 * who has reserved or bought each lot is DEMO data (see lotBooking).
 *
 * Hotspot polygons are in the plan's 2000 × 1414 coordinate space (same
 * aspect as the image), so one SVG viewBox fits the picture at any size.
 */

export type ClusterId = "green" | "yellow" | "orange"

export const CLUSTERS: Record<ClusterId, { label: string; color: string; soft: string; text: string }> = {
  green: { label: "Green Cluster", color: "#8b9a21", soft: "#eef0d9", text: "#56600f" },
  yellow: { label: "Yellow Cluster", color: "#f0c419", soft: "#fcf3cf", text: "#7a5d00" },
  orange: { label: "Orange Cluster", color: "#f08a1d", soft: "#fde6d0", text: "#8a4a05" },
}

/** A run of consecutive lots in one cluster, e.g. lots 9–16 are Orange. */
type Run = [from: number, to: number, cluster: ClusterId]

export type Block = {
  id: string
  /** "Block 4" */
  name: string
  kind: "residential" | "commercial"
  /** Lot numbers in this block, 1..lots. */
  lots: number
  runs: Run[]
  /** Parks & playgrounds lots (open space), by lot number. */
  parks: number[]
  /** Lots that are facilities, by lot number. */
  facilities?: Record<number, string>
  /** Lot areas printed on the plan (sqm), smallest to largest. */
  areas: number[]
  /** The roads the block fronts. */
  frontage: string[]
  /** Commercial zones: the area printed on the plan. */
  areaSqm?: number
  note?: string
  polygon: [number, number][]
}

export type Facility = {
  id: string
  name: string
  kind: "clubhouse" | "park" | "utility" | "gate" | "rotunda"
  detail: string
  areaSqm?: number
  /** A photo under public/johndorf/houses/ (the page shows an icon card until it exists). */
  photo?: string
  polygon: [number, number][]
}

const rect = (x1: number, y1: number, x2: number, y2: number): [number, number][] => [
  [x1, y1],
  [x2, y1],
  [x2, y2],
  [x1, y2],
]

export const BLOCKS: Block[] = [
  {
    id: "b1", name: "Block 1", kind: "residential", lots: 63,
    runs: [[1, 8, "yellow"], [9, 16, "orange"], [17, 24, "green"], [25, 30, "yellow"], [31, 34, "orange"], [36, 39, "green"], [40, 45, "yellow"], [46, 51, "orange"], [52, 57, "green"], [58, 61, "yellow"]],
    parks: [35, 62], facilities: { 63: "Sewage treatment plant (S.T.P.) · 208 sqm" },
    areas: [54, 55, 62, 78, 82, 87, 97], frontage: ["10.00 M RROW"],
    note: "The long northern row along the main internal road, backing onto the 20.00 M public road.",
    polygon: rect(431, 222, 1762, 280),
  },
  {
    id: "b2", name: "Block 2", kind: "residential", lots: 62,
    runs: [[2, 5, "green"], [6, 13, "yellow"], [14, 21, "orange"], [22, 27, "green"], [28, 31, "yellow"], [33, 36, "yellow"], [37, 42, "green"], [43, 50, "orange"], [51, 58, "yellow"], [59, 62, "green"]],
    parks: [1, 32], areas: [54, 55, 78, 80, 83], frontage: ["10.00 M RROW", "8.00 M RROW"],
    polygon: rect(484, 297, 1098, 403),
  },
  {
    id: "b3", name: "Block 3", kind: "residential", lots: 54,
    runs: [[2, 5, "orange"], [6, 11, "green"], [12, 17, "yellow"], [18, 23, "orange"], [24, 27, "green"], [29, 32, "green"], [33, 38, "orange"], [39, 44, "yellow"], [45, 50, "green"], [51, 54, "orange"]],
    parks: [1, 28], areas: [54, 78, 95], frontage: ["10.00 M RROW", "8.00 M RROW"],
    polygon: rect(1139, 297, 1692, 403),
  },
  {
    id: "b4", name: "Block 4", kind: "residential", lots: 46,
    runs: [[2, 5, "orange"], [6, 7, "green"], [8, 15, "yellow"], [16, 19, "orange"], [20, 23, "green"], [25, 28, "green"], [29, 32, "orange"], [33, 40, "yellow"], [41, 42, "green"], [43, 46, "orange"]],
    parks: [1, 24], areas: [54, 55, 78, 81, 84, 90, 100, 104], frontage: ["8.00 M RROW"],
    polygon: rect(541, 426, 1098, 523),
  },
  {
    id: "b5", name: "Block 5", kind: "residential", lots: 46,
    runs: [[2, 5, "yellow"], [6, 9, "orange"], [10, 15, "green"], [16, 19, "yellow"], [20, 23, "orange"], [25, 28, "orange"], [29, 32, "yellow"], [33, 38, "green"], [39, 42, "orange"], [43, 46, "yellow"]],
    parks: [1, 24], areas: [54, 81, 82], frontage: ["8.00 M RROW"],
    polygon: rect(1139, 426, 1692, 523),
  },
  {
    id: "b6", name: "Block 6", kind: "residential", lots: 40,
    runs: [[2, 7, "yellow"], [8, 13, "orange"], [14, 17, "green"], [18, 21, "yellow"], [23, 26, "yellow"], [27, 30, "green"], [31, 36, "orange"], [37, 40, "yellow"]],
    parks: [1, 22], areas: [54, 81, 82, 87, 91], frontage: ["8.00 M RROW", "12.00 M RROW"],
    polygon: rect(578, 545, 1098, 643),
  },
  {
    id: "b7", name: "Block 7", kind: "residential", lots: 46,
    runs: [[2, 5, "orange"], [6, 9, "green"], [10, 15, "yellow"], [16, 19, "orange"], [20, 23, "green"], [25, 28, "green"], [29, 32, "orange"], [33, 38, "yellow"], [39, 42, "green"], [43, 46, "orange"]],
    parks: [1, 24], areas: [54, 81, 82], frontage: ["8.00 M RROW", "12.00 M RROW"],
    polygon: rect(1139, 545, 1692, 643),
  },
  {
    id: "b8", name: "Block 8", kind: "residential", lots: 37,
    runs: [[2, 7, "orange"], [8, 11, "green"], [12, 15, "yellow"], [16, 19, "orange"], [21, 24, "orange"], [25, 28, "yellow"], [29, 32, "green"], [33, 37, "orange"]],
    parks: [1, 20], areas: [54, 81, 93, 99], frontage: ["12.00 M RROW", "10.00 M RROW"],
    polygon: rect(638, 685, 1098, 783),
  },
  {
    id: "b9", name: "Block 9", kind: "residential", lots: 46,
    runs: [[2, 5, "green"], [6, 9, "yellow"], [10, 15, "orange"], [16, 19, "green"], [20, 23, "yellow"], [25, 28, "yellow"], [29, 32, "green"], [33, 38, "orange"], [39, 42, "yellow"], [43, 46, "green"]],
    parks: [1, 24], areas: [54, 78, 81, 82], frontage: ["12.00 M RROW", "10.00 M RROW"],
    polygon: rect(1139, 685, 1692, 783),
  },
  {
    id: "b10", name: "Block 10", kind: "residential", lots: 29,
    runs: [[2, 8, "yellow"], [9, 12, "orange"], [13, 16, "green"], [18, 21, "green"], [22, 25, "orange"], [26, 29, "yellow"]],
    parks: [1, 17], areas: [54, 80, 81, 84, 86], frontage: ["10.00 M RROW", "8.00 M RROW"],
    polygon: rect(713, 817, 1098, 909),
  },
  {
    id: "b11", name: "Block 11", kind: "residential", lots: 18,
    runs: [[3, 6, "green"], [7, 10, "yellow"], [11, 14, "orange"], [15, 18, "green"]],
    parks: [1], facilities: { 2: "Clubhouse · 566 sqm" },
    areas: [103, 104], frontage: ["10.00 M RROW"],
    note: "A single row of the largest lots, facing the clubhouse and the amenities park.",
    polygon: rect(1264, 817, 1692, 881),
  },
  {
    id: "b12", name: "Block 12", kind: "residential", lots: 21,
    runs: [[1, 4, "yellow"], [5, 10, "orange"], [11, 14, "yellow"], [16, 21, "orange"]],
    parks: [15], areas: [81, 87, 93, 96], frontage: ["10.00 M RROW"],
    note: "The eastern edge of the subdivision, one lot deep, along the 10.00 M road.",
    polygon: rect(1713, 296, 1771, 816),
  },
  {
    id: "b13", name: "Block 13", kind: "residential", lots: 17,
    runs: [[2, 7, "green"], [8, 11, "yellow"], [12, 15, "orange"]],
    parks: [1, 16], facilities: { 17: "Water tank (W.T.) · 87 sqm" },
    areas: [81, 87], frontage: ["10.00 M RROW"],
    note: "Beside the Block 15 commercial zone, running down to the main gate.",
    polygon: [[345, 224], [431, 222], [431, 282], [557, 603], [498, 640], [385, 300]],
  },
  {
    id: "b14", name: "Block 14", kind: "residential", lots: 25,
    runs: [[2, 4, "green"], [5, 7, "yellow"], [8, 13, "orange"], [14, 17, "green"], [18, 21, "yellow"], [22, 25, "orange"]],
    parks: [1], areas: [81, 87, 93, 98, 105, 108], frontage: ["10.00 M RROW", "8.00 M RROW"],
    note: "Wraps around the Block 16 commercial zone — the subdivision's largest regular lots.",
    polygon: [[556, 750], [598, 744], [803, 940], [1103, 940], [1103, 998], [800, 998], [773, 980], [655, 872], [561, 766]],
  },
  {
    id: "b15", name: "Block 15 · Commercial Zone", kind: "commercial", lots: 0, runs: [], parks: [], areas: [], frontage: ["20.00 M PUBLIC RROW"],
    areaSqm: 3798,
    note: "Along the 20.00 M public road, with its own commercial entrance / exit beside the main gate.",
    polygon: [[197, 232], [347, 221], [470, 662], [405, 702]],
  },
  {
    id: "b16", name: "Block 16 · Commercial Zone", kind: "commercial", lots: 0, runs: [], parks: [], areas: [], frontage: ["20.00 M PUBLIC RROW"],
    areaSqm: 4457,
    note: "The larger commercial zone, along the curve of the 20.00 M public road, with its own entrance / exit.",
    polygon: [[452, 758], [556, 758], [561, 766], [655, 872], [773, 980], [800, 998], [985, 1000], [985, 1068], [700, 1068], [604, 1014], [537, 951], [504, 888], [476, 820]],
  },
]

export const FACILITIES: Facility[] = [
  { id: "clubhouse", name: "Clubhouse & Pool", kind: "clubhouse", detail: "Block 11, Lot 2 — beside the amenities park.", areaSqm: 566, photo: "/johndorf/houses/pool.jpg", polygon: rect(1137, 817, 1264, 881) },
  { id: "park", name: "Amenities Park", kind: "park", detail: "Block 11, Lot 1 — courts, playground and open lawn.", areaSqm: 3971, photo: "/johndorf/houses/amenities.jpg", polygon: [[1137, 884], [1762, 884], [1700, 1012], [985, 1012], [985, 1002], [1104, 1002], [1104, 940], [1137, 940]] },
  { id: "gate", name: "Main Gate & Guardhouse", kind: "gate", detail: "15.00 M RROW entrance, between the two commercial zones.", photo: "/johndorf/houses/gate.jpg", polygon: rect(430, 672, 522, 752) },
  { id: "rotunda", name: "Rotunda", kind: "rotunda", detail: "12.00 M RROW — the spine road starts here.", polygon: [[588, 640], [612, 648], [620, 668], [612, 690], [588, 698], [564, 690], [556, 668], [564, 648]] },
  { id: "stp", name: "Sewage Treatment Plant", kind: "utility", detail: "Block 1, Lot 63.", areaSqm: 208, polygon: rect(1700, 222, 1762, 280) },
  { id: "wt", name: "Water Tank", kind: "utility", detail: "Block 13, Lot 17.", areaSqm: 87, polygon: rect(345, 224, 390, 282) },
]

/**
 * The Montierra townhouse — one two-storey design in three colour schemes (the
 * clusters). Floor area, bedrooms and baths are as published at launch
 * (Cebu Daily News / SunStar: ~64 sqm on 54–108 sqm lots, 3 bedrooms, 2 T&B).
 * Photos are Johndorf's own renders, saved under public/johndorf/houses/.
 */
export type HouseModel = {
  cluster: ClusterId
  name: string
  type: string
  storeys: number
  bedrooms: number
  baths: number
  carport: number
  floorAreaSqm: number
  /** Photos under public/johndorf/houses/; the page draws an illustration when empty. */
  photos: string[]
}

export const HOUSE_MODELS: Record<ClusterId, HouseModel> = {
  green: { cluster: "green", name: "Montierra Townhouse", type: "Two-storey · Green scheme", storeys: 2, bedrooms: 3, baths: 2, carport: 1, floorAreaSqm: 64, photos: ["/johndorf/houses/green.jpg"] },
  yellow: { cluster: "yellow", name: "Montierra Townhouse", type: "Two-storey · Yellow scheme", storeys: 2, bedrooms: 3, baths: 2, carport: 1, floorAreaSqm: 64, photos: ["/johndorf/houses/yellow.jpg"] },
  orange: { cluster: "orange", name: "Montierra Townhouse", type: "Two-storey · Orange scheme", storeys: 2, bedrooms: 3, baths: 2, carport: 1, floorAreaSqm: 64, photos: ["/johndorf/houses/orange.jpg"] },
}

export type Lot = { no: number; cluster: ClusterId | null; park: boolean; facility: string | null }

/** Every lot of a block in order, with what it is. */
export function blockLots(b: Block): Lot[] {
  return Array.from({ length: b.lots }, (_, i) => {
    const no = i + 1
    const run = b.runs.find(([from, to]) => no >= from && no <= to)
    return { no, cluster: run ? run[2] : null, park: b.parks.includes(no), facility: b.facilities?.[no] ?? null }
  })
}

/** Residential lots per cluster in a block. */
export function clusterCounts(b: Block): Record<ClusterId, number> {
  const counts: Record<ClusterId, number> = { green: 0, yellow: 0, orange: 0 }
  for (const [from, to, cluster] of b.runs) counts[cluster] += to - from + 1
  return counts
}

export const residentialLots = (b: Block) => b.runs.reduce((n, [from, to]) => n + (to - from + 1), 0)

export const TOTALS = (() => {
  const homes = BLOCKS.filter((b) => b.kind === "residential")
  const lots = homes.reduce((n, b) => n + residentialLots(b), 0)
  const byCluster: Record<ClusterId, number> = { green: 0, yellow: 0, orange: 0 }
  for (const b of homes) for (const [k, v] of Object.entries(clusterCounts(b))) byCluster[k as ClusterId] += v
  const parks = homes.reduce((n, b) => n + b.parks.length, 0)
  const commercialSqm = BLOCKS.filter((b) => b.kind === "commercial").reduce((n, b) => n + (b.areaSqm ?? 0), 0)
  return { blocks: homes.length, lots, byCluster, parks, commercialSqm }
})()

export const centroid = (poly: [number, number][]): [number, number] => [
  poly.reduce((s, p) => s + p[0], 0) / poly.length,
  poly.reduce((s, p) => s + p[1], 0) / poly.length,
]

// ─── Availability (sample) ────────────────────────────────────────────────────
// Who has reserved or bought each lot is DEMO data for the presentation: a
// fixed spread (about half available, a third reserved, the rest sold) that
// stays the same on every visit, with sample buyer names. Real bookings would
// come from Johndorf's sales system.

export type LotStatus = "available" | "reserved" | "sold"
export type LotBooking = { status: LotStatus; buyer: string | null; date: string | null }

export const STATUS: Record<LotStatus, { label: string; color: string; soft: string; text: string }> = {
  available: { label: "Available", color: "#2f9e44", soft: "#e3f5e7", text: "#1f6f31" },
  reserved: { label: "Reserved", color: "#e8a33d", soft: "#fdf0d8", text: "#8a5a08" },
  sold: { label: "Sold", color: "#2a1d1b", soft: "#ece5e2", text: "#2a1d1b" },
}

const SAMPLE_BUYERS = [
  "Maria Clara Santos", "Jose P. Villanueva", "Angelica Reyes", "Rafael D. Cruz", "Katrina Mendoza", "Benjamin Ocampo",
  "Isabel Fernandez", "Miguel A. Torres", "Patricia Lim", "Carlo Dela Rosa", "Andrea Navarro", "Gabriel Ramos",
  "Sofia Aquino", "Daniel Bautista", "Camille Garcia", "Joshua Castillo", "Hannah Soriano", "Marco Villarin",
]

// A small, stable hash so the same lot always shows the same booking.
const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967295
}

export function lotBooking(blockId: string, lot: number): LotBooking {
  const r = hash(`${blockId}:${lot}`)
  if (r < 0.52) return { status: "available", buyer: null, date: null }
  const buyer = SAMPLE_BUYERS[Math.floor(hash(`${blockId}:${lot}:who`) * SAMPLE_BUYERS.length)]
  const day = new Date(Date.UTC(2026, 2, 1 + Math.floor(hash(`${blockId}:${lot}:when`) * 210)))
  const date = day.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
  return { status: r < 0.84 ? "reserved" : "sold", buyer, date }
}

/** Available / reserved / sold counts for a block's home lots. */
export function bookingCounts(b: Block): Record<LotStatus, number> {
  const counts: Record<LotStatus, number> = { available: 0, reserved: 0, sold: 0 }
  for (const l of blockLots(b)) if (l.cluster) counts[lotBooking(b.id, l.no).status] += 1
  return counts
}

