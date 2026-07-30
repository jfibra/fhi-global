"use client"

import Image from "next/image"
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { QRCodeCanvas } from "qrcode.react"
import {
  ChevronDown, CreditCard, Download, Mail, Phone, RefreshCcw, UserPlus, X,
} from "lucide-react"
import { SOCIAL_PLATFORMS, type SocialLinks } from "@/lib/public-profile"
import { SOCIAL_ICONS } from "./social-icons"
import {
  DISP_H, DISP_W, EXPORT_H, EXPORT_W,
  dialFromValue, isDesignId, renderCard, stripLocal,
  type CardData, type DesignId,
} from "./card-render"

/**
 * Public, unauthenticated profile page for one person — the destination of the
 * dashboard's "Share your business profile link" panel.
 *
 * Every row here is a real action built from real profile data — a pill or a
 * social icon only renders when the value behind it exists, so nothing on the
 * page can be tapped into a dead end.
 */

const DISPLAY = "font-[family-name:var(--font-outfit)]"

/** Dubai skyline already served for the public site's hero/about pages. */
const BACKDROP =
  "https://hefwmaoborpfuyhbguzv.supabase.co/storage/v1/object/public/Dubai%20Image%20Ratio%201920x1080/2.png"

const BRAND_WHITE = "/FHI_Branding_White.png"

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
  design: string
  avatarUrl: string | null
  tagline: string
  socials: SocialLinks
}

/**
 * This page's own absolute URL, for the QR code. Read via
 * useSyncExternalStore rather than an effect so there is no setState round trip
 * and the server render stays empty (matching markup on hydration).
 */
const noopSubscribe = () => () => {}
function useSelfUrl(id: string): string {
  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  )
  return origin ? `${origin}/business-card/${id}` : ""
}

/** RFC 6350 vCard. Escaping matters: an unescaped comma silently splits a field. */
function buildVCard(data: PublicProfileData, phoneE164: string): string {
  const esc = (v: string) => v.replace(/([\\,;])/g, "\\$1").replace(/\n/g, "\\n")
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${esc(data.fullname)}`,
    `N:${esc(data.fullname)};;;;`,
    "ORG:FHI Global",
    `TITLE:${esc(data.roleLabel)}`,
    ...(phoneE164 ? [`TEL;TYPE=CELL:${phoneE164}`] : []),
    ...(data.email ? [`EMAIL;TYPE=WORK:${data.email}`] : []),
    ...(data.tagline ? [`NOTE:${esc(data.tagline)}`] : []),
    "URL:https://fhiglobal.ae",
    "END:VCARD",
  ]
  return lines.join("\r\n")
}

function ActionPill({
  href,
  onClick,
  icon: Icon,
  label,
  hint,
  delay,
}: {
  href?: string
  onClick?: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
  hint?: string
  delay: number
}) {
  const inner = (
    <>
      <span className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] flex items-center justify-center">
        <Icon className="w-4 h-4 text-white" />
      </span>
      <span className="flex-1 text-center">
        <span className={`${DISPLAY} block text-[15px] font-bold text-[#0d1117]`}>{label}</span>
        {hint && <span className="block text-[11px] text-[#6b7280] mt-0.5 truncate">{hint}</span>}
      </span>
      {/* Balances the icon tile so the label stays optically centred. */}
      <span className="w-9 shrink-0" aria-hidden />
    </>
  )

  const cls =
    "animate-hero-item w-full flex items-center gap-3 px-3 py-3 rounded-full bg-white shadow-[0_6px_20px_-8px_rgba(0,0,0,0.45)] hover:-translate-y-0.5 hover:shadow-[0_10px_26px_-8px_rgba(0,0,0,0.5)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#d6b357]/60 transition-all duration-200"

  if (href) {
    return (
      <a href={href} className={cls} style={{ animationDelay: `${delay}ms` }}>
        {inner}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cls} style={{ animationDelay: `${delay}ms` }}>
      {inner}
    </button>
  )
}

/**
 * `embedded` renders the same page inside a fixed-height container (the phone
 * frame on the Public Profile Maker) instead of owning the viewport. The CSP
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
  const design: DesignId = isDesignId(data.design) ? data.design : "classic"
  const local = stripLocal(data.phoneNumber)
  const dial = dialFromValue(data.countryCode)
  const phoneE164 = local ? `${dial}${local}` : ""
  const phoneDisplay = local ? `${dial} ${local}` : ""
  const waNumber = phoneE164.replace(/\D/g, "")

  const [cardOpen, setCardOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [front, setFront] = useState("")
  const [back, setBack] = useState("")

  const cardData: CardData = useMemo(
    () => ({
      name: data.fullname,
      phoneDial: dial,
      phoneLocal: local,
      email: data.email,
      avatarUrl: data.avatarUrl,
      initials: data.initials,
    }),
    [data.fullname, dial, local, data.email, data.avatarUrl, data.initials],
  )

  // Render the card only once it is actually asked for — a visitor who just taps
  // "Call" should never pay for two canvas renders.
  useEffect(() => {
    if (!cardOpen || front) return
    let alive = true
    void (async () => {
      const [f, b] = await Promise.all([
        renderCard("front", design, cardData, DISP_W, DISP_H),
        renderCard("back", design, cardData, DISP_W, DISP_H),
      ])
      if (!alive) return
      setFront(f)
      setBack(b)
    })()
    return () => { alive = false }
  }, [cardOpen, front, design, cardData])

  const saveContact = useCallback(() => {
    const blob = new Blob([buildVCard(data, phoneE164)], { type: "text/vcard;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${data.fullname.replace(/\s+/g, "-") || "contact"}.vcf`
    a.click()
    URL.revokeObjectURL(url)
  }, [data, phoneE164])

  const downloadCard = useCallback(async () => {
    const url = await renderCard("front", design, cardData, EXPORT_W, EXPORT_H)
    const a = document.createElement("a")
    a.href = url
    a.download = `${data.fullname.replace(/\s+/g, "-") || "business"}-card.png`
    a.click()
  }, [design, data.fullname, cardData])

  const selfUrl = useSelfUrl(data.id)

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
      ? [{ id: "whatsapp", label: "Message on WhatsApp", href: `https://wa.me/${waNumber}`, Icon: WhatsAppIcon }]
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

  // Dialling and composing are left to the raw phone/email above and the
  // WhatsApp button below, so these two are the only action rows.
  const actions: Array<{
    key: string
    href?: string
    onClick?: () => void
    icon: React.ComponentType<{ className?: string }>
    label: string
    hint?: string
  }> = [
    { key: "vcf", onClick: saveContact, icon: UserPlus, label: "Save to my contacts", hint: "Downloads a .vcf contact file" },
    {
      key: "card",
      onClick: () => setCardOpen((v) => !v),
      icon: cardOpen ? ChevronDown : CreditCard,
      label: cardOpen ? "Hide business card" : "View my business card",
    },
  ]

  return (
    <main className={`relative overflow-hidden ${embedded ? "min-h-full" : "min-h-screen"}`}>
      {/* Backdrop */}
      <Image
        src={BACKDROP}
        alt=""
        fill
        priority
        // The embedded preview is a ~366px phone frame, not the viewport.
        sizes={embedded ? "400px" : "100vw"}
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#001f3f]/85 via-[#001f3f]/72 to-[#00152b]/97" />

      {/* Content column — sized for a phone, centred on anything wider. */}
      <div
        className={`relative mx-auto w-full max-w-[430px] px-6 flex flex-col items-center ${
          embedded ? "pt-10 pb-8" : "pt-14 pb-10"
        }`}
      >

        {/* Avatar — same gold ring the printed card uses, so the page and the
            card read as one identity. */}
        <div className="animate-hero-item" style={{ animationDelay: `${step(0)}ms` }}>
          <div className="relative w-[112px] h-[112px] rounded-full p-[3px] bg-[#d6b357] shadow-[0_10px_30px_-8px_rgba(0,0,0,0.6)]">
            <div className="w-full h-full rounded-full overflow-hidden ring-2 ring-white/25 bg-[#0a3a66] flex items-center justify-center">
              {data.avatarUrl ? (
                // Proxied through our own origin; a plain <img> keeps this page
                // independent of next/image's remote-pattern allowlist.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.avatarUrl}
                  alt={data.fullname}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className={`${DISPLAY} text-3xl font-bold text-[#d6b357]`}>{data.initials}</span>
              )}
            </div>
          </div>
        </div>

        {/* Name */}
        <h1
          className={`${DISPLAY} animate-hero-item mt-5 text-center text-[26px] leading-tight font-bold text-white`}
          style={{ animationDelay: `${step(1)}ms` }}
        >
          {data.fullname}
        </h1>

        {/* Tagline — the person's own words, in their own line. */}
        {data.tagline && (
          <p
            className="animate-hero-item mt-2.5 max-w-[21rem] text-center text-[15px] leading-snug text-white/80 text-balance"
            style={{ animationDelay: `${step(2)}ms` }}
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
              delay={step(HEADER_SLOTS + i)}
            />
          ))}
        </div>

        {/* Card reveal — the printed card itself, tap to flip. */}
        {cardOpen && (
          <div className="w-full mt-4 animate-hero-item" style={{ animationDelay: "0ms" }}>
            <div
              className="bc-scene w-full cursor-pointer select-none"
              style={{ aspectRatio: "1.75 / 1" }}
              onClick={() => setFlipped((f) => !f)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setFlipped((f) => !f)
                }
              }}
              aria-label={`Business card, showing the ${flipped ? "back" : "front"}. Activate to flip.`}
            >
              <div className={`bc-card w-full h-full ${flipped ? "bc-card--flipped" : ""}`}>
                <div className="bc-face bc-face--front w-full h-full rounded-2xl overflow-hidden shadow-[0_14px_40px_-10px_rgba(0,0,0,0.7)]">
                  {front ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={front} alt={`${data.fullname} business card, front`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#001f3f] rounded-2xl animate-pulse" />
                  )}
                </div>
                <div className="bc-face bc-face--back w-full h-full rounded-2xl overflow-hidden shadow-[0_14px_40px_-10px_rgba(0,0,0,0.7)]">
                  {back ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={back} alt={`${data.fullname} business card, back`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#001428] rounded-2xl animate-pulse" />
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-center gap-5">
              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/80 hover:text-white transition-colors"
              >
                <RefreshCcw className="w-3.5 h-3.5" /> Flip
              </button>
              <button
                type="button"
                onClick={() => void downloadCard()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#d6b357] hover:text-[#e6cd8c] transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Download card
              </button>
            </div>
          </div>
        )}

        {/* Contact card — QR, the details in the clear, and the brand mark, in one
            block at the foot of the page. The QR sits on its own white tile
            because a scanner needs the quiet zone and the full contrast; the
            values are select-all rather than links so they can be copied by hand. */}
        <div
          className="animate-hero-item mt-9 w-full rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm p-4"
          style={{ animationDelay: `${step(HEADER_SLOTS + actions.length)}ms` }}
        >
          <div className="flex items-center gap-4">
            {/* QR — tap to enlarge, for scanning across a table. */}
            <button
              type="button"
              onClick={() => setQrOpen(true)}
              disabled={!selfUrl}
              aria-label="Enlarge the QR code"
              className="shrink-0 p-2 rounded-xl bg-white shadow-[0_6px_18px_-8px_rgba(0,0,0,0.6)] hover:scale-[1.04] active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#d6b357]/70 disabled:cursor-default disabled:hover:scale-100 transition-transform duration-200"
            >
              {selfUrl ? (
                <QRCodeCanvas
                  value={selfUrl}
                  // Drawn at export size and scaled down by CSS so it stays sharp
                  // on high-density screens and survives a screenshot.
                  size={QR_EXPORT_PX}
                  level="M"
                  marginSize={2}
                  fgColor="#001f3f"
                  bgColor="#ffffff"
                  style={{ width: 96, height: 96 }}
                />
              ) : (
                <div className="w-24 h-24 rounded-lg bg-[#eef1f5] animate-pulse" />
              )}
            </button>

            {/* Details + brand */}
            <div className="min-w-0 flex-1 flex flex-col gap-2">
              {phoneDisplay && (
                <p className="flex items-center gap-2 text-[15px] font-semibold text-white tabular-nums">
                  <Phone className="w-3.5 h-3.5 text-[#d6b357] shrink-0" aria-hidden />
                  <span className="select-all">{phoneDisplay}</span>
                </p>
              )}
              {data.email && (
                <p className="flex items-start gap-2 text-[13px] leading-snug text-white/75">
                  <Mail className="w-3.5 h-3.5 mt-[3px] text-[#d6b357] shrink-0" aria-hidden />
                  <span className="select-all break-all">{data.email}</span>
                </p>
              )}

              {/* Only a separator when there is something above it to separate. */}
              {(phoneDisplay || data.email) && <div className="h-px bg-white/15" />}

              <a
                href="https://fhiglobal.ae"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#d6b357]/60 rounded"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={BRAND_WHITE}
                  alt="FHI Global"
                  className="h-5 w-auto opacity-90 group-hover:opacity-100 transition-opacity"
                />
                <span className="text-[11px] tracking-wider text-white/50 group-hover:text-white/80 transition-colors">
                  www.fhiglobal.ae
                </span>
              </a>
            </div>
          </div>
        </div>

        {/* Socials — only the ones this person actually filled in. */}
        {socialEntries.length > 0 && (
          <div
            className="animate-hero-item mt-9 w-full flex flex-wrap items-center justify-center gap-3 sm:gap-4"
            style={{ animationDelay: `${step(HEADER_SLOTS + actions.length + 1)}ms` }}
          >
            {socialEntries.map(({ id, label, href, Icon }) => (
              <a
                key={id}
                href={href}
                target="_blank"
                rel="noopener noreferrer me"
                title={label}
                aria-label={label}
                className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-white/12 border border-white/20 text-white hover:bg-white hover:text-[#001f3f] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#d6b357]/60 transition-all duration-200"
              >
                <Icon className="w-[18px] h-[18px]" />
              </a>
            ))}
          </div>
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
                  {data.fullname || "My profile"}
                </h2>
                <p className="text-xs text-[#6b7280] mt-0.5">Point a camera at the code</p>
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

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}
