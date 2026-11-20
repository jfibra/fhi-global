import "server-only"

import type { createAdminSupabase } from "@/lib/admin-supabase"
import { parseName } from "@/lib/parse-name"
import type { MerchantSignupInfo } from "@/lib/merchant-signup"

/**
 * The merchant record a sign-up creates (migration 092), on both sign-up
 * paths — the email-code step and Google finalize. Idempotent: a second run
 * for the same account changes nothing. The account itself is active from
 * sign-up (the merchant must log in to upload its documents); the record
 * starts in `onboarding` and the admins gate it from there.
 */
export async function createMerchantRecord(
  admin: ReturnType<typeof createAdminSupabase>,
  opts: { profileId: string; agentId: string | null; info: MerchantSignupInfo },
): Promise<void> {
  const { error } = await admin
    .from("merchants")
    .upsert(
      {
        profile_id: opts.profileId,
        agent_id: opts.agentId,
        business_name: opts.info.businessName,
        category: opts.info.category,
        signatory_name: opts.info.contactName,
        status: "onboarding",
      },
      { onConflict: "profile_id", ignoreDuplicates: true },
    )
  if (error) throw new Error(error.message)
}

/** The account's name from the signatory's: "Khalid Al Mansoori" → fname / lname / fullname. */
export function merchantAccountName(info: MerchantSignupInfo): { fname: string | null; lname: string | null; fullname: string } {
  const parsed = parseName(info.contactName)
  return { fname: parsed.first || info.contactName, lname: parsed.last || null, fullname: info.contactName }
}
