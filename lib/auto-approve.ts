import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Some inviters' recruits skip the approval queue: an account that registers
 * through their invite link starts `active` instead of `pending`. It is a
 * per-person flag admins set in the account editor
 * (profiles.metadata.auto_approve_recruits = true), made for the CEO's link
 * (2026-09-29) — never a rule for a whole role. The flag only counts while
 * the inviter is themselves an active, live account.
 */
export const AUTO_APPROVE_KEY = "auto_approve_recruits"

export async function inviterAutoApproves(admin: SupabaseClient, inviterId: string): Promise<boolean> {
  const { data } = await admin
    .from("profiles")
    .select("status, is_deleted, metadata")
    .eq("id", inviterId)
    .maybeSingle<{ status: string | null; is_deleted: boolean | null; metadata: Record<string, unknown> | null }>()
  if (!data || data.is_deleted === true || (data.status ?? "").toLowerCase() !== "active") return false
  return data.metadata?.[AUTO_APPROVE_KEY] === true
}
