import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient, hasServerSupabaseEnv } from "@/lib/supabase/server"
import { createPageMetadata } from "@/lib/seo"
import { TopBar } from "@/components/topbar"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { RegisterUI } from "@/app/register/register-ui"

export const dynamic = "force-dynamic"

export const metadata: Metadata = createPageMetadata({
  title: "Create Account | FHI Global",
  description: "Create your FHI Global account.",
})

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; role?: string; ref?: string }>
}) {
  const sp = await searchParams
  const requestedType = (sp.type ?? sp.role ?? "").toLowerCase()
  const defaultAccountType = requestedType === "developer" ? "developer" : "member"
  const inviteRef = typeof sp.ref === "string" ? sp.ref : null

  // If already logged in, redirect to dashboard
  if (hasServerSupabaseEnv()) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) redirect("/dashboard")
  }

  if (!hasServerSupabaseEnv()) {
    return (
      <>
        <TopBar />
        <Header />
        <div className="min-h-[60vh] bg-[#f4f6f9] flex items-center justify-center px-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#e8eaed] bg-white p-7 shadow-[0_8px_32px_-12px_rgba(0,31,63,0.25)]">
            <h1 className="text-2xl font-bold text-[#0d1117]">Supabase not configured</h1>
            <p className="mt-2 text-sm text-[#4b5563]">
              Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>.env.local</code>, then restart the dev server.
            </p>
          </div>
        </div>
        <Footer />
      </>
    )
  }

  return (
    <>
      <TopBar />
      <Header />
      <RegisterUI defaultAccountType={defaultAccountType} inviteRef={inviteRef} />
      <Footer />
    </>
  )
}
