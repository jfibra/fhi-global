"use server"

import { redirect } from "next/navigation"
import { ensureProfileForUser, getDashboardRouteByRole, isInactiveProfile } from "@/lib/auth"
import { isDeveloperRole } from "@/lib/app-roles"
import { createClient, hasServerSupabaseEnv } from "@/lib/supabase/server"
import { logAuditEvent, requestContextFromHeaders } from "@/lib/audit-log"
import { isValidUsername, usernameToEmail } from "@/lib/developer-accounts"

export type DeveloperLoginState = {
  error?: string
}

/**
 * Username + password sign-in for the /developer-login page. Developer partner
 * accounts have no real email — the username maps to a synthetic auth address
 * (lib/developer-accounts.ts). This page is EXCLUSIVE to role='developer'
 * accounts; anyone else is signed back out and pointed at /staff-login. Unlike
 * the staff page, these accounts carry an admin-set password, so this is a real
 * credential check (no shared default password).
 */
export async function developerLoginAction(_: DeveloperLoginState, formData: FormData): Promise<DeveloperLoginState> {
  if (!hasServerSupabaseEnv()) {
    return { error: "Supabase environment variables are not configured." }
  }

  const username = String(formData.get("username") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  if (!username || !password) return { error: "Username and password are required." }
  // Same generic error as a bad password — never reveal whether a username exists.
  if (!isValidUsername(username)) return { error: "Invalid username or password." }

  const email = usernameToEmail(username)
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    const ctx = await requestContextFromHeaders()
    await logAuditEvent({
      category: "auth",
      event: "login_failed",
      source: "auth",
      description: `Failed developer sign-in for username ${username}`,
      ...ctx,
    })
    const m = (error?.message ?? "").toLowerCase()
    if (m.includes("too many") || m.includes("rate")) return { error: "Too many attempts. Wait a minute and try again." }
    return { error: "Invalid username or password." }
  }

  const { profile, error: profileError } = await ensureProfileForUser(supabase, {
    id: data.user.id,
    email: data.user.email,
    user_metadata: data.user.user_metadata,
  })

  if (profileError || !profile) {
    await supabase.auth.signOut()
    return { error: profileError?.message ? `Profile setup failed: ${profileError.message}` : "Profile setup failed." }
  }

  // Exclusive to developer accounts — a non-developer must use /staff-login.
  if (!isDeveloperRole(profile.role)) {
    await supabase.auth.signOut()
    return { error: "This login is for developer accounts. Staff sign in at /staff-login." }
  }

  // Complete but still pending → hold on the awaiting-approval screen. Developers
  // are exempt from the profile-completion gate, so we never bounce there.
  if (isInactiveProfile(profile)) {
    redirect("/account-inactive")
  }

  const ctx = await requestContextFromHeaders()
  await logAuditEvent({
    category: "auth",
    event: "login",
    source: "auth",
    actor: { id: data.user.id, name: profile.fullname, role: profile.role },
    description: "Signed in with username (developer)",
    ...ctx,
  })

  redirect(getDashboardRouteByRole(profile.role))
}
