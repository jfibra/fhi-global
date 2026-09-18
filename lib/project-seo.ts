import { truncateDescription } from "@/lib/seo"

/**
 * Data-driven SEO copy for project pages (/{developer}/{project}).
 *
 * 256 of 257 published projects carry no curated meta_title/meta_description,
 * ~40 have no overview text at all, and the ones that do average a paragraph —
 * yet the structured columns ARE populated: price on 249, handover on 242,
 * unit types on 244, amenities on 230. These helpers turn that data into the
 * title, description, "at a glance" paragraph and FAQ block, so every project
 * page reads differently because its facts are different — the opposite of
 * swapping a name into boilerplate.
 *
 * Ground rules:
 * - Only state what the row supports. A missing field drops its sentence;
 *   nothing is padded with generic marketing copy.
 * - FAQ answers must render visibly with the same wording that goes into the
 *   FAQPage schema (see lib/structured-data.ts faqPageSchema).
 */

export type ProjectSeoUnit = {
  unit_type: string | null
  bedrooms: number | null
  size_sqft: number | string | null
  price_from: number | string | null
}

export type ProjectSeoInput = {
  name: string
  status: string | null
  community?: string | null
  location?: string | null
  city?: string | null
  launch_price_from?: number | string | null
  launch_price_to?: number | string | null
  currency?: string | null
  delivery_quarter?: string | null
  expected_completion_date?: string | null
  delivery_date?: string | null
  total_units?: number | null
  floors?: number | null
  number_of_buildings?: number | null
  down_payment_percentage?: number | string | null
  payment_plan_details?: string | null
  installment_available?: boolean | null
  freehold?: boolean | null
  ownership_type?: string | null
  developer?: { name: string } | null
  /** property_types.name values ("Apartment", "Villa", "Retail", …). */
  propertyTypes?: string[]
  units?: ProjectSeoUnit[]
  /** amenities.name values, most important first. */
  amenities?: string[]
  /** project_neighbors.description values ("Creek Metro Station - 3 min"). */
  neighbors?: string[]
}

export type Faq = { q: string; a: string }

const BRAND = "FHI Global"
/** Google's title display cutoff is ~60 characters; snippets show ~155. */
const TITLE_MAX = 60
const DESCRIPTION_MAX = 155

export const STATUS_LABELS: Record<string, string> = {
  pre_launch: "Pre-Launch",
  launch: "Launching",
  under_construction: "Under Construction",
  completed: "Completed",
}

export function statusLabel(status: string | null | undefined): string {
  return (status && STATUS_LABELS[status]) || status || "Off-Plan"
}

/** Anything not completed is sold off-plan. */
export function isOffPlan(status: string | null | undefined): boolean {
  return status !== "completed"
}

function toNum(value: number | string | null | undefined): number | null {
  if (value == null) return null
  if (typeof value === "string" && value.trim() === "") return null
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function clean(value: string | null | undefined): string | null {
  const t = (value ?? "").trim()
  return t ? t : null
}

/**
 * Below this, a "price" is a data-entry slip rather than a Dubai property
 * price — two rows hold 1.6 and 1.46 (millions typed as units), which rendered
 * on the live page as "AED 1.6".
 */
const MIN_CREDIBLE_PRICE = 50_000

/** "AED 2.2M" / "AED 586K" / "AED 950" — the compact style the cards use. */
export function formatPrice(
  from: number | string | null | undefined,
  to?: number | string | null,
  currency?: string | null,
): string | null {
  const cur = currency ?? "AED"
  const f = toNum(from)
  if (!f || f <= 0) return null
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
    return n.toLocaleString()
  }
  const t = toNum(to)
  if (t && t !== f) return `${cur} ${fmt(f)} – ${fmt(t)}`
  return `${cur} ${fmt(f)}`
}

/** Q from a 1-based month. */
function quarterOf(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`
}

/** "Q4 2027" — from delivery_quarter, else the completion/delivery date. */
export function handoverLabel(p: ProjectSeoInput): string | null {
  const q = clean(p.delivery_quarter)
  if (q) return q
  const date = clean(p.expected_completion_date) ?? clean(p.delivery_date)
  return date ? quarterOf(date) : null
}

// Residential types carry the search intent; retail/office rows are noise in a
// title ("Retail in JVC" is what nobody types).
const RESIDENTIAL_ORDER = ["Apartment", "Villa", "Townhouse", "Penthouse"]
const COMMERCIAL = ["Commercial Office", "Retail"]
const PLURAL: Record<string, string> = {
  Apartment: "Apartments",
  Villa: "Villas",
  Townhouse: "Townhouses",
  Penthouse: "Penthouses",
}

function residentialTypes(types: string[] | undefined): string[] {
  const set = new Set((types ?? []).map((t) => t.trim()))
  return RESIDENTIAL_ORDER.filter((t) => set.has(t))
}

/** Retail/office only — a business park is not a "residential development". */
function isCommercialOnly(types: string[] | undefined): boolean {
  const set = new Set((types ?? []).map((t) => t.trim()))
  return residentialTypes(types).length === 0 && COMMERCIAL.some((t) => set.has(t))
}

/** "DUBAI - AL AIN ROAD - 2 MIN" → "Dubai - Al Ain Road - 2 Min"; mixed-case input is left alone. */
function tidyCase(s: string): string {
  const t = s.replace(/\s+/g, " ").trim()
  if (t !== t.toUpperCase() || !/[A-Z]/.test(t)) return t
  return t.toLowerCase().replace(/\b[a-z]/g, (ch) => ch.toUpperCase())
}

/** Lower-case Title-Case words only: "Central A/C" → "central A/C", "BBQ Area" → "BBQ area". */
function softLower(s: string): string {
  return s.replace(/\b[A-Z][a-z]+\b/g, (w) => w.toLowerCase())
}

/** "Apartments" / "Apartments & Penthouses" / "Properties" when nothing residential. */
export function typeLabel(p: ProjectSeoInput): string {
  const types = residentialTypes(p.propertyTypes)
  if (types.length === 0) return isCommercialOnly(p.propertyTypes) ? "Commercial Units" : "Properties"
  if (types.length === 1) return PLURAL[types[0]]
  return `${PLURAL[types[0]]} & ${PLURAL[types[1]]}`
}

/** Singular, lower-case, for prose: "apartment development". */
function typeNoun(p: ProjectSeoInput): string {
  const types = residentialTypes(p.propertyTypes)
  if (types.length === 0) return isCommercialOnly(p.propertyTypes) ? "commercial" : "residential"
  if (types.length === 1) return types[0].toLowerCase()
  return `${types[0].toLowerCase()} and ${types[1].toLowerCase()}`
}

/** Primary area for titles: community, else location, else city. */
export function primaryArea(p: ProjectSeoInput): string | null {
  return clean(p.community) ?? clean(p.location) ?? clean(p.city)
}

/** "Al Furjan, Dubai" — area + city when they differ. */
export function fullArea(p: ProjectSeoInput): string | null {
  const area = clean(p.community) ?? clean(p.location)
  const city = clean(p.city)
  if (area && city && !area.toLowerCase().includes(city.toLowerCase()) && !city.toLowerCase().includes(area.toLowerCase())) {
    return `${area}, ${city}`
  }
  return area ?? city
}

/** True when the project is already branded with its developer ("Azizi Sikandar"). */
function nameCarriesDeveloper(name: string, developer: string): boolean {
  const first = developer.trim().split(/\s+/)[0]?.toLowerCase() ?? ""
  return first.length >= 4 && name.toLowerCase().includes(first)
}

function bedroomsOf(u: ProjectSeoUnit): number | null {
  if (u.bedrooms != null && Number.isFinite(u.bedrooms)) return u.bedrooms
  const t = (u.unit_type ?? "").toLowerCase()
  if (/studio/.test(t)) return 0
  const m = /(\d)\s*(?:br\b|bhk|bed)/.exec(t)
  if (m) return Number(m[1])
  return null
}

function isCommercialUnit(u: ProjectSeoUnit): boolean {
  return /shop|retail|office|commercial/i.test(u.unit_type ?? "")
}

/**
 * "Studios and 1–3 bedroom units" + optional "450–1,150 sqft" — a data summary
 * of the unit mix, or null when the rows carry nothing usable.
 */
export function unitsSummary(p: ProjectSeoInput): { mix: string | null; sizes: string | null } {
  const units = (p.units ?? []).filter((u) => !isCommercialUnit(u))
  const beds = Array.from(new Set(units.map(bedroomsOf).filter((b): b is number => b != null))).sort((a, b) => a - b)
  const sizes = units.map((u) => toNum(u.size_sqft)).filter((n): n is number => n != null && n > 0)

  let mix: string | null = null
  const hasStudio = beds.includes(0)
  const rooms = beds.filter((b) => b > 0)
  if (rooms.length > 0) {
    const bedrooms =
      rooms.length === 1 ? `${rooms[0]}-bedroom units` : `${rooms[0]}–${rooms[rooms.length - 1]} bedroom units`
    mix = hasStudio ? `Studios and ${bedrooms}` : bedrooms.charAt(0).toUpperCase() + bedrooms.slice(1)
  } else if (hasStudio) {
    mix = "Studios"
  }

  // Only claim a size range when every unit row carries one. With partial
  // coverage the old code stated the single known size as if it applied to the
  // whole mix ("studios and 1–3 bedroom units, sized 677 sqft" from one 1BR row).
  let sizeText: string | null = null
  if (sizes.length > 0) {
    const min = Math.min(...sizes)
    const max = Math.max(...sizes)
    const f = (n: number) => Math.round(n).toLocaleString("en-US")
    if (sizes.length < units.length) sizeText = `from ${f(min)} sqft`
    else sizeText = min === max ? `${f(min)} sqft` : `${f(min)}–${f(max)} sqft`
  }
  return { mix, sizes: sizeText }
}

/**
 * The advertised "from" price must be a price something is actually sold at.
 *
 * launch_price_from disagrees with the unit table on 124 of the 174 projects
 * that carry both, and on 52 of them it sits more than 50% BELOW the cheapest
 * unit on the same page — a page that advertises AED 820K over a table whose
 * cheapest row is AED 1.4M reads as bait to a buyer and as an internal
 * contradiction to a quality rater. So: implausible headline values are
 * discarded, and when the unit rows price the project, the headline can never
 * undercut them.
 */
export function priceFromValue(p: ProjectSeoInput): number | null {
  const head = toNum(p.launch_price_from)
  const headline = head != null && head >= MIN_CREDIBLE_PRICE ? head : null
  const units = (p.units ?? []).map((u) => toNum(u.price_from)).filter((n): n is number => n != null && n >= MIN_CREDIBLE_PRICE)
  if (units.length === 0) return headline
  const cheapest = Math.min(...units)
  if (headline == null) return cheapest
  // More than 10% below the cheapest real unit → the headline is not on sale.
  return headline < cheapest * 0.9 ? cheapest : Math.min(headline, cheapest)
}

/** Upper bound, only when it is credible and above the floor. */
export function priceToValue(p: ProjectSeoInput): number | null {
  const to = toNum(p.launch_price_to)
  const from = priceFromValue(p)
  if (to == null || to < MIN_CREDIBLE_PRICE) return null
  return from != null && to <= from ? null : to
}

function priceFrom(p: ProjectSeoInput): string | null {
  return formatPrice(priceFromValue(p), null, p.currency)
}

/**
 * Title: the most informative variant that fits Google's ~60-char display.
 * Always `absolute` so the layout's " | FHI Global" template can't push a
 * fitted title past the cutoff — the brand is included where it fits.
 */
export function composeProjectTitle(p: ProjectSeoInput): { absolute: string } {
  const name = p.name.trim()
  const dev = clean(p.developer?.name)
  const byDev = dev && !nameCarriesDeveloper(name, dev) ? ` by ${dev}` : ""
  const area = primaryArea(p)
  const types = typeLabel(p)
  const intent = isOffPlan(p.status) ? "Off-Plan " : ""
  const brand = ` | ${BRAND}`

  const variants: string[] = []
  if (area) {
    variants.push(
      `${name}${byDev} — ${intent}${types} in ${area}${brand}`,
      `${name}${byDev} — ${intent}${types} in ${area}`,
      `${name} — ${intent}${types} in ${area}${brand}`,
      `${name}${byDev} — ${types} in ${area}`,
      `${name} — ${intent}${types} in ${area}`,
      `${name} — ${types} in ${area}`,
    )
  }
  if (byDev) variants.push(`${name}${byDev}${brand}`)
  if (area) variants.push(`${name} in ${area}${brand}`)
  variants.push(`${name}${brand}`)

  return { absolute: variants.find((v) => v.length <= TITLE_MAX) ?? `${name}${brand}` }
}

/**
 * Meta description (≤155 chars): the facts a searcher scans for — developer,
 * area, off-plan/ready, price-from, handover, unit mix — then a call to action.
 */
export function composeProjectDescription(p: ProjectSeoInput): string {
  const name = p.name.trim()
  const dev = clean(p.developer?.name)
  const area = fullArea(p)
  const price = priceFrom(p)
  const handover = handoverLabel(p)
  const offPlan = isOffPlan(p.status)
  const types = typeLabel(p).toLowerCase()
  const { mix } = unitsSummary(p)

  let lead = name
  if (dev && !nameCarriesDeveloper(name, dev)) lead += ` by ${dev}`
  if (area) lead += ` in ${area}`
  const facts: string[] = []
  facts.push(`${offPlan ? "off-plan" : "ready"} ${types}${price ? ` from ${price}` : ""}`)
  if (offPlan && handover) facts.push(`handover ${handover}`)
  // Add sentences only while they fit the snippet — a clean stop beats an
  // ellipsis through the call to action.
  let text = `${lead}: ${facts.join(", ")}.`
  for (const s of [mix ? `${mix}.` : null, `Prices, unit types & availability from ${BRAND}.`]) {
    if (s && `${text} ${s}`.length <= DESCRIPTION_MAX) text = `${text} ${s}`
  }
  return truncateDescription(text, DESCRIPTION_MAX)
}

/**
 * "At a glance" — 2–6 factual sentences for the Overview, rendered above any
 * developer-supplied copy (and standing alone for the ~40 projects without).
 */
export function projectAtAGlance(p: ProjectSeoInput): string[] {
  const name = p.name.trim()
  const dev = clean(p.developer?.name)
  const area = fullArea(p)
  const offPlan = isOffPlan(p.status)
  const noun = typeNoun(p)
  const out: string[] = []

  out.push(
    `${name} is ${offPlan ? "an off-plan" : "a completed"} ${noun} development${dev ? ` by ${dev}` : ""}${area ? ` in ${area}` : ""}.`,
  )

  const units = p.total_units ?? null
  const floors = p.floors ?? null
  const buildings = p.number_of_buildings ?? null
  if (units || floors || (buildings && buildings > 1)) {
    let s = units ? `${units.toLocaleString("en-US")} units` : ""
    if (floors) s = s ? `${s} across ${floors} floors` : `${floors} floors`
    if (buildings && buildings > 1) s = s ? `${s} in ${buildings} buildings` : `${buildings} buildings`
    out.push(`The project comprises ${s}.`)
  }

  const { mix, sizes } = unitsSummary(p)
  if (mix) {
    const sized = sizes ? (sizes.startsWith("from") || sizes.includes("–") ? `, with sizes ${sizes.startsWith("from") ? sizes : "from " + sizes}` : `, sized ${sizes}`) : ""
    out.push(`Unit types include ${mix.charAt(0).toLowerCase() + mix.slice(1)}${sized}.`)
  }

  const price = priceFrom(p)
  const priceTo = formatPrice(p.launch_price_to, null, p.currency)
  const handover = handoverLabel(p)
  if (price) {
    let s = `Prices start from ${price}`
    if (priceTo && priceTo !== price) s += ` and range up to ${priceTo}`
    if (offPlan && handover) s += `, with handover expected in ${handover}`
    else if (!offPlan) s += `; the project is completed and ready to move in`
    out.push(`${s}.`)
  } else if (offPlan && handover) {
    out.push(`Handover is expected in ${handover}.`)
  }

  const dp = toNum(p.down_payment_percentage)
  if (dp) out.push(`A ${dp}% down payment${p.installment_available ? " with instalments" : ""} applies.`)

  const amenities = (p.amenities ?? []).filter(Boolean).slice(0, 5)
  if (amenities.length >= 3) out.push(`Residents have access to ${listJoin(amenities.map(softLower))}.`)

  const neighbors = (p.neighbors ?? []).filter(Boolean).slice(0, 3).map(tidyCase)
  if (neighbors.length >= 2) out.push(`Nearby: ${neighbors.join("; ")}.`)

  return out
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("")
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`
}

/**
 * FAQ — only questions the data can answer. Rendered visibly AND emitted as
 * FAQPage schema with identical wording.
 */
export function projectFaqs(p: ProjectSeoInput): Faq[] {
  const name = p.name.trim()
  const dev = clean(p.developer?.name)
  const area = fullArea(p)
  const offPlan = isOffPlan(p.status)
  const price = priceFrom(p)
  const priceTo = formatPrice(p.launch_price_to, null, p.currency)
  const handover = handoverLabel(p)
  const { mix, sizes } = unitsSummary(p)
  const faqs: Faq[] = []

  if (area) {
    faqs.push({
      q: `Where is ${name} located?`,
      a: `${name} is located in ${area}${dev ? `, and is developed by ${dev}` : ""}.`,
    })
  }
  faqs.push({
    q: `Is ${name} off-plan or ready?`,
    a: offPlan
      ? `${name} is an off-plan project (status: ${statusLabel(p.status).toLowerCase()})${handover ? ` with handover expected in ${handover}` : ""}.`
      : `${name} is completed and ready to move in.`,
  })
  if (price) {
    faqs.push({
      q: `What is the starting price of ${name}?`,
      a: `Prices at ${name} start from ${price}${priceTo && priceTo !== price ? ` and go up to ${priceTo}` : ""}. Contact ${BRAND} for current availability and unit-level pricing.`,
    })
  }
  if (offPlan && handover) {
    faqs.push({ q: `When is the handover date for ${name}?`, a: `Handover of ${name} is expected in ${handover}.` })
  }
  if (mix) {
    faqs.push({
      q: `What unit types are available at ${name}?`,
      a: `${name} offers ${mix.charAt(0).toLowerCase() + mix.slice(1)}${sizes ? (sizes.startsWith("from") ? ` ${sizes}` : sizes.includes("–") ? ` ranging from ${sizes}` : ` of ${sizes}`) : ""}.`,
    })
  }
  if (dev) {
    faqs.push({ q: `Who is the developer of ${name}?`, a: `${name} is developed by ${dev}.` })
  }
  const dp = toNum(p.down_payment_percentage)
  const plan = clean(p.payment_plan_details)
  if (dp || plan) {
    const bits: string[] = []
    if (dp) bits.push(`${dp}% down payment`)
    if (p.installment_available) bits.push("instalments available")
    faqs.push({
      q: `What is the payment plan for ${name}?`,
      a: `${bits.length ? `${bits.join(", ")}. ` : ""}${plan ?? ""}`.trim(),
    })
  }
  const ownership = clean(p.ownership_type) ?? (p.freehold ? "Freehold" : null)
  if (ownership) {
    faqs.push({ q: `Is ${name} freehold?`, a: `${name} is offered on a ${ownership.toLowerCase()} basis.` })
  }
  return faqs
}

export type PaymentMilestone = { percent: number; label: string }
export type PaymentPlan = {
  /** Instalments that together account for the price, in the order written. */
  milestones: PaymentMilestone[]
  /** Percentages that are charges rather than instalments (DLD, admin fees). */
  fees: PaymentMilestone[]
  /** The original sentence, kept whenever it cannot be read as a schedule. */
  note: string | null
}

/** A charge on top of the price, not a step in paying it. */
const FEE_LABEL = /\b(dld|fee|registration|commission|vat|service charge|admin|oqood)\b/i
/** Recurring instalments ("1% monthly") are not a single milestone. */
const RECURRING_LABEL = /\b(month|monthly|quarter|quarterly|annual|annually|year|yearly)\b/i

/** Tidy a milestone label: "on booking" → "On booking", "ON HANDOVER" → "On handover". */
function milestoneLabel(raw: string): string {
  const t = raw
    .replace(/^[\s\-–—:/|]+/, "")
    .replace(/[\s\-–—:/|]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
  if (!t) return ""
  const lower = t === t.toUpperCase() ? t.toLowerCase() : t.charAt(0).toLowerCase() + t.slice(1)
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

/**
 * Read a free-text payment plan into milestones.
 *
 * The field is written by hand, so it arrives in every shape: "20% on booking,
 * 50% during construction, 30% on handover", "70% During Construction / 30% On
 * Handover", but also "8 Years Payment Plan" and "1% Payment Per Month", which
 * describe a plan without splitting it. Milestones are only returned when at
 * least two percentages are present AND they account for roughly the whole
 * price — otherwise the text is passed through as a note, so a monthly-instalment
 * plan is never rendered as though 1% were the entire schedule.
 */
export function parsePaymentPlan(
  text: string | null | undefined,
  downPaymentPercent?: number | string | null,
): PaymentPlan {
  const raw = clean(text)
  const milestones: PaymentMilestone[] = []
  const fees: PaymentMilestone[] = []
  if (raw) {
    // The label runs to the next separator — "/" included, or
    // "70% During Construction / 30% On Handover" reads as a single 70% step.
    for (const m of raw.matchAll(/(\d{1,3}(?:\.\d+)?)\s*%\s*([^,;.|/\n]*)/g)) {
      const percent = Number(m[1])
      if (!Number.isFinite(percent) || percent <= 0 || percent > 100) continue
      const label = milestoneLabel(m[2] ?? "")
      if (FEE_LABEL.test(label)) fees.push({ percent, label })
      else if (!RECURRING_LABEL.test(label)) milestones.push({ percent, label })
    }
  }
  const total = milestones.reduce((sum, m) => sum + m.percent, 0)
  // A schedule has to be at least two steps that between them buy the property.
  // Anything else (a "1% monthly" plan, "8 Years Payment Plan", a per-unit-type
  // split) keeps its sentence rather than being rendered as a partial schedule.
  if (milestones.length >= 2 && total >= 90 && total <= 110) {
    return { milestones, fees, note: null }
  }
  const dp = toNum(downPaymentPercent)
  return {
    milestones: dp != null && dp > 0 && dp <= 100 ? [{ percent: dp, label: "Down payment" }] : [],
    fees,
    note: raw,
  }
}

/** Visible sub-heading under the H1: "Off-Plan Apartments by GFS Developments in Dubai South". */
export function projectSubtitle(p: ProjectSeoInput): string | null {
  const dev = clean(p.developer?.name)
  const area = fullArea(p)
  const intent = isOffPlan(p.status) ? "Off-Plan " : ""
  const types = typeLabel(p)
  const parts = [`${intent}${types}`]
  if (dev && !nameCarriesDeveloper(p.name, dev)) parts.push(`by ${dev}`)
  if (area) parts.push(`in ${area}`)
  return parts.length > 1 || types !== "Properties" ? parts.join(" ") : null
}
