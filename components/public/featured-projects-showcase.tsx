import Link from "next/link"
import Image from "next/image"
import { Building2, MapPin, CalendarClock, WalletCards, ArrowRight } from "lucide-react"
import { formatProjectPrice, type ProjectCardData } from "@/components/project-card"
import { InView } from "@/components/public/in-view"

/**
 * Homepage "Featured Projects" showcase: one hero pick with room to breathe,
 * two stacked picks beside it, and any further picks in a row beneath.
 *
 * Every line on a card is a real column on the project — status, handover,
 * developer, area, launch price, payment plan — and the FHI note is a
 * hand-written column (`agent_note`), never derived from marketing copy.
 * Anything missing is omitted rather than filled with a placeholder.
 */

export type FeaturedProjectData = ProjectCardData & {
  down_payment_percentage?: number | null
  payment_plan_details?: string | null
  /** "Why we picked it" — written by the FHI team in the admin. */
  agent_note?: string | null
}

const STATUS_LABEL: Record<string, string> = {
  pre_launch: "Pre-launch",
  launch: "Launching now",
  under_construction: "Under construction",
  completed: "Ready to move in",
}

/** "Ready to move in" / "Off-plan, handover Q4 2027" / "Launching now". */
function statusPill(status: string | null | undefined, delivery: string | null | undefined): string | null {
  const handover = delivery?.trim()
  if (status === "completed") return STATUS_LABEL.completed
  if (handover) return `Off-plan, handover ${handover}`
  return status ? (STATUS_LABEL[status] ?? null) : null
}

/** Community first (the city is "Dubai" on almost every project), then location, then city. */
function areaLabel(p: FeaturedProjectData): string | null {
  const area = [p.community, p.location].map((v) => v?.trim()).find(Boolean) ?? null
  const city = p.city?.trim() || null
  if (!area) return city
  if (!city || area.toLowerCase().includes(city.toLowerCase())) return area
  return `${area}, ${city}`
}

/**
 * A payment plan is only worth printing on a card when it fits on a line
 * ("20% on booking, 50% during construction, 30% on completion"). A paragraph
 * is summarised as the fact that a plan exists; the project page has the rest.
 */
function paymentLabel(p: FeaturedProjectData): string | null {
  const plan = p.payment_plan_details?.replace(/\s+/g, " ").trim() ?? ""
  if (plan && plan.length <= 64) return plan
  if (p.down_payment_percentage != null && p.down_payment_percentage > 0) {
    return `${Number(p.down_payment_percentage)}% down payment`
  }
  return plan ? "Payment plan available" : null
}

function projectHref(p: FeaturedProjectData): string {
  return p.developers?.slug ? `/${p.developers.slug}/${p.slug}` : `/projects/${p.slug}`
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#d6b357] px-3 py-1 text-[12px] font-bold text-[#001f3f] shadow-sm">
      {children}
    </span>
  )
}

function Price({ value, currency, large }: { value: number | null | undefined; currency: string | null | undefined; large?: boolean }) {
  if (!value) {
    return <span className="text-xs font-semibold text-[#9ca3af]">Price on request</span>
  }
  return (
    <div className="text-right shrink-0">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9ca3af]">From</span>
      <span className={`block font-['Outfit'] font-bold leading-none text-[#0d1117] ${large ? "text-2xl md:text-[28px]" : "text-lg"}`}>
        {formatProjectPrice(value, currency ?? "AED")}
      </span>
    </div>
  )
}

function Facts({ p, compact }: { p: FeaturedProjectData; compact?: boolean }) {
  const area = areaLabel(p)
  const pay = paymentLabel(p)
  const handover = p.delivery_quarter?.trim()
  // A payment plan may run to a second line; the other facts stay on one.
  const rows: { icon: React.ElementType; text: string; wrap?: boolean }[] = []
  if (area) rows.push({ icon: MapPin, text: area })
  if (!compact && handover && p.status !== "completed") rows.push({ icon: CalendarClock, text: `Handover ${handover}` })
  if (pay) rows.push({ icon: WalletCards, text: pay, wrap: true })
  if (rows.length === 0) return null
  return (
    <ul className={`mt-2 space-y-1 ${compact ? "text-[13px]" : "text-sm"} text-[#6b7280]`}>
      {rows.map(({ icon: Icon, text, wrap }) => (
        <li key={text} className="flex items-start gap-2 min-w-0">
          <Icon className="mt-[3px] h-3.5 w-3.5 shrink-0 text-[#b8913f]" aria-hidden="true" />
          <span className={wrap ? "line-clamp-2" : "truncate"}>{text}</span>
        </li>
      ))}
    </ul>
  )
}

function DeveloperChip({ p }: { p: FeaturedProjectData }) {
  const d = p.developers
  if (!d) return null
  return (
    <div className="flex items-center gap-2.5 bg-white/95 backdrop-blur-sm border border-white shadow-sm px-3 py-2">
      {d.logo_url ? (
        <Image
          src={d.logo_url}
          unoptimized={d.logo_url.toLowerCase().includes(".svg")}
          alt={d.name}
          width={96}
          height={28}
          className="h-6 w-auto max-w-[86px] object-contain"
        />
      ) : (
        <Building2 className="h-4 w-4 text-[#001f3f]/60" />
      )}
      <span className="text-[12px] font-bold text-[#0d1117] truncate max-w-[140px]">{d.name}</span>
    </div>
  )
}

function HeroCard({ p }: { p: FeaturedProjectData }) {
  const pill = statusPill(p.status, p.delivery_quarter)
  const note = p.agent_note?.trim()
  return (
    <Link href={projectHref(p)} className="group block h-full" style={{ ["--d" as string]: "0ms" }}>
      <div className="fp-img relative aspect-[16/10] lg:aspect-auto lg:h-[420px] w-full overflow-hidden bg-[#e9edf2]">
        {p.main_image ? (
          <div className="fp-zoom absolute inset-0">
            <Image
              src={p.main_image}
              alt={p.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 66vw"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[#c0c8d4]">
            <Building2 className="h-14 w-14" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        {pill && <div className="fp-pop absolute left-4 top-4"><Pill>{pill}</Pill></div>}
        <div className="fp-text absolute bottom-4 left-4"><DeveloperChip p={p} /></div>
      </div>

      <div className="fp-text mt-5 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h3 className="font-['Outfit'] text-2xl md:text-[28px] font-bold leading-tight text-[#0d1117] group-hover:text-[#001f3f] transition-colors">
            {p.name}
          </h3>
          <Facts p={p} />
        </div>
        <Price value={p.launch_price_from} currency={p.currency} large />
      </div>

      {note && (
        <div className="fp-text mt-4 bg-[#f7f8fa] border border-[#eef0f3] px-5 py-4 text-[15px] leading-relaxed text-[#1f2937]">
          <span className="font-bold text-[#0d1117]">FHI note: </span>
          {note}
        </div>
      )}
    </Link>
  )
}

function SideCard({ p, index, delay }: { p: FeaturedProjectData; index: number; delay: number }) {
  const pill = statusPill(p.status, p.delivery_quarter)
  return (
    <Link href={projectHref(p)} className="group block" style={{ ["--d" as string]: `${delay}ms` }}>
      <div className="fp-img relative aspect-[16/9] w-full overflow-hidden bg-[#e9edf2]">
        {p.main_image ? (
          <div className="fp-zoom absolute inset-0">
            <Image
              src={p.main_image}
              alt={p.name}
              fill
              priority={index < 2}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[#c0c8d4]">
            <Building2 className="h-10 w-10" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
        {pill && <div className="fp-pop absolute left-3 top-3"><Pill>{pill}</Pill></div>}
      </div>
      <div className="fp-text mt-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-['Outfit'] text-lg font-bold leading-snug text-[#0d1117] line-clamp-1 group-hover:text-[#001f3f] transition-colors">
            {p.name}
          </h3>
          {p.developers?.name && (
            <p className="text-[13px] font-semibold text-[#b8913f] truncate">{p.developers.name}</p>
          )}
          <Facts p={p} compact />
        </div>
        <Price value={p.launch_price_from} currency={p.currency} />
      </div>
    </Link>
  )
}

export function FeaturedProjectsShowcase({ projects }: { projects: FeaturedProjectData[] }) {
  if (projects.length === 0) return null
  const [hero, ...rest] = projects
  const side = rest.slice(0, 2)
  const more = rest.slice(2)

  return (
    <div className="wf">
      {/* Each row fires its own entrance as it scrolls in: the hero first,
          the side cards 220ms apart behind it. */}
      <InView className="grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-8" threshold={0.15}>
        <div className="lg:col-span-2">
          <HeroCard p={hero} />
        </div>
        {side.length > 0 && (
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-1 lg:gap-8">
            {side.map((p, i) => <SideCard key={p.id} p={p} index={i} delay={260 + i * 220} />)}
          </div>
        )}
      </InView>

      {more.length > 0 && (
        <InView className="mt-12 grid grid-cols-1 gap-10 border-t border-[#e8eaed] pt-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8" threshold={0.15}>
          {more.map((p, i) => <SideCard key={p.id} p={p} index={9} delay={i * 180} />)}
        </InView>
      )}

      <Link
        href="/projects"
        className="mt-10 inline-flex items-center gap-2 text-sm font-bold text-[#0d1117] hover:text-[#b8913f] transition-colors sm:hidden"
      >
        Browse all projects
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
