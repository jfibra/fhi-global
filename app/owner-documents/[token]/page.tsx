import type { Metadata } from "next"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { getRequestByToken, requestOpenState } from "@/lib/owner-documents/server"
import { IntakeForm } from "./intake-form"

// Public, unauthenticated intake page. The token in the URL is the capability;
// it's resolved with the service-role client (like resolveReferrer on /register)
// so it works for logged-out owners regardless of RLS. Noindexed here and via
// next.config's PRIVATE_NOINDEX_HEADERS for /owner-documents/*.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Property Owner Documents",
  robots: { index: false, follow: false },
}

const CLOSED_COPY: Record<string, { title: string; body: string }> = {
  invalid: {
    title: "Link not found",
    body: "This document link is invalid or has been removed. Please ask your agent for a new link.",
  },
  expired: {
    title: "Link expired",
    body: "This document link has expired. Please ask your agent to send you a new one.",
  },
  cancelled: {
    title: "Link cancelled",
    body: "This document request was cancelled. Please contact your agent if you believe this is a mistake.",
  },
  submitted: {
    title: "Already submitted",
    body: "Your documents have already been submitted through this link. Thank you — there's nothing more to do.",
  },
}

export default async function OwnerDocumentsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminSupabase()
  const request = await getRequestByToken(admin, token)
  const state = requestOpenState(request)

  if (state === "open" && request) {
    const { data: agent } = await admin
      .from("profiles")
      .select("fullname, fname, lname, profile_url")
      .eq("id", request.agent_id)
      .maybeSingle<{ fullname: string | null; fname: string | null; lname: string | null; profile_url: string | null }>()
    const agentName =
      agent?.fullname?.trim() ||
      [agent?.fname, agent?.lname].filter(Boolean).join(" ").trim() ||
      "Your agent"
    return (
      <IntakeForm
        token={token}
        agentName={agentName}
        agentAvatarUrl={agent?.profile_url ?? null}
        agencyName={`FHI Global Property — ${agentName}`}
      />
    )
  }

  const copy = CLOSED_COPY[state] ?? { title: "Link unavailable", body: "This link is no longer available." }
  const submitted = state === "submitted"

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#001228] to-[#012a53] px-4 py-12">
      <div className="w-full max-w-md rounded-[28px] bg-white p-8 text-center shadow-2xl">
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${submitted ? "bg-emerald-50" : "bg-amber-50"}`}>
          {submitted ? <CheckCircle2 className="h-8 w-8 text-emerald-500" /> : <AlertCircle className="h-8 w-8 text-amber-500" />}
        </div>
        <h1 className="mt-5 font-['Outfit'] text-xl font-bold text-[#0d1117]">{copy.title}</h1>
        <p className="mt-2 text-sm text-[#6b7280]">{copy.body}</p>
      </div>
    </div>
  )
}
