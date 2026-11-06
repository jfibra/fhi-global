import { Fragment } from "react"
import type { Metadata } from "next"
import Image from "next/image"
import { ArrowDown, MessageCircle } from "lucide-react"
import { AgentsGrid, type PublicAgent } from "./agents-grid"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { fetchPublicAgents } from "@/lib/public-agents"
import { createPageMetadata } from "@/lib/seo"
import { breadcrumbList, personListSchema } from "@/lib/structured-data"
import { companyWhatsappHref } from "@/lib/company"
import { JsonLd } from "@/components/json-ld"
import { InView } from "@/components/public/in-view"
import { CountUp } from "@/components/public/count-up"
import { MagneticLink } from "@/components/public/magnetic-link"
import { AgentWall, type WallPerson } from "@/components/public/agent-wall"

export const revalidate = 300

export const metadata: Metadata = createPageMetadata({
  title: "Meet Our Agents",
  description:
    "Meet the FHI Global team — property consultants across Dubai ready to guide you from first viewing to handover.",
  pathname: "/agents",
  keywords: ["Dubai real estate agents", "property consultants Dubai", "FHI Global team"],
})

const COMPANY_WHATSAPP = companyWhatsappHref()

/** A stable shuffle (same order every render, so no hydration mismatch): the wall shouldn't read A to Z. */
const mix = (id: string) => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)

/** One Person in the roster's structured data; `path` only for an agent whose site is offered to search engines. */
type SchemaPerson = { name: string; image: string | null; path: string | null }

type Roster = { agents: PublicAgent[]; wall: WallPerson[]; liveProjects: number; people: SchemaPerson[] }

async function fetchRoster(): Promise<Roster> {
  // Which agents, and which of their details, is decided in lib/public-agents.ts —
  // one loader shared with the website chat, so the chat never names an agent
  // this page doesn't. Only the live-project count is this page's own query.
  const admin = createAdminSupabase()
  const [roster, projects] = await Promise.all([
    fetchPublicAgents().catch((e: unknown) => {
      console.error("[agents] query failed:", e instanceof Error ? e.message : e)
      return null
    }),
    admin.from("projects").select("id", { count: "exact", head: true }).eq("is_active", true).eq("is_published", true).is("deleted_at", null),
  ])
  if (!roster) return { agents: [], wall: [], liveProjects: projects.count ?? 0, people: [] }
  const { agents, listedSites: listedOf } = roster

  const wall = agents
    .filter((a) => a.photo && a.uploaded)
    .sort((a, b) => mix(a.id) - mix(b.id))
    .map((a) => ({ src: a.photo as string, name: a.name, role: a.leader ? "Team leader" : "Property advisor" }))

  const people = agents.map((a) => {
    const listed = listedOf.get(a.id)
    return { name: a.name, image: a.photo, path: listed ? `/website/${listed}` : null }
  })

  return { agents, wall, liveProjects: projects.count ?? 0, people }
}

function Words({ text, start = 0, gold = false }: { text: string; start?: number; gold?: boolean }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <Fragment key={`${w}-${i}`}>
          <span className="wf-word">
            <span style={{ ["--i" as string]: start + i }} className={gold ? "wf-gold" : undefined}>{w}</span>
          </span>{" "}
        </Fragment>
      ))}
    </>
  )
}

export default async function AgentsPage() {
  const { agents, wall, liveProjects, people } = await fetchRoster()
  const faces = wall.slice(0, 7)
  const stats = [
    { value: agents.length, label: "Property advisors" },
    { value: liveProjects, label: "Live projects to show you" },
  ].filter((s) => s.value > 0)

  return (
    <div className="agx wf relative bg-[#f6f7f9] overflow-x-clip">
      <noscript>
        <style>{`.agx [class*="wf-"], .agx .wf-word > span { opacity: 1 !important; transform: none !important; filter: none !important; clip-path: none !important; } .agx .ag-card-img { filter: none !important; transform: none !important; }`}</style>
      </noscript>
      {/* The visible roster below, as Person entities. */}
      <JsonLd
        schema={[
          personListSchema(people),
          breadcrumbList([{ name: "Home", path: "/" }, { name: "Agents" }]),
        ]}
      />

      {/* ── Masthead: the cast wall ──────────────────────────────────────
          Real portraits drift behind the headline; a spotlight names one
          face at a time. Counts are the live roster and project rows. (No
          team-leaders chapter for now: two of the three accounts are demos.) */}
      <section className="relative isolate flex min-h-[640px] overflow-hidden bg-[#06182e] text-white lg:min-h-[min(88vh,860px)]">
        {wall.length >= 6 ? (
          <AgentWall people={wall} />
        ) : (
          <Image src="/background/dubai.webp" alt="" fill preload fetchPriority="high" sizes="100vw" className="object-cover" aria-hidden="true" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#06182e] via-[#06182e]/80 to-[#06182e]/25 lg:bg-gradient-to-r lg:from-[#06182e] lg:via-[#06182e]/85 lg:to-[#06182e]/15" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#06182e]/30 via-transparent to-[#06182e]/70 lg:from-[#06182e]/60" aria-hidden="true" />

        <InView className="relative z-10 mx-auto flex w-full max-w-7xl flex-col justify-end px-4 pb-12 pt-60 sm:px-6 lg:justify-center lg:px-8 lg:py-24" threshold={0.1} rootMargin="0px">
          <div className="max-w-xl" data-wall-avoid>
            <p className="inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.3em] text-[#f0d89b]">
              <span className="wf-rule h-px w-10 bg-[#d6b357]" aria-hidden="true" />
              <span className="wf-fade" style={{ ["--d" as string]: "200ms" }}>Our agents</span>
            </p>
            <h1 className="mt-4 font-['Outfit'] text-[42px] font-bold leading-[1.02] tracking-tight drop-shadow-[0_2px_18px_rgba(0,10,30,0.6)] sm:text-[56px] lg:text-[68px]">
              <Words text="Meet the faces" />
              <br />
              <Words text="behind" start={3} />
              <Words text="FHI Global." start={4} gold />
            </h1>
            <p className="wf-fade mt-5 max-w-md text-[16px] leading-relaxed text-white/80" style={{ ["--d" as string]: "650ms" }}>
              The property advisors who&rsquo;ll walk you from first viewing to the keys. Find yours, then say hello on WhatsApp.
            </p>

            {stats.length > 0 && (
              <dl className="wf-fade mt-8 grid grid-cols-3 gap-x-4 sm:flex sm:flex-wrap sm:gap-x-9 sm:gap-y-4" style={{ ["--d" as string]: "800ms" }}>
                {stats.map((s, i) => (
                  <div key={s.label}>
                    <dd className={`font-['Outfit'] text-[28px] font-bold leading-none sm:text-[34px] ${i === 1 ? "text-[#d6b357]" : "text-white"}`}>
                      <CountUp value={s.value} delay={900 + i * 140} duration={1300} />
                    </dd>
                    <dt className="mt-2 text-[9px] font-bold uppercase leading-snug tracking-[0.16em] text-[#d6b357] sm:text-[10px] sm:tracking-[0.18em]">{s.label}</dt>
                  </div>
                ))}
              </dl>
            )}

            <div className="wf-fade mt-9 flex flex-wrap gap-3" style={{ ["--d" as string]: "950ms" }}>
              <MagneticLink
                href="#directory"
                className="inline-flex items-center gap-2 bg-[#d6b357] px-6 py-3.5 text-[14px] font-bold text-[#001f3f] transition-colors hover:bg-[#e2c26a]"
              >
                Find your advisor <ArrowDown className="h-4 w-4" />
              </MagneticLink>
              <a
                href={COMPANY_WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-white/30 px-6 py-3.5 text-[14px] font-bold text-white transition-colors hover:border-[#25d366] hover:text-[#7fe3a5]"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp FHI Global
              </a>
            </div>
          </div>
        </InView>
        <div className="absolute inset-x-0 bottom-0 z-10 h-[3px] bg-[#d6b357]" aria-hidden="true" />
      </section>

      {/* ── The directory ────────────────────────────────────────────── */}
      <section id="directory" className="scroll-mt-20">
        <InView className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 lg:px-8 lg:pt-24" threshold={0.2}>
          <p className="inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.26em] text-[#b8913f]">
            <span className="wf-rule h-px w-10 bg-[#d6b357]" aria-hidden="true" />
            <span className="wf-fade" style={{ ["--d" as string]: "150ms" }}>The whole team</span>
          </p>
          <h2 className="mt-4 font-['Outfit'] text-[36px] font-bold leading-[1.05] tracking-tight text-[#0d1117] sm:text-[46px]">
            <Words text="Every advisor," />
            <Words text="one tap away." start={2} gold />
          </h2>
        </InView>
        <AgentsGrid agents={agents} />
      </section>

      {/* ── Closing ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#06182e] text-white">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-[#d6b357]" aria-hidden="true" />
        <InView className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 py-20 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-24" threshold={0.3}>
          <div className="max-w-2xl">
            {faces.length > 0 && (
              <div className="wf-fade mb-7 flex items-center" style={{ ["--d" as string]: "100ms" }} aria-hidden="true">
                {faces.map((f, i) => (
                  <span key={f.src} className="relative -ml-3 h-12 w-12 overflow-hidden rounded-full border-2 border-[#06182e] first:ml-0" style={{ zIndex: faces.length - i }}>
                    <Image src={f.src} alt="" fill sizes="48px" className="object-cover object-top" />
                  </span>
                ))}
                <span className="ml-4 text-[13px] font-semibold text-white/70">{agents.length} advisors on the team</span>
              </div>
            )}
            <p className="inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.26em] text-[#f0d89b]">
              <span className="wf-rule h-px w-10 bg-[#d6b357]" aria-hidden="true" />
              <span className="wf-fade" style={{ ["--d" as string]: "150ms" }}>Not sure who to ask?</span>
            </p>
            <h2 className="mt-4 font-['Outfit'] text-[34px] font-bold leading-[1.06] tracking-tight sm:text-[44px]">
              <Words text="We'll put you in touch" />
              <Words text="with the right advisor." start={4} gold />
            </h2>
            <p className="wf-fade mt-4 max-w-lg text-[15.5px] leading-relaxed text-white/75" style={{ ["--d" as string]: "500ms" }}>
              Tell us what you&rsquo;re looking for, and the FHI Global team will connect you.
            </p>
          </div>
          <div className="wf-fade flex shrink-0 flex-wrap gap-3" style={{ ["--d" as string]: "650ms" }}>
            <MagneticLink
              href="/contact"
              className="inline-flex items-center gap-2 bg-[#d6b357] px-7 py-4 text-[14px] font-bold text-[#001f3f] transition-colors hover:bg-[#e2c26a]"
            >
              Contact us
            </MagneticLink>
            <a
              href={COMPANY_WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-[#25d366] px-7 py-4 text-[14px] font-bold text-[#7fe3a5] transition-colors hover:bg-[#25d366]/10"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </div>
        </InView>
      </section>
    </div>
  )
}
