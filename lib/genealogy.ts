import "server-only"

import type { createAdminSupabase } from "@/lib/admin-supabase"
import { titleCaseName } from "@/lib/public-profile"
import { fetchAllSales, saleCredits } from "@/lib/fhi-chat-tools"

/**
 * One account's genealogy: everyone who registered through their invite link,
 * and everyone under those, level by level — the same walk as the admin
 * Recruitment page's downline. Recruits = profiles whose metadata.invited_by is
 * the person and metadata.developer_invite_id is null (the rule everywhere).
 * Cycle-safe, capped at 12 levels. Per person: validated deal COUNTS only — no
 * amounts, the same rule as the agent assistant's my_recruits.
 *
 * The caller decides whose tree may be built (app/api/genealogy: only the
 * signed-in account's own).
 */

export type GenealogyNode = {
  id: string
  name: string
  photo: string | null
  role: string | null
  status: string
  joinedAt: string | null
  /** Validated deals (partner shares respected), all time. */
  deals: number
  /** The recruiter's id — the root's id for level 1. */
  parentId: string
  level: number
  /** Direct recruits. */
  direct: number
  /** Everyone under them, all levels. */
  network: number
}

export type Genealogy = {
  root: { id: string; name: string; photo: string | null; role: string | null }
  nodes: GenealogyNode[]
  summary: { direct: number; network: number; levels: number; active: number; pending: number; selling: number; deals: number; perLevel: number[] }
}

type Admin = ReturnType<typeof createAdminSupabase>
const PAGE = 1000
export const GENEALOGY_MAX_LEVELS = 12

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)
const nameOf = (p: Record<string, unknown>) =>
  titleCaseName(str(p.fullname) ?? [p.fname, p.lname].filter((v) => typeof v === "string" && v).join(" ")) || "Unnamed account"

export async function buildGenealogy(admin: Admin, rootId: string, fallback: { name: string | null; photo: string | null; role: string | null }): Promise<Genealogy> {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, fullname, fname, lname, role, status, profile_url, joined_at, metadata")
      .not("is_deleted", "is", true)
      .order("joined_at", { ascending: false })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as Record<string, unknown>[]))
    if (!data || data.length < PAGE) break
  }

  const childrenOf = new Map<string, Record<string, unknown>[]>()
  for (const p of rows) {
    const meta = (p.metadata ?? {}) as Record<string, unknown>
    const by = str(meta.invited_by)
    if (!by || str(meta.developer_invite_id)) continue
    childrenOf.set(by, [...(childrenOf.get(by) ?? []), p])
  }

  // Validated deals per account, partner shares respected. Sales are
  // decoration on the tree, so a failed read leaves them at zero.
  const dealsOf = new Map<string, number>()
  try {
    for (const s of await fetchAllSales(admin)) {
      if (s.validation_status !== "validated") continue
      for (const c of saleCredits(s)) dealsOf.set(c.agentId, (dealsOf.get(c.agentId) ?? 0) + 1)
    }
  } catch {
    // see above
  }

  const nodes: GenealogyNode[] = []
  const seen = new Set<string>([rootId])
  const walk = (parentId: string, level: number) => {
    const kids = (childrenOf.get(parentId) ?? []).sort((a, b) => String(b.joined_at ?? "").localeCompare(String(a.joined_at ?? "")))
    for (const p of kids) {
      const id = String(p.id)
      if (seen.has(id)) continue
      seen.add(id)
      nodes.push({ id, name: nameOf(p), photo: str(p.profile_url), role: str(p.role), status: (str(p.status) ?? "pending").toLowerCase(), joinedAt: str(p.joined_at), deals: dealsOf.get(id) ?? 0, parentId, level, direct: 0, network: 0 })
      if (level < GENEALOGY_MAX_LEVELS) walk(id, level + 1)
    }
  }
  walk(rootId, 1)

  // Direct and whole-network counts per node, from the leaves up.
  const byId = new Map(nodes.map((n) => [n.id, n]))
  for (const n of nodes) {
    const parent = byId.get(n.parentId)
    if (parent) parent.direct++
    for (let up = byId.get(n.parentId); up; up = byId.get(up.parentId)) up.network++
  }

  const perLevel: number[] = []
  for (const n of nodes) perLevel[n.level - 1] = (perLevel[n.level - 1] ?? 0) + 1
  const me = rows.find((p) => String(p.id) === rootId)
  return {
    root: { id: rootId, name: me ? nameOf(me) : titleCaseName(fallback.name ?? "") || "You", photo: str(me?.profile_url) ?? fallback.photo, role: str(me?.role) ?? fallback.role },
    nodes,
    summary: {
      direct: perLevel[0] ?? 0,
      network: nodes.length,
      levels: perLevel.length,
      active: nodes.filter((n) => n.status === "active").length,
      pending: nodes.filter((n) => n.status === "pending").length,
      selling: nodes.filter((n) => n.deals > 0).length,
      deals: nodes.reduce((a, n) => a + n.deals, 0),
      perLevel: perLevel.map((n) => n ?? 0),
    },
  }
}
