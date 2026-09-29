// Buyers Link (migrations 060–063): every agent has ONE permanent link with a
// readable, name-based address and two public pages. /buy-with/<slug> is the
// buyer's four-step brief (details, buying profile, preferences, financials);
// /sell-with/<slug> is the seller's (details, the property, status and price,
// plans). The old /b/<code> and /s/<code> addresses redirect to them. Both land on that agent's Buyers
// Link page. Shared by the dashboard page, the public pages and the API
// routes, so the question lists, their validation and their labels have one
// definition. Nothing here is server-only.

export type Choice = { value: string; label: string }
const opts = (pairs: [string, string][]): Choice[] => pairs.map(([value, label]) => ({ value, label }))

export const BUDGET_OPTIONS = opts([
  ["under_500k", "Under AED 500K"],
  ["500k_1m", "AED 500K – 1M"],
  ["1m_1_5m", "AED 1M – 1.5M"],
  ["1_5m_3m", "AED 1.5M – 3M"],
  ["3m_5m", "AED 3M – 5M"],
  ["5m_10m", "AED 5M – 10M"],
  ["10m_plus", "AED 10M+"],
])

/** The ranges briefs used before the low end was split (2026-09-29); old leads still read as sent. */
const LEGACY_BUDGET_LABELS: Record<string, string> = { under_1m: "Under AED 1M", "1m_2m": "AED 1M – 2M", "2m_5m": "AED 2M – 5M" }

/** The bottom of each range in AED, for the lead grade. */
const BUDGET_FLOOR: Record<string, number> = {
  under_500k: 0,
  "500k_1m": 500_000,
  "1m_1_5m": 1_000_000,
  "1_5m_3m": 1_500_000,
  "3m_5m": 3_000_000,
  "5m_10m": 5_000_000,
  "10m_plus": 10_000_000,
  under_1m: 0,
  "1m_2m": 1_000_000,
  "2m_5m": 2_000_000,
}

export const CONTACT_TIME_OPTIONS = opts([
  ["morning", "Morning"],
  ["afternoon", "Afternoon"],
  ["evening", "Evening"],
])

export const budgetLabel = (value: string | null | undefined): string | null =>
  BUDGET_OPTIONS.find((o) => o.value === value)?.label ?? LEGACY_BUDGET_LABELS[value ?? ""] ?? null
export const contactTimeLabel = (value: string | null | undefined): string | null =>
  CONTACT_TIME_OPTIONS.find((o) => o.value === value)?.label ?? null

/** `label` is asked on the client's page; `short` heads the answer on the agent's side. */
type Question = { label: string; short: string; multi: boolean; options: Choice[] }

/** Which form sent a brief: the buyer's (/b/<code>) or the seller's (/s/<code>). */
export type BriefKind = "buyer" | "seller"

/** Stored answers: option keys (one, or a list for multi questions) and short free text. */
export type BriefProfile = Partial<Record<string, string | string[]>>

/**
 * Keep only known questions and option values, and the listed free-text
 * fields (trimmed and capped; `digits` keeps numbers only). Every submission
 * goes through this, so stored briefs are always clean.
 */
function parseAnswers(
  questions: Record<string, Question>,
  texts: Record<string, { max: number; digits?: boolean }>,
  raw: unknown,
): BriefProfile {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const out: BriefProfile = {}
  for (const [key, q] of Object.entries(questions)) {
    const allowed = new Set(q.options.map((o) => o.value))
    const v = input[key]
    if (q.multi) {
      if (Array.isArray(v)) {
        const picked = [...new Set(v.filter((x): x is string => typeof x === "string" && allowed.has(x)))]
        if (picked.length) out[key] = picked
      }
    } else if (typeof v === "string" && allowed.has(v)) {
      out[key] = v
    }
  }
  for (const [key, t] of Object.entries(texts)) {
    const v = input[key]
    if (typeof v !== "string") continue
    const clean = t.digits ? v.replace(/\D/g, "").replace(/^0+/, "") : v.trim()
    if (clean) out[key] = clean.slice(0, t.max)
  }
  return out
}

function labelFor(q: Question, value: string | string[] | undefined): string | null {
  if (value == null || (Array.isArray(value) && value.length === 0)) return null
  const one = (v: string) => q.options.find((o) => o.value === v)?.label ?? v
  return Array.isArray(value) ? value.map(one).join(", ") : one(value)
}

/**
 * Every choice question on the brief, by the key it is stored under in
 * buyer_link_leads.profile. Stored values are these option keys, never free
 * text, so the dashboard and exports always read cleanly.
 */
export const BUYER_QUESTIONS = {
  residence: {
    label: "Where do you live now?",
    short: "Lives",
    multi: false,
    options: opts([["uae", "In the UAE"], ["ph", "In the Philippines"], ["abroad", "Somewhere else"]]),
  },
  contact_channel: {
    label: "How should we reach you?",
    short: "Reach by",
    multi: false,
    options: opts([["whatsapp", "WhatsApp"], ["viber", "Viber"], ["messenger", "Messenger"], ["call", "Phone call"], ["email", "Email"]]),
  },
  buying_for: {
    label: "Who are you buying for?",
    short: "Buying for",
    multi: false,
    options: opts([["myself", "Myself"], ["family", "My family"], ["investment", "As an investment"], ["company", "A company"]]),
  },
  goal: {
    label: "What matters most to you?",
    short: "Goal",
    multi: false,
    options: opts([
      ["rental_income", "Rental income"],
      ["appreciation", "Long-term growth in value"],
      ["both", "Both income and growth"],
      ["home", "A home for me or my family"],
      ["residency", "Residency or the Golden Visa"],
      ["not_sure", "Not sure yet"],
    ]),
  },
  buying_with: {
    label: "Are you buying alone?",
    short: "Buying",
    multi: false,
    options: opts([["alone", "Just me"], ["partner", "With my spouse or partner"], ["family", "With family"], ["business", "With business partners"]]),
  },
  buy_timeline: {
    label: "When do you plan to buy?",
    short: "Plans to buy",
    multi: false,
    options: opts([["asap", "As soon as possible"], ["1_3m", "In 1–3 months"], ["3_6m", "In 3–6 months"], ["6_12m", "In 6–12 months"], ["exploring", "Just exploring"]]),
  },
  move_in: {
    label: "When would you like to move in?",
    short: "Move in",
    multi: false,
    options: opts([["now", "Ready now"], ["1y", "Within a year"], ["1_3y", "In 1–3 years, off-plan is fine"], ["not_moving", "Not moving in, it's an investment"]]),
  },
  property_types: {
    label: "What type of property?",
    short: "Property type",
    multi: true,
    options: opts([["apartment", "Apartment"], ["villa", "Villa"], ["townhouse", "Townhouse"], ["penthouse", "Penthouse"], ["duplex", "Duplex"], ["plot", "Plot"], ["commercial", "Commercial"]]),
  },
  bedrooms: {
    label: "Bedrooms",
    short: "Bedrooms",
    multi: true,
    options: opts([["studio", "Studio"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5_plus", "5+"]]),
  },
  completion: {
    label: "Off-plan or ready?",
    short: "Completion",
    multi: false,
    options: opts([["off_plan", "Off-plan"], ["ready", "Ready to move in"], ["either", "Either is fine"]]),
  },
  areas: {
    label: "Areas you like",
    short: "Areas",
    multi: true,
    options: opts([
      ["downtown", "Downtown Dubai"],
      ["marina", "Dubai Marina"],
      ["business_bay", "Business Bay"],
      ["palm", "Palm Jumeirah"],
      ["jvc", "JVC"],
      ["dubai_hills", "Dubai Hills Estate"],
      ["creek_harbour", "Dubai Creek Harbour"],
      ["dubai_south", "Dubai South"],
      ["ranches", "Arabian Ranches"],
      ["open", "Open to suggestions"],
    ]),
  },
  must_haves: {
    label: "Must-haves",
    short: "Must-haves",
    multi: true,
    options: opts([
      ["sea_view", "Sea view"],
      ["pool", "Pool"],
      ["gym", "Gym"],
      ["metro", "Near the metro"],
      ["schools", "Near schools"],
      ["furnished", "Furnished"],
      ["parking", "Parking"],
      ["pets", "Pet-friendly"],
      ["maid_room", "Maid's room"],
    ]),
  },
  payment: {
    label: "How will you pay?",
    short: "Payment",
    multi: false,
    options: opts([["cash", "Cash"], ["mortgage", "Mortgage"], ["payment_plan", "Developer payment plan"], ["not_sure", "Not sure yet"]]),
  },
  mortgage_status: {
    label: "Mortgage pre-approval",
    short: "Mortgage",
    multi: false,
    options: opts([["approved", "Pre-approved"], ["in_progress", "In progress"], ["not_yet", "Not yet"]]),
  },
  down_payment: {
    label: "Down payment you have ready",
    short: "Down payment",
    multi: false,
    options: opts([["10_20", "10–20%"], ["20_30", "20–30%"], ["30_50", "30–50%"], ["50_plus", "More than 50%"], ["not_sure", "Not sure yet"]]),
  },
  golden_visa: {
    label: "Interested in the UAE Golden Visa?",
    short: "Golden Visa",
    multi: false,
    options: opts([["yes", "Yes"], ["tell_me", "Tell me more"], ["no", "No"]]),
  },
  readiness: {
    label: "How ready are you to go ahead?",
    short: "Readiness",
    multi: false,
    options: opts([
      ["reserve", "Ready to reserve"],
      ["serious", "Seriously considering"],
      ["family", "Need to talk to family or partners"],
      ["info", "Need more information first"],
      ["exploring", "Only exploring"],
    ]),
  },
} satisfies Record<string, Question>

export type QuestionKey = keyof typeof BUYER_QUESTIONS

/** The brief's answers: option keys, plus two short free-text fields. */
export type BuyerProfile = Partial<Record<QuestionKey, string | string[]>> & {
  nationality?: string
  areas_other?: string
}

/** The four steps, in order, with the choice questions each one asks. */
export const BUYER_STEPS: { id: "details" | "profile" | "preferences" | "financials"; title: string; keys: QuestionKey[] }[] = [
  { id: "details", title: "Your details", keys: ["residence", "contact_channel"] },
  { id: "profile", title: "Buying profile", keys: ["buying_for", "goal", "buying_with", "buy_timeline", "move_in"] },
  { id: "preferences", title: "Preferences", keys: ["property_types", "bedrooms", "completion", "areas", "must_haves"] },
  { id: "financials", title: "Financials", keys: ["payment", "mortgage_status", "down_payment", "golden_visa", "readiness"] },
]

/** Choice questions the client must answer (budget is required too). */
export const REQUIRED_QUESTIONS: QuestionKey[] = ["buying_for", "buy_timeline", "payment", "readiness"]

/**
 * Keep only known keys and known option values; cap the free text. Used by
 * the API on every submission, so stored briefs are always clean.
 */
export function parseProfile(raw: unknown): BuyerProfile {
  const out = parseAnswers(BUYER_QUESTIONS, { nationality: { max: 60 }, areas_other: { max: 200 } }, raw) as BuyerProfile
  // A pre-approval only means something for a mortgage buyer.
  if (out.payment !== "mortgage") delete out.mortgage_status
  return out
}

/** "Apartment, Villa" for a stored answer, or null when unanswered. */
export function answerLabel(key: QuestionKey, value: string | string[] | undefined): string | null {
  return labelFor(BUYER_QUESTIONS[key], value)
}

// ─── The lead grade ──────────────────────────────────────────────────────────

export type LeadGrade = "priority" | "qualified" | "nurture" | "info"

export const LEAD_GRADES: Record<LeadGrade, { label: string; bg: string; text: string; why: string }> = {
  priority: { label: "Priority", bg: "#dcfce7", text: "#166534", why: "AED 1M or more, buying within 6 months, funds in place, ready to go ahead" },
  qualified: { label: "Qualified", bg: "#dbeafe", text: "#1e40af", why: "AED 500K or more, buying within a year, not only exploring" },
  nurture: { label: "Nurture", bg: "#fef3c7", text: "#92400e", why: "Interested, but the budget, timing or funds aren't there yet" },
  info: { label: "Information", bg: "#f3f4f6", text: "#4b5563", why: "Only exploring for now" },
}

export const GRADE_OPTIONS = opts([["priority", "Priority"], ["qualified", "Qualified"], ["nurture", "Nurture"], ["info", "Information"]])

/**
 * A buyer's grade from their answers, so the agent knows who to call first.
 * Plain rules, not a model: Priority = AED 1M+, buying within 6 months, funds
 * in place (cash, a payment plan, or a mortgage pre-approved or in progress)
 * and ready to go ahead; Qualified = AED 500K+, within a year, not only
 * exploring; Information = only exploring; anything else Nurture. Readiness
 * was added later, so a brief without it is graded on the rest.
 */
export function leadGrade(lead: { budget: string | null; profile?: BriefProfile | null }): LeadGrade {
  const p = lead.profile ?? {}
  const s = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "")
  const budget = BUDGET_FLOOR[lead.budget ?? ""] ?? 0
  const t = s("buy_timeline")
  const r = s("readiness")
  const pay = s("payment")
  const ms = s("mortgage_status")
  const soon = t === "asap" || t === "1_3m" || t === "3_6m"
  const withinYear = soon || t === "6_12m"
  const keen = !r || r === "reserve" || r === "serious"
  const funds = pay === "cash" || pay === "payment_plan" || (pay === "mortgage" && (ms === "approved" || ms === "in_progress"))
  if (r === "exploring" || (t === "exploring" && r === "info")) return "info"
  if (budget >= 1_000_000 && soon && keen && funds) return "priority"
  if (budget >= 500_000 && withinYear && r !== "exploring") return "qualified"
  return "nurture"
}

// ─── The seller's brief (/s/<code>) ──────────────────────────────────────────

/**
 * Every choice question on the seller's brief. Property type, bedrooms and
 * areas reuse the buyer's option keys, so both sides of the agent's page read
 * the same words.
 */
export const SELLER_QUESTIONS = {
  relation: {
    label: "Are you the owner?",
    short: "Owner",
    multi: false,
    options: opts([["owner", "Yes, I'm the owner"], ["co_owner", "I co-own it"], ["representative", "I'm acting for the owner"]]),
  },
  residence: { ...BUYER_QUESTIONS.residence },
  property_type: {
    label: "What type of property is it?",
    short: "Property type",
    multi: false,
    options: BUYER_QUESTIONS.property_types.options,
  },
  area: {
    label: "Where is it?",
    short: "Area",
    multi: false,
    options: BUYER_QUESTIONS.areas.options.filter((o) => o.value !== "open"),
  },
  bedrooms: {
    label: "Bedrooms",
    short: "Bedrooms",
    multi: false,
    options: BUYER_QUESTIONS.bedrooms.options,
  },
  bathrooms: {
    label: "Bathrooms",
    short: "Bathrooms",
    multi: false,
    options: opts([["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5_plus", "5+"]]),
  },
  furnishing: {
    label: "Is it furnished?",
    short: "Furnishing",
    multi: false,
    options: opts([["furnished", "Furnished"], ["partly", "Partly furnished"], ["unfurnished", "Unfurnished"]]),
  },
  features: {
    label: "Highlights",
    short: "Highlights",
    multi: true,
    options: opts([
      ["sea_view", "Sea view"],
      ["upgraded", "Upgraded"],
      ["private_pool", "Private pool"],
      ["garden", "Garden"],
      ["balcony", "Balcony"],
      ["high_floor", "High floor"],
      ["corner", "Corner unit"],
      ["maid_room", "Maid's room"],
      ["parking", "Parking"],
    ]),
  },
  completion: {
    label: "Is it ready or off-plan?",
    short: "Status",
    multi: false,
    options: opts([["ready", "Ready"], ["off_plan", "Off-plan"]]),
  },
  paid_percent: {
    label: "How much of the price have you paid?",
    short: "Paid so far",
    multi: false,
    options: opts([["under_30", "Under 30%"], ["30_50", "30–50%"], ["50_80", "50–80%"], ["80_plus", "80% or more"]]),
  },
  handover: {
    label: "Expected handover",
    short: "Handover",
    multi: false,
    options: opts([["within_1y", "Within a year"], ["1_2y", "In 1–2 years"], ["2y_plus", "In more than 2 years"], ["not_sure", "Not sure"]]),
  },
  occupancy: {
    label: "Who lives there now?",
    short: "Occupancy",
    multi: false,
    options: opts([["vacant", "It's vacant"], ["owner", "I live in it"], ["tenanted", "It's rented out"]]),
  },
  tenancy_ends: {
    label: "When does the tenancy end?",
    short: "Tenancy ends",
    multi: false,
    options: opts([["under_3m", "Within 3 months"], ["3_6m", "In 3–6 months"], ["6_12m", "In 6–12 months"], ["12m_plus", "In more than a year"]]),
  },
  valuation: {
    label: "Would you like a valuation?",
    short: "Valuation",
    multi: false,
    options: opts([["yes", "Yes, please"], ["no", "No, I have a price in mind"]]),
  },
  mortgage: {
    label: "Is there a mortgage on it?",
    short: "Mortgage",
    multi: false,
    options: opts([["no", "No"], ["yes", "Yes"]]),
  },
  title_deed: {
    label: "Do you have the title deed or Oqood?",
    short: "Title deed",
    multi: false,
    options: opts([["yes", "Yes"], ["in_process", "In process"], ["not_sure", "Not sure"]]),
  },
  sell_timeline: {
    label: "When do you want to sell?",
    short: "Wants to sell",
    multi: false,
    options: opts([["asap", "As soon as possible"], ["1_3m", "In 1–3 months"], ["3_6m", "In 3–6 months"], ["exploring", "Just checking the price"]]),
  },
  reason: {
    label: "Why are you selling?",
    short: "Reason",
    multi: false,
    options: opts([["upgrading", "Upgrading"], ["relocating", "Relocating"], ["investment", "Taking profit on an investment"], ["other", "Something else"]]),
  },
  listed: {
    label: "Is it listed with other agents?",
    short: "Listed elsewhere",
    multi: false,
    options: opts([["no", "No"], ["yes", "Yes"]]),
  },
  also_rent: {
    label: "Would you consider renting it out instead?",
    short: "Would rent",
    multi: false,
    options: opts([["yes", "Yes"], ["maybe", "Maybe"], ["no", "No"]]),
  },
} satisfies Record<string, Question>

export type SellerQuestionKey = keyof typeof SELLER_QUESTIONS

/** The seller's answers: option keys, plus short free text and two numbers. */
export type SellerProfile = Partial<Record<SellerQuestionKey, string | string[]>> & {
  nationality?: string
  area_other?: string
  building?: string
  /** Digits only. */
  size_sqft?: string
  /** AED, digits only. */
  asking_price?: string
}

/** The seller's four steps, in order, with the choice questions each one asks. */
export const SELLER_STEPS: { id: "details" | "property" | "status" | "plans"; title: string; keys: SellerQuestionKey[] }[] = [
  { id: "details", title: "Your details", keys: ["relation", "residence"] },
  { id: "property", title: "The property", keys: ["property_type", "area", "bedrooms", "bathrooms", "furnishing", "features"] },
  { id: "status", title: "Status & price", keys: ["completion", "paid_percent", "handover", "occupancy", "tenancy_ends", "valuation", "mortgage", "title_deed"] },
  { id: "plans", title: "Your plans", keys: ["sell_timeline", "reason", "listed", "also_rent"] },
]

/** Choice questions a seller must answer. The area is required too: a pick or typed in. */
export const SELLER_REQUIRED: SellerQuestionKey[] = ["property_type", "completion", "sell_timeline"]

export function parseSellerProfile(raw: unknown): SellerProfile {
  const out = parseAnswers(
    SELLER_QUESTIONS,
    {
      nationality: { max: 60 },
      area_other: { max: 80 },
      building: { max: 120 },
      size_sqft: { max: 7, digits: true },
      asking_price: { max: 11, digits: true },
    },
    raw,
  ) as SellerProfile
  // Questions that only apply to one status: off-plan payments and handover,
  // or who lives in a ready home and until when.
  if (out.completion !== "off_plan") {
    delete out.paid_percent
    delete out.handover
  }
  if (out.completion !== "ready") delete out.occupancy
  if (out.occupancy !== "tenanted") delete out.tenancy_ends
  // Land has no rooms or furniture; a commercial unit has no bedrooms.
  if (out.property_type === "plot") {
    delete out.bedrooms
    delete out.bathrooms
    delete out.furnishing
  }
  if (out.property_type === "commercial") delete out.bedrooms
  return out
}

/** Which of the seller's conditional questions apply to these answers (the form and the parser agree). */
export function sellerAsks(p: SellerProfile) {
  return {
    bedrooms: p.property_type !== "plot" && p.property_type !== "commercial",
    bathrooms: p.property_type !== "plot",
    furnishing: p.property_type !== "plot",
    paid_percent: p.completion === "off_plan",
    handover: p.completion === "off_plan",
    occupancy: p.completion === "ready",
    tenancy_ends: p.completion === "ready" && p.occupancy === "tenanted",
  }
}

export function sellerAnswerLabel(key: SellerQuestionKey, value: string | string[] | undefined): string | null {
  return labelFor(SELLER_QUESTIONS[key], value)
}

/** "AED 2,500,000" from stored digits. */
export const formatAed = (digits: string | undefined): string | null =>
  digits && /^\d+$/.test(digits) ? `AED ${Number(digits).toLocaleString("en-US")}` : null
/** "1,250 sq ft" from stored digits. */
export const formatSqft = (digits: string | undefined): string | null =>
  digits && /^\d+$/.test(digits) ? `${Number(digits).toLocaleString("en-US")} sq ft` : null

/** Link codes: 8 characters from an alphabet with no look-alikes (0/o, 1/l/i). The link's internal id. */
export const BUYER_LINK_CODE_RE = /^[23456789abcdefghjkmnpqrstuvwxyz]{8}$/
/** A link's readable address (migration 063), e.g. "juliecor-repompo". */
export const BRIEF_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** The public pages, by the link's readable address. */
export const buyerLinkPath = (slug: string) => `/buy-with/${slug}`
export const sellerLinkPath = (slug: string) => `/sell-with/${slug}`

export type BuyerLink = {
  id: string
  agent_id: string
  code: string
  /** The readable address, minted once from the agent's name (migration 063). */
  slug: string | null
  is_active: boolean
  created_at: string
}

export type BuyerLead = {
  id: string
  link_id: string
  agent_id: string
  name: string
  whatsapp_code: string
  whatsapp: string
  email: string | null
  budget: string | null
  contact_time: string | null
  message: string | null
  /** Which form sent it (migration 062). */
  kind: BriefKind
  /** A buyer's or a seller's answers, per `kind`. */
  profile: BriefProfile
  created_at: string
}

export const BUYER_LINK_COLUMNS = "id, agent_id, code, slug, is_active, created_at"
export const BUYER_LEAD_COLUMNS =
  "id, link_id, agent_id, name, whatsapp_code, whatsapp, email, budget, contact_time, message, kind, profile, created_at"

/**
 * The international digits wa.me and tel: need: "+971" + "050 123 4567" →
 * "971501234567". A number typed with its own "+" code is used as written; a
 * national one drops its trunk 0 behind the country code.
 */
export function waDigits(code: string | null | undefined, number: string | null | undefined): string {
  const n = (number ?? "").trim()
  if (!n) return ""
  if (n.startsWith("+")) return n.replace(/\D/g, "")
  return `${(code ?? "").replace(/\D/g, "")}${n.replace(/\D/g, "").replace(/^0+/, "")}`
}
