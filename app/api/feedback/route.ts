import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { allowRequest, clientIp } from "@/lib/rate-limit"
import { ROLES_SALES_PIPELINE } from "@/lib/app-roles"
import { normalizeAppRole } from "@/lib/app-roles"

/**
 * Public customer-feedback endpoint (the per-agent form at
 * /feedback/[agentId]). Unauthenticated by design — customers have no
 * account. Inserts run through the service-role client; the table has no
 * client write path. Zod-validated, honeypot-guarded, per-IP rate-limited.
 * The advisor's name is snapshotted SERVER-SIDE from the profile — a caller
 * can never inject it.
 */

export const runtime = "nodejs"

const score = z.number().int().min(1).max(5)

const FeedbackSchema = z.object({
  agentId: z.string().uuid("Invalid feedback link."),
  clientName: z.string().trim().min(1, "Please enter your name.").max(200),
  propertyRef: z.string().trim().max(300).optional().default(""),
  transactionType: z.enum(["buy", "resell", "rent"]).nullable().optional(),
  transactionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date.")
    .nullable()
    .optional(),
  overallRating: score,
  scores: z.object({
    communication: score,
    market: score,
    understanding: score,
    professionalism: score,
    negotiation: score,
    process: score,
    experience: score,
  }),
  recommend: z.enum(["definitely_not", "unlikely", "not_sure", "likely", "very_likely", "definitely_yes"], {
    message: "Tell us how likely you are to recommend this advisor.",
  }),
  didWell: z.string().trim().max(3000).optional().default(""),
  toImprove: z.string().trim().max(3000).optional().default(""),
  otherComments: z.string().trim().max(3000).optional().default(""),
  website: z.string().optional().default(""), // honeypot — humans leave this empty
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const parsed = FeedbackSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json({ error: first?.message ?? "Invalid input." }, { status: 400 })
  }
  const input = parsed.data

  // Honeypot: pretend success so bots learn nothing.
  if (input.website.trim() !== "") return NextResponse.json({ ok: true })

  const ip = clientIp(req.headers)
  if (!allowRequest(`feedback:${ip}`, 5, 60_000)) {
    return NextResponse.json(
      { error: "Too many submissions from your connection — please try again in a minute." },
      { status: 429 },
    )
  }

  const admin = createAdminSupabase()

  // The link must point at a real, active member of the sales ladder.
  const { data: agent } = await admin
    .from("profiles")
    .select("id, fullname, role, status, is_deleted")
    .eq("id", input.agentId)
    .maybeSingle<{ id: string; fullname: string | null; role: string | null; status: string | null; is_deleted: boolean | null }>()

  const role = normalizeAppRole(agent?.role)
  const salesRoles = new Set<string>([...ROLES_SALES_PIPELINE])
  if (!agent || agent.is_deleted || agent.status !== "active" || !role || !salesRoles.has(role)) {
    return NextResponse.json({ error: "This feedback link is no longer active." }, { status: 404 })
  }

  const { data: row, error } = await admin
    .from("agent_feedback")
    .insert({
      agent_id: agent.id,
      agent_name: agent.fullname,
      client_name: input.clientName,
      property_ref: input.propertyRef || null,
      transaction_type: input.transactionType ?? null,
      transaction_date: input.transactionDate ?? null,
      overall_rating: input.overallRating,
      score_communication: input.scores.communication,
      score_market: input.scores.market,
      score_understanding: input.scores.understanding,
      score_professionalism: input.scores.professionalism,
      score_negotiation: input.scores.negotiation,
      score_process: input.scores.process,
      score_experience: input.scores.experience,
      recommend: input.recommend,
      did_well: input.didWell || null,
      to_improve: input.toImprove || null,
      other_comments: input.otherComments || null,
      ip_address: ip,
      user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    })
    .select("id")
    .single<{ id: string }>()

  if (error) {
    return NextResponse.json({ error: "Could not save your feedback — please try again." }, { status: 500 })
  }

  await logAuditEvent({
    category: "feedback",
    event: "feedback_submitted",
    source: "public",
    subjectType: "agent_feedback",
    subjectId: row.id,
    subjectLabel: agent.fullname ?? agent.id,
    description: `Customer feedback for ${agent.fullname ?? "an advisor"} — ${input.overallRating}/5 from ${input.clientName}`,
    newValues: { agentId: agent.id, overallRating: input.overallRating, recommend: input.recommend },
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ ok: true })
}
