import nodemailer from "nodemailer"
import { SITE_URL } from "@/lib/seo"

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

  await transport().sendMail({
    from: fromAddress(),
    to,
    subject,
    text,
    html,
  })
}
