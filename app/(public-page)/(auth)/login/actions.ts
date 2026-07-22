"use server"

import { redirect } from "next/navigation"
import { ensureProfileForUser, isInactiveProfile, pickSafePostLoginRedirect } from "@/lib/auth"
import { createClient, hasServerSupabaseEnv } from "@/lib/supabase/server"
import { logAuditEvent, requestContextFromHeaders } from "@/lib/audit-log"

export type LoginState = {
  error?: string
}

function signInErrorMessage(error: { message?: string } | null): string {
  const raw = String(error?.message ?? "").trim()
  const m = raw.toLowerCase()

  if (m.includes("email not confirmed") || m.includes("email_not_confirmed")) {
    return (
      "This account’s email is not confirmed. In Supabase: Authentication → Users → open the user and confirm the email, " +
      "or ask an admin to resend confirmation. Admin-created users should use the same Supabase project as this site."
    )
  }
  if (m.includes("invalid login credentials") || m.includes("invalid email or password")) {
    return (
      "Invalid email or password. Use the exact email the account was created with (try all lowercase). " +
      "If you were just added by an admin, confirm there are no extra spaces in the password you were given."
    )
  }
  if (m.includes("too many requests") || m.includes("rate limit")) {
    return "Too many sign-in attempts. Wait a few minutes and try again."
  }
  if (raw) {
    return `Sign-in failed: ${raw}`
  }
  return "Invalid email or password."
}

export async function loginAction(_: LoginState, formData: FormData): Promise<LoginState> {
  if (!hasServerSupabaseEnv()) {
    return { error: "Supabase environment variables are not configured." }
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")

  if (!email || !password) {
    return { error: "Email and password are required." }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    const ctx = await requestContextFromHeaders()
    await logAuditEvent({
      category: "auth",
      event: "login_failed",
      source: "auth",
      description: `Failed email sign-in for ${email}`,
      ...ctx,
    })
    return { error: signInErrorMessage(error) }
  }

  const { profile, error: profileError } = await ensureProfileForUser(supabase, {
    id: data.user.id,
    email: data.user.email,
    user_metadata: data.user.user_metadata,
  })

  if (profileError || !profile) {
    await supabase.auth.signOut()
    if (profileError?.message) {
      return { error: `Profile setup failed: ${profileError.message}` }
    }
    return { error: "Profile setup failed. Please contact administrator." }
  }

  if (isInactiveProfile(profile)) {
    await supabase.auth.signOut()
    redirect("/account-inactive")
  }

  const ctx = await requestContextFromHeaders()
  await logAuditEvent({
    category: "auth",
    event: "login",
    source: "auth",
    actor: { id: data.user.id, name: profile.fullname, role: profile.role },
    description: "Signed in with email",
    ...ctx,
  })

  const nextRaw = String(formData.get("next") ?? "").trim()
  redirect(pickSafePostLoginRedirect(nextRaw, profile.role))
}
