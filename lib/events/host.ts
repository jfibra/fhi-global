import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { titleCaseName } from "@/lib/public-profile"
import { loadShareContact } from "@/lib/website-project-share"

/**
 * Who hosts an agent's event, for the "Hosted by" box on its fhiglobal.ae page
 * (/events/<slug>). Since 2026-10-04 an agent's event on the main page renders
 * there instead of forwarding to their website, so the agent keeps the credit
 * and a direct line to the visitor here.
 *
 * Only what's already public: an agent with a published website shows the
 * name, photo and numbers that site shows (dialable via loadShareContact) plus
 * a link to it; an agent without one shows just the name and photo (also on
 * /agents) — their number isn't public anywhere, so it isn't shown here.
 */
export type EventHost = {
  name: string
  first: string
  photo: string | null
  /** International digits ("971523694547") for wa.me / tel:, or null. */
  whatsapp: string | null
  phone: string | null
  /** Their published website, or null. */
  websiteHref: string | null
}

export async function loadEventHost(admin: SupabaseClient, agentId: string): Promise<EventHost | null> {
  const [{ data: site }, { data: profile }] = await Promise.all([
    admin.from("website_builder").select("slug, is_published, contact, about_id").eq("agent_id", agentId).maybeSingle(),
    admin.from("profiles").select("fullname, profile_url").eq("id", agentId).maybeSingle(),
  ])
  const profileName = typeof profile?.fullname === "string" ? profile.fullname : ""
  const profilePhoto = typeof profile?.profile_url === "string" && profile.profile_url ? profile.profile_url : null

  if (site?.slug && site.is_published !== false) {
    const contact = (site.contact ?? {}) as { name?: unknown; phone?: unknown; whatsapp?: unknown }
    const text = (v: unknown) => (typeof v === "string" ? v : "")
    const { data: about } = site.about_id
      ? await admin.from("about_section").select("photo").eq("id", site.about_id as string).maybeSingle()
      : { data: null }
    const share = await loadShareContact(
      admin,
      agentId,
      { name: text(contact.name) || profileName, phone: text(contact.phone), whatsapp: text(contact.whatsapp) },
      (typeof about?.photo === "string" && about.photo) || profilePhoto,
    )
    return {
      name: share.name,
      first: share.first,
      photo: share.portrait,
      whatsapp: share.whatsapp || null,
      phone: share.phone || null,
      websiteHref: `/website/${site.slug as string}`,
    }
  }

  const name = titleCaseName(profileName)
  if (!name) return null
  return { name, first: name.split(" ")[0], photo: profilePhoto, whatsapp: null, phone: null, websiteHref: null }
}
