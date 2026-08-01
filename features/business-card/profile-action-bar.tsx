"use client"

import { useState } from "react"
import { Check, Loader2, Phone, Save, Share2 } from "lucide-react"
import { readableOn, verticalGradient, type ProfileTheme } from "@/lib/profile-themes"
import { buildVCard, downloadVCard } from "./vcard"

/**
 * The Save Card · Share · Contact bar that sits under the contact card.
 *
 * One solid accent-coloured strip split into equal segments by hairline rules —
 * the segments are siblings in a flex row rather than three separate buttons, so
 * the bar reads as a single control the way the reference does.
 *
 * It wears the theme rather than a fixed red: the accent is the agent's own
 * choice, the label ink is derived from it so a pale accent still reads, and the
 * radius follows the same slider the pills above use. Only the shape is fixed.
 */

type Props = {
  t: ProfileTheme
  fullname: string
  roleLabel: string
  email: string
  phoneE164: string
  phoneDisplay: string
  tagline: string
  avatarUrl: string | null
  selfUrl: string
  /** Opens the shared QR + share-targets dialog owned by the page. */
  onShare: () => void
  delay: number
}

export function ProfileActionBar({
  t,
  fullname,
  roleLabel,
  email,
  phoneE164,
  phoneDisplay,
  tagline,
  avatarUrl,
  selfUrl,
  onShare,
  delay,
}: Props) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // By measured contrast, not a luminance cutoff — see readableOn. Small bold
  // caps on the accent is the one place on this page that needs the stricter pick.
  const ink = readableOn(t.accent)

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const vcard = await buildVCard({
        fullname,
        title: roleLabel,
        email,
        phoneE164,
        url: selfUrl,
        tagline,
        avatarUrl,
      })
      downloadVCard(vcard, fullname)
      setSaved(true)
      setTimeout(() => setSaved(false), 2200)
    } finally {
      setSaving(false)
    }
  }

  // Contact dials when there's a number and composes when there isn't. With
  // neither, the segment would be a dead end, so it doesn't render.
  const contactHref = phoneE164 ? `tel:${phoneE164}` : email ? `mailto:${email}` : ""

  const segments: Array<{
    key: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    href?: string
    onClick?: () => void
    busy?: boolean
    /** Spells out the destination, which "Contact" on its own doesn't. */
    title?: string
  }> = [
    {
      key: "save",
      label: saved ? "Saved" : "Save Card",
      icon: saved ? Check : saving ? Loader2 : Save,
      onClick: () => void handleSave(),
      busy: saving,
      title: `Save ${fullname} to your contacts`,
    },
    // Opens the QR dialog, which carries the code and the per-network share
    // buttons. Unconditional: gating it on selfUrl (empty until hydration) would
    // render two segments on the server and three in the browser, and the bar
    // would visibly re-flow a moment after load.
    {
      key: "share",
      label: "Share",
      icon: Share2,
      onClick: onShare,
      title: "Share this profile",
    },
    ...(contactHref
      ? [{
          key: "contact",
          label: phoneE164 ? "Contact" : "Email",
          icon: Phone,
          href: contactHref,
          title: phoneE164 ? `Call ${phoneDisplay}` : `Email ${email}`,
        }]
      : []),
  ]

  const inner = (label: string, Icon: React.ComponentType<{ className?: string }>, busy?: boolean) => (
    <>
      <Icon className={`w-4 h-4 shrink-0 ${busy ? "animate-spin" : ""}`} />
      <span className="font-[family-name:var(--font-outfit)] font-bold uppercase tracking-wide text-[13px] truncate">
        {label}
      </span>
    </>
  )

  const segCls =
    "flex-1 min-w-0 flex items-center justify-center gap-2 px-2 py-3 hover:bg-black/10 active:bg-black/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset transition-colors duration-150"

  return (
    <div
      className="animate-hero-item mt-4 w-full flex overflow-hidden shadow-[0_8px_24px_-10px_rgba(0,0,0,0.5)]"
      style={{
        animationDelay: `${delay}ms`,
        // Matches the pills and the contact card: flat accent, or the same
        // original-to-slightly-darker ramp when the theme's gradient is on.
        background: t.gradient ? verticalGradient(t.accent) : t.accent,
        borderRadius: t.pillRadius,
        color: ink,
        ["--tw-ring-color" as string]: ink,
      }}
    >
      {segments.map((s, i) => (
        <div key={s.key} className="flex-1 min-w-0 flex items-stretch">
          {/* Hairline between segments, drawn from the label ink so it stays
              visible on a light accent as well as a dark one. */}
          {i > 0 && <span className="w-px shrink-0 my-2 opacity-30" style={{ background: ink }} aria-hidden />}
          {s.href ? (
            <a href={s.href} title={s.title} aria-label={s.title} className={segCls}>
              {inner(s.label, s.icon)}
            </a>
          ) : (
            <button
              type="button"
              onClick={s.onClick}
              disabled={s.busy}
              title={s.title}
              aria-label={s.title}
              className={segCls}
            >
              {inner(s.label, s.icon, s.busy)}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
