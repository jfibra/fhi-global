import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient, hasServerSupabaseEnv } from "@/lib/supabase/server"
import { createPageMetadata } from "@/lib/seo"
import { RegisterUI } from "@/app/register/register-ui"

export const dynamic = "force-dynamic"

export const metadata: Metadata = createPageMetadata({
  title: "Developer Registration | FHI Global",
  description: "Create your developer account on FHI Global.",
  pathname: "/register/developer",
})

export default async function DeveloperRegisterPage() {
  if (hasServerSupabaseEnv()) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) redirect("/dashboard")
  }

  if (!hasServerSupabaseEnv()) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-2xl border border-[#e8eaed] bg-white p-7 shadow-[0_8px_32px_-12px_rgba(0,31,63,0.25)]">
          <h1 className="text-2xl font-bold text-[#0d1117]">Supabase not configured</h1>
          <p className="mt-2 text-sm text-[#4b5563]">
            Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>.env.local</code>, then restart the dev server.
          </p>
        </div>
      </div>
    )
  }

  return <RegisterUI defaultAccountType="developer" />
}

