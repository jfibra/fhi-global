"use server"

import { createClient, hasServerSupabaseEnv } from "@/lib/supabase/server"

export type RegisterState = {
  error?: string
  success?: boolean
}

export async function registerAction(_: RegisterState, formData: FormData): Promise<RegisterState> {
  if (!hasServerSupabaseEnv()) {
    return { error: "Supabase environment variables are not configured." }
  }

  const firstName  = String(formData.get("firstName")  ?? "").trim()
  const lastName   = String(formData.get("lastName")   ?? "").trim()
  const email      = String(formData.get("email")      ?? "").trim()
  const password   = String(formData.get("password")   ?? "")
  const confirmPwd = String(formData.get("confirmPassword") ?? "")

  if (!firstName || !lastName || !email || !password) {
    return { error: "All fields are required." }
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." }
  }

  if (password !== confirmPwd) {
    return { error: "Passwords do not match." }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name:  lastName,
        full_name:  `${firstName} ${lastName}`,
      },
    },
  })

  if (error) {
    if (error.message.includes("already registered") || error.message.includes("User already registered")) {
      return { error: "An account with this email already exists." }
    }
    return { error: error.message }
  }

  return { success: true }
}
