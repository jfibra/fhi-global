"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"
import { QRCodeCanvas } from "qrcode.react"
import {
  ArrowLeft, Building2, Check, ClipboardList, Download, Globe, Link2, Star, X,
} from "lucide-react"
import { type ProfileTheme } from "@/lib/profile-themes"
import { SITE_URL } from "@/lib/seo"
import { profileOgCardVersion, type ProfileOgCard } from "@/lib/profile-og-card"
import { ContactCard } from "./contact-card"
import { ProfileActionBar } from "./profile-action-bar"
import { SHARE_TARGETS } from "./share-targets"
import {
  DEFAULT_BUTTON_URL, SOCIAL_PLATFORMS, titleCaseName,
  type CustomLink, type FeaturedItem, type FixedButtonKey, type SocialLinks,
} from "@/lib/public-profile"
import { SOCIAL_ICONS, WhatsApp } from "./social-icons"
import { dialFromValue, stripLocal } from "./card-render"

/**
 * Public, unauthenticated profile page for one person — the destination of the
 * dashboard's "Share your business profile link" panel.
 *
 * Every row here is a real action built from real profile data — a pill or a
 * social icon only renders when the value behind it exists, so nothing on the
 * page can be tapped into a dead end.
 */

const DISPLAY = "font-[family-name:var(--font-outfit)]"

/** QR is drawn at this size and scaled down by CSS — sharp on any screen. */
const QR_EXPORT_PX = 560
/** The enlarged canvas in the modal, which is also what "Download" saves. */
const QR_MODAL_ID = "fhi-profile-qr-large"

export type PublicProfileData = {
  id: string
  fullname: string
  initials: string
  roleLabel: string
  email: string
  countryCode: string
  phoneNumber: string
  avatarUrl: string | null
  tagline: string
  /** Pinned items, in the order the agent chose. Each gets its own full view. */
  listings: FeaturedItem[]
  projects: FeaturedItem[]
  links: CustomLink[]
  /** Wording for the buttons whose destination the profile owns. */
  buttonLabels: Record<FixedButtonKey, string>
  /** Resolved look — see lib/profile-themes.ts. */
  theme: ProfileTheme
  /** Link-preview card — used by generateMetadata, not rendered on the page. */
  ogCard: ProfileOgCard
  socials: SocialLinks
}

/**
 * This page's canonical public URL — what the QR encodes and what every share
 * button sends.
 *
 * Built from SITE_URL rather than window.location.origin, which is what it used
 * to read. Two reasons. The obvious one: a QR or a shared link pointing at
 * localhost:8713 (or a preview deploy) is useless to whoever receives it, and
 * this is the same origin the page's own og:url already advertises. The
 * load-bearing one: Facebook and LinkedIn do not build a post from the
 * parameters you hand them — they fetch the URL server-side and read its OG
 * tags — so a non-public origin gives their crawlers nothing and the composer
 * comes up empty.
 *
 * It also means the URL is known during SSR, so the QR and the share hrefs
 * render on the server instead of appearing a beat after hydration.
 */
function profileUrl(id: string): string {
  return `${SITE_URL}/business-card/${id}`
}

/** "www.example.com/x" → "example.com", for the subtext under a custom button. */
function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "")
  } catch {
    return ""
  }
}

function ActionPill({
  href,
  onClick,
  icon: Icon,
  label,
  hint,
  delay,
  t,
  external = false,
}: {
  /** A destination, or an onClick for the in-page reveals. Exactly one. */
  href?: string
  onClick?: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
  hint?: string
  delay: number
  t: ProfileTheme
  /** Agent-supplied destination: opens in a new tab and passes no referrer or
   *  ranking signal, since we don't vouch for where it goes. */
  external?: boolean
}) {
  // Lucide sizes off the svg box, so the glyph scales with its tile.
  const iconGlyph = Math.max(12, Math.round((t.tileSize || 20) * 0.45))

  const cls =
    "animate-hero-item w-full flex items-center gap-3 px-3 shadow-[0_6px_20px_-8px_rgba(0,0,0,0.45)] hover:-translate-y-0.5 hover:shadow-[0_10px_26px_-8px_rgba(0,0,0,0.5)] focus-visible:outline-none focus-visible:ring-4 transition-all duration-200"
  const style = {
    animationDelay: `${delay}ms`,
    background: t.pillBg,
    borderRadius: t.pillRadius,
    border: t.pillBorder,
    paddingTop: t.pillPadY,
    paddingBottom: t.pillPadY,
    // Tailwind can't express a runtime ring colour; the CSS variable it reads can.
    ["--tw-ring-color" as string]: `${t.accent}99`,
  } as React.CSSProperties

  const inner = (
    <>
      {/* The icon is skipped entirely under the None treatment, and a tile of 0
          keeps the glyph but drops the chip behind it. */}
      {t.showIcon && (
        <span
          className="shrink-0 flex items-center justify-center"
          style={{
            width: t.tileSize || 20,
            height: t.tileSize || 20,
            background: t.tileSize ? t.tile : "transparent",
            border: t.tileSize ? t.tileBorder : "none",
            borderRadius: t.tileRadius,
            color: t.tileSize ? t.tileInk : t.pillInk,
          }}
        >
          <span className="block" style={{ width: iconGlyph, height: iconGlyph }}>
            <Icon className="w-full h-full" />
          </span>
        </span>
      )}
      <span className="flex-1 text-center">
        <span
          className={`${DISPLAY} block font-bold`}
          style={{ color: t.pillInk, fontSize: t.pillFont }}
        >
          {label}
        </span>
        {hint && (
          <span className="block text-[11px] mt-0.5 truncate" style={{ color: t.pillSubInk }}>
            {hint}
          </span>
        )}
      </span>
      {/* Balances the icon tile so the label stays optically centred. With no
          icon there is nothing to balance, and the label centres on its own. */}
      {t.showIcon && (
        <span className="shrink-0" style={{ width: t.tileSize || 20 }} aria-hidden />
      )}
    </>
  )

  if (href) {
    return (
      <a
        href={href}
        className={cls}
        style={style}
        {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow ugc" } : {})}
      >
        {inner}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cls} style={style}>
      {inner}
    </button>
  )
}

/**
 * A pinned collection, filling the column in place of the profile.
 *
 * Deliberately a view swap rather than an expander: a handful of properties with
 * covers, prices and their own back affordance is a page, and stacking it under
 * the buttons buried the last one three screens down.
 */
function CollectionView({
  title,
  items,
  onBack,
  t,
}: {
  title: string
  items: FeaturedItem[]
  onBack: () => void
  t: ProfileTheme
}) {
  return (
    <div className="w-full">
      <button
        type="button"
        onClick={onBack}
        className="animate-hero-item inline-flex items-center gap-1.5 text-sm font-semibold hover:opacity-100 focus-visible:outline-none rounded-lg px-1 transition-opacity opacity-80"
        style={{ animationDelay: "0ms", color: t.ink }}
      >
        <ArrowLeft className="w-4 h-4" /> Back to profile
      </button>

      <h2
        className={`${DISPLAY} animate-hero-item mt-4 text-[22px] font-bold`}
        style={{ animationDelay: "70ms", color: t.ink }}
      >
        {title}
      </h2>
      <p
        className="animate-hero-item text-xs mt-0.5"
        style={{ animationDelay: "70ms", color: t.inkMuted }}
      >
        {items.length} handpicked
      </p>

      <div className="mt-5 space-y-4">
        {items.map((item, i) => (
          <a
            key={`${item.kind}-${i}`}
            href={item.href}
            className="animate-hero-item block overflow-hidden shadow-[0_8px_24px_-10px_rgba(0,0,0,0.55)] hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-10px_rgba(0,0,0,0.6)] focus-visible:outline-none transition-all duration-200"
            style={{
              animationDelay: `${140 + i * 70}ms`,
              background: t.pillBg,
              // Cards echo the button shape, but never fully round — a pill-shaped
              // photo card reads as a mistake.
              borderRadius: t.pillRadius === "9999px" ? "18px" : t.pillRadius,
              border: t.pillBorder,
            }}
          >
            <span className="relative block w-full bg-[#eef1f5]" style={{ aspectRatio: "16 / 10" }}>
              {item.image ? (
                // Agent and developer media live on several hosts; a plain <img>
                // keeps this page off next/image's allowlist entirely.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-[#b8bfc9]">
                  <Building2 className="w-7 h-7" />
                </span>
              )}
            </span>
            <span className="block p-3.5">
              <span className={`${DISPLAY} block text-[15px] font-bold leading-snug`} style={{ color: t.pillInk }}>
                {item.title}
              </span>
              {item.subtitle && (
                <span className="block text-[12px] capitalize mt-0.5" style={{ color: t.pillSubInk }}>
                  {item.subtitle}
                </span>
              )}
              <span className="block text-[14px] font-bold tabular-nums mt-1.5" style={{ color: t.pillInk }}>
                {item.price}
              </span>
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}

/**
 * `embedded` renders the same page inside a fixed-height container (the phone
 * frame on the Digital Business Card) instead of owning the viewport. The CSP
 * sets `frame-src 'none'`, so an iframe preview isn't an option — and mounting
 * the real component is better anyway: it reflects unsaved edits instantly.
 */
export function PublicProfile({
  data,
  embedded = false,
}: {
  data: PublicProfileData
  embedded?: boolean
}) {
  const local = stripLocal(data.phoneNumber)
  const dial = dialFromValue(data.countryCode)
  const phoneE164 = local ? `${dial}${local}` : ""
  const phoneDisplay = local ? `${dial} ${local}` : ""
  const waNumber = phoneE164.replace(/\D/g, "")

  const [qrOpen, setQrOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  /** Which collection has taken over the column, if any. */
  const [view, setView] = useState<"profile" | "listings" | "projects">("profile")

  const t = data.theme
  // Display only — the stored name is left as typed.
  const displayName = titleCaseName(data.fullname)

  const selfUrl = profileUrl(data.id)
  /**
   * The URL the share buttons and Copy send, stamped with the saved card's
   * version. Facebook caches its link preview PER EXACT URL — sharing the bare
   * URL after a redesign serves the old cached card for weeks unless someone
   * runs the Sharing Debugger. A link that changes with every save is always a
   * first-time URL to the crawler, so the new card shows up on its own. The QR,
   * the visible URL text and the vCard keep the clean address: they lead people
   * to a browser, which has no scrape cache to bust.
   */
  const shareUrl = `${selfUrl}?v=${profileOgCardVersion(data.ogCard)}`

  // Escape backs out of a collection view, matching the QR dialog.
  useEffect(() => {
    if (view === "profile") return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setView("profile") }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [view])

  // Escape closes the enlarged QR. Bound only while it is open so the page has
  // no stray listener the rest of the time.
  useEffect(() => {
    if (!qrOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setQrOpen(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [qrOpen])

  // Move focus into the dialog on open so a keyboard user isn't left behind it.
  const qrCloseRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (qrOpen) qrCloseRef.current?.focus()
  }, [qrOpen])

  // The message that travels with the link on the networks that take one.
  const shareText = `${displayName} — ${data.roleLabel} at FHI Global`

  // Message AND link, because the two networks that use this need different
  // halves: Facebook already attaches the link and wants the caption, Instagram
  // takes neither and wants the URL. One string covers both pastes.
  const copyLink = useCallback(() => {
    if (!selfUrl) return
    void navigator.clipboard.writeText(`${shareText} ${shareUrl}`).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2600)
      },
      () => {
        /* clipboard blocked — the URL above is selectable, which is the fallback */
      },
    )
  }, [selfUrl, shareUrl, shareText])

  const downloadQr = useCallback(() => {
    const canvas = document.getElementById(QR_MODAL_ID) as HTMLCanvasElement | null
    if (!canvas) return
    const a = document.createElement("a")
    a.href = canvas.toDataURL("image/png")
    a.download = `${data.fullname.replace(/\s+/g, "-") || "profile"}-qr.png`
    a.click()
  }, [data.fullname])

  // The icon row: WhatsApp first (it comes from the phone number, not the social
  // fields), then only the platforms this person actually filled in — an icon
  // that goes nowhere makes the whole row look broken.
  const socialEntries: Array<{
    id: string
    label: string
    href: string
    Icon: React.ComponentType<{ className?: string }>
  }> = [
    ...(waNumber
      ? [{ id: "whatsapp", label: "Message on WhatsApp", href: `https://wa.me/${waNumber}`, Icon: WhatsApp }]
      : []),
    ...SOCIAL_PLATFORMS.flatMap((p) => {
      const href = data.socials[p.id]
      return href ? [{ id: p.id, label: p.label, href, Icon: SOCIAL_ICONS[p.id] }] : []
    }),
  ]

  // Entrance stagger. The header runs on fixed slots; the action pills continue
  // the same 70ms cadence from their own index, so a missing phone number just
  // shortens the sequence instead of leaving a gap in it.
  const step = (slot: number) => slot * 70
  const HEADER_SLOTS = 5

  // Featured collections first, then the agent's own buttons — every row here is
  // theirs to set. Dialling and composing are left to the phone/email in the
  // contact block and the WhatsApp icon, so no action row duplicates them.
  const actions: Array<{
    key: string
    href?: string
    onClick?: () => void
    icon: React.ComponentType<{ className?: string }>
    label: string
    hint?: string
    external?: boolean
  }> = [
    ...(data.listings.length > 0
      ? [{
          key: "featured-listings",
          onClick: () => setView("listings"),
          icon: ClipboardList,
          label: data.buttonLabels.featuredListings,
          hint: `${data.listings.length} propert${data.listings.length === 1 ? "y" : "ies"}`,
        }]
      : []),
    ...(data.projects.length > 0
      ? [{
          key: "featured-projects",
          onClick: () => setView("projects"),
          icon: Star,
          label: data.buttonLabels.featuredProjects,
          hint: `${data.projects.length} project${data.projects.length === 1 ? "" : "s"}`,
        }]
      : []),
    ...data.links.map((link, i) => ({
      key: `link-${i}`,
      href: link.url,
      icon: Link2,
      label: link.label,
      // Naming the destination is the honest thing to do on a page of
      // agent-supplied outbound links.
      hint: hostOf(link.url),
      external: true,
    })),
    {
      key: "default",
      href: DEFAULT_BUTTON_URL,
      icon: Globe,
      label: data.buttonLabels.default,
    },
  ]

  return (
    <main className={`relative overflow-hidden ${embedded ? "min-h-full" : "min-h-screen"}`}>
      {/* Backdrop — photo only when the theme has one; the scrim always paints. */}
      {t.image && (
        <Image
          src={t.image}
          alt=""
          fill
          priority
          // The embedded preview is a ~366px phone frame, not the viewport.
          sizes={embedded ? "400px" : "100vw"}
          className="object-cover object-center"
        />
      )}
      <div className="absolute inset-0" style={{ background: t.scrim }} />

      {/* Content column — sized for a phone, centred on anything wider. */}
      <div
        className={`relative mx-auto w-full max-w-[430px] px-6 flex flex-col items-center ${
          embedded ? "pt-10 pb-8" : "pt-14 pb-10"
        }`}
      >

        {view !== "profile" ? (
          <CollectionView
            title={view === "listings" ? data.buttonLabels.featuredListings : data.buttonLabels.featuredProjects}
            items={view === "listings" ? data.listings : data.projects}
            onBack={() => setView("profile")}
            t={t}
          />
        ) : (
          <>
          {/* Avatar — same gold ring the printed card uses, so the page and the
              card read as one identity. */}
          <div className="animate-hero-item" style={{ animationDelay: `${step(0)}ms` }}>
            <div
              className="relative w-[112px] h-[112px] rounded-full p-[3px] shadow-[0_10px_30px_-8px_rgba(0,0,0,0.6)]"
              style={{ background: t.accent }}
            >
              <div className="w-full h-full rounded-full overflow-hidden ring-2 ring-white/25 bg-[#0a3a66] flex items-center justify-center">
                {data.avatarUrl ? (
                  // Proxied through our own origin; a plain <img> keeps this page
                  // independent of next/image's remote-pattern allowlist.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.avatarUrl}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className={`${DISPLAY} text-3xl font-bold`} style={{ color: t.accent }}>{data.initials}</span>
                )}
              </div>
            </div>
          </div>

          {/* Name */}
          <h1
            className={`${DISPLAY} animate-hero-item mt-5 text-center text-[26px] leading-tight font-bold`}
            style={{ animationDelay: `${step(1)}ms`, color: t.ink }}
          >
            {displayName}
          </h1>

          {/* Tagline — the person's own words, in their own line. */}
          {data.tagline && (
            <p
              className="animate-hero-item mt-2.5 max-w-[21rem] text-center text-[15px] leading-snug text-balance"
              style={{ animationDelay: `${step(2)}ms`, color: t.ink, opacity: 0.85 }}
            >
              {data.tagline}
            </p>
          )}

          {/* Actions */}
          <div className="w-full mt-8 space-y-3">
            {actions.map((a, i) => (
              <ActionPill
                key={a.key}
                href={a.href}
                onClick={a.onClick}
                icon={a.icon}
                label={a.label}
                hint={a.hint}
                external={a.external}
                t={t}
                delay={step(HEADER_SLOTS + i)}
              />
            ))}
          </div>

          {/* Contact card — one of six designs, rendered by contact-card.tsx. */}
          <ContactCard
            design={t.contactLayout}
            t={t}
            phoneDisplay={phoneDisplay}
            email={data.email}
            selfUrl={selfUrl}
            onQrOpen={() => setQrOpen(true)}
            delay={step(HEADER_SLOTS + actions.length)}
          />

          {/* Save the contact, share the link, dial — the three things a visitor
              came here to do, directly under the details they act on. */}
          <ProfileActionBar
            t={t}
            fullname={displayName}
            roleLabel={data.roleLabel}
            email={data.email}
            phoneE164={phoneE164}
            phoneDisplay={phoneDisplay}
            tagline={data.tagline}
            avatarUrl={data.avatarUrl}
            selfUrl={selfUrl}
            onShare={() => setQrOpen(true)}
            delay={step(HEADER_SLOTS + actions.length + 1)}
          />

        {/* Socials — only the ones this person actually filled in. */}
          {socialEntries.length > 0 && (
            <div
              className="animate-hero-item mt-9 w-full flex flex-wrap items-center justify-center gap-3 sm:gap-4"
              style={{ animationDelay: `${step(HEADER_SLOTS + actions.length + 2)}ms` }}
            >
              {socialEntries.map(({ id, label, href, Icon }) => (
                <a
                  key={id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer me"
                  title={label}
                  aria-label={label}
                  className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full border hover:-translate-y-0.5 focus-visible:outline-none transition-all duration-200"
                  style={{ background: t.panel, borderColor: t.panelBorder, color: t.ink }}
                >
                  <Icon className="w-[18px] h-[18px]" />
                </a>
              ))}
            </div>
          )}
          </>
        )}

      </div>

      {/* Enlarged QR. Positioned `absolute` when embedded so the maker's phone
          frame contains it, `fixed` on the real page so it owns the viewport —
          a portal would escape the frame and look wrong in the preview. */}
      {qrOpen && (
        <div
          className={`${embedded ? "absolute" : "fixed"} inset-0 z-50 flex items-center justify-center p-6 bg-[#00101f]/80 backdrop-blur-sm`}
          onClick={() => setQrOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-dialog-title"
            onClick={(e) => e.stopPropagation()}
            className="animate-hero-item w-full max-w-[320px] rounded-3xl bg-white p-5 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.7)]"
            style={{ animationDelay: "0ms" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="qr-dialog-title" className={`${DISPLAY} text-base font-bold text-[#0d1117] truncate`}>
                  {displayName || "My profile"}
                </h2>
                <p className="text-xs text-[#6b7280] mt-0.5">Scan the code, or send it on</p>
              </div>
              <button
                ref={qrCloseRef}
                type="button"
                onClick={() => setQrOpen(false)}
                aria-label="Close"
                className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#001f3f]/20 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 flex justify-center">
              {selfUrl && (
                <QRCodeCanvas
                  id={QR_MODAL_ID}
                  value={selfUrl}
                  size={QR_EXPORT_PX}
                  level="M"
                  marginSize={2}
                  fgColor="#001f3f"
                  bgColor="#ffffff"
                  // Square and fluid. The display size MUST come through `style`,
                  // not className: qrcode.react builds `{height: size, width:
                  // size, ...style}` inline, and inline beats Tailwind — so an
                  // `h-auto` class loses while a `max-w-*` class still clamps the
                  // width, which is exactly how this ends up a tall rectangle.
                  // height:auto against the 560×560 canvas keeps it square.
                  style={{ width: "100%", height: "auto" }}
                  className="max-w-[248px]"
                />
              )}
            </div>

            <p className="mt-4 text-[11px] text-[#6b7280] break-all text-center select-all">{selfUrl}</p>

            {/* Send it on. Same round-icon row as the profile's own socials, but
                every icon here is an outbound share of THIS page rather than a
                link to the agent's account there. */}
            <div className="mt-4 pt-4 border-t border-[#eef0f3]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af] text-center">
                Share this profile
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
                {SHARE_TARGETS.map(({ id, label, Icon, href, copyFirst }) => (
                  <a
                    key={id}
                    href={selfUrl ? href(shareUrl, shareText) : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={label}
                    aria-label={label}
                    // Instagram takes no link parameter, so the link goes to the
                    // clipboard on the way out. The navigation still happens —
                    // this only rides along with it.
                    onClick={copyFirst ? copyLink : undefined}
                    className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-[#f3f5f8] text-[#0d1117] border border-[#e5e8ed] hover:-translate-y-0.5 hover:bg-[#e8ecf2] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#001f3f]/20 transition-all duration-200"
                  >
                    <Icon className="w-[17px] h-[17px]" />
                  </a>
                ))}
              </div>
              {copied && (
                <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#0f7b46]">
                  <Check className="w-3.5 h-3.5" /> Copied — paste it into the post
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={downloadQr}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] text-white text-sm font-bold hover:shadow-[0_8px_20px_-6px_rgba(0,31,63,0.6)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#d6b357]/60 transition-all"
            >
              <Download className="w-4 h-4" /> Download the code
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

