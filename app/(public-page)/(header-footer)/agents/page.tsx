import type { Metadata } from "next"
import Image from "next/image"
import { Handshake, Users, Award } from "lucide-react"
import { AgentsGrid } from "./agents-grid"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { createPageMetadata } from "@/lib/seo"
import { titleCaseName } from "@/lib/public-profile"
import { breadcrumbList, personListSchema } from "@/lib/structured-data"
import { JsonLd } from "@/components/json-ld"

export const revalidate = 300

export const metadata: Metadata = createPageMetadata({
  title: "Meet Our Agents",
  description:
    "Meet the FHI Global team — property consultants across Dubai ready to guide you from first viewing to handover.",
  pathname: "/agents",
  keywords: ["Dubai real estate agents", "property consultants Dubai", "FHI Global team"],
})

/** Public shape — deliberately narrow, see the query note below. */
type Agent = {
  id: string
  name: string
  photo: string | null
  phone: string | null
  whatsapp: string | null
}

/** Joins a stored country code with its number, tolerating either being blank. */
function contact(meta: Record<string, unknown> | null, key: "phone" | "whatsapp"): string | null {
  if (!meta) return null
  const code = typeof meta[`${key}_country_code`] === "string" ? (meta[`${key}_country_code`] as string).trim() : ""
  const num = typeof meta[`${key}_number`] === "string" ? (meta[`${key}_number`] as string).trim() : ""
  if (!num) return null
  // Numbers are sometimes stored already carrying the code.
  return num.startsWith("+") || !code ? num : `${code}${num}`
}

async function fetchAgents(): Promise<Agent[]> {
  // Service role, server-side, with an explicit column list — the same pattern
  // the public business-card page uses. It is NOT laziness about RLS: profiles
  // only grants SELECT to `authenticated`, and opening it to anon would expose
  // whole rows (metadata carries licence numbers, internal LR ids and private
  // contact fields). Row-level security cannot restrict columns; naming them
  // here can. Nothing outside this list ever reaches the browser.
  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, fullname, fname, lname, profile_url, metadata")
    .in("role", ["agent", "team_leader"])
    .eq("status", "active")
    .not("is_deleted", "is", true)
    .order("fullname", { ascending: true })

  if (error) {
    console.error("[agents] query failed:", error.message)
    return []
  }

  return (data ?? [])
    .map((p) => {
      const meta = (p.metadata ?? null) as Record<string, unknown> | null
      const raw = (p.fullname ?? [p.fname, p.lname].filter(Boolean).join(" ") ?? "").trim()
      return {
        id: String(p.id),
        name: titleCaseName(raw),
        photo: typeof p.profile_url === "string" && p.profile_url.trim() ? p.profile_url : null,
        phone: contact(meta, "phone"),
        whatsapp: contact(meta, "whatsapp"),
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
}

const PROMISES = [
  { icon: Users, title: "Expert Guidance", body: "Local expertise you can trust and rely on." },
  { icon: Award, title: "Client Focused", body: "Your goals are our top priority." },
  { icon: Handshake, title: "End-to-End Support", body: "From search to handover, we're with you all the way." },
]

export default async function AgentsPage() {
  const agents = await fetchAgents()

  return (
    <div className="bg-[#f7f8fa]">
      {/* The visible roster below, as Person entities. */}
      <JsonLd
        schema={[
          personListSchema(agents.map((a) => ({ name: a.name, image: a.photo }))),
          breadcrumbList([{ name: "Home", path: "/" }, { name: "Agents" }]),
        ]}
      />
      {/* ── Masthead ─────────────────────────────────────────────────── */}
      <section className="relative bg-[#001f3f] overflow-hidden">
        <Image
          src="/background/developers.webp"
          alt=""
          fill
          sizes="100vw"
          priority
          className="absolute inset-0 object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#001428]/95 via-[#001428]/80 to-[#001428]/45" />

        <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-12 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-10 lg:gap-16 items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6b357]">Our Agents</p>
            <h1
              className="font-['Outfit'] text-4xl md:text-[46px] font-bold text-white mt-2.5 leading-[1.1] tracking-tight"
              style={{ textShadow: "0 2px 22px rgba(0,10,30,0.55)" }}
            >
              Meet Our <span className="text-[#d6b357]">Real Estate Experts</span>
            </h1>
            <span className="block w-14 h-[3px] bg-[#d6b357] mt-5 mb-6" aria-hidden="true" />
            <p
              className="text-[15.5px] leading-relaxed text-[#c9d4e2] max-w-xl"
              style={{ textShadow: "0 1px 10px rgba(0,10,30,0.5)" }}
            >
              Our consultants are here to guide you every step of the way — find the right
              expert for your property journey in Dubai.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-10 gap-y-6 lg:border-l lg:border-white/15 lg:pl-14">
            {PROMISES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="max-w-[190px]">
                <Icon className="w-7 h-7 text-[#d6b357]" strokeWidth={1.25} aria-hidden="true" />
                <p className="mt-3 text-[15px] font-bold text-white">{title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-white/65">{body}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative h-[3px] bg-[#d6b357]" />
      </section>

      {/* ── Directory ────────────────────────────────────────────────── */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-6">
          <div>
            <h2 className="font-['Outfit'] text-2xl md:text-3xl font-bold text-[#0d1117]">
              Our Professional Agents
            </h2>
            <span className="block w-14 h-[3px] bg-[#d6b357] mt-3" aria-hidden="true" />
          </div>
        </div>

        <AgentsGrid agents={agents} />
      </div>
    </div>
  )
}
