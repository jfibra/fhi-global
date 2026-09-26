import { cache } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, CalendarDays, MapPin, MessageCircle, Phone, Receipt, Wallet } from "lucide-react"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { canUseBuyerLinks } from "@/lib/app-roles"
import { titleCaseName } from "@/lib/public-profile"
import { BUYER_LINK_CODE_RE, waDigits } from "@/lib/buyer-links"
import { formatPrice, handoverLabel, parsePaymentPlan, priceFromValue, statusLabel } from "@/lib/project-seo"
import { BuyerLeadForm } from "./buyer-lead-form"

// A Buyers Link (migration 060): the projects an agent picked for a client,
// with a form that sends the client's details to that agent. Private — never
// indexed — and always fresh, so a paused link stops at once.

export const dynamic = "force-dynamic"

type ProjectRow = {
  id: number
  name: string
  slug: string | null
  main_image: string | null
  status: string | null
  community: string | null
  location: string | null
  city: string | null
  launch_price_from: number | null
  launch_price_to: number | null
  currency: string | null
  delivery_quarter: string | null
  expected_completion_date: string | null
  delivery_date: string | null
  down_payment_percentage: number | null
  payment_plan_details: string | null
  developers: { name: string; slug: string | null } | null
  project_images: { url: string; rank: number | null }[] | null
  project_units: { price_from: number | null }[] | null
}

const PROJECT_SELECT = `
  id, name, slug, main_image, status, community, location, city,
  launch_price_from, launch_price_to, currency, delivery_quarter, expected_completion_date, delivery_date,
  down_payment_percentage, payment_plan_details,
  developers ( name, slug ),
  project_images ( url, rank ),
  project_units ( price_from )
`

type AgentRow = {
  id: string
  fullname: string | null
  profile_url: string | null
  role: string | null
  status: string | null
  is_deleted: boolean | null
  metadata: Record<string, unknown> | null
}

// Service role with explicit columns: the anon key can't read links or
// profiles, and the page needs only the link, the agent's public face and the
// published projects on it.
const load = cache(async (code: string) => {
  if (!BUYER_LINK_CODE_RE.test(code)) return null
  const admin = createAdminSupabase()
  const { data: link } = await admin
    .from("buyer_links")
    .select("id, agent_id, code, title, note, project_ids, is_active")
    .eq("code", code)
    .maybeSingle<{ id: string; agent_id: string; code: string; title: string; note: string | null; project_ids: number[]; is_active: boolean }>()
  if (!link) return null
  const { data: agent } = await admin
    .from("profiles")
    .select("id, fullname, profile_url, role, status, is_deleted, metadata")
    .eq("id", link.agent_id)
    .maybeSingle<AgentRow>()
  // A link dies with its owner's access.
  if (!agent || agent.is_deleted || agent.status !== "active" || !canUseBuyerLinks(agent.role)) return null

  let projects: ProjectRow[] = []
  if (link.is_active && link.project_ids.length > 0) {
    const { data } = await admin
      .from("projects")
      .select(PROJECT_SELECT)
      .in("id", link.project_ids)
      .eq("is_active", true)
      .eq("is_published", true)
      .is("deleted_at", null)
    const byId = new Map(((data ?? []) as unknown as ProjectRow[]).map((p) => [p.id, p]))
    projects = link.project_ids.map((id) => byId.get(id)).filter((p): p is ProjectRow => !!p)
  }
  return { link, agent, projects }
})

type Props = { params: Promise<{ code: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params
  const data = await load(code)
  if (!data) return { title: "Link not found", robots: { index: false, follow: false } }
  const agentName = titleCaseName(data.agent.fullname ?? "") || "your FHI Global advisor"
  const description = `Projects selected for you by ${agentName}.`
  const image = data.projects[0]?.main_image
  // The WhatsApp preview the client sees when the agent sends the link.
  return {
    title: data.link.title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title: data.link.title, description, ...(image ? { images: [{ url: image }] } : {}) },
  }
}

/** The agent's WhatsApp and phone from their profile (metadata keys set on Profile Settings). */
function agentContact(meta: Record<string, unknown> | null) {
  const s = (k: string) => (typeof meta?.[k] === "string" ? (meta[k] as string).trim() : "")
  const phone = waDigits(s("phone_country_code") || "+971", s("phone_number"))
  const whatsapp = waDigits(s("whatsapp_country_code") || s("phone_country_code") || "+971", s("whatsapp_number")) || phone
  return { whatsapp, phone }
}

export default async function BuyerLinkPage({ params }: Props) {
  const { code } = await params
  const data = await load(code)
  if (!data) notFound()
  const { link, agent, projects } = data

  const agentName = titleCaseName(agent.fullname ?? "") || "Your FHI Global Advisor"
  const firstName = agentName.split(" ")[0]
  const { whatsapp, phone } = agentContact(agent.metadata)
  const initials = agentName.split(" ").map((w) => w.charAt(0)).slice(0, 2).join("").toUpperCase()

  return (
    <div className="bg-[#f5f6f8] min-h-screen">
      {/* ── Masthead: the selection and the agent behind it ── */}
      <section className="bg-[#001f3f] border-b-[3px] border-[#d6b357]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-12">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#d6b357]">Selected for you</p>
          <h1 className="mt-3 font-['Outfit'] text-3xl md:text-[40px] font-bold leading-tight tracking-tight text-white">
            {link.title}
          </h1>
          {link.note && (
            <p className="mt-4 max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-white/80">&ldquo;{link.note}&rdquo;</p>
          )}
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
            <span className="flex items-center gap-3">
              {agent.profile_url ? (
                <Image
                  src={agent.profile_url}
                  alt={agentName}
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-full border-2 border-[#d6b357] object-cover"
                />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#d6b357] bg-[#0b2a4d] font-bold text-[#d6b357]">
                  {initials}
                </span>
              )}
              <span>
                <span className="block font-bold text-white">{agentName}</span>
                <span className="block text-sm text-white/60">Property Advisor · FHI Global</span>
              </span>
            </span>
            <span className="flex flex-wrap gap-2">
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#25d366] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1fb857]"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp {firstName}
                </a>
              )}
              {phone && (
                <a
                  href={`tel:+${phone}`}
                  className="inline-flex items-center gap-2 border border-white/25 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  <Phone className="h-4 w-4" /> Call
                </a>
              )}
            </span>
          </div>
        </div>
      </section>

      {!link.is_active ? (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="font-['Outfit'] text-2xl font-bold text-[#0d1117]">This selection is no longer available</p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#6b7280]">
            {firstName} has closed this page. Send them a message for the latest options.
          </p>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto grid grid-cols-1 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <div className="min-w-0 space-y-8">
            {projects.length === 0 && (
              <p className="border border-[#e8eaed] bg-white p-6 text-[15px] text-[#6b7280]">
                These projects are no longer listed. Send {firstName} a message for the latest options.
              </p>
            )}
            {projects.map((p) => (
              <ProjectBlock key={p.id} p={p} />
            ))}
          </div>
          <aside id="details" className="scroll-mt-24 lg:sticky lg:top-24">
            <BuyerLeadForm
              code={link.code}
              agentFirstName={firstName}
              agentWhatsapp={whatsapp || null}
              projects={projects.map((p) => ({ id: p.id, name: p.name }))}
            />
          </aside>
        </div>
      )}
    </div>
  )
}

function ProjectBlock({ p }: { p: ProjectRow }) {
  const gallery = [...(p.project_images ?? [])].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)).map((i) => i.url)
  const images = [...new Set([p.main_image, ...gallery].filter((u): u is string => !!u))].slice(0, 5)
  // Same price, handover and plan reading as the project page, so the two never disagree.
  const seo = {
    name: p.name,
    status: p.status,
    launch_price_from: p.launch_price_from,
    launch_price_to: p.launch_price_to,
    currency: p.currency,
    delivery_quarter: p.delivery_quarter,
    expected_completion_date: p.expected_completion_date,
    delivery_date: p.delivery_date,
    // Only the unit prices matter here (the floor price can't undercut them).
    units: (p.project_units ?? []).map((u) => ({ unit_type: null, bedrooms: null, size_sqft: null, price_from: u.price_from })),
  }
  const price = formatPrice(priceFromValue(seo), null, p.currency)
  const handover = handoverLabel(seo)
  const plan = parsePaymentPlan(p.payment_plan_details, p.down_payment_percentage)
  const planText =
    plan.milestones.length >= 2
      ? plan.milestones.map((m) => `${m.percent}% ${m.label}`).join(" · ")
      : plan.milestones[0]
        ? `${plan.milestones[0].percent}% down payment`
        : plan.note && plan.note.length <= 90
          ? plan.note
          : null
  const area = p.community || p.location || p.city
  const href = p.developers?.slug && p.slug ? `/${p.developers.slug}/${p.slug}` : null

  return (
    <article className="overflow-hidden border border-[#e8eaed] bg-white">
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-1 bg-[#e9edf2]">
          <div className="relative col-span-4 aspect-[16/9]">
            <Image src={images[0]} alt={p.name} fill sizes="(min-width: 1024px) 700px, 100vw" className="object-cover" />
          </div>
          {images.slice(1).map((src, i) => (
            <div key={src} className="relative aspect-[4/3]">
              <Image src={src} alt={`${p.name} — photo ${i + 2}`} fill sizes="(min-width: 1024px) 175px, 25vw" className="object-cover" />
            </div>
          ))}
        </div>
      )}
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          {p.status && (
            <span className="bg-[#001f3f] px-2.5 py-1 font-bold uppercase tracking-wider text-white">{statusLabel(p.status)}</span>
          )}
          {p.developers?.name && <span className="font-semibold text-[#b8913f]">{p.developers.name}</span>}
        </div>
        <h2 className="mt-2 font-['Outfit'] text-2xl font-bold leading-snug text-[#0d1117]">{p.name}</h2>
        {area && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-[#6b7280]">
            <MapPin className="h-4 w-4 text-[#b8913f]" /> {area}
          </p>
        )}
        {(price || handover || planText) && (
          <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {price && <Fact icon={<Wallet className="h-4 w-4" />} label="Starting from" value={price} />}
            {handover && <Fact icon={<CalendarDays className="h-4 w-4" />} label="Handover" value={handover} />}
            {planText && <Fact icon={<Receipt className="h-4 w-4" />} label="Payment plan" value={planText} />}
          </dl>
        )}
        {href && (
          <Link
            href={href}
            target="_blank"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-[#001f3f] transition-colors hover:text-[#b8913f]"
          >
            View full project details <ArrowUpRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </article>
  )
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border border-[#eef0f3] bg-[#fafbfc] px-3.5 py-3">
      <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a6d2a]">
        {icon} {label}
      </dt>
      <dd className="mt-1 text-[15px] font-bold text-[#0d1117]">{value}</dd>
    </div>
  )
}
