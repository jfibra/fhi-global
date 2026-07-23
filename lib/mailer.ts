import nodemailer from "nodemailer"

/**
 * Server-only SMTP mailer. Used to deliver auth OTP codes ourselves instead of
 * relying on Supabase's built-in email (which is capped at a few sends/hour on
 * the free tier). Supabase still generates + verifies the code — we only send
 * the email. Configure via SMTP_* in .env.local.
 */

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

/** Send a 6-digit auth code. `purpose` tweaks the copy (sign in vs sign up). */
export async function sendOtpEmail(
  to: string,
  code: string,
  purpose: "login" | "register" = "login",
): Promise<void> {
  const heading = purpose === "register" ? "Confirm your email" : "Sign in to FHI Global"
  const intro =
    purpose === "register"
      ? "Use this code to finish creating your FHI Global account:"
      : "Use this code to sign in to your FHI Global account:"

  const html = `
  <div style="margin:0;padding:0;background:#f4f6f9;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="440" cellpadding="0" cellspacing="0" style="max-width:440px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e8eaed;">
          <tr><td style="background:#001f3f;padding:22px 28px;border-bottom:4px solid #d6b357;">
            <span style="color:#d6b357;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">FHI Global</span>
          </td></tr>
          <tr><td style="padding:32px 28px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
            <h1 style="margin:0 0 8px;font-size:20px;color:#0d1117;">${heading}</h1>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b5563;">${intro}</p>
            <div style="text-align:center;margin:8px 0 20px;">
              <span style="display:inline-block;font-size:32px;font-weight:700;letter-spacing:10px;color:#001f3f;background:#f6f8fb;border:1px solid #e8eaed;border-radius:12px;padding:14px 20px;">${code}</span>
            </div>
            <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">This code expires in 1 hour. If you didn't request it, you can safely ignore this email.</p>
          </td></tr>
          <tr><td style="padding:16px 28px;background:#fafbfc;border-top:1px solid #eef0f3;font-family:Arial,sans-serif;font-size:11px;color:#9ca3af;text-align:center;">
            © ${new Date().getFullYear()} FHI Global · Dubai, UAE
          </td></tr>
        </table>
      </td></tr>
    </table>
  </div>`

  await transport().sendMail({
    from: fromAddress(),
    to,
    subject: `${code} is your FHI Global ${purpose === "register" ? "sign-up" : "sign-in"} code`,
    text: `${intro}\n\n${code}\n\nThis code expires in 1 hour. If you didn't request it, ignore this email.`,
    html,
  })
}
