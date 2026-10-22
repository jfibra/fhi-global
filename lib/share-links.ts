import { buyerLinkPath, sellerLinkPath } from "@/lib/buyer-links"

/**
 * The four links an agent shares, in one place (boss via Juliecor,
 * 2026-10-22): the team invite and the Global Partners invite (Invite page),
 * the Buyers Link and the Sellers Link (Agent Resource → Buyers Link). The
 * Invite page, the Buyers Link page and the Links page all build them here,
 * so the addresses and the WhatsApp wording never drift apart.
 */

/** Joins FHI under the agent — they appear as the agent's recruit. */
export const teamInviteUrl = (origin: string, userId: string) => `${origin}/register?ref=${userId}`
export const teamInviteShare = (url: string) => `Join me on FHI Global — Dubai's premier real estate portal. Create your account here: ${url}`

/** The same referral, a different landing: agents abroad register as Global Partners. */
export const partnerInviteUrl = (origin: string, userId: string) => `${origin}/register?type=global-partner&ref=${userId}`
export const partnerInviteShare = (url: string) =>
  `Become an FHI Global Partner — earn with Dubai real estate from anywhere. Register under my network here: ${url}`

/** /buy-with/<name> (older links: /b/<code>) — a buyer's four-step brief. */
export const buyersLinkUrl = (origin: string, link: { slug: string | null; code: string }) =>
  `${origin}${link.slug ? buyerLinkPath(link.slug) : `/b/${link.code}`}`
export const buyersLinkShare = (url: string) =>
  `Hi! To help me find the right property for you in Dubai, please answer a few quick questions here. It takes about two minutes: ${url}`

/** /sell-with/<name> (older links: /s/<code>) — an owner's property details. */
export const sellersLinkUrl = (origin: string, link: { slug: string | null; code: string }) =>
  `${origin}${link.slug ? sellerLinkPath(link.slug) : `/s/${link.code}`}`
export const sellersLinkShare = (url: string) =>
  `Hi! Thinking of selling your property in Dubai? Tell me about it here and I'll come back to you on price and next steps. It takes about two minutes: ${url}`
