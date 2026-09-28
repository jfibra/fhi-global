import Image from "next/image"
import { MessageCircle, Phone } from "lucide-react"
import type { BriefAgent } from "@/lib/buyer-link-page"

/**
 * The navy masthead of a Buyers Link page (/b/<code>, /s/<code>): the agent
 * who sent it, with their WhatsApp and phone, then what the page is for. The
 * form card overlaps its lower edge.
 */
export function BriefMasthead({
  agent,
  eyebrow,
  title,
  gold,
  intro,
}: {
  agent: BriefAgent
  eyebrow: string
  /** The heading's first part; `gold` finishes it in gold. */
  title: string
  gold: string
  intro: string
}) {
  return (
    <section className="relative overflow-hidden bg-[#06182e] text-white">
      <div className="absolute inset-0" aria-hidden="true">
        <Image src="/background/dubai.webp" alt="" fill priority sizes="100vw" className="object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#06182e]/95 via-[#06182e]/80 to-[#06182e]/45" />
      </div>
      <div className="relative mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6 md:pt-14">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <span className="flex items-center gap-3">
            {agent.photo ? (
              <Image
                src={agent.photo}
                alt={agent.name}
                width={64}
                height={64}
                className="h-16 w-16 rounded-full border-2 border-[#d6b357] object-cover"
              />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#d6b357] bg-[#0b2a4d] text-lg font-bold text-[#d6b357]">
                {agent.initials}
              </span>
            )}
            <span>
              <span className="block font-['Outfit'] text-lg font-bold text-white">{agent.name}</span>
              <span className="block text-sm text-white/65">Property Advisor · FHI Global</span>
            </span>
          </span>
          <span className="flex flex-wrap gap-2">
            {agent.whatsapp && (
              <a
                href={`https://wa.me/${agent.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#25d366] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1fb857]"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp {agent.firstName}
              </a>
            )}
            {agent.phone && (
              <a
                href={`tel:+${agent.phone}`}
                className="inline-flex items-center gap-2 border border-white/25 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                <Phone className="h-4 w-4" /> Call
              </a>
            )}
          </span>
        </div>

        <p className="mt-9 inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.26em] text-[#f0d89b]">
          <span className="h-px w-10 bg-[#d6b357]" aria-hidden="true" />
          {eyebrow}
        </p>
        <h1 className="mt-3 font-['Outfit'] text-[34px] font-bold leading-[1.06] tracking-tight sm:text-[46px]">
          {title} <span className="text-[#e3c06c]">{gold}</span>
        </h1>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-white/80">{intro}</p>
      </div>
    </section>
  )
}
