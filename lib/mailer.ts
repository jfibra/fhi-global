import nodemailer from "nodemailer"
import { SITE_URL } from "@/lib/seo"
import { logAuditEvent } from "@/lib/audit-log"

/**
 * Server-only SMTP mailer. Used to deliver auth OTP codes ourselves instead of
 * relying on Supabase's built-in email (which is capped at a few sends/hour on
 * the free tier). Supabase still generates + verifies the code — we only send
 * the email. Configure via SMTP_* in .env.local.
 */

// Emails can't use relative paths — the logo is served from the public site.
const LOGO_URL = `${SITE_URL}/FHI_Branding_White.png`
const NAVY = "#001f3f"
const GOLD = "#d6b357"

function getConfig() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT ?? 465)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null
  return {
    host,
    port,
    // 465 = implicit TLS (SSL); anything else = STARTTLS.
    secure: port === 465,
    auth: { user, pass },
  }
}

export function hasMailerConfig(): boolean {
  return getConfig() !== null
}

let cached: nodemailer.Transporter | null = null

function transport() {
  const config = getConfig()
  if (!config) throw new Error("SMTP is not configured (set SMTP_HOST/SMTP_USER/SMTP_PASS).")
  if (!cached) cached = nodemailer.createTransport(config)
  return cached
}

function fromAddress() {
  const email = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || ""
  const name = process.env.SMTP_FROM_NAME || "FHI Global"
  return `${name} <${email}>`
}

type DeliverOptions = {
  from: string
  to: string | string[]
  subject: string
  text: string
  html: string
}

// Cap the stored HTML so one huge email can't balloon an audit row.
const AUDIT_HTML_CAP = 256 * 1024

/**
 * Send an email and record it in the audit trail under category "mailer", so
 * every message shows up in System Logs with its recipients, subject, the
 * sending "mailable", and a body preview. Auditing is best-effort
 * (logAuditEvent never throws); a send FAILURE is logged then re-thrown so
 * callers (e.g. the auth OTP flow) still see it.
 */
async function deliver(mailable: string, opts: DeliverOptions): Promise<void> {
  const recipients = Array.isArray(opts.to) ? opts.to : [opts.to]
  try {
    await transport().sendMail(opts)
  } catch (error) {
    await auditMail(mailable, opts.subject, recipients, opts.html, error)
    throw error
  }
  await auditMail(mailable, opts.subject, recipients, opts.html, null)
}

async function auditMail(
  mailable: string,
  subject: string,
  recipients: string[],
  html: string,
  error: unknown,
): Promise<void> {
  const failed = error != null
  const body = html.length > AUDIT_HTML_CAP ? `${html.slice(0, AUDIT_HTML_CAP)}\n<!-- truncated -->` : html
  await logAuditEvent({
    category: "mailer",
    event: failed ? "email_failed" : "email_sent",
    source: "system",
    subjectType: "email",
    subjectLabel: subject,
    description: `${failed ? "Failed to send" : "Sent"} "${subject}" to ${recipients.join(", ")}`,
    newValues: {
      recipients,
      subject,
      mailable,
      html: body,
      ...(failed ? { error: error instanceof Error ? error.message : String(error) } : {}),
    },
  })
}

/** Send a numeric auth code. `purpose` tweaks the copy (sign in vs sign up). */
export async function sendOtpEmail(
  to: string,
  code: string,
  purpose: "login" | "register" = "login",
): Promise<void> {
  const eyebrow = purpose === "register" ? "Verify your email" : "Secure sign-in"
  const heading = purpose === "register" ? "Confirm your email address" : "Sign in to FHI Global"
  const intro =
    purpose === "register"
      ? "You're almost there. Enter this code to finish creating your FHI Global account."
      : "Enter this code to securely sign in to your FHI Global account."

  const subject = `${code} is your FHI Global ${purpose === "register" ? "sign-up" : "sign-in"} code`
  const text = `${heading}\n\n${intro}\n\nYour code: ${code}\n\nIf you didn't request it, you can safely ignore this email.\n\n© ${new Date().getFullYear()} FHI Global · Dubai, UAE`

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#eef1f5;-webkit-font-smoothing:antialiased;">
  <!-- Preheader (hidden inbox preview) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Your FHI Global code is ${code}.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px -16px rgba(0,20,45,0.35);">

        <!-- Header: logo on navy, gold rule -->
        <tr>
          <td align="center" bgcolor="${NAVY}" style="background:${NAVY};padding:30px 32px 26px;border-bottom:3px solid ${GOLD};">
            <img src="${LOGO_URL}" alt="FHI Global" height="40" style="height:40px;width:auto;display:block;border:0;outline:none;text-decoration:none;">
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 8px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2937;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:${GOLD};">${eyebrow}</p>
            <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:700;color:#0d1117;">${heading}</h1>
            <p style="margin:0 0 4px;font-size:15px;line-height:1.65;color:#4b5563;">${intro}</p>
          </td>
        </tr>

        <!-- Code block -->
        <tr>
          <td style="padding:20px 40px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center" bgcolor="#f5f8fc" style="background:#f5f8fc;border:1px solid #e2e8f2;border-radius:14px;padding:24px 16px;">
                <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:34px;font-weight:800;letter-spacing:10px;color:${NAVY};line-height:1;">${code}</div>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- Security note -->
        <tr>
          <td style="padding:16px 40px 32px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="border-top:1px solid #eef0f3;padding-top:18px;">
                <p style="margin:0;font-size:12.5px;line-height:1.6;color:#9ca3af;">
                  For your security, never share this code with anyone. FHI Global will never ask for it.
                  If you didn't request this, you can safely ignore this email.
                </p>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" bgcolor="#fafbfc" style="background:#fafbfc;border-top:1px solid #eef0f3;padding:22px 32px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
            <p style="margin:10px 0 0;font-size:11px;color:#b6bdc7;">© ${new Date().getFullYear()} FHI Global Property. All rights reserved.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  await deliver("OtpMailer", {
    from: fromAddress(),
    to,
    subject,
    text,
    html,
  })
}

// ─── Event emails (registration confirmation + raffle winner) ─────────────────

/** User-provided values land in HTML — always escape them. */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/** Event times are Dubai time (GST) everywhere in the app — emails included. */
function dubaiDateLabel(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return (
    d.toLocaleDateString("en-AE", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Dubai" }) +
    " · " +
    d.toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" }) +
    " (GST)"
  )
}

/** Shared navy/gold email shell used by the event emails below. */
function eventEmailShell(input: { subject: string; preheader: string; bodyHtml: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>${esc(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#eef1f5;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(input.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px -16px rgba(0,20,45,0.35);">
        <tr>
          <td align="center" bgcolor="${NAVY}" style="background:${NAVY};padding:30px 32px 26px;border-bottom:3px solid ${GOLD};">
            <img src="${LOGO_URL}" alt="FHI Global" height="40" style="height:40px;width:auto;display:block;border:0;outline:none;text-decoration:none;">
          </td>
        </tr>
        ${input.bodyHtml}
        <tr>
          <td align="center" bgcolor="#fafbfc" style="background:#fafbfc;border-top:1px solid #eef0f3;padding:22px 32px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
            <p style="margin:0;font-size:12px;color:#8a6d2a;font-weight:700;">fhiglobal.ae</p>
            <p style="margin:10px 0 0;font-size:11px;color:#b6bdc7;">© ${new Date().getFullYear()} FHI Global Property. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/** One label/value row for the details table. */
function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:9px 0;border-bottom:1px solid #eef0f3;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#9ca3af;vertical-align:top;width:110px;">${esc(label)}</td>
    <td style="padding:9px 0 9px 14px;border-bottom:1px solid #eef0f3;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#1f2937;">${esc(value)}</td>
  </tr>`
}

/** Confirmation sent right after a successful public event registration. */
export async function sendEventRegistrationEmail(input: {
  to: string
  fullName: string
  eventTitle: string
  eventDate: string | null
  venue: string | null
  eventUrl: string
}): Promise<void> {
  const subject = `You're registered — ${input.eventTitle}`
  const dateLabel = dubaiDateLabel(input.eventDate)
  const rows = [
    detailRow("Event", input.eventTitle),
    dateLabel ? detailRow("When", dateLabel) : "",
    input.venue ? detailRow("Venue", input.venue) : "",
    detailRow("Name", input.fullName),
    detailRow("Email", input.to),
  ].join("")

  const bodyHtml = `
        <tr>
          <td style="padding:36px 40px 6px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2937;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:${GOLD};">Registration confirmed</p>
            <h1 style="margin:0 0 12px;font-size:23px;line-height:1.3;font-weight:700;color:#0d1117;">You're in, ${esc(input.fullName)}! 🎟️</h1>
            <p style="margin:0;font-size:15px;line-height:1.65;color:#4b5563;">
              Your registration for <strong>${esc(input.eventTitle)}</strong> is confirmed. Here are your details —
              keep this email as your confirmation and show it at the entrance.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafd;border:1px solid #e2e8f2;border-radius:14px;">
              <tr><td style="padding:16px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:22px 40px 34px;">
            <a href="${esc(input.eventUrl)}"
               style="display:inline-block;background:${NAVY};color:#ffffff;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;padding:13px 34px;border-radius:12px;border-bottom:3px solid ${GOLD};">
              View event details
            </a>
          </td>
        </tr>`

  await deliver("EventRegistrationMailer", {
    from: fromAddress(),
    to: input.to,
    subject,
    text: `Registration confirmed — ${input.eventTitle}\n\nName: ${input.fullName}\n${dateLabel ? `When: ${dateLabel}\n` : ""}${input.venue ? `Venue: ${input.venue}\n` : ""}\nKeep this email as your confirmation and show it at the entrance.\n\n${input.eventUrl}`,
    html: eventEmailShell({
      subject,
      preheader: `Your registration for ${input.eventTitle} is confirmed.`,
      bodyHtml,
    }),
  })
}

/** Sent to a raffle winner as their proof of winning (triggered by the host). */
export async function sendRaffleWinnerEmail(input: {
  to: string
  fullName: string
  eventTitle: string
  prize: string | null
}): Promise<void> {
  const prizeLabel = input.prize?.trim() || ""
  const subject = prizeLabel
    ? `🎉 Congratulations — you won ${prizeLabel}!`
    : `🎉 Congratulations — you're a raffle winner!`
  const drawnLabel =
    new Date().toLocaleDateString("en-AE", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Dubai" }) +
    " · " +
    new Date().toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" }) +
    " (GST)"

  const rows = [
    detailRow("Winner", input.fullName),
    detailRow("Event", input.eventTitle),
    prizeLabel ? detailRow("Prize", prizeLabel) : "",
    detailRow("Drawn", drawnLabel),
  ].join("")

  const bodyHtml = `
        <tr>
          <td style="padding:36px 40px 6px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2937;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:${GOLD};">Live raffle winner</p>
            <h1 style="margin:0 0 12px;font-size:23px;line-height:1.3;font-weight:700;color:#0d1117;">Congratulations, ${esc(input.fullName)}! 🎉</h1>
            <p style="margin:0;font-size:15px;line-height:1.65;color:#4b5563;">
              Your name was drawn in the live raffle at <strong>${esc(input.eventTitle)}</strong>.
            </p>
          </td>
        </tr>
        ${prizeLabel ? `
        <tr>
          <td style="padding:20px 40px 6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center" style="background:#fdf6e3;border:1px solid #e7d9a8;border-radius:14px;padding:22px 16px;">
                <p style="margin:0 0 4px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8a6d2a;">You won</p>
                <p style="margin:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:26px;font-weight:800;color:#8a6d2a;line-height:1.25;">${esc(prizeLabel)}</p>
              </td></tr>
            </table>
          </td>
        </tr>` : ""}
        <tr>
          <td style="padding:20px 40px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafd;border:1px solid #e2e8f2;border-radius:14px;">
              <tr><td style="padding:16px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 40px 34px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
            <p style="margin:0;font-size:13px;line-height:1.65;color:#6b7280;">
              <strong style="color:#1f2937;">This email is your proof of winning.</strong> Present it to the
              FHI Global events team to claim your prize.
            </p>
          </td>
        </tr>`

  await deliver("RaffleWinnerMailer", {
    from: fromAddress(),
    to: input.to,
    subject,
    text: `Congratulations ${input.fullName}!\n\nYour name was drawn in the live raffle at ${input.eventTitle}.${prizeLabel ? `\nPrize: ${prizeLabel}` : ""}\nDrawn: ${drawnLabel}\n\nThis email is your proof of winning — present it to the FHI Global events team to claim your prize.`,
    html: eventEmailShell({
      subject,
      preheader: prizeLabel ? `You won ${prizeLabel} at ${input.eventTitle}!` : `You won the raffle at ${input.eventTitle}!`,
      bodyHtml,
    }),
  })
}

// ─── Sales pipeline emails (encode confirmation + status updates) ──────────────

function moneyLabel(value: number): string {
  const n = Number(value || 0)
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " AED"
}

/** reservation_date is a plain date — no time component to show. */
function saleDateLabel(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-AE", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Dubai" })
}

export type SaleEmailDetails = {
  saleTypeLabel: string
  clientName: string | null
  propertyLabel: string | null
  developerName: string | null
  contractPrice: number
  reservationDate: string | null
  /** Absolute link to the agent's sales area. */
  dashboardUrl: string
}

function saleDetailRows(d: SaleEmailDetails, statusLabel: string): string {
  const dateLabel = saleDateLabel(d.reservationDate)
  return [
    detailRow("Sale type", d.saleTypeLabel),
    d.clientName ? detailRow("Client", d.clientName) : "",
    d.propertyLabel ? detailRow("Property", d.propertyLabel) : "",
    d.developerName ? detailRow("Developer", d.developerName) : "",
    detailRow("Contract price", moneyLabel(d.contractPrice)),
    dateLabel ? detailRow("Reservation", dateLabel) : "",
    detailRow("Status", statusLabel),
  ].join("")
}

function saleEmailBody(input: {
  eyebrow: string
  heading: string
  intro: string
  detailsHtml: string
  note: string | null
  dashboardUrl: string
  /** Optional quoted block (e.g. a discussion comment) shown above the details. */
  quoteHtml?: string
  /** CTA button label; defaults to "View my sales". */
  ctaLabel?: string
}): string {
  return `
        <tr>
          <td style="padding:36px 40px 6px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2937;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:${GOLD};">${esc(input.eyebrow)}</p>
            <h1 style="margin:0 0 12px;font-size:23px;line-height:1.3;font-weight:700;color:#0d1117;">${input.heading}</h1>
            <p style="margin:0;font-size:15px;line-height:1.65;color:#4b5563;">${input.intro}</p>
          </td>
        </tr>
        ${input.quoteHtml ? `
        <tr>
          <td style="padding:18px 40px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafd;border-left:3px solid ${GOLD};border-radius:0 10px 10px 0;">
              <tr><td style="padding:14px 18px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#374151;font-style:italic;">${input.quoteHtml}</td></tr>
            </table>
          </td>
        </tr>` : ""}
        <tr>
          <td style="padding:20px 40px 6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafd;border:1px solid #e2e8f2;border-radius:14px;">
              <tr><td style="padding:16px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${input.detailsHtml}</table>
              </td></tr>
            </table>
          </td>
        </tr>
        ${input.note ? `
        <tr>
          <td style="padding:14px 40px 0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
            <p style="margin:0;font-size:13px;line-height:1.65;color:#6b7280;">${input.note}</p>
          </td>
        </tr>` : ""}
        <tr>
          <td align="center" style="padding:22px 40px 34px;">
            <a href="${esc(input.dashboardUrl)}"
               style="display:inline-block;background:${NAVY};color:#ffffff;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;padding:13px 34px;border-radius:12px;border-bottom:3px solid ${GOLD};">
              ${esc(input.ctaLabel ?? "View my sales")}
            </a>
          </td>
        </tr>`
}

/** First name only for greetings — "MARIA DELA CRUZ" reads better as "Maria". */
function greetingName(fullName: string | null): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0] ?? ""
  if (!first) return "there"
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
}

/** Plain-text variant of an intro/note that carries inline HTML like <strong>. */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
}

/** Shared detail lines for the plain-text alternatives — mirrors saleDetailRows. */
function saleDetailText(d: SaleEmailDetails, statusLabel: string): string {
  const dateLabel = saleDateLabel(d.reservationDate)
  return [
    `Sale type: ${d.saleTypeLabel}`,
    d.clientName ? `Client: ${d.clientName}` : "",
    d.propertyLabel ? `Property: ${d.propertyLabel}` : "",
    d.developerName ? `Developer: ${d.developerName}` : "",
    `Contract price: ${moneyLabel(d.contractPrice)}`,
    dateLabel ? `Reservation: ${dateLabel}` : "",
    `Status: ${statusLabel}`,
  ].filter(Boolean).join("\n")
}

const ENCODED_STATUS_LABELS: Record<string, string> = {
  pending: "Pending validation",
  under_review: "Under Review",
  validated: "Validated",
  invalid_sale: "Invalid Sale",
}

/** Confirmation sent to the agent right after their sale is encoded. */
export async function sendSaleEncodedEmail(input: {
  to: string
  agentName: string | null
  /** The sale's actual validation status — admins can encode pre-validated sales. */
  validationStatus: string
  details: SaleEmailDetails
}): Promise<void> {
  const d = input.details
  const subject = `Sale recorded — ${d.clientName ?? d.saleTypeLabel} · ${moneyLabel(d.contractPrice)}`
  const name = greetingName(input.agentName)
  const isPending = input.validationStatus === "pending"
  const statusLabel =
    ENCODED_STATUS_LABELS[input.validationStatus] ?? input.validationStatus.replace(/_/g, " ")
  const intro = isPending
    ? `Your <strong>${esc(d.saleTypeLabel)}</strong> has been submitted successfully and is now
            <strong>pending validation</strong> by the admin team. Keep this email for your records —
            you'll get another one as soon as its status changes.`
    : `Your <strong>${esc(d.saleTypeLabel)}</strong> has been recorded. Its current validation status
            is <strong>${esc(statusLabel)}</strong>.`
  const note = isPending
    ? "Make sure your proof of transaction is attached — the admin team needs it to validate the sale."
    : null

  const bodyHtml = saleEmailBody({
    eyebrow: "Sale recorded",
    heading: `Your sale has been recorded, ${esc(name)}! 🏆`,
    intro,
    detailsHtml: saleDetailRows(d, statusLabel),
    note,
    dashboardUrl: d.dashboardUrl,
  })

  await deliver("SaleEncodedMailer", {
    from: fromAddress(),
    to: input.to,
    subject,
    text: `Your sale has been recorded.\n\n${stripTags(intro)}\n\n${saleDetailText(d, statusLabel)}\n${note ? `\n${note}\n` : ""}\n${d.dashboardUrl}`,
    html: eventEmailShell({
      subject,
      preheader: isPending
        ? `Your ${d.saleTypeLabel.toLowerCase()} was recorded and is pending validation.`
        : `Your ${d.saleTypeLabel.toLowerCase()} was recorded — status: ${statusLabel}.`,
      bodyHtml,
    }),
  })
}

type SaleStatusCopy = { eyebrow: string; heading: string; intro: string; statusLabel: string; note: string | null }

const VALIDATION_COPY: Record<string, SaleStatusCopy> = {
  validated: {
    eyebrow: "Sale validated",
    heading: "Great news, {name} — your sale is validated! ✅",
    intro: "The admin team has reviewed and <strong>validated</strong> your sale. It now counts toward your production.",
    statusLabel: "Validated",
    note: null,
  },
  under_review: {
    eyebrow: "Sale under review",
    heading: "Your sale is under review, {name}",
    intro: "The admin team is currently <strong>reviewing</strong> this sale. No action is needed from you right now — you'll be emailed once the review is done.",
    statusLabel: "Under Review",
    note: null,
  },
  invalid_sale: {
    eyebrow: "Sale marked invalid",
    heading: "Your sale was marked invalid, {name}",
    intro: "The admin team marked this sale as an <strong>invalid sale</strong>. Please review the details below.",
    statusLabel: "Invalid Sale",
    note: "If you believe this is a mistake, open the sale in your dashboard and use its discussion thread to reach the admin team.",
  },
  pending: {
    eyebrow: "Validation update",
    heading: "Your sale is back to pending, {name}",
    intro: "This sale's validation was reset to <strong>pending</strong> and will be looked at again by the admin team.",
    statusLabel: "Pending",
    note: null,
  },
}

const COMMISSION_COPY: Record<string, SaleStatusCopy> = {
  processing: {
    eyebrow: "Commission update",
    heading: "Your commission is being processed, {name}",
    intro: "The commission for this sale is now <strong>processing</strong>. You'll be emailed at each step until it's released.",
    statusLabel: "Processing",
    note: null,
  },
  approved: {
    eyebrow: "Commission approved",
    heading: "Your commission has been approved, {name} 🙌",
    intro: "The commission for this sale has been <strong>approved</strong> and is queued for release.",
    statusLabel: "Approved",
    note: null,
  },
  released: {
    eyebrow: "Commission released",
    heading: "Congratulations, {name} — your commission is released! 🎉",
    intro: "The commission for this sale has been <strong>released</strong>.",
    statusLabel: "Released",
    note: null,
  },
  rejected: {
    eyebrow: "Commission update",
    heading: "Your commission was rejected, {name}",
    intro: "The commission for this sale was <strong>rejected</strong>. Please review the details below.",
    statusLabel: "Rejected",
    note: "If you believe this is a mistake, open the sale in your dashboard and use its discussion thread to reach the admin team.",
  },
  pending: {
    eyebrow: "Commission update",
    heading: "Your commission is back to pending, {name}",
    intro: "The commission status for this sale was reset to <strong>pending</strong>.",
    statusLabel: "Pending",
    note: null,
  },
}

/** Sent to the agent when an admin changes a sale's validation or commission status. */
export async function sendSaleStatusEmail(input: {
  to: string
  agentName: string | null
  kind: "validation" | "commission"
  status: string
  details: SaleEmailDetails
}): Promise<void> {
  const d = input.details
  const copyMap = input.kind === "validation" ? VALIDATION_COPY : COMMISSION_COPY
  const fallbackLabel = input.status.replace(/_/g, " ")
  const copy: SaleStatusCopy = copyMap[input.status] ?? {
    eyebrow: input.kind === "validation" ? "Validation update" : "Commission update",
    heading: "Your sale's status changed, {name}",
    intro: `This sale's ${input.kind} status is now <strong>${esc(fallbackLabel)}</strong>.`,
    statusLabel: fallbackLabel,
    note: null,
  }
  const name = greetingName(input.agentName)
  const subject = `${copy.eyebrow} — ${d.clientName ?? d.saleTypeLabel} · ${moneyLabel(d.contractPrice)}`

  const bodyHtml = saleEmailBody({
    eyebrow: copy.eyebrow,
    // Function replacement: a literal name containing "$&" or "$`" must not
    // trigger String.replace's $-substitutions.
    heading: copy.heading.replace("{name}", () => esc(name)),
    intro: copy.intro,
    detailsHtml: saleDetailRows(d, copy.statusLabel),
    note: copy.note,
    dashboardUrl: d.dashboardUrl,
  })

  await deliver("SaleStatusMailer", {
    from: fromAddress(),
    to: input.to,
    subject,
    text: `${copy.eyebrow}\n\n${stripTags(copy.intro)}\n\n${saleDetailText(d, copy.statusLabel)}\n${copy.note ? `\n${copy.note}\n` : ""}\n${d.dashboardUrl}`,
    html: eventEmailShell({
      subject,
      preheader: `${copy.eyebrow} for your ${d.saleTypeLabel.toLowerCase()}.`,
      bodyHtml,
    }),
  })
}

/** Sent to the other party when a validation-discussion comment is posted. */
export async function sendSaleCommentEmail(input: {
  to: string
  recipientName: string | null
  commenterName: string | null
  commenterRoleLabel: string | null
  commentExcerpt: string
  /** The sale's current validation status, human label — shown in the details. */
  statusLabel: string
  details: SaleEmailDetails
}): Promise<void> {
  const d = input.details
  const name = greetingName(input.recipientName)
  const who = input.commenterName?.trim() || "A team member"
  const roleSuffix = input.commenterRoleLabel ? ` (${esc(input.commenterRoleLabel)})` : ""
  const subject = `New message — ${d.clientName ?? d.saleTypeLabel} · ${moneyLabel(d.contractPrice)}`
  const intro = `<strong>${esc(who)}</strong>${roleSuffix} posted a new message on the validation discussion for this sale.`

  // Escape first so a comment can never inject markup, then keep the author's line breaks.
  const quoteHtml = esc(input.commentExcerpt).replace(/\r?\n/g, "<br>")

  const bodyHtml = saleEmailBody({
    eyebrow: "New message",
    heading: `You have a new message, ${esc(name)} 💬`,
    intro,
    quoteHtml,
    detailsHtml: saleDetailRows(d, input.statusLabel),
    note: null,
    dashboardUrl: d.dashboardUrl,
    ctaLabel: "Open the discussion",
  })

  await deliver("SaleCommentMailer", {
    from: fromAddress(),
    to: input.to,
    subject,
    text: `${who}${input.commenterRoleLabel ? ` (${input.commenterRoleLabel})` : ""} posted a new message on the validation discussion for this sale:\n\n"${input.commentExcerpt}"\n\n${saleDetailText(d, input.statusLabel)}\n\n${d.dashboardUrl}`,
    html: eventEmailShell({
      subject,
      preheader: `New message from ${who} on ${d.clientName ?? d.saleTypeLabel}.`,
      bodyHtml,
    }),
  })
}

/** Sent to each admin when a visitor submits an Inquire Now lead on a project page. */
export async function sendLeadInquiryEmail(input: {
  to: string
  adminName: string | null
  lead: {
    name: string
    email: string
    phone: string
    lookingFor: string
    propertyCategory: string
    projectName: string | null
    developerName: string | null
  }
  dashboardUrl: string
}): Promise<void> {
  const { lead } = input
  const name = greetingName(input.adminName)
  const subject = `New lead — ${lead.name}${lead.projectName ? ` · ${lead.projectName}` : ""}`

  const detailsHtml = [
    detailRow("Name", lead.name),
    detailRow("Email", lead.email),
    detailRow("Phone", lead.phone),
    detailRow("Looking for", lead.lookingFor),
    detailRow("Category", lead.propertyCategory),
    lead.projectName ? detailRow("Project", lead.projectName) : "",
    lead.developerName ? detailRow("Developer", lead.developerName) : "",
  ].join("")

  const bodyHtml = `
        <tr>
          <td style="padding:36px 40px 6px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2937;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:${GOLD};">New lead</p>
            <h1 style="margin:0 0 12px;font-size:23px;line-height:1.3;font-weight:700;color:#0d1117;">A new inquiry just came in, ${esc(name)} 📥</h1>
            <p style="margin:0;font-size:15px;line-height:1.65;color:#4b5563;">
              <strong>${esc(lead.name)}</strong> submitted an Inquire Now form${lead.projectName ? ` on <strong>${esc(lead.projectName)}</strong>` : ""}.
              Leads go cold fast — reach out while it's warm.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafd;border:1px solid #e2e8f2;border-radius:14px;">
              <tr><td style="padding:16px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailsHtml}</table>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:22px 40px 34px;">
            <a href="${esc(input.dashboardUrl)}"
               style="display:inline-block;background:${NAVY};color:#ffffff;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;padding:13px 34px;border-radius:12px;border-bottom:3px solid ${GOLD};">
              View lead
            </a>
          </td>
        </tr>`

  await deliver("LeadInquiryMailer", {
    from: fromAddress(),
    to: input.to,
    subject,
    text: `New lead from ${lead.name}${lead.projectName ? ` on ${lead.projectName}` : ""}.\n\nName: ${lead.name}\nEmail: ${lead.email}\nPhone: ${lead.phone}\nLooking for: ${lead.lookingFor}\nCategory: ${lead.propertyCategory}${lead.projectName ? `\nProject: ${lead.projectName}` : ""}${lead.developerName ? `\nDeveloper: ${lead.developerName}` : ""}\n\n${input.dashboardUrl}`,
    html: eventEmailShell({
      subject,
      preheader: `${lead.name} inquired${lead.projectName ? ` about ${lead.projectName}` : ""}.`,
      bodyHtml,
    }),
  })
}

/**
 * A personal message written by an admin on the Emails page — a reply to a
 * lead or a standalone composed email. The admin's text is the whole body
 * (greeting included, like any mail client); we only wrap it in the brand
 * shell and sign it with the sender's name.
 */
export async function sendAdminDirectEmail(input: {
  to: string
  subject: string
  /** Plain text as typed by the admin; line breaks are preserved. */
  message: string
  senderName: string | null
  /** Context line, e.g. "Azizi Venice · Azizi Developments" — reply emails only. */
  regarding?: string | null
}): Promise<void> {
  const signer = input.senderName?.trim() || "The FHI Global Team"
  const messageHtml = esc(input.message).replace(/\r?\n/g, "<br>")

  const bodyHtml = `
        <tr>
          <td style="padding:36px 40px 8px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2937;">
            <p style="margin:0 0 14px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:${GOLD};">A message from FHI Global</p>
            <div style="font-size:15px;line-height:1.75;color:#374151;">${messageHtml}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 40px 30px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="border-top:1px solid #eef0f3;padding-top:16px;">
                <p style="margin:0;font-size:14px;font-weight:700;color:#0d1117;">${esc(signer)}</p>
                <p style="margin:2px 0 0;font-size:12.5px;color:#6b7280;">FHI Global · Dubai, UAE</p>
                ${input.regarding ? `<p style="margin:10px 0 0;font-size:11.5px;color:#9ca3af;">Sent regarding your inquiry about ${esc(input.regarding)}. Just reply to this email to continue the conversation.</p>` : `<p style="margin:10px 0 0;font-size:11.5px;color:#9ca3af;">Just reply to this email to continue the conversation.</p>`}
              </td></tr>
            </table>
          </td>
        </tr>`

  await deliver("AdminDirectMailer", {
    from: fromAddress(),
    to: input.to,
    subject: input.subject,
    text: `${input.message}\n\n—\n${signer}\nFHI Global · Dubai, UAE${input.regarding ? `\nSent regarding your inquiry about ${input.regarding}.` : ""}`,
    html: eventEmailShell({
      subject: input.subject,
      preheader: input.message.slice(0, 120),
      bodyHtml,
    }),
  })
}

/**
 * Sent to the requesting agent when a property owner submits their documents
 * through an owner-document (NOC / Trakheesi) intake link. Best-effort — a mail
 * failure must never lose the submission.
 */
export async function sendOwnerDocumentsSubmittedEmail(input: {
  to: string
  agentName: string | null
  ownerName: string
  propertyLabel: string | null
  fileCount: number
  dashboardUrl: string
}): Promise<void> {
  const name = greetingName(input.agentName)
  const subject = `Owner documents received — ${input.ownerName}`

  const detailsHtml = [
    detailRow("Owner", input.ownerName),
    input.propertyLabel ? detailRow("Property", input.propertyLabel) : "",
    detailRow("Documents", `${input.fileCount} file${input.fileCount === 1 ? "" : "s"} uploaded`),
  ].join("")

  const bodyHtml = `
        <tr>
          <td style="padding:36px 40px 6px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2937;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:${GOLD};">Owner documents received</p>
            <h1 style="margin:0 0 12px;font-size:23px;line-height:1.3;font-weight:700;color:#0d1117;">You've got what you need, ${esc(name)} 📄</h1>
            <p style="margin:0;font-size:15px;line-height:1.65;color:#4b5563;">
              <strong>${esc(input.ownerName)}</strong> submitted their documents and details through your intake link.
              You can now review everything and proceed with the NOC / Trakheesi filing.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafd;border:1px solid #e2e8f2;border-radius:14px;">
              <tr><td style="padding:16px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailsHtml}</table>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:22px 40px 34px;">
            <a href="${esc(input.dashboardUrl)}"
               style="display:inline-block;background:${NAVY};color:#ffffff;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;padding:13px 34px;border-radius:12px;border-bottom:3px solid ${GOLD};">
              View submission
            </a>
          </td>
        </tr>`

  await deliver("OwnerDocumentsSubmittedMailer", {
    from: fromAddress(),
    to: input.to,
    subject,
    text: `Owner documents received from ${input.ownerName}.\n\nOwner: ${input.ownerName}\n${input.propertyLabel ? `Property: ${input.propertyLabel}\n` : ""}Documents: ${input.fileCount} file${input.fileCount === 1 ? "" : "s"} uploaded\n\nReview the submission: ${input.dashboardUrl}`,
    html: eventEmailShell({
      subject,
      preheader: `${input.ownerName} submitted their documents through your intake link.`,
      bodyHtml,
    }),
  })
}
