import Image from "next/image"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { JD_COOKIE, isJohndorfSession } from "@/lib/johndorf/session"
import { JohndorfLoginForm } from "./login-form"

export const dynamic = "force-dynamic"

/** fhiglobal.ae/johndorf — the Johndorf presentation's sign-in (lib/johndorf/session.ts). */
export default async function JohndorfLoginPage() {
  if (isJohndorfSession((await cookies()).get(JD_COOKIE)?.value)) redirect("/johndorf/dashboard")

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="absolute inset-x-0 top-0 h-1 bg-[#b4241c]" />

      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex justify-center">
          <Image src="/johndorf/logo.png" alt="Johndorf Ventures Corporation" width={391} height={186} priority className="h-auto w-[230px]" />
        </div>

        <div className="rounded-lg border border-[#ece5e2] bg-white p-7 shadow-[0_20px_50px_-28px_rgba(80,20,15,0.35)] sm:p-8">
          <h1 className="font-[family-name:var(--font-jd-serif)] text-[28px] font-semibold leading-tight text-[#2a1d1b]">Sign in</h1>
          <p className="mt-1.5 mb-6 text-sm text-[#7d6c68]">Welcome to the Johndorf portal.</p>
          <JohndorfLoginForm />
        </div>

        <p className="mt-8 text-center text-[11px] uppercase tracking-[0.18em] text-[#a89c98]">
          © {new Date().getFullYear()} Johndorf Ventures Corporation
        </p>
      </div>
    </main>
  )
}
