import { cache } from "react"
import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound, permanentRedirect } from "next/navigation"
import { ArrowLeft, BadgeCheck, BedDouble, Building2, CalendarClock, Globe, MapPin, Maximize2, Phone } from "lucide-react"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { loadSiteBySlug } from "@/lib/website-builder-service"
import { loadAgentWebsiteEvents } from "@/lib/events/website-events"
import { loadAgentWebsiteReviews } from "@/lib/website-reviews"
import { SITE_URL } from "@/lib/seo"
import { formatPrice, isHandoverOverdue, parsePaymentPlan, priceFromValue, projectSubtitle, type ProjectSeoInput } from "@/lib/project-seo"
import { agentProjectPath, loadShareContact, shareCopy, withDialableNumbers } from "@/lib/website-project-share"
import { ProjectGallery } from "@/components/public/project-gallery"
import { ReadMore } from "@/components/public/read-more"
import { InView } from "@/components/public/in-view"
import { GOLD, GOLD_TINT, NAVY, themeVars } from "../../../_data"
import { SiteHeader } from "../../../_components/header"
import { SiteFooter } from "../../../_components/footer"
import { ShareProject } from "../../../_components/share-project"
import { WhatsAppIcon } from "../../../_components/ui"

// A project as shared from an agent's website: the project inside the agent's
// site (their header, footer and theme) with the agent as the only contact —
// so a Facebook or WhatsApp share brings the lead to that agent. Its link
// preview (opengraph-image.tsx beside this file) carries the agent's name and
// number. Not indexed: every agent has a copy of every project, and the main
// project page is the one for search; social crawlers ignore noindex.

export const dynamic = "force-dynamic"

const STATUS: Record<string, string> = {
  pre_launch: "Pre-launch",
  launch: "Launching now",
  under_construction: "Under construction",
  completed: "Ready to move in",
}

type Row = {
  id: number
  name: string
  slug: string
  status: string | null
  description: string | null
  about_project: string | null
  main_image: string | null
  city: string | null
  location: string | null
  community: string | null
  launch_price_from: number | string | null
  launch_price_to: number | string | null
  currency: string | null
  delivery_quarter: string | null
  expected_completion_date: string | null
  delivery_date: string | null
  down_payment_percentage: number | string | null
  payment_plan_details: string | null
  installment_available: boolean | null
  freehold: boolean | null
  ownership_type: string | null
  total_units: number | null
  floors: number | null
  number_of_buildings: number | null
  developers: { name: string; slug: string | null; logo_url: string | null; logo_bg: string | null; is_verified: boolean | null } | null
  project_images: { id: number; url: string; is_main: boolean | null; rank: number | null }[] | null
  project_units: { unit_type: string | null; bedrooms: number | null; bathrooms: number | null; size_sqft: number | null; price_from: number | null }[] | null
  project_property_types: { property_types: { name: string } | null }[] | null
  project_amenities: { amenities: { name: string } | null }[] | null
}

const getSite = cache((slug: string) => loadSiteBySlug(createAdminSupabase(), slug))

/** A live, published project, by slug. The same rows the main project page serves. */
const getProject = cache(async (slug: string): Promise<Row | null> => {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null
  const { data, error } = await createPublicSupabaseClient()
    .from("projects")
    .select(
      `id, name, slug, status, description, about_project, main_image, city, location, community,
       launch_price_from, launch_price_to, currency, delivery_quarter, expected_completion_date, delivery_date,
       down_payment_percentage, payment_plan_details, installment_available, freehold, ownership_type,
       total_units, floors, number_of_buildings,
       developers ( name, slug, logo_url, logo_bg, is_verified ),
       project_images ( id, url, is_main, rank ),
       project_units ( unit_type, bedrooms, bathrooms, size_sqft, price_from ),
       project_property_types ( property_types ( name ) ),
       project_amenities ( amenities ( name ) )`,
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .is("deleted_at", null)
    .maybeSingle()
  // A transient failure must be a 5xx, never a "not found" on a shared link.
  if (error) throw new Error("Failed to load project")
  return (data as unknown as Row | null) ?? null
})

const getContact = cache(async (slug: string) => {
  const site = await getSite(slug)
  if (!site) return null
  return loadShareContact(createAdminSupabase(), site.agentId, site.data.agent, site.data.about.portrait)
})

/** Everything the page and its metadata say about the project, computed once. */
function facts(p: Row) {
  const propertyTypes = (p.project_property_types ?? []).map((t) => t.property_types?.name).filter((n): n is string => Boolean(n))
  const units = p.project_units ?? []
  const seo: ProjectSeoInput = {
    name: p.name,
    status: p.status,
    community: p.community,
    location: p.location,
    city: p.city,
    launch_price_from: p.launch_price_from,
    launch_price_to: p.launch_price_to,
    currency: p.currency,
    delivery_quarter: p.delivery_quarter,
    expected_completion_date: p.expected_completion_date,
    delivery_date: p.delivery_date,
    total_units: p.total_units,
    floors: p.floors,
    number_of_buildings: p.number_of_buildings,
    down_payment_percentage: p.down_payment_percentage,
    payment_plan_details: p.payment_plan_details,
    installment_available: p.installment_available,
    freehold: p.freehold,
    ownership_type: p.ownership_type,
    developer: p.developers ? { name: p.developers.name } : null,
    propertyTypes,
    units,
  }
  const from = formatPrice(priceFromValue(seo), null, p.currency)
  const area = [p.community, p.location].map((v) => v?.trim()).find(Boolean) ?? null
  const city = p.city?.trim() || null
  const where = area ? (city && !area.toLowerCase().includes(city.toLowerCase()) ? `${area}, ${city}` : area) : city
  // A quarter that has already ended on a project still being built is not announced as upcoming.
  const handover = isHandoverOverdue(seo)
    ? null
    : p.delivery_quarter?.trim() || (p.expected_completion_date ? String(p.expected_completion_date).slice(0, 4) : null)
  const bedsOf = (u: (typeof units)[number]) => (u.bedrooms != null ? u.bedrooms : /studio/i.test(u.unit_type ?? "") ? 0 : null)
  const beds = [...new Set(units.map(bedsOf).filter((b): b is number => b != null))].sort((a, b) => a - b)
  const bedLabel = (b: number) => (b === 0 ? "Studio" : `${b} BR`)
  const bedRange = beds.length ? (beds.length === 1 ? bedLabel(beds[0]) : `${bedLabel(beds[0])} – ${bedLabel(beds[beds.length - 1])}`) : null
  const sizes = units.map((u) => u.size_sqft).filter((s): s is number => s != null && s > 0)
  const sizeRange = sizes.length
    ? Math.min(...sizes) === Math.max(...sizes)
      ? `${Math.round(Math.min(...sizes)).toLocaleString("en-US")} sq ft`
      : `${Math.round(Math.min(...sizes)).toLocaleString("en-US")} – ${Math.round(Math.max(...sizes)).toLocaleString("en-US")} sq ft`
    : null
  // A units table only earns its place with sizes or prices; bare types are
  // already the bedroom range above. Columns with nothing in them are dropped.
  const hasSize = units.some((u) => u.size_sqft != null && u.size_sqft > 0)
  const hasPrice = units.some((u) => u.price_from != null && Number(u.price_from) > 0)
  const shownUnits = hasSize || hasPrice ? units.filter((u) => u.unit_type || u.bedrooms != null || u.size_sqft != null || u.price_from != null) : []
  const images = (p.project_images ?? [])
    .slice()
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .map((img) => ({ id: img.id, image_url: img.url, caption: null, rank: img.rank }))
  if (!images.length && p.main_image) images.push({ id: -1, image_url: p.main_image, caption: null, rank: 0 })
  const amenities = (p.project_amenities ?? []).map((a) => a.amenities?.name).filter((n): n is string => Boolean(n)).slice(0, 12)
  return {
    from,
    where,
    handover,
    bedRange,
    sizeRange,
    propertyTypes,
    shownUnits,
    hasSize,
    hasPrice,
    bedsOf,
    images,
    amenities,
    subtitle: projectSubtitle(seo),
    plan: parsePaymentPlan(p.payment_plan_details, p.down_payment_percentage),
    about: (p.about_project || p.description || "").trim(),
  }
}

type Props = { params: Promise<{ slug: string; project: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, project: key } = await params
  const [site, project, contact] = await Promise.all([getSite(slug), getProject(key), getContact(slug)])
  if (!site || !project || !contact) notFound()
  const f = facts(project)
  const url = `${SITE_URL.replace(/\/$/, "")}${agentProjectPath(site.slug, project.slug)}`
  const title = `${project.name}${f.from ? ` from ${f.from}` : ""} · ${contact.name}`
  const description = `${f.subtitle ?? project.name}. Contact ${contact.name}${contact.label ? ` on ${contact.label}` : ""} for prices, payment plans and viewings.`
  // og:url is this page (not the main project page), or Facebook would fetch
  // the main page's preview — which has no agent on it.
  return {
    title,
    description,
    robots: { index: false, follow: true },
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: "FHI Global" },
    twitter: { card: "summary_large_image", title, description },
  }
}

export default async function AgentProjectPage({ params }: Props) {
  const { slug, project: key } = await params
  const site = await getSite(slug)
  if (!site) notFound()
  // An address the site had before (migration 058) → its current one.
  if (site.slug !== slug) permanentRedirect(agentProjectPath(site.slug, key))
  const [project, contact, events, reviews] = await Promise.all([
    getProject(key),
    getContact(slug),
    loadAgentWebsiteEvents(createAdminSupabase(), site.agentId),
    loadAgentWebsiteReviews(createAdminSupabase(), site.agentId, 1),
  ])
  if (!project || !contact) notFound()

  // The header's Contact Me menu dials the agent's numbers with their country code.
  const data = withDialableNumbers(site.data, contact)
  const home = `/website/${site.slug}`
  const f = facts(project)
  const dev = project.developers
  const status = project.status ? STATUS[project.status] ?? null : null
  const url = `${SITE_URL.replace(/\/$/, "")}${agentProjectPath(site.slug, project.slug)}`
  const share = { url, ...shareCopy({ title: project.name, developerName: dev?.name, from: f.from, location: f.where }, contact) }
  const hello = `Hi ${contact.first}, I'm interested in ${project.name}. Can you send me the price list, payment plan and available units?`
  const wa = contact.whatsapp ? `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(hello)}` : null
  const tel = contact.phone ? `tel:+${contact.phone}` : null
  const facts3 = [
    f.from && { label: "Starting from", value: f.from },
    f.handover && { label: "Handover", value: f.handover },
    f.bedRange && { label: "Bedrooms", value: f.bedRange },
    f.sizeRange && { label: "Sizes", value: f.sizeRange },
    f.propertyTypes.length > 0 && { label: "Property types", value: f.propertyTypes.slice(0, 3).join(", ") },
    status && { label: "Status", value: status },
  ].filter(Boolean) as { label: string; value: string }[]

  const contactButtons = (big = false) => (
    <div className={`flex flex-wrap gap-2 ${big ? "" : ""}`}>
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center justify-center gap-2 bg-[#25d366] px-5 font-bold text-white transition-colors hover:bg-[#1fb857] ${big ? "h-12 text-[15px]" : "h-11 text-[14px]"}`}
        >
          <WhatsAppIcon className="h-5 w-5" /> WhatsApp {contact.first}
        </a>
      )}
      {tel && (
        <a
          href={tel}
          className={`inline-flex items-center justify-center gap-2 border px-5 font-bold transition-colors hover:bg-[var(--wb-gold)] hover:text-white ${big ? "h-12 text-[15px]" : "h-11 text-[14px]"}`}
          style={{ borderColor: GOLD, color: NAVY }}
        >
          <Phone className="h-4 w-4" /> Call
        </a>
      )}
    </div>
  )

  return (
    <div style={themeVars(data.theme)}>
      <SiteHeader data={data} showEvents={events.upcoming.length + events.past.length > 0} showReviews={reviews.length > 0} basePath={home} />

      <main className="bg-[#faf8f4] pb-24 lg:pb-0">
        <div className="mx-auto max-w-[1400px] px-5 pt-8 sm:px-8 lg:pt-10">
          <Link href={`${home}#projects`} className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#6b7280] transition-colors hover:text-[var(--wb-gold)]">
            <ArrowLeft className="h-4 w-4" /> {contact.name}&apos;s featured projects
          </Link>

          {/* Phones: name and price first, then the photos, then the facts and
              the agent. Wide screens: photos left, all of it on the right. */}
          <div className="mt-6 grid gap-7 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-10 lg:gap-y-0">
            {/* ── Photos ── */}
            <div className="order-2 min-w-0 lg:order-none lg:row-span-2">
              {f.images.length > 0 ? (
                <InView threshold={0.05} rootMargin="0px">
                  <ProjectGallery images={f.images} projectName={project.name} location={f.where} />
                </InView>
              ) : (
                <div className="flex aspect-[16/10] items-center justify-center bg-[#eef1f5] text-[#9ca3af]">
                  <Building2 className="h-10 w-10" />
                </div>
              )}
            </div>

            {/* ── The project ── */}
            <div className="order-1 min-w-0 lg:order-none">
              <div className="flex flex-wrap items-center gap-2">
                {status && (
                  <span className="inline-flex h-8 items-center bg-black/85 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white">{status}</span>
                )}
                {dev && (
                  <span className="inline-flex h-8 items-center gap-2 border border-[#e8e5dc] bg-white pl-1 pr-3 text-[12.5px] font-semibold" style={{ color: NAVY }}>
                    {dev.logo_url ? (
                      <span className="flex h-6 items-center px-1" style={{ backgroundColor: dev.logo_bg ?? "#ffffff" }}>
                        <Image src={dev.logo_url} alt="" width={64} height={20} unoptimized={dev.logo_url.toLowerCase().includes(".svg")} className="h-5 w-auto max-w-[64px] object-contain" style={{ width: "auto" }} />
                      </span>
                    ) : (
                      <Building2 className="ml-1.5 h-4 w-4" />
                    )}
                    {dev.name}
                    {dev.is_verified && <BadgeCheck className="h-4 w-4" strokeWidth={1.75} style={{ fill: GOLD, color: "#fff" }} />}
                  </span>
                )}
              </div>
              <h1 className="mt-4 font-serif text-[36px] font-bold leading-[1.08] tracking-tight sm:text-[44px]" style={{ color: NAVY }}>
                {project.name}
              </h1>
              {f.where && (
                <p className="mt-3 flex items-center gap-2 text-[15px] text-[#5b6472]">
                  <MapPin className="h-4 w-4 shrink-0" style={{ color: GOLD }} /> {f.where}
                </p>
              )}
              {f.subtitle && <p className="mt-2 text-[14px] text-[#8a919c]">{f.subtitle}</p>}
              {f.from && (
                <p className="mt-4 text-[15px] font-semibold text-[#5b6472] lg:hidden">
                  Starting from <span className="font-serif text-[24px] font-bold" style={{ color: NAVY }}>{f.from}</span>
                </p>
              )}
            </div>

            {/* ── The facts, and the agent ── */}
            <div className="order-3 min-w-0 lg:order-none">
              {facts3.length > 0 && (
                <dl className="mt-6 grid grid-cols-2 gap-px border border-[#e8e5dc] bg-[#e8e5dc]">
                  {facts3.map((x) => (
                    <div key={x.label} className="bg-white px-4 py-3">
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a919c]">{x.label}</dt>
                      <dd className="mt-1 text-[17px] font-bold leading-tight" style={{ color: NAVY }}>{x.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {/* The agent: the only contact on this page */}
              <div className="mt-6 border border-[#e8e5dc] bg-white p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: GOLD }}>Your property advisor</p>
                <div className="mt-3 flex items-center gap-4">
                  {contact.portrait ? (
                    <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2" style={{ borderColor: GOLD }}>
                      <Image src={contact.portrait} alt={contact.name} fill sizes="64px" className="object-cover object-top" />
                    </span>
                  ) : (
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full font-serif text-[22px] font-bold text-white" style={{ backgroundColor: NAVY }}>
                      {contact.first.charAt(0)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-serif text-[20px] font-bold" style={{ color: NAVY }}>{contact.name}</p>
                    {data.agent.title && <p className="truncate text-[12.5px] text-[#6b7280]">{data.agent.title}</p>}
                    {contact.label && (
                      <a href={tel ?? undefined} className="mt-0.5 inline-block text-[15px] font-bold tracking-wide" style={{ color: NAVY }}>
                        {contact.label}
                      </a>
                    )}
                  </div>
                </div>
                <div className="mt-4">{contactButtons(true)}</div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ShareProject share={share} variant="pill" placement="up" />
                  <Link
                    href={home}
                    className="inline-flex h-12 items-center gap-2 px-3 text-[13.5px] font-semibold text-[#6b7280] transition-colors hover:text-[var(--wb-gold)]"
                  >
                    <Globe className="h-4 w-4" /> {contact.first}&apos;s website
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Details ── */}
        <div className="mx-auto mt-14 max-w-[1400px] space-y-14 px-5 pb-16 sm:px-8 lg:mt-20">
          {(f.plan.milestones.length > 0 || f.plan.note) && (
            <section>
              <h2 className="font-serif text-[28px] font-bold tracking-tight" style={{ color: NAVY }}>Payment plan</h2>
              {f.plan.milestones.length > 0 ? (
                <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {f.plan.milestones.map((m, i) => (
                    <li key={`${m.label}-${i}`} className="border border-[#e8e5dc] bg-white p-5">
                      <p className="font-serif text-[34px] font-bold leading-none" style={{ color: GOLD }}>{m.percent}%</p>
                      <p className="mt-2 text-[14px] font-semibold" style={{ color: NAVY }}>{m.label}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#3d4451]">{f.plan.note}</p>
              )}
            </section>
          )}

          {f.shownUnits.length > 0 && (
            <section>
              <h2 className="font-serif text-[28px] font-bold tracking-tight" style={{ color: NAVY }}>Units</h2>
              <div className="mt-5 overflow-x-auto border border-[#e8e5dc] bg-white">
                <table className="w-full min-w-[520px] text-left text-[14px]">
                  <thead>
                    <tr className="text-[10.5px] uppercase tracking-[0.12em] text-[#8a919c]" style={{ backgroundColor: GOLD_TINT }}>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Bedrooms</th>
                      {f.hasSize && <th className="px-4 py-3 font-semibold">Size</th>}
                      {f.hasPrice && <th className="px-4 py-3 font-semibold">From</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0ede4]">
                    {f.shownUnits.map((u, i) => (
                      <tr key={i} style={{ color: NAVY }}>
                        <td className="px-4 py-3 font-semibold">{u.unit_type ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5">
                            <BedDouble className="h-4 w-4 text-[#9aa0aa]" />
                            {(() => {
                              const b = f.bedsOf(u)
                              return b == null ? "—" : b === 0 ? "Studio" : b
                            })()}
                          </span>
                        </td>
                        {f.hasSize && (
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5">
                              <Maximize2 className="h-4 w-4 text-[#9aa0aa]" />
                              {u.size_sqft ? `${Math.round(u.size_sqft).toLocaleString("en-US")} sq ft` : "—"}
                            </span>
                          </td>
                        )}
                        {f.hasPrice && <td className="px-4 py-3 font-bold">{formatPrice(u.price_from, null, project.currency) ?? "On request"}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {f.about && (
            <section className="max-w-3xl">
              <h2 className="font-serif text-[28px] font-bold tracking-tight" style={{ color: NAVY }}>About {project.name}</h2>
              <div className="mt-4">
                <ReadMore fadeFrom="from-[#faf8f4]">
                  <p className="whitespace-pre-line text-[15.5px] leading-[1.8] text-[#3d4451]">{f.about}</p>
                </ReadMore>
              </div>
            </section>
          )}

          {f.amenities.length > 0 && (
            <section>
              <h2 className="font-serif text-[28px] font-bold tracking-tight" style={{ color: NAVY }}>Amenities</h2>
              <ul className="mt-5 flex flex-wrap gap-2">
                {f.amenities.map((a) => (
                  <li key={a} className="border border-[#e8e5dc] bg-white px-3.5 py-2 text-[13.5px] font-semibold" style={{ color: NAVY }}>
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Closing: the agent again */}
          <section className="flex flex-col gap-6 border-t-2 bg-white p-7 sm:p-10 lg:flex-row lg:items-center lg:justify-between" style={{ borderColor: GOLD }}>
            <div className="max-w-xl">
              <p className="font-serif text-[28px] font-bold leading-tight tracking-tight sm:text-[32px]" style={{ color: NAVY }}>
                Interested in {project.name}?
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-[#5b6472]">
                {contact.first} can send you the latest price list, payment plan and available units
                {f.handover ? `, and walk you through handover in ${f.handover}` : ""}.
              </p>
              {f.handover && (
                <p className="mt-3 inline-flex items-center gap-2 text-[13px] font-semibold text-[#6b7280]">
                  <CalendarClock className="h-4 w-4" style={{ color: GOLD }} /> Handover {f.handover}
                </p>
              )}
            </div>
            {contactButtons(true)}
          </section>
        </div>
      </main>

      {/* Phones: the agent is one tap away while scrolling */}
      {(wa || tel) && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-[#e8e5dc] bg-white/95 p-3 backdrop-blur lg:hidden">
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 flex-1 items-center justify-center gap-2 bg-[#25d366] text-[15px] font-bold text-white">
              <WhatsAppIcon className="h-5 w-5" /> WhatsApp {contact.first}
            </a>
          )}
          {tel && (
            <a href={tel} aria-label={`Call ${contact.name}`} className="inline-flex h-12 w-14 items-center justify-center border" style={{ borderColor: GOLD, color: NAVY }}>
              <Phone className="h-5 w-5" />
            </a>
          )}
        </div>
      )}

      <SiteFooter data={data} />
    </div>
  )
}
