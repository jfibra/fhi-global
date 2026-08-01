import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient, hasServerSupabaseEnv } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { createPageMetadata } from "@/lib/seo"
import { RegisterUI, type Referrer } from "@/app/(public-page)/(auth)/register/register-ui"

export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Resolve the inviter behind ?ref=<id> to a safe display card (name + role).
 * Best-effort: a bad/unknown/deleted ref just yields null, and the right panel
 * falls back to the default marketing hero. Uses the service-role client so it
 * works for logged-out visitors regardless of RLS; returns only public fields.
 */
async function resolveReferrer(refId: string | null): Promise<Referrer> {
  if (!refId || !UUID_RE.test(refId)) return null
  try {
    const admin = createAdminSupabase()
    const { data } = await admin
      .from("profiles")
      .select("fname, lname, fullname, role, profile_url, is_deleted, metadata")
      .eq("id", refId)
      .maybeSingle<{ fname: string | null; lname: string | null; fullname: string | null; role: string | null; profile_url: string | null; is_deleted: boolean | null; metadata: Record<string, unknown> | null }>()
    if (!data || data.is_deleted === true) return null
    const name =
      data.fullname?.trim() ||
      [data.fname, data.lname].filter(Boolean).join(" ").trim() ||
      "Your inviter"
    const meta = data.metadata ?? {}
    const nationality = typeof meta.nationality === "string" ? meta.nationality : null
    const dial = typeof meta.phone_country_code === "string" ? meta.phone_country_code : ""
    const num = typeof meta.phone_number === "string" ? meta.phone_number : ""
    const phone = num ? `${dial} ${num}`.trim() : null
    const authRes = await admin.auth.admin.getUserById(refId).catch(() => null)
    const email = authRes?.data?.user?.email ?? null
    return { name, role: data.role ?? "agent", avatarUrl: data.profile_url ?? null, nationality, email, phone }
  } catch {
    return null
  }
}

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

  const referrer = await resolveReferrer(inviteRef)

  return <RegisterUI defaultAccountType={defaultAccountType} inviteRef={inviteRef} referrer={referrer} />
}
