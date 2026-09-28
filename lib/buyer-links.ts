// Buyers Link (migrations 060, 061): every agent has ONE permanent link
// (/b/<code>). A client who opens it answers a four-step brief (details,
// buying profile, preferences, financials) that lands on that agent's Buyers
// Link page. Shared by the dashboard page, the public /b/<code> page and the
// API routes, so the question list, its validation and its labels have one
// definition. Nothing here is server-only.

export type Choice = { value: string; label: string }
const opts = (pairs: [string, string][]): Choice[] => pairs.map(([value, label]) => ({ value, label }))

export const BUDGET_OPTIONS = opts([
  ["under_1m", "Under AED 1M"],
  ["1m_2m", "AED 1M – 2M"],
  ["2m_5m", "AED 2M – 5M"],
  ["5m_10m", "AED 5M – 10M"],
  ["10m_plus", "AED 10M+"],
])

export const CONTACT_TIME_OPTIONS = opts([
  ["morning", "Morning"],
  ["afternoon", "Afternoon"],
  ["evening", "Evening"],
])

export const budgetLabel = (value: string | null | undefined): string | null =>
  BUDGET_OPTIONS.find((o) => o.value === value)?.label ?? null
export const contactTimeLabel = (value: string | null | undefined): string | null =>
  CONTACT_TIME_OPTIONS.find((o) => o.value === value)?.label ?? null

/** `label` is asked on the client's page; `short` heads the answer on the agent's side. */
type Question = { label: string; short: string; multi: boolean; options: Choice[] }

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
    options: opts([["uae", "In the UAE"], ["abroad", "Outside the UAE"]]),
  },
  buying_for: {
    label: "Who are you buying for?",
    short: "Buying for",
    multi: false,
    options: opts([["myself", "Myself"], ["family", "My family"], ["investment", "As an investment"], ["company", "A company"]]),
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
} satisfies Record<string, Question>

export type QuestionKey = keyof typeof BUYER_QUESTIONS

/** The brief's answers: option keys, plus two short free-text fields. */
export type BuyerProfile = Partial<Record<QuestionKey, string | string[]>> & {
  nationality?: string
  areas_other?: string
}

/** The four steps, in order, with the choice questions each one asks. */
export const BUYER_STEPS: { id: "details" | "profile" | "preferences" | "financials"; title: string; keys: QuestionKey[] }[] = [
  { id: "details", title: "Your details", keys: ["residence"] },
  { id: "profile", title: "Buying profile", keys: ["buying_for", "buying_with", "buy_timeline", "move_in"] },
  { id: "preferences", title: "Preferences", keys: ["property_types", "bedrooms", "completion", "areas", "must_haves"] },
  { id: "financials", title: "Financials", keys: ["payment", "mortgage_status", "down_payment", "golden_visa"] },
]

/** Choice questions the client must answer (budget is required too). */
export const REQUIRED_QUESTIONS: QuestionKey[] = ["buying_for", "buy_timeline", "payment"]

/**
 * Keep only known keys and known option values; cap the free text. Used by
 * the API on every submission, so stored briefs are always clean.
 */
export function parseProfile(raw: unknown): BuyerProfile {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const out: BuyerProfile = {}
  for (const [key, q] of Object.entries(BUYER_QUESTIONS) as [QuestionKey, Question][]) {
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
  const text = (k: "nationality" | "areas_other", max: number) => {
    const v = input[k]
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, max)
  }
  text("nationality", 60)
  text("areas_other", 200)
  // A pre-approval only means something for a mortgage buyer.
  if (out.payment !== "mortgage") delete out.mortgage_status
  return out
}

/** "Apartment, Villa" for a stored answer, or null when unanswered. */
export function answerLabel(key: QuestionKey, value: string | string[] | undefined): string | null {
  if (value == null || (Array.isArray(value) && value.length === 0)) return null
  const options = BUYER_QUESTIONS[key].options
  const one = (v: string) => options.find((o) => o.value === v)?.label ?? v
  return Array.isArray(value) ? value.map(one).join(", ") : one(value)
}

/** Link codes: 8 characters from an alphabet with no look-alikes (0/o, 1/l/i). */
export const BUYER_LINK_CODE_RE = /^[23456789abcdefghjkmnpqrstuvwxyz]{8}$/

export const buyerLinkPath = (code: string) => `/b/${code}`

export type BuyerLink = {
  id: string
  agent_id: string
  code: string
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
  profile: BuyerProfile
  created_at: string
}

export const BUYER_LINK_COLUMNS = "id, agent_id, code, is_active, created_at"
export const BUYER_LEAD_COLUMNS =
  "id, link_id, agent_id, name, whatsapp_code, whatsapp, email, budget, contact_time, message, profile, created_at"

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
