import { COMPANY, companyAddressLine, companyLicenceLine } from "@/lib/company"
import { HOME_FAQS } from "@/lib/faqs"
import { SITE_URL } from "@/lib/seo"

/**
 * The website chat's ready answers (boss via Juliecor, 2026-11-12): the
 * questions visitors ask about the WEBSITE and the COMPANY — how to register,
 * how to sign in, how to reach the office, who FHI is, what we charge, how to
 * sell a home through us, how to join an event — plus greetings and thanks.
 *
 * None of these need the model: the facts never change between two
 * questions and live in lib/company.ts already. app/api/site-chat answers
 * them from here BEFORE the spend gate and the model (free, instant, and
 * still answered when the chat is over its daily cap), and logs them with
 * tools = ["faq"] so the admin page shows what visitors ask. The same entries
 * reach the model through the site_pages tool (lib/site-chat.ts) for the
 * phrasings the matcher misses, so the answer is the same either way.
 *
 * Pure data, no server imports: the chat panel reads `chip` for its "Quick
 * answers" row, so this file must stay importable from the browser.
 *
 * Matching: the visitor's last message, lowercased, must match one of
 * `patterns` and none of `unless`. First entry wins, so the order matters —
 * the event one sits before the account one ("register for the roadshow"
 * is not "create an account"). Keep the patterns about the WEBSITE: a
 * question that names a project, an area or a developer belongs to the model.
 */

export type SiteChatFaq = {
  id: string
  /** The chip in the panel's "Quick answers" row; null = reachable by asking only. */
  chip: string | null
  /** Plain text, like the model's answers: "- " lines become a list, addresses become links. */
  answer: string
  patterns: RegExp[]
  unless?: RegExp[]
  /** Topic words the site_pages tool scores, so the model finds the entry too ("" = never offered to the model). */
  words: string
}

const base = SITE_URL.replace(/\/$/, "")
const consultantLine = `Or tap "Talk to a consultant" under this chat and a consultant will message you on WhatsApp.`

const whatWeCharge = HOME_FAQS.find((f) => /charge buyers/i.test(f.question))?.answer ?? "Nothing — our commission is paid by the developer, not by you. Consultations, shortlists and project comparisons cost you nothing."

/** A question that names a project, a developer or a unit is the model's, whatever else it says. */
const PROPERTY_TALK = /\b(emaar|damac|azizi|sobha|samana|binghatti|danube|nakheel|meraas|ellington|project|projects|developer|developers|tower|unit|units)\b/

export const SITE_CHAT_FAQS: SiteChatFaq[] = [
  {
    id: "greeting",
    chip: null,
    patterns: [/^(hi|hii+|hello|hey|heya|hiya|yo|hola|salam|salaam|assalamu? ?alaikum|kumusta|kamusta|good (morning|afternoon|evening|day)|greetings)( there| fhi| fhi assistant| everyone)?$/],
    answer: `Hi! I'm FHI Assistant. Ask me about any project in Dubai — prices, payment plans, handover — or tell me what you're looking for, for example:
- Cheapest 1-bedroom in JVC
- Villas under AED 3M
- Projects handing over in 2027
- Apartments for rent in Dubai Marina
You can also tap "Talk to a consultant" below and a real person will message you on WhatsApp.`,
    words: "",
  },
  {
    id: "thanks",
    chip: null,
    patterns: [/^(thanks?|thank you|thank u|thx|ty|tysm|thanks? (so much|a lot|you)|thank you (so much|very much)|ok thanks?|bye|goodbye|see you|salamat|shukran|maraming salamat)( very much| so much| a lot)?$/],
    answer: `You're welcome! Anything else I can look up for you — a project, an area or a budget? ${consultantLine}`,
    words: "",
  },
  {
    id: "ack",
    chip: null,
    patterns: [/^(ok|okay|k|great|perfect|nice|cool|got it|noted|i see|alright|sure|yes|yeah|yep|no|nope)$/],
    answer: `Anything else I can look up for you — a project, an area or a budget? ${consultantLine}`,
    words: "",
  },
  {
    id: "event_register",
    chip: null,
    patterns: [
      /\b(register|registration|sign ?up|join|attend|book|ticket|seat|rsvp|reserve)\b.*\b(event|roadshow|seminar|webinar|expo|exhibition|open house)\b/,
      /\b(event|roadshow|seminar|webinar|expo|exhibition|open house)s?\b.*\b(register|registration|sign ?up|join|attend|book|ticket|seat|rsvp|reserve|free)\b/,
    ],
    answer: `Every event has its own page with a registration form: open ${base}/events and choose the event, then tap Register — your seat is confirmed by email. Our events are free to attend unless the event page says otherwise. Ask me "any upcoming events?" and I'll list what's coming up.`,
    words: "event events roadshow seminar webinar register attend seat ticket",
  },
  {
    id: "register",
    chip: "How do I register?",
    patterns: [
      /\b(register|registration|sign ?up|signup|create (an |my |a new )?account|open (an |a new )?account|make (an |a new )?account|new account|(become|be) (an? |your )?(agent|partner|member|broker|affiliate)|join (fhi|the team|your team|as an? (agent|partner|member|broker)|you as)|how (to|do i|can i) join|apply (as|to be|for) (an? )?(agent|partner|member|broker|job)|careers?|vacanc|hiring|recruit)/,
    ],
    unless: [/\b(registered|event|roadshow|seminar|webinar|expo|exhibition|newsletter|dld|land department|title deed|oqood|ejari|trakheesi|rera|brn|broker licen|interest in|my interest|escrow|company)\b/, PROPERTY_TALK],
    answer: `You don't need an account to browse projects, ask me questions or talk to a consultant — all of that is open to everyone.
An account is for agents, partners and developers who work with FHI Global:
- Go to ${base}/register and enter your email, then type the 6-digit code we send you — or continue with Google.
- If someone from FHI Global invited you, open their invite link instead, so you join their team.
- An administrator approves every new account before the first sign-in; once approved, sign in at ${base}/staff-login.
Developers who want their projects on fhiglobal.ae: email ${COMPANY.email} or WhatsApp ${COMPANY.phone} and the team will set up your developer access.`,
    words: "register registration sign up signup create account join agent partner member careers work with fhi",
  },
  {
    id: "login",
    chip: "How do I sign in?",
    patterns: [
      /\b(log ?in|log ?on|sign ?in|signin|my account|my dashboard|the dashboard|forgot (my )?password|reset (my )?password|change (my )?password|password|can'?t (log|sign|get) in|cannot (log|sign|get) in|unable to (log|sign|get) in|locked out)\b/,
      /\b(account|registration) (is |be |was |not |still |yet |been )*(approved|approval|pending|inactive|not active|activated|active|blocked)\b|\b(waiting for|awaiting) (approval|activation)\b|\bapprove my (account|registration)\b|\bwhen will (i|my account) be (approved|activated|active)\b/,
    ],
    unless: [/\b(event|roadshow|seminar|webinar)\b/, PROPERTY_TALK],
    answer: `Agents and staff sign in at ${base}/staff-login with their email and password. Developer partners sign in at ${base}/developers-login with the username and password FHI Global gave them.
A new account works only after an administrator has approved it — if yours is still pending, the team is on it.
Forgot your password or can't get in? Email ${COMPANY.email} or WhatsApp ${COMPANY.phone} and the team will reset it for you.`,
    words: "login log in sign in password forgot reset dashboard account pending approved",
  },
  {
    id: "contact",
    chip: "Contact & office hours",
    patterns: [
      /\b(contact (you|us|fhi|number|details|info|information)|how (to|do i|can i) (contact|reach|call|email|find|visit) (you|fhi|the office|your office)|your (phone|number|whatsapp|email|address|office|location|hours)|phone number|whatsapp number|email address|office (address|hours|location|time|timing)|opening (hours|time)|working (hours|days|time)|business hours|where (are you|is (your|the) office|can i find you)|visit (you|the office|your office)|(talk|speak|chat) (to|with) (a |an )?(consultant|human|person|real person|someone|somebody)|call (you|me|back)|customer (service|support|care)|hotline)\b/,
    ],
    unless: [
      /\b(which|best|recommend|top|list of|your|an?|the) agents?\b/,
      /\bagents? (who|that|in|for|near|speaks)\b/,
      /\b(speaks|tagalog|filipino|arabic|russian|hindi|urdu|chinese|mandarin|french|german|language)\b/,
      /\b(of|for|named?|called) [a-z][a-z' .-]*$/,
    ],
    answer: `Here's how to reach FHI Global:
- WhatsApp or call: ${COMPANY.phone}
- Email: ${COMPANY.email}
- Office: ${companyAddressLine()}
- Hours: ${COMPANY.hours.label}
Or tap "Talk to a consultant" under this chat, leave your name and WhatsApp number, and a consultant will message you — usually within the hour in office time. More at ${base}/contact.`,
    words: "contact phone whatsapp email office address location hours visit call consultant support",
  },
  {
    id: "about",
    chip: "Who is FHI Global?",
    patterns: [
      /\b(who (are|is) (you|fhi|fhi global|this company|your company)|about (fhi|you|your company|the company|this (company|website|site))|what is fhi|what does fhi (do|global do)|tell me about (fhi|you|yourself|your company)|(is|are) (fhi|fhi global|you|this (site|website|company)) (legit|legitimate|real|licensed|registered|trusted|trustworthy|safe|a scam|genuine|reliable)|rera (number|licen[cs]e|registered)|\born\b|trade licen[cs]e|your licen[cs]e|licensed broker|scam|legit)\b/,
    ],
    unless: [PROPERTY_TALK],
    answer: `${COMPANY.name} (${COMPANY.legalName}) is a real estate brokerage in Dubai${companyLicenceLine() ? ` — ${companyLicenceLine()}` : ""} — helping buyers, investors and tenants from around the world find off-plan and ready property across Dubai and the UAE, working directly with the developers.
- Office: ${companyAddressLine()}
- Phone and WhatsApp: ${COMPANY.phone}
Read more at ${base}/about and meet the team at ${base}/agents.`,
    words: "about fhi global who are you company legit licensed rera orn licence trust",
  },
  {
    id: "fees",
    chip: "Do you charge buyers?",
    patterns: [
      /\b((do|does|will|would) (you|fhi|fhi global) charge|(your|fhi'?s?|fhi global'?s?) (fee|fees|commission|charges)|is (this|it|the service|fhi|the chat|your service) free|free (to use|of charge|service|consultation)|(have|need) to pay (you|fhi|anything|a fee)|pay (a |any )?(fee|commission) to (you|fhi)|charge (buyers|me|anything|a fee|commission)|what do you charge|how much do you charge)\b/,
    ],
    unless: [/\b(dld|land department|transfer fee|registration fee|service charges? (in|of|for|at)|mortgage|trustee|noc|oqood|ejari|maintenance)\b/, PROPERTY_TALK],
    answer: `${whatWeCharge}
The one-off government costs of a purchase (the 4% DLD transfer fee and the small registration fees) are the same whoever you buy through — our buying-costs guide walks through them: ${base}/dubai-property-buying-costs.`,
    words: "charge fees commission free buyer cost of using fhi",
  },
  {
    id: "sell",
    chip: "Sell or rent out my property",
    patterns: [
      /\b(sell my|selling my|rent out my|renting out my|lease (out )?my|list my|listing my|market my|advertise my|put my (\w+ )?(up )?for (sale|rent)|my (apartment|villa|property|unit|flat|house|townhouse|penthouse|studio) (for|up for|is for) (sale|rent)|i (own|have) (a|an|one|two|2) (apartment|villa|property|unit|flat|house|townhouse|penthouse|studio)|landlord|property owner|valuation of my|value (of )?my (apartment|villa|property|unit|flat|house)|how much is my)\b/,
    ],
    unless: [/\b(buy|buying|looking for|want to (buy|rent|invest)|budget|interested in|price of|how much is (a|an|the))\b/, PROPERTY_TALK],
    answer: `Yes — FHI Global's agents market resale homes and rentals on fhiglobal.ae (the Buy and Rent pages) and to our buyer network.
Tap "Talk to a consultant" under this chat and leave your details, or WhatsApp ${COMPANY.phone} with the community, the building, the number of bedrooms and the price you have in mind, and an agent will come back to you about listing it.`,
    words: "sell my property rent out landlord owner list my apartment villa valuation",
  },
  {
    id: "privacy",
    chip: null,
    patterns: [/\b(privacy|personal data|my data|my (details|information) (safe|secure|shared|sold)|gdpr|share my (details|number|information|email)|sell my (details|number|data)|spam me|data protection)\b/],
    answer: `Your details are used only so an FHI Global consultant can get back to you about property — we never sell or share them with anyone else. The full privacy policy is at ${base}/privacy.`,
    words: "privacy personal data details safe shared policy",
  },
]

/** Lowercase, straight quotes, one space, no trailing punctuation — what the patterns are written against. */
export function normalizeSiteChatQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\s?!.,:;]+$/, "")
}

/**
 * The ready answer for a visitor's message, or null when the model should
 * answer. Only short, direct questions qualify: a long message is usually a
 * real question with a FAQ word in it ("I registered my interest in Azizi
 * Venice last week, what's the payment plan?").
 */
export function matchSiteChatFaq(question: string): SiteChatFaq | null {
  const q = normalizeSiteChatQuestion(question)
  if (!q || q.length > 160) return null
  for (const faq of SITE_CHAT_FAQS) {
    if (!faq.patterns.some((p) => p.test(q))) continue
    if (faq.unless?.some((p) => p.test(q))) continue
    return faq
  }
  return null
}

/** The chips the panel offers under the welcome, in file order. */
export const SITE_CHAT_FAQ_CHIPS: string[] = SITE_CHAT_FAQS.flatMap((f) => (f.chip ? [f.chip] : []))
