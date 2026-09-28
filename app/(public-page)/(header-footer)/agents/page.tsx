import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowDown, Globe, MessageCircle, UserRound } from "lucide-react"
import { AgentsGrid, TitleCard, type PublicAgent } from "./agents-grid"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { createPageMetadata } from "@/lib/seo"
import { titleCaseName } from "@/lib/public-profile"
import { breadcrumbList, personListSchema } from "@/lib/structured-data"
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

const COMPANY_WHATSAPP = "https://wa.me/971567428288"

/** Joins a stored country code with its number, tolerating either being blank. */
function contact(meta: Record<string, unknown> | null, key: "phone" | "whatsapp"): string | null {
  if (!meta) return null
  const code = typeof meta[`${key}_country_code`] === "string" ? (meta[`${key}_country_code`] as string).trim() : ""
  const num = typeof meta[`${key}_number`] === "string" ? (meta[`${key}_number`] as string).trim() : ""
  if (!num) return null
  // Numbers are sometimes stored already carrying the code.
  return num.startsWith("+") || !code ? num : `${code}${num}`
}

/**
 * Google Sign-In avatars arrive at 96 px ("…=s96-c"), which blurs at card
 * size. Google serves the same picture larger on request.
 */
function sharpPhoto(url: string): string {
  return /googleusercontent\.com\//.test(url) ? url.replace(/=s\d+(-c)?$/, "=s640-c") : url
}

/** Uploaded to FHI's own storage, i.e. a portrait the agent chose for work (not a Google account picture). */
const isUploaded = (url: string) => /\.amazonaws\.com\//.test(url)

/** A stable shuffle (same order every render, so no hydration mismatch): the wall shouldn't read A to Z. */
const mix = (id: string) => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)

type Roster = { agents: PublicAgent[]; wall: WallPerson[]; liveProjects: number }

async function fetchRoster(): Promise<Roster> {
  // Service role, server-side, with an explicit column list — the same pattern
  // the public business-card page uses. It is NOT laziness about RLS: profiles
  // only grants SELECT to `authenticated`, and opening it to anon would expose
  // whole rows (metadata carries licence numbers, internal LR ids and private
  // contact fields). Row-level security cannot restrict columns; naming them
  // here can. Only what PublicAgent names ever reaches the browser: name,
  // photo, role, phone, WhatsApp, and the public pages that already exist for
  // them (business card, website, approved review score).
  const admin = createAdminSupabase()
  const [profiles, sites, reviews, projects] = await Promise.all([
    admin
      .from("profiles")
      .select("id, fullname, fname, lname, role, profile_url, metadata")
      .in("role", ["agent", "team_leader"])
      .eq("status", "active")
      .not("is_deleted", "is", true)
      .order("fullname", { ascending: true }),
    admin.from("website_builder").select("agent_id, slug").eq("is_published", true).not("slug", "is", null),
    admin.from("agent_feedback").select("agent_id, overall_rating").eq("status", "approved"),
    admin.from("projects").select("id", { count: "exact", head: true }).eq("is_active", true).eq("is_published", true).is("deleted_at", null),
  ])

  if (profiles.error) {
    console.error("[agents] query failed:", profiles.error.message)
    return { agents: [], wall: [], liveProjects: projects.count ?? 0 }
  }

  const siteOf = new Map((sites.data ?? []).map((s) => [String(s.agent_id), String(s.slug)]))
  const scores = new Map<string, number[]>()
  for (const r of reviews.data ?? []) {
    const k = String(r.agent_id)
    scores.set(k, [...(scores.get(k) ?? []), Number(r.overall_rating)])
  }

  const agents: PublicAgent[] = (profiles.data ?? [])
    .map((p) => {
      const meta = (p.metadata ?? null) as Record<string, unknown> | null
      const raw = (p.fullname ?? [p.fname, p.lname].filter(Boolean).join(" ") ?? "").trim()
      const photo = typeof p.profile_url === "string" && p.profile_url.trim() ? p.profile_url.trim() : null
      const s = scores.get(String(p.id))
      return {
        id: String(p.id),
        name: titleCaseName(raw),
        photo: photo ? sharpPhoto(photo) : null,
        uploaded: photo ? isUploaded(photo) : false,
        leader: p.role === "team_leader",
        phone: contact(meta, "phone"),
        whatsapp: contact(meta, "whatsapp"),
        website: siteOf.get(String(p.id)) ?? null,
        rating: s?.length ? { average: s.reduce((a, b) => a + b, 0) / s.length, count: s.length } : null,
      }
    })
    // An unnamed card helps nobody find anyone.
    .filter((a) => a.name.length > 0)
    // Agents with a photo lead. A visitor's first screen decides whether the
    // team looks real, and a grid opening on logo placeholders undersells it.
    // Alphabetical within each group, so the ordering is still predictable and
    // the whole thing self-corrects as agents upload portraits.
    .sort((a, b) => {
      if (Boolean(a.photo) !== Boolean(b.photo)) return a.photo ? -1 : 1
      return a.name.localeCompare(b.name)
    })

  const wall = agents
    .filter((a) => a.photo && a.uploaded)
    .sort((a, b) => mix(a.id) - mix(b.id))
    .map((a) => ({ src: a.photo as string, name: a.name, role: a.leader ? "Team leader" : "Property advisor" }))

  return { agents, wall, liveProjects: projects.count ?? 0 }
}

function Words({ text, start = 0, gold = false }: { text: string; start?: number; gold?: boolean }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span key={`${w}-${i}`} className="wf-word mr-[0.24em]">
          <span style={{ ["--i" as string]: start + i }} className={gold ? "wf-gold" : undefined}>{w}</span>
        </span>
      ))}
    </>
  )
}

export default async function AgentsPage() {
  const { agents, wall, liveProjects } = await fetchRoster()
  const leaders = agents.filter((a) => a.leader)
  const faces = wall.slice(0, 7)
  const stats = [
    { value: agents.length, label: "Property advisors" },
    { value: leaders.length, label: "Team leaders" },
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
          personListSchema(agents.map((a) => ({ name: a.name, image: a.photo }))),
          breadcrumbList([{ name: "Home", path: "/" }, { name: "Agents" }]),
        ]}
      />

      {/* ── Masthead: the cast wall ──────────────────────────────────────
          Real portraits drift behind the headline; a spotlight names one
          face at a time. Counts are the live roster and project rows. */}
      <section className="relative isolate flex min-h-[640px] overflow-hidden bg-[#06182e] text-white lg:min-h-[min(88vh,860px)]">
        {wall.length >= 6 ? (
          <AgentWall people={wall} />
        ) : (
          <Image src="/background/dubai.webp" alt="" fill priority sizes="100vw" className="object-cover" aria-hidden="true" />
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

      {/* ── Team leaders ─────────────────────────────────────────────── */}
      {leaders.length > 0 && (
        <section className="relative bg-white">
          <InView className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28" threshold={0.12}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.26em] text-[#b8913f]">
                  <span className="wf-rule h-px w-10 bg-[#d6b357]" aria-hidden="true" />
                  <span className="wf-fade" style={{ ["--d" as string]: "150ms" }}>Leadership</span>
                </p>
                <h2 className="mt-4 font-['Outfit'] text-[36px] font-bold leading-[1.05] tracking-tight text-[#0d1117] sm:text-[46px]">
                  <Words text="The team" />
                  <Words text="leaders" start={2} gold />
                </h2>
              </div>
              <p className="wf-fade max-w-sm text-[15px] leading-relaxed text-[#6b7280]" style={{ ["--d" as string]: "400ms" }}>
                They lead FHI Global&rsquo;s sales teams in Dubai. Reach any of them directly.
              </p>
            </div>

            <div className={`mt-14 grid gap-x-8 gap-y-14 sm:grid-cols-2 ${leaders.length >= 3 ? "lg:grid-cols-3" : ""}`}>
              {leaders.map((a, i) => {
                const d = 250 + i * 200
                const wa = a.whatsapp?.replace(/[^\d]/g, "")
                return (
                  <article key={a.id} className="group">
                    <div className="relative">
                      {(["tl", "tr", "bl", "br"] as const).map((c) => (
                        <span key={c} className={`wf-corner wf-corner--${c}`} style={{ ["--d" as string]: `${d + 700}ms` }} aria-hidden="true" />
                      ))}
                      <Link
                        href={`/business-card/${a.id}`}
                        aria-label={`${a.name}, team leader: view profile`}
                        className="wf-photo relative block aspect-[4/5] overflow-hidden bg-[#0b2a4d]"
                        style={{ ["--d" as string]: `${d}ms` }}
                      >
                        {a.photo ? (
                          <Image
                            src={a.photo}
                            alt={a.name}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            className="wf-photo-img object-cover object-top transition-transform duration-700 group-hover:scale-[1.03]"
                            style={{ ["--d" as string]: `${d}ms` }}
                          />
                        ) : (
                          <TitleCard name={a.name} size="lg" />
                        )}
                        <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#06182e]/70 to-transparent" aria-hidden="true" />
                        <span className="absolute bottom-4 left-4 bg-[#d6b357] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#001f3f]">
                          Team leader
                        </span>
                      </Link>
                    </div>
                    <h3 className="wf-fade mt-7 font-['Outfit'] text-[26px] font-bold leading-tight text-[#0d1117]" style={{ ["--d" as string]: `${d + 450}ms` }}>
                      {a.name}
                    </h3>
                    <div className="wf-fade mt-4 flex flex-wrap gap-2" style={{ ["--d" as string]: `${d + 550}ms` }}>
                      {wa && (
                        <a
                          href={`https://wa.me/${wa}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-[#25d366] px-4 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#1fb857]"
                        >
                          <MessageCircle className="h-4 w-4" /> WhatsApp
                        </a>
                      )}
                      <Link
                        href={`/business-card/${a.id}`}
                        className="inline-flex items-center gap-2 border border-[#e5e8ec] px-4 py-2.5 text-[13px] font-bold text-[#374151] transition-colors hover:border-[#d6b357] hover:text-[#8a6d2b]"
                      >
                        <UserRound className="h-4 w-4" /> Profile
                      </Link>
                      {a.website && (
                        <Link
                          href={`/website/${a.website}`}
                          className="inline-flex items-center gap-2 border border-[#e5e8ec] px-4 py-2.5 text-[13px] font-bold text-[#374151] transition-colors hover:border-[#d6b357] hover:text-[#8a6d2b]"
                        >
                          <Globe className="h-4 w-4" /> Website
                        </Link>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </InView>
        </section>
      )}

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
