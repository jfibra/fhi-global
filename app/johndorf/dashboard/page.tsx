import Image from "next/image"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { LogOut } from "lucide-react"
import { JD_COOKIE, isJohndorfSession } from "@/lib/johndorf/session"
import { signOutJohndorf } from "../actions"

export const dynamic = "force-dynamic"
export const metadata = { title: "Home" }

/** After signing in — a holding page until the presentation's next step is built. */
export default async function JohndorfDashboardPage() {
  if (!isJohndorfSession((await cookies()).get(JD_COOKIE)?.value)) redirect("/johndorf")

  return (
    <div className="min-h-screen">
      <header className="border-b border-[#ece5e2] bg-white">
        <div className="h-1 bg-[#b4241c]" />
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Image src="/johndorf/logo.png" alt="Johndorf Ventures Corporation" width={391} height={186} className="h-auto w-[120px]" />
          <form action={signOutJohndorf}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-md border border-[#e3dcd8] px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#6b5a56] transition-colors hover:border-[#b4241c] hover:text-[#b4241c]"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b4241c]">Johndorf Ventures Corporation</p>
        <h1 className="mt-2 font-[family-name:var(--font-jd-serif)] text-4xl font-semibold text-[#2a1d1b]">Welcome</h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[#7d6c68]">You&apos;re signed in.</p>
      </main>
    </div>
  )
}
