import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { JD_COOKIE, isJohndorfSession } from "@/lib/johndorf/session"
import { Entrance } from "./entrance"
import { JohndorfLoginForm } from "./login-form"

export const dynamic = "force-dynamic"

/** fhiglobal.ae/johndorf — the Johndorf presentation's entrance and sign-in (lib/johndorf/session.ts). */
export default async function JohndorfLoginPage() {
  if (isJohndorfSession((await cookies()).get(JD_COOKIE)?.value)) redirect("/johndorf/dashboard")

  return (
    <Entrance>
      <JohndorfLoginForm />
    </Entrance>
  )
}
