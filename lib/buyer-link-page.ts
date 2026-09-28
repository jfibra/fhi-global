import "server-only"
import { cache } from "react"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { canUseBuyerLinks } from "@/lib/app-roles"
import { titleCaseName } from "@/lib/public-profile"
import { BUYER_LINK_CODE_RE, waDigits } from "@/lib/buyer-links"

// What the two public Buyers Link pages (/b/<code> for buyers, /s/<code> for
// sellers) need about a link: the link itself and its agent's public face.
// Service role with explicit columns: the anon key can't read links or
// profiles. cache() lets generateMetadata and the page share one read.

type AgentRow = {
  id: string
  fullname: string | null
  profile_url: string | null
  role: string | null
  status: string | null
  is_deleted: boolean | null
  metadata: Record<string, unknown> | null
}

export type BriefAgent = {
  name: string
  firstName: string
  initials: string
  photo: string | null
  /** wa.me / tel: digits, or "" when the agent has no number on their profile. */
  whatsapp: string
  phone: string
}

export const loadBriefLink = cache(async (code: string) => {
  if (!BUYER_LINK_CODE_RE.test(code)) return null
  const admin = createAdminSupabase()
  const { data: link } = await admin
    .from("buyer_links")
    .select("id, agent_id, code, is_active")
    .eq("code", code)
    .maybeSingle<{ id: string; agent_id: string; code: string; is_active: boolean }>()
  if (!link) return null
  const { data: agent } = await admin
    .from("profiles")
    .select("id, fullname, profile_url, role, status, is_deleted, metadata")
    .eq("id", link.agent_id)
    .maybeSingle<AgentRow>()
  // A link dies with its owner's access.
  if (!agent || agent.is_deleted || agent.status !== "active" || !canUseBuyerLinks(agent.role)) return null

  const meta = agent.metadata
  const s = (k: string) => (typeof meta?.[k] === "string" ? (meta[k] as string).trim() : "")
  // The agent's numbers from Profile Settings (metadata keys).
  const phone = waDigits(s("phone_country_code") || "+971", s("phone_number"))
  const whatsapp = waDigits(s("whatsapp_country_code") || s("phone_country_code") || "+971", s("whatsapp_number")) || phone
  const name = titleCaseName(agent.fullname ?? "") || "Your FHI Global Advisor"
  const face: BriefAgent = {
    name,
    firstName: name.split(" ")[0],
    initials: name.split(" ").map((w) => w.charAt(0)).slice(0, 2).join("").toUpperCase(),
    photo: agent.profile_url,
    whatsapp,
    phone,
  }
  return { link, agent: face }
})
