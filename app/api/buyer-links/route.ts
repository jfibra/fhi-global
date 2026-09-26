import { NextRequest, NextResponse } from "next/server"
import { randomInt } from "node:crypto"
import { z } from "zod"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_BUYER_LINK_OWNERS } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { BUYER_LINK_COLUMNS, BUYER_LINK_MAX_PROJECTS, livePublishedProjectIds } from "@/lib/buyer-links"

// Create a Buyers Link (migration 060) for the signed-in agent. The owner is
// always the session user; only live, published projects are kept.

export const runtime = "nodejs"

const LinkSchema = z.object({
  title: z.string().trim().min(1, "Give the link a title.").max(120, "Keep the title under 120 characters."),
  note: z.string().trim().max(1000, "Keep the note under 1,000 characters.").optional().default(""),
  projectIds: z
    .array(z.number().int().positive())
    .min(1, "Pick at least one project.")
    .max(BUYER_LINK_MAX_PROJECTS, `Pick up to ${BUYER_LINK_MAX_PROJECTS} projects.`),
})

const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz"
const newCode = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")

export async function POST(req: NextRequest) {
  const guard = await requireRole([...ROLES_BUYER_LINK_OWNERS])
  if (!guard.ok) return guard.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }
  const parsed = LinkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check the form." }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const projectIds = await livePublishedProjectIds(admin, [...new Set(parsed.data.projectIds)])
  if (projectIds.length === 0) {
    return NextResponse.json({ error: "None of those projects are published any more." }, { status: 400 })
  }

  // 31^8 codes — a clash is vanishingly rare, but retry on the unique index.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await admin
      .from("buyer_links")
      .insert({
        agent_id: guard.context.userId,
        code: newCode(),
        title: parsed.data.title,
        note: parsed.data.note || null,
        project_ids: projectIds,
      })
      .select(BUYER_LINK_COLUMNS)
      .single()
    if (!error) return NextResponse.json({ link: data })
    if (error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ error: "Could not create the link — please try again." }, { status: 500 })
}
