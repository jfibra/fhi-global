"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { allowRequest, clientIp } from "@/lib/rate-limit"
import { JD_COOKIE, JD_SESSION_SECONDS, checkJohndorfLogin, newJohndorfSession } from "@/lib/johndorf/session"

export type JohndorfLoginState = { error?: string }

/** Sign in to the Johndorf presentation (lib/johndorf/session.ts). */
export async function signInJohndorf(_: JohndorfLoginState, formData: FormData): Promise<JohndorfLoginState> {
  const ip = clientIp(new Headers(await headers()))
  if (!allowRequest(`johndorf-login:${ip}`, 10, 5 * 60_000)) {
    return { error: "Too many attempts — please wait a few minutes and try again." }
  }
  const user = String(formData.get("username") ?? "")
  const pass = String(formData.get("password") ?? "")
  if (!checkJohndorfLogin(user, pass)) return { error: "Wrong username or password." }

  ;(await cookies()).set(JD_COOKIE, newJohndorfSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: JD_SESSION_SECONDS,
  })
  redirect("/johndorf/dashboard")
}

export async function signOutJohndorf(): Promise<void> {
  ;(await cookies()).delete(JD_COOKIE)
  redirect("/johndorf")
}
