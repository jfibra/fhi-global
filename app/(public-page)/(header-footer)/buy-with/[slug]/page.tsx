import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { createPageMetadata } from "@/lib/seo"
import { loadBriefBySlug } from "@/lib/buyer-link-page"
import { BriefMasthead } from "@/components/public/brief-masthead"
import { BuyerLeadForm } from "./buyer-lead-form"

// An agent's Buyers Link for buyers (migrations 060–063): one permanent page
// per agent, at a readable address (/buy-with/juliecor-repompo), where a
// client answers a four-step brief that goes straight to that agent. The same
// address under /sell-with/ is the agent's Sellers Link; old /b/<code> links
// redirect here. Private (never indexed): each agent's copy of this form is
// near-identical, so indexing them would only add thin duplicate pages.
// Always fresh, so a deactivated agent's link stops at once.

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const data = await loadBriefBySlug(slug)
  if (!data) return { title: "Link not found", robots: { index: false, follow: false } }
  // The WhatsApp preview the client sees when the agent sends the link.
  return createPageMetadata({
    title: `Find your property in Dubai with ${data.agent.name}`,
    description: `Answer four quick questions and ${data.agent.firstName} will send you options that fit.`,
    pathname: `/buy-with/${slug}`,
    robots: { index: false, follow: false },
  })
}

export default async function BuyerLinkPage({ params }: Props) {
  const { slug } = await params
  const data = await loadBriefBySlug(slug)
  if (!data) notFound()
  const { link, agent } = data

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <BriefMasthead
        agent={agent}
        eyebrow="Your property brief"
        title={`Tell ${agent.firstName} what you’re`}
        gold="looking for."
        intro={`Four quick steps, about two minutes. ${agent.firstName} will come back to you on WhatsApp with options that fit.`}
      />

      <div className="relative mx-auto -mt-14 max-w-3xl px-4 pb-16 sm:px-6">
        {!link.is_active ? (
          <div className="border border-[#e8eaed] bg-white p-8 text-center">
            <p className="font-['Outfit'] text-2xl font-bold text-[#0d1117]">This page is no longer available</p>
            <p className="mt-2 text-[15px] leading-relaxed text-[#6b7280]">Send {agent.firstName} a message directly instead.</p>
          </div>
        ) : (
          <BuyerLeadForm code={link.code} agentFirstName={agent.firstName} agentWhatsapp={agent.whatsapp || null} />
        )}
        <p className="mt-5 flex items-center justify-center gap-2 text-center text-[12.5px] text-[#6b7280]">
          <ShieldCheck className="h-4 w-4 text-[#b8913f]" />
          Your answers go only to {agent.name} at FHI Global.
        </p>
      </div>
    </div>
  )
}
