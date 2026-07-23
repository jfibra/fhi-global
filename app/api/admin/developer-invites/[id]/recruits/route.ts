import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"

// List the accounts that redeemed a developer invite link: who created the link,
// and for each registrant their name, email, selected developer, and status.
// Admin-only; reads via the service-role client (profiles/auth are RLS-guarded).

export const runtime = "nodejs"

const MAX_RECRUITS = 200

type ProfileRow = {
  id: string
  fname: string | null
  lname: string | null
  fullname: string | null
  role: string | null
  status: string | null
  is_deleted: boolean | null
  joined_at: string | null
  metadata: Record<string, unknown> | null
}

function nameOf(p: { fname: string | null; lname: string | null; fullname: string | null }): string {
  return (
    p.fullname?.trim() ||
    [p.fname, p.lname].filter(Boolean).join(" ").trim() ||
    "—"
  )
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const { id } = await params
  const admin = createAdminSupabase()

  // The link + who created it.
  const { data: invite } = await admin
    .from("developer_invites")
    .select("id, created_by")
    .eq("id", id)
    .maybeSingle<{ id: string; created_by: string | null }>()
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 })

  let createdBy: { id: string; name: string } | null = null
  if (invite.created_by) {
    const { data: creator } = await admin
      .from("profiles")
      .select("id, fname, lname, fullname")
      .eq("id", invite.created_by)
      .maybeSingle<{ id: string; fname: string | null; lname: string | null; fullname: string | null }>()
    if (creator) createdBy = { id: creator.id, name: nameOf(creator) }
  }

  // Accounts created through this link (metadata.developer_invite_id === id).
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, fname, lname, fullname, role, status, is_deleted, joined_at, metadata")
    .eq("metadata->>developer_invite_id", id)
    .order("joined_at", { ascending: false })
    .limit(MAX_RECRUITS)

  const rows = (profiles as ProfileRow[] | null) ?? []

  // Resolve selected developers in one query.
  const developerIds = Array.from(
    new Set(
      rows
        .map((p) => (typeof p.metadata?.developer_id === "string" ? (p.metadata.developer_id as string) : null))
        .filter((v): v is string => !!v),
    ),
  )
  const developerNames = new Map<string, string>()
  if (developerIds.length > 0) {
    const { data: devs } = await admin.from("developers").select("id, name").in("id", developerIds)
    for (const d of (devs as { id: string; name: string }[] | null) ?? []) developerNames.set(d.id, d.name)
  }

  // Emails live in auth.users — look each up (bounded by MAX_RECRUITS).
  const recruits = await Promise.all(
    rows.map(async (p) => {
      let email: string | null = null
      try {
        const { data } = await admin.auth.admin.getUserById(p.id)
        email = data?.user?.email ?? null
      } catch {
        /* best-effort */
      }
      const developerId = typeof p.metadata?.developer_id === "string" ? (p.metadata.developer_id as string) : null
      return {
        id: p.id,
        name: nameOf(p),
        email,
        role: p.role,
        status: p.status,
        isDeleted: p.is_deleted === true,
        developerId,
        developerName: developerId ? developerNames.get(developerId) ?? null : null,
        joinedAt: p.joined_at,
      }
    }),
  )

  return NextResponse.json({ createdBy, count: recruits.length, recruits })
}
