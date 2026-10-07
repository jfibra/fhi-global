import type { SupabaseClient } from "@supabase/supabase-js"
import { waDigits } from "@/lib/buyer-links"
import { titleCaseName } from "@/lib/public-profile"

// Sharing a project from an agent's website (/website/<slug>): the shared
// link opens that project INSIDE the agent's site
// (/website/<slug>/projects/<project>), where the only contact is the agent —
// and its link preview (og:image) carries the agent's name and number, so a
// Facebook post brings leads to the agent, not to FHI in general.
//
// Numbers: the Website Builder stores the agent's number as typed, usually
// without its country code ("523694547"), while the profile keeps the code
// (metadata.phone_country_code). The dialable number is the site's number
// behind the profile's code — the same rule as Buyers Link (waDigits).

export type ShareContact = {
  /** "Agnes White" */
  name: string
  first: string
  /** Digits only, international: "16195484663". "" when none on file. */
  phone: string
  whatsapp: string
  /** "+1 619 548 4663" — for text and the preview image. */
  label: string
  portrait: string | null
}

type AgentFields = { name: string; phone: string; whatsapp: string }

/** "+971 52 369 4547", "+1 619 548 4663", "+63 910 193 0243"; anything else "+<digits>". */
export function formatIntl(digits: string): string {
  const d = digits.replace(/\D/g, "")
  if (!d) return ""
  if (d.startsWith("971") && d.length === 12) return `+971 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8)}`
  if (d.startsWith("1") && d.length === 11) return `+1 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}`
  if (d.startsWith("63") && d.length === 12) return `+63 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`
  if (d.startsWith("44") && d.length === 12) return `+44 ${d.slice(2, 6)} ${d.slice(6)}`
  return `+${d}`
}

/** The agent's dialable numbers: the website's numbers behind the profile's country codes. */
export async function loadShareContact(
  admin: SupabaseClient,
  agentId: string,
  agent: AgentFields,
  portrait: string | null,
  /** `strict`: a failed read throws instead of quietly using the default +971 code. For ISR pages, where a
   *  transient error would otherwise cache wrong dial codes (a +971 glued onto a +63 number) for minutes. */
  opts: { strict?: boolean } = {},
): Promise<ShareContact> {
  const { data, error } = await admin.from("profiles").select("metadata").eq("id", agentId).maybeSingle<{ metadata: Record<string, unknown> | null }>()
  if (error && opts.strict) throw new Error("Failed to load agent contact")
  const meta = data?.metadata ?? {}
  const code = (k: string) => (typeof meta[k] === "string" && /^\+\d{1,4}$/.test((meta[k] as string).trim()) ? (meta[k] as string).trim() : "")
  const phoneCode = code("phone_country_code") || "+971"
  const waCode = code("whatsapp_country_code") || phoneCode
  const phone = waDigits(phoneCode, agent.phone)
  const whatsapp = waDigits(waCode, agent.whatsapp) || phone
  const name = titleCaseName(agent.name ?? "") || "Your FHI Global advisor"
  return {
    name,
    first: name.split(" ")[0],
    phone,
    whatsapp,
    label: formatIntl(whatsapp || phone),
    portrait: portrait || null,
  }
}

/**
 * The site's data with the agent's numbers made dialable: the header's Contact
 * Me menu and the About channels build wa.me/tel: links straight from
 * agent.phone / agent.whatsapp, which the Website Builder stores without a
 * country code. Nothing displays these as text on the pages that use this.
 */
export function withDialableNumbers<T extends { agent: { phone: string; whatsapp: string } }>(data: T, contact: ShareContact): T {
  return {
    ...data,
    agent: {
      ...data.agent,
      phone: contact.phone ? `+${contact.phone}` : data.agent.phone,
      whatsapp: contact.whatsapp ? `+${contact.whatsapp}` : data.agent.whatsapp,
    },
  }
}

/** "azizi-grand" from a main-site project href ("/azizi-developments/azizi-grand" or "/projects/azizi-grand"). */
export const projectSlugFromHref = (href?: string | null): string | null =>
  href?.split("?")[0].split("/").filter(Boolean).pop() ?? null

export const agentProjectPath = (siteSlug: string, projectSlug: string) => `/website/${siteSlug}/projects/${projectSlug}`

/** What goes out with the link: a title, and a text that carries the agent's number (WhatsApp, email, the native share sheet). */
export function shareCopy(
  p: { title: string; developerName?: string | null; from?: string | null; location?: string | null },
  c: ShareContact,
): { title: string; text: string } {
  const by = p.developerName && !p.title.toLowerCase().includes(p.developerName.toLowerCase().split(" ")[0]) ? ` by ${p.developerName}` : ""
  const price = p.from ? `, from ${p.from}` : ""
  const where = p.location ? ` in ${p.location}` : ""
  const title = `${p.title}${by}`
  const contact = c.label ? `${c.name}, ${c.label}` : c.name
  return {
    title,
    text: `${p.title}${by}${price}${where}. For prices, payment plans and viewings, contact me: ${contact}.`,
  }
}
