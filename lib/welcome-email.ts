import { createAdminSupabase } from "@/lib/admin-supabase"
import { hasMailerConfig, sendAdminDirectEmail } from "@/lib/mailer"

/**
 * The "your account is approved" welcome email, shared by the invite Approve
 * button and the admin activation. Sent from the approver's own
 * @fhiglobal.ae mailbox when they have one (the personal Emails accounts),
 * the company address otherwise — and recorded in the approver's Sent
 * folder, so the recruit's reply threads straight back into their dashboard
 * via the mailbox sync.
 *
 * Never throws: activation must never fail on mail plumbing. Returns whether
 * the email actually went out.
 */
export async function sendWelcomeEmail(input: {
  targetId: string
  targetName: string | null
  approver: { id: string; name: string | null; mailbox?: string | null }
  /** true when the approver personally leads the recruit (the invite
   *  ladder); admin activations welcome them to the company instead. */
  personalTeam: boolean
}): Promise<boolean> {
  if (!hasMailerConfig()) return false
  try {
    const admin = createAdminSupabase()
    const { data: authUser } = await admin.auth.admin.getUserById(input.targetId)
    const to = authUser?.user?.email ?? null
    if (!to) return false

    const approverName = input.approver.name?.trim() || "The FHI Global Team"
    const mailbox = (input.approver.mailbox ?? "").trim().toLowerCase() || null
    const firstName = (input.targetName ?? "").trim().split(/\s+/)[0] || ""
    const subject = "Welcome to the FHI Family — your account is approved"
    // The team's own approved wording; only the greeting and the signature
    // are dynamic. The approver signs personally on invite approvals; admin
    // activations sign as the company.
    const signTitle = input.personalTeam ? "Dubai Broker" : "FHI Global Property · Dubai"
    const message = [
      `Dear ${firstName || "Team Member"},`,
      ``,
      `Welcome to FHI – Future Homes One Team! 🎉`,
      ``,
      `We are delighted to have you join our growing family of passionate and driven professionals.`,
      ``,
      `At FHI, we believe that success is built together — through teamwork, dedication, integrity, and a commitment to helping our clients find the right property and investment opportunities.`,
      ``,
      `As you begin this exciting journey with us, remember that every call, every meeting, and every client interaction is an opportunity to grow, learn, and succeed.`,
      ``,
      `We are excited to have you on board and look forward to achieving great things together.`,
      ``,
      `Welcome to the FHI family! 🏡✨`,
      ``,
      `Together, we build futures.`,
      ``,
      `Warm regards,`,
      approverName,
      signTitle,
    ].join("\n")

    let sendError: string | null = null
    try {
      await sendAdminDirectEmail({
        to,
        subject,
        message,
        // The body carries the personal sign-off; the template footer stays
        // the generic brand block so the name isn't printed twice.
        senderName: null,
        ...(mailbox ? { fromAccount: { address: mailbox, name: input.approver.name } } : {}),
      })
    } catch (err) {
      sendError = err instanceof Error ? err.message : String(err)
    }

    // The approver's Sent folder shows it; a failed send shows there too,
    // honestly marked, instead of vanishing.
    await admin.from("inquiry_emails").insert({
      to_email: to.toLowerCase(),
      to_name: input.targetName ?? null,
      subject,
      body_text: message,
      sent_by: input.approver.id,
      sent_by_name: approverName,
      status: sendError ? "failed" : "sent",
      error: sendError,
      from_email: mailbox ?? ((process.env.SMTP_FROM_EMAIL ?? "").trim().toLowerCase() || null),
    })

    return !sendError
  } catch {
    return false
  }
}
