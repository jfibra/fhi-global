import Image from "next/image"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { LogOut } from "lucide-react"
import { JD_COOKIE, isJohndorfSession } from "@/lib/johndorf/session"
import { signOutJohndorf } from "../actions"
import { MontierraMap } from "./montierra-map"

export const dynamic = "force-dynamic"
export const metadata = { title: "Montierra" }

/** Signed in: Montierra's subdivision plan, block by block (lib/johndorf/montierra.ts). */
export default async function JohndorfDashboardPage() {
  if (!isJohndorfSession((await cookies()).get(JD_COOKIE)?.value)) redirect("/johndorf")

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[#ece5e2] bg-white/95 backdrop-blur">
        <div className="h-1 bg-[#b4241c]" />
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-4">
            <Image src="/johndorf/logo.png" alt="Johndorf Ventures Corporation" width={391} height={186} className="h-auto w-[96px]" unoptimized />
            <span className="hidden h-8 w-px bg-[#ece5e2] sm:block" />
            <Image src="/johndorf/montierra-wordmark.png" alt="Montierra" width={462} height={97} className="hidden h-auto w-[120px] sm:block" unoptimized />
          </div>
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

      <main className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b4241c]">Johndorf Ventures Corporation</p>
            <h1 className="mt-1 font-[family-name:var(--font-jd-serif)] text-4xl font-semibold text-[#2a1d1b]">Montierra</h1>
          </div>
          {/* Honest about the bookings and models: they're placeholders for the presentation. */}
          <span className="rounded-full border border-[#e3dcd8] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a89c98]" title="House models and reservations shown here are sample data">
            Demo data
          </span>
        </div>
        <MontierraMap />
      </main>
    </div>
  )
}
