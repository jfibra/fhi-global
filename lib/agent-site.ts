import { SAMPLE_DATA, type WebsiteData } from "@/app/website/_data"
import { titleCaseName } from "@/lib/public-profile"
import { truncateDescription, truncateTitle } from "@/lib/seo"

/**
 * What a public agent site (/website/<slug>) may claim about the agent's RERA
 * registration.
 *
 * The Website Builder keeps BRN / ORN / brokerage as free text with no
 * validation, and the template's sample values ("BRN: 123456", "ORN: 98765",
 * "Filipino Homes Inc. Dubai") leaked onto live sites two ways: sites created
 * before the editor started blank were seeded from the sample and saved it
 * verbatim, and loadSite spread the saved contact over the sample, so any
 * missing key inherited it. Every site wears a "RERA Licensed Broker" badge,
 * so a made-up registration number there is a compliance problem, not a
 * cosmetic one. A credential is therefore shown only when it looks like a real
 * registration, and is blanked everywhere else. Pure — safe in the editor.
 */

type AgentFields = WebsiteData["agent"]

const SAMPLE = SAMPLE_DATA.agent

/** The agent block with nothing in it — the base a saved site is merged over (never the sample). */
export const BLANK_AGENT: AgentFields = {
  name: "",
  title: "",
  brn: "",
  orn: "",
  brokerage: "",
  phone: "",
  whatsapp: "",
  email: "",
  office: "",
}

const clean = (value: unknown): string => (typeof value === "string" ? value.trim() : "")

// The sequences people type when they have no number yet. An explicit list, not "any run of consecutive
// digits": that rule also hid real registrations such as 2345 or 45678.
const PLACEHOLDER_SEQUENCES = new Set([
  "0123", "01234", "012345", "0123456",
  "1234", "12345", "123456", "1234567",
  "9876", "98765", "987654", "9876543",
  "4321", "54321", "654321", "7654321",
])

/** "0000", "11111", "123456", "4321": one repeated digit or a typed-in sequence is a placeholder, not a registration. */
function isPlaceholderDigits(v: string): boolean {
  return /^(\d)\1+$/.test(v) || PLACEHOLDER_SEQUENCES.has(v)
}

/** A RERA BRN is the 4–7 digit number on the broker card, and never the template's sample. */
export function isPlausibleBrn(value: unknown): boolean {
  const v = clean(value)
  return /^\d{4,7}$/.test(v) && v !== SAMPLE.brn && !isPlaceholderDigits(v)
}

/** A RERA ORN is the 2–6 digit office registration number, and never the template's sample. */
export function isPlausibleOrn(value: unknown): boolean {
  const v = clean(value)
  return /^\d{2,6}$/.test(v) && v !== SAMPLE.orn && !isPlaceholderDigits(v)
}

/** A brokerage name is real text of its own: not digits, not a stray letter, not the template's sample brokerage. */
export function isPlausibleBrokerage(value: unknown): boolean {
  const v = clean(value)
  return (
    v.length >= 3 &&
    !/^\d+$/.test(v) &&
    !/^[\s\-–—_.]+$/.test(v) &&
    !/^(n\/?a|none|nil|null|test|sample|tbd|tba)$/i.test(v) &&
    v.toLowerCase() !== SAMPLE.brokerage.toLowerCase()
  )
}

const digitsOf = (v: unknown) => clean(v).replace(/\D/g, "")

/**
 * The agent with every credential that fails the checks blanked — what loadSite hands to the pages and the
 * editor — and the template's own contact details blanked where a sample-seeded site stored them: the sample
 * e-mail and phone otherwise survive as live "Email" and "Call" channels that reach nobody.
 */
export function sanitizeAgentCredentials<T extends AgentFields>(agent: T): T {
  return {
    ...agent,
    brn: isPlausibleBrn(agent.brn) ? clean(agent.brn) : "",
    orn: isPlausibleOrn(agent.orn) ? clean(agent.orn) : "",
    brokerage: isPlausibleBrokerage(agent.brokerage) ? clean(agent.brokerage) : "",
    email: clean(agent.email).toLowerCase() === SAMPLE.email.toLowerCase() ? "" : clean(agent.email),
    phone: digitsOf(agent.phone) && digitsOf(agent.phone) === digitsOf(SAMPLE.phone) ? "" : clean(agent.phone),
    whatsapp: digitsOf(agent.whatsapp) && digitsOf(agent.whatsapp) === digitsOf(SAMPLE.whatsapp) ? "" : clean(agent.whatsapp),
  }
}

export type AgentCredential = { kind: "brn" | "brokerage" | "orn"; label: string; value: string }

/**
 * The credential tiles for the About section — only those that passed. The
 * "RERA Licensed Broker" tile exists only with a valid BRN, so the badge never
 * stands without a number behind it.
 */
export function agentCredentials(agent: Pick<AgentFields, "brn" | "orn" | "brokerage">): AgentCredential[] {
  const rows: AgentCredential[] = []
  if (isPlausibleBrn(agent.brn)) rows.push({ kind: "brn", label: "RERA Licensed Broker", value: `BRN: ${clean(agent.brn)}` })
  if (isPlausibleBrokerage(agent.brokerage)) rows.push({ kind: "brokerage", label: "Brokerage", value: clean(agent.brokerage) })
  if (isPlausibleOrn(agent.orn)) rows.push({ kind: "orn", label: "Office Registration", value: `ORN: ${clean(agent.orn)}` })
  return rows
}

// ─── Listing an agent's site in search ───────────────────────────────────────
//
// A site is offered to search engines (robots index, a sitemap entry) only when
// it is actually the agent's. Sites created before the editor started blank were
// seeded from the template and saved it as it stood, so a site can be "complete"
// by word count while its bio, portrait and headline are all the sample's. The
// checks therefore compare against the template's own copy, not just its length.

const norm = (v: unknown) => clean(v).toLowerCase().replace(/\s+/g, " ")
const SAMPLE_BIO_HEAD = norm(SAMPLE_DATA.about.bio).slice(0, 80)
const SAMPLE_HERO_DESCRIPTION = norm(SAMPLE_DATA.hero.description)

/** The template's sample bio (or something that starts the same way). */
export function isSampleBio(bio: unknown): boolean {
  const n = norm(bio)
  // includes(), not startsWith(): one sentence typed in front of the template paragraph must not pass the gate.
  return n !== "" && n.includes(SAMPLE_BIO_HEAD)
}

export function isSamplePortrait(src: unknown): boolean {
  return clean(src) === SAMPLE_DATA.about.portrait
}

/** The template's banner photo (the same man in a suit as the sample portrait). */
export function isSampleBanner(src: unknown): boolean {
  return clean(src).endsWith("/background/sample-hero.png")
}

/** What a public site shows as its banner when the agent has none: a bright, people-free Dubai skyline — never the sample's stranger. */
export const PUBLIC_BANNER_FALLBACK = "/background/dubai.webp"

/** The hero and about blocks with nothing in them — the base a saved site is merged over (never the sample). */
export const BLANK_HERO: WebsiteData["hero"] = {
  headline: "",
  headlineAccent: "",
  description: "",
  image: "",
  overlay: 0,
  stats: [],
}
export const BLANK_ABOUT: WebsiteData["about"] = {
  heading: "",
  bio: "",
  portrait: "",
  views: "",
  listings: "",
  rating: "",
  socials: { facebook: "", instagram: "", linkedin: "", youtube: "" },
}

const MIN_BIO_WORDS = 60

/** What the three signals a listing decision rests on look like for one site. */
export type AgentSiteSignals = { name: string; bio: string; portrait: string }

/**
 * What a site still needs before it is listed in search, in the agent's words
 * (the editor prints this). Empty = complete. Raw stored values only — the same
 * three fields the sitemap shard reads — so the page's robots tag and the
 * sitemap can never disagree.
 */
export function agentSiteMissing(s: AgentSiteSignals): string[] {
  const missing: string[] = []
  const name = clean(s.name)
  if (!name || name.toLowerCase() === SAMPLE_DATA.agent.name.toLowerCase()) missing.push("your name")
  const bio = clean(s.bio)
  if (isSampleBio(bio) || bio.split(/\s+/).filter(Boolean).length < MIN_BIO_WORDS) {
    missing.push(`a bio of at least ${MIN_BIO_WORDS} words, in your own words`)
  }
  const portrait = clean(s.portrait)
  if (!portrait || isSamplePortrait(portrait)) missing.push("your portrait photo")
  return missing
}

export const isAgentSiteComplete = (s: AgentSiteSignals): boolean => agentSiteMissing(s).length === 0

/**
 * The three signals from a `website_builder` row selected as
 * `contact, about:about_id(bio, photo)` (PostgREST hands the embed back as an object
 * or a one-element array). Every list that must agree with a site's own robots tag —
 * the sitemap shard, the /agents roster's Person links — reads its rows through this.
 */
export function agentSiteSignalsFromRow(row: { contact?: unknown; about?: unknown }): AgentSiteSignals {
  const contact = (row.contact ?? {}) as { name?: unknown }
  const about = (Array.isArray(row.about) ? row.about[0] : row.about) as { bio?: unknown; photo?: unknown } | null | undefined
  return {
    name: typeof contact.name === "string" ? contact.name : "",
    bio: typeof about?.bio === "string" ? about.bio : "",
    portrait: typeof about?.photo === "string" ? about.photo : "",
  }
}

/** "CARLOS & MICHELLE  GUINTO" → "Carlos & Michelle Guinto". */
export function agentDisplayName(name: unknown): string {
  return titleCaseName(clean(name))
}

/** A couple or team name ("Carlos & Michelle Guinto") is not one person: no Person markup for it. */
export const isSinglePersonName = (name: unknown): boolean => {
  const n = clean(name)
  return n !== "" && !n.includes("&") && !/\s(and|\+)\s/i.test(n)
}

const TITLE_MAX = 47 // the layout appends " | FHI Global" (13 chars) and Google shows ~60

/**
 * "Name — role" fitted to the title budget. The role is the agent's own
 * professional title; without one, "Real Estate Agent" is claimed only when a
 * plausible BRN stands behind it (most site owners are international endorsers,
 * not licensed brokers), else a neutral "Dubai Property Advisor".
 */
export function agentSiteTitle(agent: { name: string; title: string; brn: string }): string {
  const name = agentDisplayName(agent.name)
  if (!name) return "Agent website"
  // Agents type their own role, often with a full stop ("Property Investment Advisor.") — not wanted in a title.
  const role = clean(agent.title).replace(/[\s.,;:–—-]+$/, "") || (isPlausibleBrn(agent.brn) ? "Real Estate Agent in Dubai" : "Dubai Property Advisor")
  const full = `${name} — ${role}`
  if (full.length <= TITLE_MAX) return full
  const short = `${name} — Dubai Property`
  return short.length <= TITLE_MAX ? short : truncateTitle(name, TITLE_MAX)
}

/** The meta description: the agent's own hero line, else their bio — never the template's sample sentences. */
export function agentSiteDescription(
  agent: { name: string },
  hero: { description: string },
  about: { bio: string },
): string {
  const heroLine = clean(hero.description)
  if (heroLine && norm(heroLine) !== SAMPLE_HERO_DESCRIPTION) return truncateDescription(heroLine)
  const bio = clean(about.bio)
  if (bio && !isSampleBio(bio)) return truncateDescription(bio)
  const name = agentDisplayName(agent.name)
  return `${name || "An FHI Global agent"} — off-plan and ready properties in Dubai, with FHI Global.`
}

/**
 * Hero/band stats with the template's invented numbers removed. Sites that
 * saved the sample kept "150+ Properties Sold", "AED 500M+ Sales Volume" and
 * "TOP 5% Agent in FHI Global" — fabricated claims about a real person. When
 * two or more of a site's stats are the template's own (same value and label),
 * the set is untouched sample and none of it is shown.
 */
export function dropSampleStats<T extends { value: string; label: string }>(stats: T[]): T[] {
  const key = (s: { value: string; label: string }) => `${norm(s.value)}|${norm(s.label)}`
  const sample = new Set([...SAMPLE_DATA.hero.stats, ...SAMPLE_DATA.bandStats].map(key))
  return stats.filter((s) => sample.has(key(s))).length >= 2 ? [] : stats
}
