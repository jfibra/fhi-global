"use server"

import { redirect } from "next/navigation"
import { ensureProfileForUser, getDashboardRouteByRole, isInactiveProfile } from "@/lib/auth"
import { createClient, hasServerSupabaseEnv } from "@/lib/supabase/server"

export type LoginState = {
  error?: string
}

export async function loginAction(_: LoginState, formData: FormData): Promise<LoginState> {
  if (!hasServerSupabaseEnv()) {
    return { error: "Supabase environment variables are not configured." }
  }

  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!email || !password) {
    return { error: "Email and password are required." }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    return { error: "Invalid email or password." }
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

  redirect(getDashboardRouteByRole(profile.role))
}
