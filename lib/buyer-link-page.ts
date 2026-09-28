import "server-only"
import { cache } from "react"
import { notFound, permanentRedirect } from "next/navigation"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { canUseBuyerLinks } from "@/lib/app-roles"
import { titleCaseName } from "@/lib/public-profile"
import { nameSlug } from "@/lib/website-builder-service"
import { BRIEF_SLUG_RE, BUYER_LINK_CODE_RE, buyerLinkPath, sellerLinkPath, waDigits, type BriefKind } from "@/lib/buyer-links"

// What the public Buyers Link pages (/buy-with/<slug> for buyers,
// /sell-with/<slug> for sellers) need about a link: the link itself and its
// agent's public face. Also the readable address itself (migration 063):
// minted once from the agent's name and never changed, and the redirect that
// keeps old /b/<code> and /s/<code> links (and printed QR codes) working.
// Service role with explicit columns: the anon key can't read links or
// profiles.

type AgentRow = {
  id: string
  fullname: string | null
  profile_url: string | null
  role: string | null
  status: string | null
  is_deleted: boolean | null
  metadata: Record<string, unknown> | null
}

type LinkRow = { id: string; agent_id: string; code: string; slug: string | null; is_active: boolean }
const LINK_SELECT = "id, agent_id, code, slug, is_active"

export type BriefAgent = {
  name: string
  firstName: string
  initials: string
  photo: string | null
  /** wa.me / tel: digits, or "" when the agent has no number on their profile. */
  whatsapp: string
  phone: string
}

/** The agent behind a link, or null when their access is gone (a link dies with it). */
async function agentFor(admin: SupabaseClient, agentId: string): Promise<{ face: BriefAgent; fullname: string } | null> {
  const { data: agent } = await admin
    .from("profiles")
    .select("id, fullname, profile_url, role, status, is_deleted, metadata")
    .eq("id", agentId)
    .maybeSingle<AgentRow>()
  if (!agent || agent.is_deleted || agent.status !== "active" || !canUseBuyerLinks(agent.role)) return null

  const meta = agent.metadata
  const s = (k: string) => (typeof meta?.[k] === "string" ? (meta[k] as string).trim() : "")
  // The agent's numbers from Profile Settings (metadata keys).
  const phone = waDigits(s("phone_country_code") || "+971", s("phone_number"))
  const whatsapp = waDigits(s("whatsapp_country_code") || s("phone_country_code") || "+971", s("whatsapp_number")) || phone
  const name = titleCaseName(agent.fullname ?? "") || "Your FHI Global Advisor"
  return {
    fullname: agent.fullname ?? "",
    face: {
      name,
      firstName: name.split(" ")[0],
      initials: name.split(" ").map((w) => w.charAt(0)).slice(0, 2).join("").toUpperCase(),
      photo: agent.profile_url,
      whatsapp,
      phone,
    },
  }
}

/**
 * The link's readable address, minted on first use from the agent's name
 * with the agent-website rule ("MICHELLE Q. GUINTO" → "michelle-guinto"),
 * then base-2, base-3, … when the name is taken. Never re-minted: printed QR
 * codes must keep working. Only fills an empty slug, so two requests racing
 * settle on one.
 */
export async function ensureLinkSlug(admin: SupabaseClient, link: { id: string; slug: string | null }, fullname: string): Promise<string | null> {
  if (link.slug) return link.slug
  const base = nameSlug(fullname) || "fhi-agent"
  const { data } = await admin.from("buyer_links").select("slug").or(`slug.eq.${base},slug.like.${base}-%`)
  const taken = new Set((data ?? []).map((r) => r.slug as string))
  for (let n = 1; n <= 50; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`
    if (taken.has(candidate)) continue
    const { data: saved, error } = await admin
      .from("buyer_links")
      .update({ slug: candidate })
      .eq("id", link.id)
      .is("slug", null)
      .select("slug")
      .maybeSingle<{ slug: string }>()
    if (saved?.slug) return saved.slug
    if (error && error.code !== "23505") {
      console.error("[buyer-links] slug mint failed:", error.message)
      return null
    }
    if (!error) {
      // Nothing updated: another request minted it a moment ago.
      const { data: again } = await admin.from("buyer_links").select("slug").eq("id", link.id).maybeSingle<{ slug: string | null }>()
      return again?.slug ?? null
    }
    taken.add(candidate) // someone else took this one first; try the next
  }
  return null
}

/** A public page's link and agent, by the readable address. cache() lets generateMetadata and the page share one read. */
export const loadBriefBySlug = cache(async (slug: string) => {
  if (!BRIEF_SLUG_RE.test(slug) || slug.length > 80) return null
  const admin = createAdminSupabase()
  const { data: link } = await admin.from("buyer_links").select(LINK_SELECT).eq("slug", slug).maybeSingle<LinkRow>()
  if (!link) return null
  const agent = await agentFor(admin, link.agent_id)
  if (!agent) return null
  return { link, agent: agent.face }
})

/**
 * An old /b/<code> or /s/<code> address: 308 to the readable page (minting
 * its address if the agent hasn't opened Buyers Link since migration 063),
 * query string kept. 404 when the link or its agent's access is gone.
 */
export async function redirectOldLink(
  code: string,
  kind: BriefKind,
  searchParams: Record<string, string | string[] | undefined>,
): Promise<never> {
  if (!BUYER_LINK_CODE_RE.test(code)) notFound()
  const admin = createAdminSupabase()
  const { data: link } = await admin.from("buyer_links").select(LINK_SELECT).eq("code", code).maybeSingle<LinkRow>()
  const agent = link ? await agentFor(admin, link.agent_id) : null
  const slug = link && agent ? await ensureLinkSlug(admin, link, agent.fullname) : null
  if (!slug) notFound()
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(searchParams)) for (const x of Array.isArray(v) ? v : v != null ? [v] : []) qs.append(k, x)
  const path = kind === "seller" ? sellerLinkPath(slug) : buyerLinkPath(slug)
  permanentRedirect(qs.size ? `${path}?${qs}` : path)
}
