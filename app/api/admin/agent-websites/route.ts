import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { agentSiteMissing } from "@/lib/agent-site"

// Admin → Agent Resource → Agent Websites: every agent's Website Builder site,
// live or taken down, with its owner. Admin staff only. The actions live in
// ./[id]/route.ts (take down / restore, permanent delete, preview data).

export const runtime = "nodejs"

export type AdminAgentWebsite = {
  id: string
  agentId: string
  slug: string
  title: string
  /** false = taken down (soft-deleted): off the public page, directory, sitemap — the data is kept. */
  live: boolean
  /** Offered to search engines (name, bio, portrait filled in). */
  complete: boolean
  createdAt: string | null
  updatedAt: string | null
  agent: { name: string; role: string | null; photo: string | null; status: string | null }
}

type Row = {
  id: string
  agent_id: string
  slug: string | null
  title: string | null
  is_published: boolean | null
  created_at: string | null
  updated_at: string | null
  contact: { name?: string } | null
  about: { bio: string | null; photo: string | null } | null
}

export async function GET() {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  try {
    const admin = createAdminSupabase()
    const rows: Row[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin
        .from("website_builder")
        .select("id, agent_id, slug, title, is_published, created_at, updated_at, contact, about:about_id(bio, photo)")
        .order("updated_at", { ascending: false })
        .range(from, from + 999)
      if (error) throw error
      rows.push(...((data ?? []) as unknown as Row[]))
      if (!data || data.length < 1000) break
    }
    const ids = [...new Set(rows.map((r) => r.agent_id))]
    const people = new Map<string, { fullname: string | null; fname: string | null; lname: string | null; role: string | null; profile_url: string | null; status: string | null }>()
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await admin.from("profiles").select("id, fullname, fname, lname, role, profile_url, status").in("id", ids.slice(i, i + 200))
      if (error) throw error
      for (const p of data ?? []) people.set(p.id as string, p as never)
    }
    const sites: AdminAgentWebsite[] = rows
      .filter((r) => r.slug)
      .map((r) => {
        const p = people.get(r.agent_id)
        const name = p?.fullname?.trim() || [p?.fname, p?.lname].filter(Boolean).join(" ").trim() || r.contact?.name?.trim() || "Unnamed agent"
        return {
          id: r.id,
          agentId: r.agent_id,
          slug: r.slug as string,
          title: r.title ?? "",
          live: r.is_published !== false,
          complete: agentSiteMissing({ name: r.contact?.name ?? "", bio: r.about?.bio ?? "", portrait: r.about?.photo ?? "" }).length === 0,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          agent: { name, role: p?.role ?? null, photo: p?.profile_url ?? r.about?.photo ?? null, status: p?.status ?? null },
        }
      })
    return NextResponse.json({ sites })
  } catch {
    return NextResponse.json({ error: "Couldn't load the agent websites." }, { status: 500 })
  }
}
