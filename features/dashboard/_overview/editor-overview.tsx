"use client"

import Link from "next/link"
import { ReactNode, useEffect, useState } from "react"
import type { LucideIcon } from "lucide-react"
import { Building2, CalendarDays, FolderOpen } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { categoryMeta, eventColor, humanizeEvent, relativeTime } from "@/components/dashboard/system-logs/log-meta"

// Editor landing dashboard: content KPIs (developers / projects / events),
// quick actions into the editor pages, recent content, and the editor's own
// contribution stats + activity feed (self-scoped via /api/editor/activity).

// ─── Formatters ───────────────────────────────────────────────────────────────

const NUM = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })
const DATE_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" })

const fmtNumber = (v: number) => NUM.format(v)

function fmtDate(v?: string | null) {
  if (!v) return "—"
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? "—" : DATE_FMT.format(d)
}

function humanize(s: string) {
  return s.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  // project statuses
  pre_launch:         { bg: "bg-sky-50",     text: "text-sky-700"     },
  launch:             { bg: "bg-purple-50",  text: "text-purple-700"  },
  under_construction: { bg: "bg-orange-50",  text: "text-orange-700"  },
  completed:          { bg: "bg-emerald-50", text: "text-emerald-700" },
  // event statuses
  draft:              { bg: "bg-amber-50",   text: "text-amber-700"   },
  published:          { bg: "bg-emerald-50", text: "text-emerald-700" },
  archived:           { bg: "bg-slate-100",  text: "text-slate-600"   },
}

type QuickAction = { label: string; desc: string; href: string; icon: LucideIcon }
const QUICK_ACTIONS: QuickAction[] = [
  { label: "Add Developer", desc: "Register a partner firm",  href: "/editor/developers", icon: Building2    },
  { label: "Add Project",   desc: "Publish a new launch",     href: "/editor/projects",   icon: FolderOpen   },
  { label: "Create Event",  desc: "Announce a new event",     href: "/editor/events",     icon: CalendarDays },
]

// ─── Data loading ─────────────────────────────────────────────────────────────

function safeCount(res: { count: number | null; error: unknown }) {
  if (res.error) return 0
  return res.count ?? 0
}

function safeRows<T>(res: { data: T | null; error: unknown }): NonNullable<T> {
  if (res.error || !res.data) return [] as unknown as NonNullable<T>
  return res.data
}

type EventRow = {
  id: string
  title: string
  eventDate: string | null
  status: string
  registrationCount: number
}

type ActivityStats = {
  month: { created: number; updated: number; deleted: number; total: number }
  byCategory: Record<string, number>
  allTimeTotal: number
}

type ActivityItem = {
  id: string
  occurredAt: string
  category: string
  event: string
  subjectLabel: string | null
  description: string | null
}

const EMPTY_STATS: ActivityStats = {
  month: { created: 0, updated: 0, deleted: 0, total: 0 },
  byCategory: { developers: 0, projects: 0, events: 0 },
  allTimeTotal: 0,
}

async function fetchEvents(): Promise<EventRow[]> {
  try {
    const res = await fetch("/api/admin/events", { cache: "no-store" })
    if (!res.ok) return []
    const json = (await res.json()) as { events?: EventRow[] }
    return json.events ?? []
  } catch {
    return []
  }
}

async function fetchActivity(): Promise<{ stats: ActivityStats; feed: ActivityItem[] }> {
  try {
    const res = await fetch("/api/editor/activity?limit=15", { cache: "no-store" })
    if (!res.ok) return { stats: EMPTY_STATS, feed: [] }
    const json = (await res.json()) as { stats?: ActivityStats; feed?: ActivityItem[] }
    return { stats: json.stats ?? EMPTY_STATS, feed: json.feed ?? [] }
  } catch {
    return { stats: EMPTY_STATS, feed: [] }
  }
}

async function loadEditorDashboard() {
  const supabase = createClient()

  const [
    activeDevelopersRes,
    totalDevelopersRes,
    totalProjectsRes,
    publishedProjectsRes,
    recentProjectsRes,
    events,
    activity,
  ] = await Promise.all([
    supabase.from("developers").select("id", { count: "exact", head: true }).eq("is_active", true).is("deleted_at", null),
    supabase.from("developers").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("projects").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("is_published", true).is("deleted_at", null),
    supabase
      .from("projects")
      .select("id, name, status, is_published, updated_at")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(5),
    fetchEvents(),
    fetchActivity(),
  ])

  const activeDevelopers = safeCount(activeDevelopersRes)
  const totalDevelopers = safeCount(totalDevelopersRes)
  const totalProjects = safeCount(totalProjectsRes)
  const publishedProjects = safeCount(publishedProjectsRes)

  const recentProjects = (safeRows(recentProjectsRes) as Record<string, unknown>[]).map(row => ({
    id: String(row.id ?? ""),
    name: String(row.name ?? "Untitled"),
    status: String(row.status ?? ""),
    isPublished: row.is_published === true,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  }))

  const now = Date.now()
  const totalEvents = events.length
  const publishedEvents = events.filter(e => e.status === "published").length
  const draftEvents = events.filter(e => e.status === "draft").length
  const upcomingEvents = events.filter(
    e => e.status === "published" && e.eventDate && new Date(e.eventDate).getTime() >= now,
  ).length
  const recentEvents = events.slice(0, 5)

  const kpiCards = [
    { label: "Active Developers",  value: fmtNumber(activeDevelopers),  detail: `${fmtNumber(totalDevelopers)} total` },
    { label: "Total Projects",     value: fmtNumber(totalProjects),     detail: "All projects"                        },
    { label: "Published Projects", value: fmtNumber(publishedProjects), detail: `${fmtNumber(Math.max(0, totalProjects - publishedProjects))} drafts` },
    { label: "Upcoming Events",    value: fmtNumber(upcomingEvents),    detail: `${fmtNumber(totalEvents)} total`     },
  ]

  const miniCards = [
    { label: "Draft Projects", value: fmtNumber(Math.max(0, totalProjects - publishedProjects)), detail: "Not yet published" },
    { label: "Published Events", value: fmtNumber(publishedEvents), detail: "Live on the site" },
    { label: "Draft Events", value: fmtNumber(draftEvents), detail: "Awaiting publish" },
  ]

  return { kpiCards, miniCards, recentProjects, recentEvents, stats: activity.stats, feed: activity.feed }
}

type EditorDashboardData = Awaited<ReturnType<typeof loadEditorDashboard>>

// ─── Components ───────────────────────────────────────────────────────────────

function EditorDashboardSkeleton() {
  return (
    <div className="space-y-4 pb-12">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-black/5 animate-pulse" />
        ))}
      </div>
      <div className="h-72 rounded-2xl bg-black/5 animate-pulse" />
    </div>
  )
}

export function EditorDashboardContent({ userId, userName }: { userId: string; userName: string }) {
  const [data, setData] = useState<EditorDashboardData | null>(null)

  useEffect(() => {
    let active = true
    loadEditorDashboard().then((d) => {
      if (active) setData(d)
    })
    return () => {
      active = false
    }
  }, [userId])

  if (!data) return <EditorDashboardSkeleton />

  const { kpiCards, miniCards, recentProjects, recentEvents, stats, feed } = data

  const contributionCards = [
    { label: "Created This Month", value: fmtNumber(stats.month.created), detail: "New content items" },
    { label: "Updated This Month", value: fmtNumber(stats.month.updated), detail: "Edits & restores" },
    { label: "Deleted This Month", value: fmtNumber(stats.month.deleted), detail: "Removed items" },
    {
      label: "Total Actions",
      value: fmtNumber(stats.allTimeTotal),
      detail: `${fmtNumber(stats.byCategory.developers ?? 0)} developers · ${fmtNumber(stats.byCategory.projects ?? 0)} projects · ${fmtNumber(stats.byCategory.events ?? 0)} events this month`,
    },
  ]

  return (
    <div className="space-y-10 pb-12">

      {/* ── Section 1: Content KPIs ── */}
      <section>
        <SectionLabel title="Content at a Glance" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpiCards.map(card => (
            <KpiCard key={card.label} {...card} />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mt-4">
          {miniCards.map(card => (
            <MiniCard key={card.label} {...card} />
          ))}
        </div>
      </section>

      {/* ── Section 2: Quick actions ── */}
      <section>
        <SectionLabel title="Quick Actions" />
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {QUICK_ACTIONS.map(action => (
            <ActionCard key={action.label} action={action} />
          ))}
        </div>
      </section>

      {/* ── Section 3: Recent content ── */}
      <section>
        <SectionLabel title="Recent Content" />
        <div className="grid gap-5 xl:grid-cols-2">
          <TableCard title="Recently Updated Projects" subtitle="5 latest changes">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#f0f2f5]">
                  {["Project", "Status", "Published", "Updated"].map(h => (
                    <Th key={h}>{h}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentProjects.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-4 text-sm text-[#6b7280]">No projects yet.</td></tr>
                )}
                {recentProjects.map(p => (
                  <tr key={p.id} className="border-b border-[#f0f2f5] hover:bg-[#f9fafb] transition-colors">
                    <Td bold truncate>{p.name}</Td>
                    <Td>{p.status ? <StatusPill status={p.status} /> : "—"}</Td>
                    <Td>{p.isPublished ? "Yes" : "Draft"}</Td>
                    <Td>{fmtDate(p.updatedAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>

          <TableCard title="Recent Events" subtitle="5 latest events">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#f0f2f5]">
                  {["Event", "Date", "Status", "Registrations"].map(h => (
                    <Th key={h}>{h}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentEvents.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-4 text-sm text-[#6b7280]">No events yet.</td></tr>
                )}
                {recentEvents.map(e => (
                  <tr key={e.id} className="border-b border-[#f0f2f5] hover:bg-[#f9fafb] transition-colors">
                    <Td bold truncate>{e.title}</Td>
                    <Td>{fmtDate(e.eventDate)}</Td>
                    <Td><StatusPill status={e.status} /></Td>
                    <Td>{fmtNumber(e.registrationCount)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        </div>
      </section>

      {/* ── Section 4: My contributions ── */}
      <section>
        <SectionLabel title="My Contributions" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {contributionCards.map(card => (
            <MiniCard key={card.label} {...card} />
          ))}
        </div>
      </section>

      {/* ── Section 5: My recent activity ── */}
      <section>
        <SectionLabel title="My Recent Activity" />
        {feed.length === 0 ? (
          <div className="rounded-2xl border border-[#e8eaed] bg-white p-5 text-sm text-[#6b7280]">
            No activity yet — your creates and edits will appear here, {userName.split(" ")[0]}.
          </div>
        ) : (
          <div className="space-y-2">
            {feed.map(item => {
              const meta = categoryMeta(item.category)
              return (
                <div key={item.id} className="flex items-start justify-between gap-4 rounded-2xl border border-[#e8eaed] bg-white px-5 py-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#0d1117] leading-snug truncate">
                      <span style={{ color: eventColor(item.event) }}>{humanizeEvent(item.event)}</span>
                      {" — "}
                      {item.subjectLabel ?? item.description ?? "Untitled"}
                    </p>
                    <span className={`mt-1.5 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] ${meta.bg} ${meta.text}`}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#9ca3af] shrink-0 pt-0.5">{relativeTime(item.occurredAt)}</p>
                </div>
              )
            })}
          </div>
        )}
      </section>

    </div>
  )
}

// ─── Sub-components (same visual system as the admin overview) ────────────────

function SectionLabel({ title }: { title: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-[20px] font-bold text-[#0d1117] font-['Outfit']">{title}</h2>
    </div>
  )
}

function KpiCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-[#e8eaed] p-5 hover:shadow-[0_4px_20px_-2px_rgba(0,31,63,0.06)] transition-all duration-300">
      <div className="absolute top-4 bottom-4 left-0 w-1.5 rounded-r bg-[#001f3f]" />
      <div className="pl-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-[#374151]">{label}</p>
        <p className="font-['Outfit'] text-[40px] leading-tight font-bold text-[#001f3f] mt-1 tracking-tight">{value}</p>
        {detail && <p className="text-[13px] text-[#6b7280]">{detail}</p>}
      </div>
    </div>
  )
}

function MiniCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl bg-white border border-[#e8eaed] shadow-[0_2px_12px_-2px_rgba(0,31,63,0.06)] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#9ca3af]">{label}</p>
      <p className="font-['Outfit'] text-2xl font-bold text-[#0d1117] mt-2">{value}</p>
      {detail && <p className="text-xs text-[#9ca3af] mt-0.5">{detail}</p>}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const styles = STATUS_STYLES[status.toLowerCase()] ?? { bg: "bg-slate-100", text: "text-slate-600" }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${styles.bg} ${styles.text}`}>
      {humanize(status)}
    </span>
  )
}

function TableCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border border-[#e8eaed] shadow-[0_2px_12px_-2px_rgba(0,31,63,0.06)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#f0f2f5]">
        <h3 className="text-sm font-bold text-[#0d1117]">{title}</h3>
        {subtitle && <p className="text-xs text-[#9ca3af] mt-0.5">{subtitle}</p>}
      </div>
      <div className="overflow-x-auto p-1">{children}</div>
    </div>
  )
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9ca3af] whitespace-nowrap">
      {children}
    </th>
  )
}

function Td({ children, bold, truncate }: { children: ReactNode; bold?: boolean; truncate?: boolean }) {
  return (
    <td className={`px-3 py-3 text-sm ${bold ? "font-semibold text-[#0d1117]" : "text-[#374151]"} ${truncate ? "max-w-[200px] truncate" : ""}`}>
      {children}
    </td>
  )
}

function ActionCard({ action }: { action: QuickAction }) {
  const Icon = action.icon
  return (
    <Link
      href={action.href}
      className="group flex flex-col gap-3 rounded-2xl border border-[#e8eaed] bg-white p-5 shadow-[0_2px_12px_-2px_rgba(0,31,63,0.06)] hover:shadow-[0_4px_20px_-2px_rgba(0,31,63,0.10)] hover:-translate-y-0.5 transition-all duration-300"
    >
      <span className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#001f3f] to-[#d6b357] shadow-md">
        <Icon className="w-5 h-5 text-white" />
      </span>
      <div>
        <p className="text-sm font-bold text-[#0d1117]">{action.label}</p>
        <p className="text-xs text-[#9ca3af] mt-0.5">{action.desc}</p>
      </div>
    </Link>
  )
}
