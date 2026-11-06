import "server-only"

import { createAdminSupabase } from "@/lib/admin-supabase"
import { ROLES_PUBLIC_AGENTS } from "@/lib/app-roles"
import { titleCaseName } from "@/lib/public-profile"
import { agentSiteSignalsFromRow, isAgentSiteComplete } from "@/lib/agent-site"
import { STORY_BY_AGENT } from "@/lib/films"
import type { Film } from "@/components/public/film-player"

/**
 * The public roster: the agents admin staff picked for the Agents page
 * (Accounts & Invites → Public Agents, migration 077), with only what that
 * page prints. One loader for /agents and for the website chat's `our_agents`
 * tool (lib/site-chat.ts), so the chat can never name an agent the page
 * doesn't, nor a detail it doesn't show.
 *
 * Service role, server-side, with an explicit column list — the same pattern
 * the public business-card page uses. It is NOT laziness about RLS: profiles
 * only grants SELECT to `authenticated`, and opening it to anon would expose
 * whole rows (metadata carries licence numbers, internal LR ids and private
 * contact fields). Row-level security cannot restrict columns; naming them
 * here can. Only what PublicAgent names ever leaves the server: name, photo,
 * role, phone, WhatsApp, and the public pages that already exist for them
 * (business card, website, approved review score, their website's bio).
 */

export type PublicAgent = {
  id: string
  name: string
  photo: string | null
  /** The photo was uploaded to FHI (not a Google account picture). */
  uploaded: boolean
  leader: boolean
  phone: string | null
  whatsapp: string | null
  /** Published agent website slug (/website/<slug>). */
  website: string | null
  /** Approved client reviews only. */
  rating: { average: number; count: number } | null
  /** The agent's own story film (FHI Stories), when one was made. */
  story?: Film | null
  /** The "about" text of their published website — what they say about themselves there (trimmed). */
  about?: string | null
}

export type PublicRoster = {
  agents: PublicAgent[]
  /** agent id → website slug, for sites open to search engines only (lib/agent-site.ts). */
  listedSites: Map<string, string>
}

/** Joins a stored country code with its number, tolerating either being blank. */
export function profileContact(meta: Record<string, unknown> | null, key: "phone" | "whatsapp"): string | null {
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
export function sharpPhoto(url: string): string {
  return /googleusercontent\.com\//.test(url) ? url.replace(/=s\d+(-c)?$/, "=s640-c") : url
}

/** Uploaded to FHI's own storage, i.e. a portrait the agent chose for work (not a Google account picture). */
const isUploaded = (url: string) => /\.amazonaws\.com\//.test(url)

export async function fetchPublicAgents(): Promise<PublicRoster> {
  const admin = createAdminSupabase()
  const [profiles, sites, reviews] = await Promise.all([
    admin
      .from("profiles")
      .select("id, fullname, fname, lname, role, profile_url, metadata")
      .in("role", [...ROLES_PUBLIC_AGENTS])
      .eq("status", "active")
      .not("is_deleted", "is", true)
      // Only the agents admin staff picked (Accounts & Invites → Public Agents, migration 077).
      .eq("show_on_agents_page", true)
      .order("fullname", { ascending: true }),
    admin.from("website_builder").select("agent_id, slug, contact, about:about_id(bio, photo)").eq("is_published", true).not("slug", "is", null),
    admin.from("agent_feedback").select("agent_id, overall_rating").eq("status", "approved"),
  ])
  if (profiles.error) throw new Error(`[public-agents] ${profiles.error.message}`)

  const siteOf = new Map((sites.data ?? []).map((s) => [String(s.agent_id), String(s.slug)]))
  const bioOf = new Map(
    (sites.data ?? []).map((s) => {
      const about = (Array.isArray(s.about) ? s.about[0] : s.about) as { bio?: unknown } | null
      const bio = typeof about?.bio === "string" ? about.bio.replace(/\s+/g, " ").trim() : ""
      return [String(s.agent_id), bio || null]
    }),
  )
  // A Person links to their site only when that site is open to search engines — the same
  // predicate as its robots tag and the sitemap (lib/agent-site.ts), so no structured-data
  // link points at a noindex page.
  const listedSites = new Map(
    (sites.data ?? []).filter((s) => isAgentSiteComplete(agentSiteSignalsFromRow(s))).map((s) => [String(s.agent_id), String(s.slug)]),
  )
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
        phone: profileContact(meta, "phone"),
        whatsapp: profileContact(meta, "whatsapp"),
        website: siteOf.get(String(p.id)) ?? null,
        rating: s?.length ? { average: s.reduce((a, b) => a + b, 0) / s.length, count: s.length } : null,
        story: STORY_BY_AGENT[String(p.id)] ?? null,
        about: bioOf.get(String(p.id)) ?? null,
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

  return { agents, listedSites }
}
