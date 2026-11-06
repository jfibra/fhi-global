import "server-only"

import type { createAdminSupabase } from "@/lib/admin-supabase"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { getDashboardRouteByRole } from "@/lib/auth"
import { hasMailerConfig, sendLeadInquiryEmail } from "@/lib/mailer"
import { SITE_URL } from "@/lib/seo"

type Admin = ReturnType<typeof createAdminSupabase>

/**
 * "A new lead just came in" to every admin — the email the Inquire Now form
 * sends (app/api/inquiries), shared with the website chat's lead form
 * (app/api/site-chat/lead). Best-effort: a mail hiccup never loses the lead,
 * and each admin's address comes from auth, never from the profile.
 */
export async function notifyAdminsOfLead(
  admin: Admin,
  inquiryId: string,
  lead: Parameters<typeof sendLeadInquiryEmail>[0]["lead"],
): Promise<void> {
  if (!hasMailerConfig()) return
  try {
    const { data: admins } = await admin.from("profiles").select("id, fullname, role").in("role", [...ROLES_ADMIN_STAFF])
    await Promise.all(
      (admins ?? []).map(async (a) => {
        const authUser = await admin.auth.admin.getUserById(String(a.id)).catch(() => null)
        const to = authUser?.data?.user?.email
        if (!to) return
        await sendLeadInquiryEmail({
          to,
          adminName: typeof a.fullname === "string" ? a.fullname : null,
          lead,
          // /leads/[id] forwards to the inbox with the conversation open (LeadDetailClient).
          dashboardUrl: `${SITE_URL}${getDashboardRouteByRole(a.role as string)}/leads/${inquiryId}`,
        }).catch(() => {})
      }),
    )
  } catch (e) {
    console.error("[lead-notify] admin notification failed:", e instanceof Error ? e.message : e)
  }
}
