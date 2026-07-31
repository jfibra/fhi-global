"use client"

import { Globe, Mail, Phone } from "lucide-react"
import { QRCodeCanvas } from "qrcode.react"
import { inkFor, type ContactDesignId, type ProfileTheme } from "@/lib/profile-themes"

/**
 * The contact card at the foot of the public profile.
 *
 * These follow the printed set closely, because the composition IS the design:
 * two are QR-then-details, four put a brand zone, the details and the QR in three
 * columns. An earlier version stacked everything into bands to buy text width and
 * the result read as a generic info panel — so the columns are kept and the type
 * is sized down to fit the ~382px profile column instead.
 *
 * Every card carries three detail lines — phone, email, website — and the QR.
 * There is no brand mark: the profile already carries the branding above, so on a
 * card this narrow the lockup was spending 76px that the details needed. What is
 * left of each design is its surface, its QR framing and its flourish.
 *
 * Everything tinted reads from the theme: the accent drives the QR frame, the
 * rules and the flourishes, and the line pips reuse the SAME icon tokens the
 * page buttons use — so changing the accent or the icon design (solid, soft,
 * outline, plain, none) carries through here instead of leaving the card stuck on
 * a gold circle.
 */

const DISPLAY = "font-[family-name:var(--font-outfit)]"

const NAVY = "#0d2340"
const IVORY = "#faf7f1"

type Spec = {
  bg: string
  ink: string
  inkMuted: string
}

function specFor(id: ContactDesignId, t: ProfileTheme): Spec {
  const light = { bg: IVORY, ink: "#12233c", inkMuted: "#5b6b7f" }

  // The surface first: a chosen colour wins over the design's own, and its ink is
  // picked against it so a light choice does not end up with white text.
  const base: Spec = t.contactBg
    ? { bg: t.contactBg, ...inkFor(t.contactBg) }
    : id === "panel"
      ? // Glass: the page's own panel tokens, so it sits on whatever backdrop the
        // theme paints instead of introducing a surface of its own.
        { bg: t.panel, ink: t.ink, inkMuted: t.inkMuted }
      : id === "ivory"
        ? light
        : { bg: NAVY, ink: "#ffffff", inkMuted: "rgba(255,255,255,0.72)" }

  // Then the ink. A chosen text colour applies inside the card as well, and it
  // beats the automatic pick — an explicit choice should not be second-guessed.
  return t.textColor ? { ...base, ink: t.ink, inkMuted: t.inkMuted } : base
}

/**
 * The pip carrying a line's icon, wearing the theme's icon design.
 *
 * The radius is clamped to half the pip: the page's tiles run to 48px and can
 * carry a 24px radius, which on a 20px pip would just be a circle regardless —
 * clamping keeps "Square" reading square here too.
 */
function Pip({ t, size, children }: { t: ProfileTheme; size: number; children: React.ReactNode }) {
  return (
  <span
    className="shrink-0 flex items-center justify-center"
    style={{
      width: size,
      height: size,
      background: t.tile,
      border: t.tileBorder,
      borderRadius: Math.min(t.tileRadius, size / 2),
      color: t.tileInk,
    }}
  >
    {children}
  </span>
)
}

/**
 * Phone, email and website — the three lines every printed card carries.
 * `compact` is the three-column cards, whose details column is narrower.
 */
function Details({
s,
t,
phone,
email,
compact,
}: {
s: Spec
t: ProfileTheme
phone: string
email: string
compact: boolean
}) {
const pip = compact ? 20 : 24
const glyph = compact ? "w-2.5 h-2.5" : "w-3 h-3"
const lead = compact ? "text-[12px]" : "text-[13px]"
const rest = compact ? "text-[10px]" : "text-[11px]"

const row = (icon: React.ReactNode, body: React.ReactNode, strong = false) => (
  <p className="flex items-center gap-2 min-w-0">
    {/* Hidden under the None icon design, exactly as the page buttons are. */}
    {t.showIcon && (
      <Pip t={t} size={pip}>
        {icon}
      </Pip>
    )}
    <span
      className={`min-w-0 truncate ${strong ? `${DISPLAY} font-bold ${lead} tabular-nums` : rest}`}
      style={{ color: strong ? s.ink : s.inkMuted }}
    >
      {body}
    </span>
  </p>
)

return (
  <div className={`min-w-0 flex-1 flex flex-col ${compact ? "gap-1.5" : "gap-2"}`}>
    {phone && row(<Phone className={glyph} />, <span className="select-all">{phone}</span>, true)}
    {email &&
      row(
        <Mail className={glyph} />,
        // Truncated rather than wrapped so the card keeps its proportions; the
        // title and select-all keep the full address reachable.
        <span className="select-all" title={email}>
          {email}
        </span>,
      )}
    {row(<Globe className={glyph} />, <span>www.fhiglobal.ae</span>)}
  </div>
)
}

export function ContactCard({
design,
t,
phoneDisplay,
email,
selfUrl,
onQrOpen,
delay,
}: {
design: ContactDesignId
t: ProfileTheme
phoneDisplay: string
email: string
selfUrl: string
onQrOpen: () => void
delay: number
}) {
const s = specFor(design, t)
const gold = t.accent
/**
 * `round` gives the bed a disc instead of a rounded square. The QR itself stays
 * square inside it — a scanner needs the quiet zone whatever the frame does, so
 * the disc is padded enough to keep one.
 */
const qr = (size: number, round = false) => (
  <button
    type="button"
    onClick={onQrOpen}
    disabled={!selfUrl}
    aria-label="Enlarge the QR code"
    className={`shrink-0 bg-white hover:scale-[1.03] active:scale-95 focus-visible:outline-none focus-visible:ring-4 disabled:cursor-default disabled:hover:scale-100 transition-transform duration-200 ${
      round ? "rounded-full grid place-items-center" : "rounded-lg p-1"
    }`}
    style={{
      border: `2px solid ${gold}`,
      ["--tw-ring-color" as string]: `${gold}88`,
      ...(round ? { width: size + 26, height: size + 26 } : null),
    }}
  >
    {selfUrl ? (
      <QRCodeCanvas
        value={selfUrl}
        size={480}
        level="M"
        marginSize={1}
        fgColor="#0b1220"
        bgColor="#ffffff"
        style={{ width: size, height: size, display: "block" }}
      />
    ) : (
      <div style={{ width: size, height: size }} className="rounded bg-[#eef1f5] animate-pulse" />
    )}
  </button>
)

const shell = "animate-hero-item relative mt-9 w-full overflow-hidden rounded-2xl"
const shellStyle: React.CSSProperties = {
  animationDelay: `${delay}ms`,
  background: s.bg,
  boxShadow: "0 12px 34px -14px rgba(0,0,0,0.55)",
}

// ── Every design is one surface: QR, a gold rule, then the three lines. ───
// What differs is that surface — the page's glass, a navy card, an ivory one
// with ribbons — or whatever colour the agent chose.
return (
    <div
      className={`${shell}${design === "panel" && !t.contactBg ? " backdrop-blur-sm" : ""}`}
      style={
        design === "panel" && !t.contactBg
          ? // No drop shadow on the glass: it reads as part of the page, and a
            // shadow would lift it off the backdrop it is meant to sit in. A
            // chosen colour makes it a solid card, so the shadow comes back.
            { ...shellStyle, border: `1px solid ${t.panelBorder}`, boxShadow: "none" }
          : shellStyle
      }
    >
      {design === "ivory" && (
        <>
          <span
            className="pointer-events-none absolute -top-8 -right-6 h-20 w-28 rotate-[20deg]"
            style={{
              background: `linear-gradient(115deg, ${gold} 0%, ${gold}00 70%)`,
              borderBottomLeftRadius: "100%",
            }}
          />
          <span
            className="pointer-events-none absolute -bottom-8 -left-6 h-20 w-28 rotate-[20deg]"
            style={{
              background: `linear-gradient(295deg, ${gold} 0%, ${gold}00 70%)`,
              borderTopRightRadius: "100%",
            }}
          />
        </>
      )}
      <div className="relative flex items-stretch gap-3 p-3.5">
        {qr(84)}
        <span className="w-px shrink-0" style={{ background: `${gold}4d` }} />
        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <Details s={s} t={t} phone={phoneDisplay} email={email} compact={false} />
        </div>
      </div>
    </div>
  )
}
