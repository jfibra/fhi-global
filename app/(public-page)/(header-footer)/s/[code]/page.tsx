import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { createPageMetadata } from "@/lib/seo"
import { loadBriefLink } from "@/lib/buyer-link-page"
import { BriefMasthead } from "@/components/public/brief-masthead"
import { SellerLeadForm } from "./seller-lead-form"

// An agent's Sellers Link (migration 062): the same code as their Buyers
// Link (/b/<code>), for owners who want to sell a Dubai property through
// that agent. A four-step brief about the property lands on the agent's
// Buyers Link page under Sellers. Private (never indexed) and always fresh.

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ code: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params
  const data = await loadBriefLink(code)
  if (!data) return { title: "Link not found", robots: { index: false, follow: false } }
  // The WhatsApp preview the owner sees when the agent sends the link.
  return createPageMetadata({
    title: `Sell your property in Dubai with ${data.agent.name}`,
    description: `Tell ${data.agent.firstName} about your property in four quick steps.`,
    pathname: `/s/${code}`,
    robots: { index: false, follow: false },
  })
}

export default async function SellerLinkPage({ params }: Props) {
  const { code } = await params
  const data = await loadBriefLink(code)
  if (!data) notFound()
  const { link, agent } = data

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <BriefMasthead
        agent={agent}
        eyebrow="Selling in Dubai"
        title={`Tell ${agent.firstName} about the property you’re`}
        gold="selling."
        intro={`Four quick steps, about two minutes. ${agent.firstName} will come back to you on WhatsApp to talk price and next steps.`}
      />

      <div className="relative mx-auto -mt-14 max-w-3xl px-4 pb-16 sm:px-6">
        {!link.is_active ? (
          <div className="border border-[#e8eaed] bg-white p-8 text-center">
            <p className="font-['Outfit'] text-2xl font-bold text-[#0d1117]">This page is no longer available</p>
            <p className="mt-2 text-[15px] leading-relaxed text-[#6b7280]">Send {agent.firstName} a message directly instead.</p>
          </div>
        ) : (
          <SellerLeadForm code={link.code} agentFirstName={agent.firstName} agentWhatsapp={agent.whatsapp || null} />
        )}
        <p className="mt-5 flex items-center justify-center gap-2 text-center text-[12.5px] text-[#6b7280]">
          <ShieldCheck className="h-4 w-4 text-[#b8913f]" />
          Your answers go only to {agent.name} at FHI Global.
        </p>
      </div>
    </div>
  )
}
