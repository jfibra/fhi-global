import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { titleCaseName } from "@/lib/public-profile"

/**
 * The admin bell: what happened in the last seven days that an admin would
 * want to hear about — accounts registered (and whether they wait for
 * approval), sales submitted, replies in the company inbox, new inquiries and
 * contact messages, support tickets, Buyers Link briefs, event registrations.
 * Read straight from the tables each time (nothing is stored), newest first,
 * with a link into the page that handles it. Which ones are "unread" is the
 * bell's business (it remembers when it was last opened). Admin staff only.
 */

export const runtime = "nodejs"

export type AdminNotification = {
  id: string
  kind: "account" | "sale" | "reply" | "inquiry" | "contact" | "ticket" | "brief" | "registration"
  title: string
  detail: string | null
  /** ISO timestamp. */
  at: string
  /** Path under the role's dashboard base, e.g. "/accounts/recruitment". */
  path: string
}

const DAYS = 7
const PER_KIND = 40
const TOTAL = 80

export async function GET() {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const admin = createAdminSupabase()
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString()
  const name = (v: unknown) => titleCaseName(typeof v === "string" ? v : "") || "Someone"
  const aed = (n: unknown) => `AED ${Math.round(Number(n ?? 0)).toLocaleString("en-AE")}`
  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

  const [accounts, sales, replies, inquiries, contacts, tickets, briefs, registrations] = await Promise.all([
    admin.from("profiles").select("id, fullname, role, status, joined_at, metadata").not("is_deleted", "is", true).gte("joined_at", since).order("joined_at", { ascending: false }).limit(PER_KIND),
    admin.from("sales_reports").select("id, agent_id, contract_price, validation_status, created_at, projects(name), developers(name)").gte("created_at", since).order("created_at", { ascending: false }).limit(PER_KIND),
    admin.from("inquiry_emails").select("id, from_name, from_email, subject, created_at, read_at").eq("direction", "inbound").is("owner_id", null).gte("created_at", since).order("created_at", { ascending: false }).limit(PER_KIND),
    admin.from("inquiries").select("id, name, project_name, developer_name, created_at").is("deleted_at", null).gte("created_at", since).order("created_at", { ascending: false }).limit(PER_KIND),
    admin.from("contact_submissions").select("id, name, subject, created_at").is("deleted_at", null).gte("created_at", since).order("created_at", { ascending: false }).limit(PER_KIND),
    admin.from("support_tickets").select("id, title, status, created_at, reported_by_profile:reported_by(fullname)").gte("created_at", since).order("created_at", { ascending: false }).limit(PER_KIND),
    admin.from("buyer_link_leads").select("id, name, kind, agent_id, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(PER_KIND),
    admin.from("event_registrations").select("id, full_name, event_id, created_at, events(title)").gte("created_at", since).order("created_at", { ascending: false }).limit(PER_KIND),
  ])

  // Agent names for sales and briefs, in one lookup.
  const agentIds = [...new Set([...(sales.data ?? []).map((s) => String(s.agent_id)), ...(briefs.data ?? []).map((b) => String(b.agent_id))])]
  const agents = new Map<string, string>()
  if (agentIds.length) {
    const { data } = await admin.from("profiles").select("id, fullname").in("id", agentIds)
    for (const a of (data ?? []) as { id: string; fullname: string | null }[]) agents.set(a.id, name(a.fullname))
  }

  const items: AdminNotification[] = []
  for (const p of (accounts.data ?? []) as Array<Record<string, unknown>>) {
    const meta = (p.metadata ?? {}) as Record<string, unknown>
    const pending = String(p.status ?? "pending") === "pending"
    items.push({
      id: `account:${p.id}`, kind: "account",
      title: `${name(p.fullname)} registered${pending ? " — waiting for approval" : ""}`,
      detail: typeof meta.invited_by === "string" ? "Through an invite link" : "Directly on the website",
      at: String(p.joined_at), path: pending ? "/accounts/recruitment" : `/accounts/users?account=${p.id}`,
    })
  }
  for (const s of (sales.data ?? []) as Array<Record<string, unknown>>) {
    const project = one(s.projects as { name: string } | null)?.name
    const developer = one(s.developers as { name: string } | null)?.name
    items.push({
      id: `sale:${s.id}`, kind: "sale",
      title: `${agents.get(String(s.agent_id)) ?? "An agent"} submitted a sale — ${aed(s.contract_price)}`,
      detail: [project, developer].filter(Boolean).join(" · ") + (s.validation_status && s.validation_status !== "validated" ? ` · ${String(s.validation_status).replace(/_/g, " ")}` : ""),
      at: String(s.created_at), path: `/sales/${s.id}`,
    })
  }
  for (const r of (replies.data ?? []) as Array<Record<string, unknown>>) {
    items.push({
      id: `reply:${r.id}`, kind: "reply",
      title: `${name(r.from_name) === "Someone" ? String(r.from_email ?? "Someone") : name(r.from_name)} replied${r.read_at ? "" : " — unread"}`,
      detail: (r.subject as string | null) ?? null, at: String(r.created_at), path: "/leads",
    })
  }
  for (const q of (inquiries.data ?? []) as Array<Record<string, unknown>>) {
    items.push({
      id: `inquiry:${q.id}`, kind: "inquiry",
      title: `${name(q.name)} inquired`,
      detail: [q.project_name, q.developer_name].filter(Boolean).join(" · ") || null, at: String(q.created_at), path: "/leads",
    })
  }
  for (const c of (contacts.data ?? []) as Array<Record<string, unknown>>) {
    items.push({ id: `contact:${c.id}`, kind: "contact", title: `${name(c.name)} sent a message`, detail: (c.subject as string | null) ?? null, at: String(c.created_at), path: "/communication/contact-inbox" })
  }
  for (const t of (tickets.data ?? []) as Array<Record<string, unknown>>) {
    const by = one(t.reported_by_profile as { fullname: string | null } | null)?.fullname
    items.push({ id: `ticket:${t.id}`, kind: "ticket", title: `${name(by)} opened a support ticket`, detail: (t.title as string | null) ?? null, at: String(t.created_at), path: `/communication/support/${t.id}` })
  }
  for (const b of (briefs.data ?? []) as Array<Record<string, unknown>>) {
    items.push({
      id: `brief:${b.id}`, kind: "brief",
      title: `${name(b.name)} sent a ${b.kind === "seller" ? "seller" : "buyer"} brief`,
      detail: `To ${agents.get(String(b.agent_id)) ?? "an agent"}`, at: String(b.created_at), path: "/communication/buyer-leads",
    })
  }
  for (const e of (registrations.data ?? []) as Array<Record<string, unknown>>) {
    items.push({ id: `registration:${e.id}`, kind: "registration", title: `${name(e.full_name)} registered for an event`, detail: one(e.events as { title: string } | null)?.title ?? null, at: String(e.created_at), path: "/events" })
  }

  items.sort((a, b) => b.at.localeCompare(a.at))
  return NextResponse.json({ items: items.slice(0, TOTAL), since })
}
