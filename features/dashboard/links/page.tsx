"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Link as LinkIcon } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { roleInList } from "@/lib/app-roles"
import { getDashboardRouteByRole } from "@/lib/auth"
import { fetchMyBuyerLink } from "@/lib/buyer-link-service"
import type { BuyerLink } from "@/lib/buyer-links"
import {
  buyersLinkShare,
  buyersLinkUrl,
  partnerInviteShare,
  partnerInviteUrl,
  sellersLinkShare,
  sellersLinkUrl,
  teamInviteShare,
  teamInviteUrl,
} from "@/lib/share-links"
import { ShareLinkCard } from "./share-link-card"

/**
 * Links — every link an agent shares, on one page (boss via Juliecor,
 * 2026-10-22): the team invite and the Global Partners invite (the Invite
 * page's two QR cards) and the Buyers Link and Sellers Link (Agent Resource →
 * Buyers Link). The same links, built in lib/share-links.ts; recruits and
 * briefs still live on those pages, linked from here. Agents and team leaders
 * ("links" in SUB_PATH_ROLES).
 */

const LINK_ROLES = ["agent", "team_leader"] as const

export default function LinksPage() {
  const { user, role } = useAuth()
  const allowed = useRequireAllowed(roleInList(role, LINK_ROLES))
  const userId = user?.id ?? null
  const base = getDashboardRouteByRole(role)

  const [origin, setOrigin] = useState("")
  const [link, setLink] = useState<BuyerLink | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // The Buyers / Sellers link is minted on first use (POST /api/buyer-links), as on the Buyers Link page.
  useEffect(() => {
    if (!allowed || !userId) return
    let live = true
    void fetchMyBuyerLink().then((mine) => {
      if (!live) return
      setOrigin(window.location.origin)
      setLink(mine.link)
      setLinkError(mine.error)
    })
    return () => {
      live = false
    }
  }, [allowed, userId, reloadKey])

  if (!allowed) return null

  const teamUrl = origin && userId ? teamInviteUrl(origin, userId) : ""
  const partnerUrl = origin && userId ? partnerInviteUrl(origin, userId) : ""
  const buyersUrl = origin && link ? buyersLinkUrl(origin, link) : ""
  const sellersUrl = origin && link ? sellersLinkUrl(origin, link) : ""
  const linkProblem = linkError ? `Couldn't load your link. ${linkError}` : link && !link.is_active ? "This link is switched off, so clients can't send a brief. Ask an admin to turn it back on." : null
  const retry = () => {
    setLinkError(null)
    setReloadKey((k) => k + 1)
  }

  const section = (title: string, text: string, more: { href: string; label: string }) => (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div>
        <h2 className="font-['Outfit'] text-[17px] font-bold text-[#0d1117]">{title}</h2>
        <p className="text-[13px] text-[#6b7280]">{text}</p>
      </div>
      <Link href={more.href} className="inline-flex items-center gap-1 text-[12.5px] font-bold text-[#001f3f] hover:text-[#b8913f]">
        {more.label} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )

  return (
    <div className="w-full max-w-5xl space-y-8">
      <div>
        <h1 className="flex items-center gap-2 font-['Outfit'] text-2xl font-bold text-[#0d1117]">
          <LinkIcon className="h-6 w-6 text-[#001f3f]" />
          Links
        </h1>
        <p className="mt-1 text-sm text-[#6b7280]">Your four links in one place — send them on WhatsApp, copy them, or let people scan the QR.</p>
      </div>

      <section>
        {section("Grow your team", "People who join through these links become your recruits.", { href: `${base}/invite`, label: "See your recruits" })}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ShareLinkCard
            title="Team invite"
            qrTitle="Scan to join FHI Global"
            note="For people joining your real estate team — they appear as your recruits."
            url={teamUrl}
            share={teamInviteShare}
            qrFile="fhi-invite-qr.png"
          />
          <ShareLinkCard
            title="Global Partners invite"
            qrTitle="Scan to become an FHI Global Partner"
            note="For agents outside the UAE. They register under your network with the full FHI agent toolkit."
            url={partnerUrl}
            share={partnerInviteShare}
            qrFile="fhi-global-partners-invite-qr.png"
            dark
            logo={{ src: "/logos/global_partner.png", alt: "Filipino Homes Global Partners" }}
          />
        </div>
      </section>

      <section>
        {section("Win clients", "Clients answer a few quick questions and their brief comes straight to you.", { href: `${base}/agent-resource/buyers-link`, label: "See your briefs" })}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ShareLinkCard
            title="Buyers Link"
            qrTitle="Scan to send your brief"
            note="For buyers — their brief lands in My buyers, graded so you know who to call first."
            url={linkProblem ? "" : buyersUrl}
            share={buyersLinkShare}
            qrFile="fhi-buyers-link-qr.png"
            problem={linkProblem}
            onRetry={linkError ? retry : undefined}
          />
          <ShareLinkCard
            title="Sellers Link"
            qrTitle="Scan to sell your property"
            note="For owners who want to sell in Dubai — their property details land in My sellers."
            url={linkProblem ? "" : sellersUrl}
            share={sellersLinkShare}
            qrFile="fhi-sellers-link-qr.png"
            dark
            problem={linkProblem}
            onRetry={linkError ? retry : undefined}
          />
        </div>
      </section>
    </div>
  )
}
