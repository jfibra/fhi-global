import { redirect } from "next/navigation"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { resolveInviteToken, type InviteDeveloper } from "@/lib/developer-invites"
import { JoinRegisterUI } from "./join-register-ui"

export const dynamic = "force-dynamic"
export const metadata = { robots: { index: false, follow: false } }

const INVALID_COPY: Record<string, { title: string; body: string }> = {
  expired: { title: "This invite link has expired", body: "Ask the person who invited you for a fresh link." },
  used_up: { title: "This invite link is no longer available", body: "It has reached its maximum number of sign-ups." },
  revoked: { title: "This invite link was turned off", body: "Ask your administrator to send you a new one." },
  invalid: { title: "This invite link isn't valid", body: "Double-check the link, or ask for a new one." },
}

function InvalidState({ status }: { status: string }) {
  const copy = INVALID_COPY[status] ?? INVALID_COPY.invalid
  return (
    <div className="min-h-[100dvh] bg-[#f4f6f9] flex items-center justify-center p-4">
      <div className="bg-white rounded-[24px] border border-[#e8eaed] shadow-[0_8px_48px_-8px_rgba(0,31,63,0.12)] p-8 max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle className="w-7 h-7 text-rose-500" />
        </div>
        <h1 className="font-['Outfit'] text-xl font-bold text-[#0d1117] mb-2">{copy.title}</h1>
        <p className="text-sm text-[#6b7280] mb-6">{copy.body}</p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#002952] transition-colors"
        >
          Go to FHI Global
        </Link>
      </div>
    </div>
  )
}

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const resolved = await resolveInviteToken(token)

  if (resolved.status !== "valid") {
    return <InvalidState status={resolved.status} />
  }

  // Already signed in → send to dashboard (mirrors /register).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect("/dashboard")

  // Generic link → provide the active developer list for the picker.
  let developers: InviteDeveloper[] = []
  if (!resolved.config.developer) {
    const pub = createPublicSupabaseClient()
    const { data } = await pub
      .from("developers")
      .select("id, name, slug, logo_url, is_verified")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name")
    developers = (data as InviteDeveloper[] | null) ?? []
  }

  return (
    <JoinRegisterUI
      token={token}
      autoActivate={resolved.config.autoActivate}
      boundDeveloper={resolved.config.developer}
      developers={developers}
    />
  )
}
