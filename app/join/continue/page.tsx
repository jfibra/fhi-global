import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { resolveInviteToken } from "@/lib/developer-invites"
import { JoinContinuePanel } from "./continue-panel"

// Post-Google-redirect landing for the developer-invite flow (LR-free). The
// session is already established by /auth/callback. Shows a confirm modal, then
// /api/developer-invite/finalize provisions the developer account.

export const dynamic = "force-dynamic"
export const metadata = { robots: { index: false, follow: false } }

function Blocked({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-h-[100dvh] bg-[#f4f6f9] flex items-center justify-center p-4">
      <div className="bg-white rounded-[24px] border border-[#e8eaed] shadow-lg p-8 max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle className="w-7 h-7 text-amber-500" />
        </div>
        <h1 className="font-['Outfit'] text-xl font-bold text-[#0d1117] mb-2">{title}</h1>
        <p className="text-sm text-[#6b7280] mb-6">{body}</p>
        <Link href="/login" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#002952]">
          Go to sign in
        </Link>
      </div>
    </div>
  )
}

export default async function JoinContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ dev_invite?: string; dev?: string; dev_new?: string }>
}) {
  const { dev_invite = "", dev = "", dev_new = "" } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return <Blocked title="Sign-in expired" body="Please open your invite link again and continue with Google." />
  }

  const resolved = await resolveInviteToken(dev_invite)
  if (resolved.status !== "valid") {
    return <Blocked title="This invite link is no longer valid" body="Ask your administrator for a fresh link." />
  }

  // Guard: an already-provisioned / curated account must not be silently rebound.
  const admin = createAdminSupabase()
  const { data: profile } = await admin
    .from("profiles")
    .select("role, metadata")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null; metadata: Record<string, unknown> | null }>()
  const meta = profile?.metadata ?? {}
  if (meta.google_provisioned === true || (profile?.role && profile.role !== "member")) {
    return (
      <Blocked
        title="This Google account already belongs to an FHI user"
        body="Sign in with it instead — invite links are only for creating new accounts."
      />
    )
  }

  const gmeta = user.user_metadata ?? {}
  const google = {
    email: user.email ?? "",
    name:
      (typeof gmeta.full_name === "string" && gmeta.full_name) ||
      (typeof gmeta.name === "string" && gmeta.name) ||
      (user.email ?? ""),
    picture:
      (typeof gmeta.avatar_url === "string" && gmeta.avatar_url) ||
      (typeof gmeta.picture === "string" && gmeta.picture) ||
      null,
  }

  return (
    <JoinContinuePanel
      token={dev_invite}
      chosenDeveloperId={dev || null}
      newDeveloperName={dev_new || null}
      boundDeveloper={resolved.config.developer}
      autoActivate={resolved.config.autoActivate}
      google={google}
    />
  )
}
