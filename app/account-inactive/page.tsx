import type { Metadata } from "next"
import Link from "next/link"
import { Clock, ShieldAlert } from "lucide-react"
import { createPageMetadata } from "@/lib/seo"
import { createClient, hasServerSupabaseEnv } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export const metadata: Metadata = createPageMetadata({
  title: "Account Status",
  description: "Your account status.",
})

export default async function AccountInactivePage() {
  // Distinguish a brand-new account awaiting approval ("pending") from one an
  // admin has deactivated — the wording and tone should differ.
  let status: string | null = null
  if (hasServerSupabaseEnv()) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase.from("profiles").select("status").eq("id", user.id).single<{ status: string | null }>()
      status = data?.status ?? null
    }
  }

  const isPending = status === "pending" || status === null

  return (
    <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-[#e8eaed] bg-white p-8 shadow-[0_8px_32px_-12px_rgba(0,31,63,0.25)]">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${isPending ? "bg-[#d6b357]/12 text-[#b8913f]" : "bg-rose-50 text-rose-500"}`}>
            {isPending ? <Clock className="w-7 h-7" /> : <ShieldAlert className="w-7 h-7" />}
          </div>
          <h1 className="text-2xl font-bold text-[#0d1117] leading-tight">
            {isPending ? "Your account is under review" : "Account inactive"}
          </h1>
        </div>

        {isPending ? (
          <>
            <p className="mt-4 text-sm text-[#4b5563] leading-relaxed">
              Thanks for registering — your profile has been submitted and is <span className="font-semibold text-[#374151]">pending approval</span>. You&apos;ll be able to sign in once it&apos;s approved.
            </p>
          </>
        ) : (
          <>
            <p className="mt-4 text-sm text-[#4b5563] leading-relaxed">
              Your account is currently inactive.
            </p>
            <p className="mt-1 text-sm text-[#4b5563] leading-relaxed">
              Please contact the system administrator to restore access.
            </p>
          </>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="rounded-lg bg-[#001f3f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#002a52]"
          >
            Go to Homepage
          </Link>
          <form action="/logout" method="post">
            <button
              type="submit"
              className="rounded-lg border border-[#e5e5e5] px-4 py-2.5 text-sm font-semibold text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f]"
            >
              Logout
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
