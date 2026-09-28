import { cache } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Image from "next/image"
import { MessageCircle, Phone, ShieldCheck } from "lucide-react"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { canUseBuyerLinks } from "@/lib/app-roles"
import { titleCaseName } from "@/lib/public-profile"
import { createPageMetadata } from "@/lib/seo"
import { BUYER_LINK_CODE_RE, waDigits } from "@/lib/buyer-links"
import { BuyerLeadForm } from "./buyer-lead-form"

// An agent's Buyers Link (migrations 060–061): one permanent page per agent
// where a client answers a four-step brief that goes straight to that agent.
// Private (never indexed) and always fresh, so a deactivated agent's link
// stops at once.

export const dynamic = "force-dynamic"

type AgentRow = {
  id: string
  fullname: string | null
  profile_url: string | null
  role: string | null
  status: string | null
  is_deleted: boolean | null
  metadata: Record<string, unknown> | null
}

// Service role with explicit columns: the anon key can't read links or
// profiles, and the page needs only the link and the agent's public face.
const load = cache(async (code: string) => {
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
  return { link, agent }
})

type Props = { params: Promise<{ code: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params
  const data = await load(code)
  if (!data) return { title: "Link not found", robots: { index: false, follow: false } }
  const agentName = titleCaseName(data.agent.fullname ?? "") || "your FHI Global advisor"
  const first = agentName.split(" ")[0]
  // The WhatsApp preview the client sees when the agent sends the link.
  return createPageMetadata({
    title: `Find your property in Dubai with ${agentName}`,
    description: `Answer four quick questions and ${first} will send you options that fit.`,
    pathname: `/b/${code}`,
    robots: { index: false, follow: false },
  })
}

/** The agent's WhatsApp and phone from their profile (metadata keys set on Profile Settings). */
function agentContact(meta: Record<string, unknown> | null) {
  const s = (k: string) => (typeof meta?.[k] === "string" ? (meta[k] as string).trim() : "")
  const phone = waDigits(s("phone_country_code") || "+971", s("phone_number"))
  const whatsapp = waDigits(s("whatsapp_country_code") || s("phone_country_code") || "+971", s("whatsapp_number")) || phone
  return { whatsapp, phone }
}

export default async function BuyerLinkPage({ params }: Props) {
  const { code } = await params
  const data = await load(code)
  if (!data) notFound()
  const { link, agent } = data

  const agentName = titleCaseName(agent.fullname ?? "") || "Your FHI Global Advisor"
  const firstName = agentName.split(" ")[0]
  const { whatsapp, phone } = agentContact(agent.metadata)
  const initials = agentName.split(" ").map((w) => w.charAt(0)).slice(0, 2).join("").toUpperCase()

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      {/* ── Masthead: the agent, and what this page is for ── */}
      <section className="relative overflow-hidden bg-[#06182e] text-white">
        <div className="absolute inset-0" aria-hidden="true">
          <Image src="/background/dubai.webp" alt="" fill priority sizes="100vw" className="object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#06182e]/95 via-[#06182e]/80 to-[#06182e]/45" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6 md:pt-14">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <span className="flex items-center gap-3">
              {agent.profile_url ? (
                <Image
                  src={agent.profile_url}
                  alt={agentName}
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-full border-2 border-[#d6b357] object-cover"
                />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#d6b357] bg-[#0b2a4d] text-lg font-bold text-[#d6b357]">
                  {initials}
                </span>
              )}
              <span>
                <span className="block font-['Outfit'] text-lg font-bold text-white">{agentName}</span>
                <span className="block text-sm text-white/65">Property Advisor · FHI Global</span>
              </span>
            </span>
            <span className="flex flex-wrap gap-2">
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#25d366] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1fb857]"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp {firstName}
                </a>
              )}
              {phone && (
                <a
                  href={`tel:+${phone}`}
                  className="inline-flex items-center gap-2 border border-white/25 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  <Phone className="h-4 w-4" /> Call
                </a>
              )}
            </span>
          </div>

          <p className="mt-9 inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.26em] text-[#f0d89b]">
            <span className="h-px w-10 bg-[#d6b357]" aria-hidden="true" />
            Your property brief
          </p>
          <h1 className="mt-3 font-['Outfit'] text-[34px] font-bold leading-[1.06] tracking-tight sm:text-[46px]">
            Tell {firstName} what you&rsquo;re <span className="text-[#e3c06c]">looking for.</span>
          </h1>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-white/80">
            Four quick steps, about two minutes. {firstName} will come back to you on WhatsApp with options that fit.
          </p>
        </div>
      </section>

      <div className="relative mx-auto -mt-14 max-w-3xl px-4 pb-16 sm:px-6">
        {!link.is_active ? (
          <div className="border border-[#e8eaed] bg-white p-8 text-center">
            <p className="font-['Outfit'] text-2xl font-bold text-[#0d1117]">This page is no longer available</p>
            <p className="mt-2 text-[15px] leading-relaxed text-[#6b7280]">Send {firstName} a message directly instead.</p>
          </div>
        ) : (
          <BuyerLeadForm code={link.code} agentFirstName={firstName} agentWhatsapp={whatsapp || null} />
        )}
        <p className="mt-5 flex items-center justify-center gap-2 text-center text-[12.5px] text-[#6b7280]">
          <ShieldCheck className="h-4 w-4 text-[#b8913f]" />
          Your answers go only to {agentName} at FHI Global.
        </p>
      </div>
    </div>
  )
}
