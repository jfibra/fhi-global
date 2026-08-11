// Shared "Contact Me" channel list — used by the About section and the site
// header dropdown so both stay identical: WhatsApp (prefilled message) and
// Email/Call always; Instagram DM + Messenger only when the profile URLs are
// set (their handle becomes an ig.me / m.me chat link).

import type { ComponentType, SVGProps } from "react"
import { Instagram, Mail, Phone } from "lucide-react"
import { DEFAULT_WA_MESSAGE, type WebsiteData } from "../_data"
import { MessengerIcon, WhatsAppIcon } from "./ui"

export type ContactChannel = {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
  href: string
}

function handleFrom(url: string): string | null {
  try {
    const u = new URL(url)
    const seg = u.pathname.split("/").filter(Boolean)
    if (seg[0] === "profile.php") return u.searchParams.get("id")
    return seg[0] || null
  } catch {
    return null
  }
}

export function buildContactChannels(data: WebsiteData): ContactChannel[] {
  const { agent, about } = data
  const fbHandle = about.socials.facebook ? handleFrom(about.socials.facebook) : null
  const igHandle = about.socials.instagram ? handleFrom(about.socials.instagram) : null
  return [
    {
      icon: WhatsAppIcon,
      label: "WhatsApp",
      href: `https://wa.me/${agent.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(DEFAULT_WA_MESSAGE)}`,
    },
    ...(igHandle ? [{ icon: Instagram, label: "Instagram", href: `https://ig.me/m/${igHandle}` }] : []),
    { icon: Mail, label: "Email", href: `mailto:${agent.email}` },
    // m.me: on MOBILE (most visitors) it opens the Messenger app straight
    // into the chat. Desktop web hits Meta's E2EE "Continue" flow, which
    // drops the recipient for personal profiles with no prior thread — a
    // Meta-side quirk no URL form avoids; only Pages get the clean web flow.
    ...(fbHandle ? [{ icon: MessengerIcon, label: "Messenger", href: `https://m.me/${fbHandle}` }] : []),
    { icon: Phone, label: "Call", href: `tel:${agent.phone}` },
  ]
}
