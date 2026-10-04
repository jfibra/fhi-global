import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { JD_COOKIE, isJohndorfSession } from "@/lib/johndorf/session"
import { JohndorfLanding } from "./landing"

export const dynamic = "force-dynamic"
export const metadata = { title: "Home" }

/** After signing in: Johndorf's landing page (lib/johndorf/company.ts); the Montierra plan is one click away. */
export default async function JohndorfHomePage() {
  if (!isJohndorfSession((await cookies()).get(JD_COOKIE)?.value)) redirect("/johndorf")
  return <JohndorfLanding />
}
