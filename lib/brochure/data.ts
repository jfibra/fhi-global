import "server-only"

import type { createAdminSupabase } from "@/lib/admin-supabase"
import { SITE_URL } from "@/lib/seo"
import { COMPANY, companyLicenceParts } from "@/lib/company"
import { formatPrice, fullArea, handoverLabel, isOffPlan, parsePaymentPlan, priceFromValue, priceToValue, statusLabel, unitsSummary, type ProjectSeoInput } from "@/lib/project-seo"
import { profileContact, sharpPhoto } from "@/lib/public-agents"
import { titleCaseName } from "@/lib/public-profile"
import { isTestRecord } from "@/lib/listing-publish-checks"

/**
 * The project brochure an agent sends a client (boss via Juliecor, 2026-11-06):
 * "make me a brochure for Azizi Ruby" in the agent FHI Assistant → a one-page
 * PDF with the project's photo, from price, units and prices, payment plan,
 * amenities and what's nearby, and the AGENT'S OWN contact block with a QR
 * code to the project on their website (or their WhatsApp). This file gathers
 * the facts; lib/brochure/pdf.tsx draws them; app/api/fhi-chat/brochure serves
 * the file.
 *
 * Every project fact follows the public pages' rules (lib/project-seo.ts): the
 * from-price never undercuts the cheapest listed unit, the payment plan is read
 * into milestones only when it really is a schedule, and an unpublished or
 * test-named project is a 404 here as it is on the site.
 */

type Admin = ReturnType<typeof createAdminSupabase>

const base = () => SITE_URL.replace(/\/$/, "")

const PROJECT_SELECT =
  "*, developers(name, slug, is_verified), project_property_types(property_types(name)), project_units(unit_type, layout_name, bedrooms, bathrooms, size_sqft, size_sqm, price_from, price_to, available_units), project_amenities(amenities(name)), project_neighbors(category, description), project_points(category, description), project_features(description)"

type UnitRow = { unit_type: string | null; layout_name?: string | null; bedrooms: number | null; bathrooms?: number | null; size_sqft: number | string | null; size_sqm?: number | string | null; price_from: number | string | null; price_to: number | string | null; available_units?: number | null }
type Row = Record<string, unknown> & {
  id: number
  name: string
  slug: string
  status: string | null
  developers: { name: string; slug: string | null; is_verified: boolean | null } | { name: string; slug: string | null; is_verified: boolean | null }[] | null
  project_property_types: { property_types: { name: string } | null }[] | null
  project_units: UnitRow[] | null
  project_amenities: { amenities: { name: string } | null }[] | null
  project_neighbors: { category: string | null; description: string }[] | null
  project_points: { category: string | null; description: string }[] | null
  project_features: { description: string }[] | null
}

const oneRel = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)
const numOf = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}
const str = (row: Record<string, unknown>, key: string): string | null => (typeof row[key] === "string" && (row[key] as string).trim() ? (row[key] as string).trim() : null)
const clean = (text: string) => text.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim()

/** Studio = 0; otherwise the stored count, else the number in "2 Bedroom". */
function unitBeds(u: UnitRow): number | null {
  if (typeof u.bedrooms === "number") return u.bedrooms
  const t = (u.unit_type ?? "").toLowerCase()
  if (/studio/.test(t)) return 0
  const m = /(\d+)\s*(?:br|bed)/.exec(t)
  return m ? Number(m[1]) : null
}

function seoInputOf(p: Row): ProjectSeoInput {
  const dev = oneRel(p.developers)
  return {
    name: p.name,
    status: p.status,
    community: str(p, "community"),
    location: str(p, "location"),
    city: str(p, "city"),
    launch_price_from: numOf(p.launch_price_from),
    launch_price_to: numOf(p.launch_price_to),
    currency: str(p, "currency"),
    delivery_quarter: str(p, "delivery_quarter"),
    expected_completion_date: str(p, "expected_completion_date"),
    delivery_date: str(p, "delivery_date"),
    total_units: numOf(p.total_units),
    down_payment_percentage: numOf(p.down_payment_percentage),
    payment_plan_details: str(p, "payment_plan_details"),
    installment_available: typeof p.installment_available === "boolean" ? p.installment_available : null,
    developer: dev ? { name: dev.name } : null,
    propertyTypes: (p.project_property_types ?? []).map((t) => t.property_types?.name).filter((n): n is string => Boolean(n)),
    units: (p.project_units ?? []).map((u) => ({ unit_type: u.unit_type, bedrooms: u.bedrooms, size_sqft: u.size_sqft, price_from: u.price_from })),
  }
}

export type BrochureUnit = { type: string; beds: string; size: string | null; price: string | null; priceValue: number | null; available: number | null }

export type Brochure = {
  project: {
    id: number
    name: string
    slug: string
    developer: string | null
    developerVerified: boolean
    area: string | null
    status: string
    offPlan: boolean
    handover: string | null
    priceFrom: string | null
    priceRange: string | null
    mix: string | null
    sizes: string | null
    propertyTypes: string[]
    image: string | null
    page: string
    description: string | null
    permit: string | null
    totalUnits: number | null
    freehold: boolean | null
    ownership: string | null
  }
  units: BrochureUnit[]
  plan: { milestones: Array<{ percent: number; label: string }>; fees: Array<{ percent: number; label: string }>; note: string | null; downPayment: number | null }
  amenities: string[]
  nearby: string[]
  highlights: string[]
  agent: { name: string; role: string; photo: string | null; whatsapp: string | null; whatsappDigits: string | null; phone: string | null; email: string | null; website: string | null; shareUrl: string | null }
  /** What the QR code opens, and the caption under it. */
  qr: { url: string; caption: string }
  company: { name: string; legalName: string; phone: string; email: string; licence: string; site: string }
  generatedOn: string
}

const ROLE_WORDS: Record<string, string> = { team_leader: "Team Leader", unit_manager: "Unit Manager", global_partner: "Global Partner", secretary: "Secretary", team_secretary: "Team Secretary" }

/** A published, non-test project by id, or null. */
async function loadProject(admin: Admin, id: number): Promise<Row | null> {
  const { data, error } = await admin.from("projects").select(PROJECT_SELECT).eq("id", id).is("deleted_at", null).eq("is_active", true).eq("is_published", true).maybeSingle()
  if (error) throw new Error(error.message)
  const row = (data ?? null) as Row | null
  if (!row || isTestRecord({ projectName: row.name })) return null
  return row
}

/** The agent's own contact block: the same details their business card and the Agents page print. */
async function loadAgent(admin: Admin, userId: string, email: string | null) {
  const [{ data: p }, { data: site }, authUser] = await Promise.all([
    admin.from("profiles").select("id, fullname, fname, lname, role, profile_url, metadata").eq("id", userId).maybeSingle(),
    admin.from("website_builder").select("slug").eq("agent_id", userId).eq("is_published", true).not("slug", "is", null).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    email ? Promise.resolve(null) : admin.auth.admin.getUserById(userId).catch(() => null),
  ])
  const meta = ((p?.metadata ?? null) as Record<string, unknown> | null) ?? null
  const raw = ((p?.fullname as string | null) ?? [p?.fname, p?.lname].filter(Boolean).join(" ") ?? "").trim()
  const photo = typeof p?.profile_url === "string" && p.profile_url.trim() ? sharpPhoto(p.profile_url.trim()) : null
  const whatsapp = profileContact(meta, "whatsapp")
  const slug = typeof site?.slug === "string" ? site.slug : null
  return {
    name: titleCaseName(raw) || "FHI Global consultant",
    role: ROLE_WORDS[String(p?.role ?? "")] ?? "Property Advisor",
    photo,
    whatsapp,
    whatsappDigits: whatsapp ? whatsapp.replace(/\D/g, "") || null : null,
    phone: profileContact(meta, "phone"),
    email: email ?? authUser?.data?.user?.email ?? null,
    websiteSlug: slug,
  }
}

export async function loadBrochure(admin: Admin, projectId: number, who: { userId: string; email: string | null }): Promise<Brochure | null> {
  const [p, agent] = await Promise.all([loadProject(admin, projectId), loadAgent(admin, who.userId, who.email)])
  if (!p) return null
  const seo = seoInputOf(p)
  const dev = oneRel(p.developers)
  const plan = parsePaymentPlan(str(p, "payment_plan_details"), numOf(p.down_payment_percentage))
  const mix = unitsSummary(seo)
  const from = priceFromValue(seo)
  const to = priceToValue(seo)
  const currency = str(p, "currency")

  const units: BrochureUnit[] = (p.project_units ?? [])
    .map((u) => {
      const beds = unitBeds(u)
      const price = numOf(u.price_from)
      const priceTo = numOf(u.price_to)
      const sqft = numOf(u.size_sqft)
      return {
        type: (u.layout_name?.trim() || u.unit_type?.trim() || (beds === 0 ? "Studio" : beds != null ? `${beds}-bedroom` : "Unit")).slice(0, 40),
        beds: beds === 0 ? "Studio" : beds != null ? `${beds} BR` : "—",
        size: sqft ? `${Math.round(sqft).toLocaleString("en-AE")} sq ft` : null,
        // Prices under AED 50K are data slips on the public pages too.
        price: price != null && price >= 50_000 ? formatPrice(price, priceTo != null && priceTo > price ? priceTo : null, currency) : null,
        priceValue: price != null && price >= 50_000 ? price : null,
        available: typeof u.available_units === "number" ? u.available_units : null,
      }
    })
    .sort((a, b) => (a.priceValue ?? Infinity) - (b.priceValue ?? Infinity))
    .slice(0, 9)

  const page = dev?.slug ? `${base()}/${dev.slug}/${p.slug}` : `${base()}/projects`
  const shareUrl = agent.websiteSlug ? `${base()}/website/${agent.websiteSlug}/projects/${p.slug}` : null
  const whatsappUrl = agent.whatsappDigits ? `https://wa.me/${agent.whatsappDigits}?text=${encodeURIComponent(`Hi ${agent.name.split(" ")[0]}, I'm interested in ${p.name}.`)}` : null
  const qr = shareUrl
    ? { url: shareUrl, caption: "Scan for this project on my website" }
    : whatsappUrl
      ? { url: whatsappUrl, caption: "Scan to message me on WhatsApp" }
      : { url: page, caption: "Scan for the project page" }

  const description = clean(str(p, "description") ?? str(p, "about_project") ?? "")
  const cut = description.length > 420 ? `${description.slice(0, 420).replace(/\s+\S*$/, "")}…` : description

  return {
    project: {
      id: Number(p.id),
      name: p.name,
      slug: p.slug,
      developer: dev?.name ?? null,
      developerVerified: Boolean(dev?.is_verified),
      area: fullArea(seo),
      status: statusLabel(p.status),
      offPlan: isOffPlan(p.status),
      handover: handoverLabel(seo),
      priceFrom: from != null ? formatPrice(from, null, currency) : null,
      priceRange: from != null ? formatPrice(from, to != null && to > from ? to : null, currency) : null,
      mix: mix.mix,
      sizes: mix.sizes,
      propertyTypes: seo.propertyTypes ?? [],
      image: str(p, "main_image"),
      page,
      description: cut || null,
      permit: str(p, "trakheesi_permit_number"),
      totalUnits: numOf(p.total_units),
      freehold: typeof p.freehold === "boolean" ? p.freehold : null,
      ownership: str(p, "ownership_type"),
    },
    units,
    plan: { milestones: plan.milestones, fees: plan.fees, note: plan.note, downPayment: numOf(p.down_payment_percentage) },
    amenities: [...new Set((p.project_amenities ?? []).map((a) => a.amenities?.name?.trim()).filter((n): n is string => Boolean(n)))].slice(0, 12),
    nearby: (p.project_neighbors ?? []).map((n) => clean(n.description)).filter(Boolean).slice(0, 5),
    highlights: [...(p.project_points ?? []).map((n) => clean(n.description)), ...(p.project_features ?? []).map((n) => clean(n.description))].filter(Boolean).slice(0, 5),
    agent: {
      name: agent.name,
      role: agent.role,
      photo: agent.photo,
      whatsapp: agent.whatsapp,
      whatsappDigits: agent.whatsappDigits,
      phone: agent.phone,
      email: agent.email,
      website: agent.websiteSlug ? `${base()}/website/${agent.websiteSlug}` : null,
      shareUrl,
    },
    qr,
    company: { name: COMPANY.name, legalName: COMPANY.legalName, phone: COMPANY.phone, email: COMPANY.email, licence: companyLicenceParts().join(" · "), site: base().replace(/^https?:\/\//, "") },
    generatedOn: new Date().toLocaleDateString("en-AE", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dubai" }),
  }
}

/** The chat tool's lookup: a published, non-test project by (partial) name — exact name first, else the shortest match. */
export async function findBrochureProject(admin: Admin, name: string): Promise<{ id: number; name: string; developer: string | null; image: string | null; page: string; others: string[] } | null> {
  const q = name.trim().replace(/[%_]/g, "")
  if (!q) return null
  const { data, error } = await admin
    .from("projects")
    .select("id, name, slug, main_image, developers(name, slug)")
    .is("deleted_at", null)
    .eq("is_active", true)
    .eq("is_published", true)
    .ilike("name", `%${q}%`)
    .limit(6)
  if (error) throw new Error(error.message)
  const rows = ((data ?? []) as Array<{ id: number; name: string; slug: string; main_image: string | null; developers: { name: string; slug: string | null } | { name: string; slug: string | null }[] | null }>).filter((r) => !isTestRecord({ projectName: r.name }))
  if (!rows.length) return null
  const exact = rows.find((r) => r.name.toLowerCase() === q.toLowerCase())
  const pick = exact ?? [...rows].sort((a, b) => a.name.length - b.name.length)[0]
  const dev = oneRel(pick.developers)
  return {
    id: Number(pick.id),
    name: pick.name,
    developer: dev?.name ?? null,
    image: pick.main_image,
    page: dev?.slug ? `${base()}/${dev.slug}/${pick.slug}` : `${base()}/projects`,
    others: rows.filter((r) => r.id !== pick.id).map((r) => r.name),
  }
}
