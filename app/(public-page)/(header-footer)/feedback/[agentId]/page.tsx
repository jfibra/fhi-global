import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Image from "next/image"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { ROLES_SALES_PIPELINE, normalizeAppRole } from "@/lib/app-roles"
import { FeedbackForm } from "./feedback-form"

// A customer's private review link — not something search engines should list.
export const metadata: Metadata = {
  title: "Customer Feedback",
  robots: { index: false, follow: false },
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function FeedbackPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params
  if (!UUID_RE.test(agentId)) notFound()

  // Service role with an explicit column list — the anon key can't read
  // profiles, and the page needs only the advisor's public face.
  const admin = createAdminSupabase()
  const { data: agent } = await admin
    .from("profiles")
    .select("id, fullname, profile_url, role, status, is_deleted")
    .eq("id", agentId)
    .maybeSingle<{
      id: string
      fullname: string | null
      profile_url: string | null
      role: string | null
      status: string | null
      is_deleted: boolean | null
    }>()

  const role = normalizeAppRole(agent?.role)
  const salesRoles = new Set<string>([...ROLES_SALES_PIPELINE])
  if (!agent || agent.is_deleted || agent.status !== "active" || !role || !salesRoles.has(role)) {
    notFound()
  }

  const advisorName = agent.fullname?.trim() || "Your FHI Global Advisor"

  return (
    <div className="bg-[#f5f6f8] min-h-screen">
      {/* Navy masthead — mirrors the printed form's letterhead */}
      <section className="bg-[#001f3f] border-b-[3px] border-[#d6b357]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#d6b357] mb-3">
            FHI Global Property · United Arab Emirates
          </p>
          <h1 className="font-['Outfit'] text-3xl md:text-4xl font-bold text-white tracking-tight">
            Customer Feedback Review
          </h1>
          <p className="text-white/70 text-sm leading-relaxed mt-3 max-w-xl mx-auto">
            Your feedback helps us improve the performance and service standards of our real
            estate advisors.
          </p>

          {/* The advisor being reviewed */}
          <div className="mt-6 inline-flex items-center gap-3 bg-white/10 border border-white/20 px-5 py-3">
            {agent.profile_url ? (
              <Image
                src={agent.profile_url}
                alt={advisorName}
                width={40}
                height={40}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <span className="w-10 h-10 rounded-full bg-[#d6b357] flex items-center justify-center font-bold text-[#001f3f]">
                {advisorName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="text-left">
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#d6b357]">
                Reviewing
              </span>
              <span className="block text-sm font-bold text-white">{advisorName}</span>
            </span>
          </div>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <FeedbackForm agentId={agent.id} advisorName={advisorName} />
      </div>
    </div>
  )
}
