"use client"

import Link from "next/link"
import { ReactNode, useEffect, useState } from "react"
import type { LucideIcon } from "lucide-react"
import { Building2, FileText, LifeBuoy, ShoppingCart, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { fetchSales } from "@/lib/sales-service"
import { getDashboardRouteByRole } from "@/lib/auth"
import { AdminAnalyticsCharts } from "./charts-client"

// ─── Formatters ───────────────────────────────────────────────────────────────

const AED = new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 })
const NUM = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })
const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" })
const DATE_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" })
const TIME_FMT = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" })

const fmtCurrency = (v: number) => AED.format(v)
const fmtNumber = (v: number) => NUM.format(v)

function fmtDate(v?: string | null) {
  if (!v) return "—"
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? "—" : DATE_FMT.format(d)
}

function fmtTime(v?: string | null) {
  if (!v) return "—"
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? "—" : TIME_FMT.format(d)
}

function humanize(s: string) {
  return s.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PROJECT_STATUSES = ["pre_launch", "launch", "under_construction", "completed"] as const
const PROJECT_STATUS_LABELS: Record<string, string> = {
  pre_launch: "Pre-launch", launch: "Launch",
  under_construction: "Under Construction", completed: "Completed",
}
const PROJECT_STATUS_COLORS: Record<string, string> = {
  pre_launch: "#0ea5e9", launch: "#c084fc",
  under_construction: "#fb923c", completed: "#22c55e",
}

const VALIDATION_STATUSES = ["pending", "under_review", "validated", "invalid_sale"] as const
const VALIDATION_STATUS_LABELS: Record<string, string> = {
  pending: "Pending", under_review: "Under Review",
  validated: "Validated", invalid_sale: "Invalid Sale",
}
const VALIDATION_STATUS_COLORS: Record<string, string> = {
  pending: "#d97706", under_review: "#2563eb",
  validated: "#16a34a", invalid_sale: "#dc2626",
}

const DEVELOPER_COLORS = ["#0ea5e9","#d6b357","#14b8a6","#6366f1","#f97316","#a855f7","#22d3ee","#fb7185"]

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  open:          { bg: "bg-amber-50",   text: "text-amber-700"   },
  in_progress:   { bg: "bg-sky-50",     text: "text-sky-700"     },
  waiting_user:  { bg: "bg-rose-50",    text: "text-rose-700"    },
  resolved:      { bg: "bg-emerald-50", text: "text-emerald-700" },
  closed:        { bg: "bg-slate-100",  text: "text-slate-600"   },
  pending:       { bg: "bg-amber-50",   text: "text-amber-700"   },
  under_review:  { bg: "bg-sky-50",     text: "text-sky-700"     },
  validated:     { bg: "bg-emerald-50", text: "text-emerald-700" },
  invalid_sale:  { bg: "bg-rose-100",   text: "text-rose-600"    },
  processing:    { bg: "bg-blue-50",    text: "text-blue-700"    },
  approved:      { bg: "bg-emerald-50", text: "text-emerald-700" },
  released:      { bg: "bg-emerald-50", text: "text-emerald-700" },
  rejected:      { bg: "bg-rose-100",   text: "text-rose-600"    },
}

type QuickAction = { label: string; desc: string; href: string; icon: LucideIcon }
const QUICK_ACTIONS: QuickAction[] = [
  { label: "Add Developer",        desc: "Invite a partner firm",     href: "/developers", icon: Users       },
  { label: "Add Project",          desc: "Publish a new launch",      href: "/projects",   icon: Building2   },
  { label: "Encode Sale",          desc: "Log a reservation",         href: "/sales",      icon: ShoppingCart },
  { label: "Create Support Ticket",desc: "Raise an incident",         href: "/support",    icon: LifeBuoy    },
  { label: "Create Purchase",      desc: "Track procurement spend",   href: "/purchases",  icon: FileText    },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pick(rel: unknown): string {
  if (!rel) return "Unknown"
  const c = Array.isArray(rel) ? rel[0] : rel
  if (!c || typeof c !== "object") return "Unknown"
  const r = c as Record<string, unknown>
  const v = r.fullname ?? r.category_name ?? r.registered_name
  return (typeof v === "string" && v.trim()) || "Unknown"
}

function pickKey(rel: unknown, key: string): string | null {
  if (!rel) return null
  const c = Array.isArray(rel) ? rel[0] : rel
  if (!c || typeof c !== "object") return null
  const v = (c as Record<string, unknown>)[key]
  return typeof v === "string" ? v : null
}

function safeCount(res: { count: number | null; error: unknown }) {
  if (res.error) return 0
  return res.count ?? 0
}

function safeRows<T>(res: { data: T | null; error: unknown }): NonNullable<T> {
  if (res.error || !res.data) return [] as unknown as NonNullable<T>
  return res.data
}

function buildMonthlySeries(
  rows: { reservation_date?: string | null; contract_price?: string | number | null }[],
  windowStart: Date,
  months = 12,
) {
  const bucket = new Map<string, { sum: number; count: number }>()
  for (const row of rows) {
    if (!row.reservation_date) continue
    const d = new Date(row.reservation_date)
    if (Number.isNaN(d.getTime())) continue
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    const e = bucket.get(key) ?? { sum: 0, count: 0 }
    e.sum += Number(row.contract_price ?? 0)
    e.count += 1
    bucket.set(key, e)
  }
  return Array.from({ length: months }, (_, i) => {
    const ptr = new Date(Date.UTC(windowStart.getUTCFullYear(), windowStart.getUTCMonth() + i, 1))
    const key = `${ptr.getUTCFullYear()}-${String(ptr.getUTCMonth() + 1).padStart(2, "0")}`
    const v = bucket.get(key) ?? { sum: 0, count: 0 }
    return { month: MONTH_FMT.format(ptr), count: v.count, value: v.sum }
  })
}

// ─── Public page component ────────────────────────────────────────────────────

async function loadAdminDashboard(roleValue: string, userId: string) {
  const supabase = createClient()

  const monthlyWindowStart = new Date()
  monthlyWindowStart.setUTCDate(1)
  monthlyWindowStart.setUTCMonth(monthlyWindowStart.getUTCMonth() - 11)
  monthlyWindowStart.setUTCHours(0, 0, 0, 0)
  const monthlyStartISO = monthlyWindowStart.toISOString().split("T")[0]

  const [
    profilesCountRes,
    developersCountRes,
    totalProjectsRes,
    publishedProjectsRes,
    totalSalesRes,
    totalSalesValueRes,
    clientsCountRes,
    purchasesCountRes,
    openTicketsRes,
    activeTeamsRes,
    pendingValidationRes,
    pendingCommissionRes,
    monthlySalesRes,
    developerSalesRes,
    projectStatusRes,
    validationStatusRes,
    supportTicketsRes,
    purchasesTableRes,
    activityLogsRes,
    recentSalesRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_deleted", false),
    supabase.from("developers").select("id", { count: "exact", head: true }).eq("is_active", true).is("deleted_at", null),
    supabase.from("projects").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("is_published", true).is("deleted_at", null),
    supabase.from("sales_reports").select("id", { count: "exact", head: true }),
    supabase.from("sales_reports").select("total_value:sum(contract_price)"),
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("purchases").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("teams").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("sales_reports").select("id", { count: "exact", head: true }).in("validation_status", ["pending", "under_review"]),
    supabase.from("sales_reports").select("id", { count: "exact", head: true }).eq("commission_status", "pending"),
    supabase
      .from("sales_reports")
      .select("reservation_date, contract_price")
      .not("reservation_date", "is", null)
      .gte("reservation_date", monthlyStartISO),
    supabase
      .from("sales_reports")
      .select("developer_id")
      .not("developer_id", "is", null),
    supabase
      .from("projects")
      .select("status")
      .is("deleted_at", null),
    supabase
      .from("sales_reports")
      .select("validation_status"),
    supabase
      .from("support_tickets")
      .select("id, title, priority, status, created_at, reported_by_profile:reported_by(id, fullname), assigned_to_profile:assigned_to(id, fullname)")
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("purchases")
      .select("id, invoice_number, tax_month, total_actual_amount, created_at, purchase_categories(category_name), company_tax_entities(registered_name), profiles:created_by(fullname)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("sales_activity_logs")
      .select("id, description, action_type, created_at, performed_by, performed_role, profiles:performed_by(fullname)")
      .order("created_at", { ascending: false })
      .limit(10),
    fetchSales({
      page: 1, perPage: 10,
      sortField: "created_at", sortDir: "desc",
      currentRole: roleValue, currentUserId: userId,
    }),
  ])

  // ── KPI counts ──────────────────────────────────────────────────────────────
  const totalUsers       = safeCount(profilesCountRes)
  const totalDevelopers  = safeCount(developersCountRes)
  const totalProjects    = safeCount(totalProjectsRes)
  const publishedProjects = safeCount(publishedProjectsRes)
  const totalSalesCount  = safeCount(totalSalesRes)
  const totalClients     = safeCount(clientsCountRes)
  const totalPurchases   = safeCount(purchasesCountRes)
  const openTickets      = safeCount(openTicketsRes)
  const activeTeams      = safeCount(activeTeamsRes)
  const pendingValidations = safeCount(pendingValidationRes)
  const pendingCommissions = safeCount(pendingCommissionRes)

  const rawSalesValueRow = !totalSalesValueRes.error ? totalSalesValueRes.data?.[0] : null
  const totalSalesValue = Number((rawSalesValueRow as Record<string, unknown> | null | undefined)?.total_value ?? 0)

  // ── Chart data ───────────────────────────────────────────────────────────────
  const monthlyRows = safeRows(monthlySalesRes) as { reservation_date: string | null; contract_price: string | null }[]
  const monthlySeries = buildMonthlySeries(monthlyRows, monthlyWindowStart)

  const devSalesRows = safeRows(developerSalesRes) as { developer_id: string }[]
  const devCountMap = new Map<string, number>()
  for (const row of devSalesRows) {
    const id = String(row.developer_id)
    devCountMap.set(id, (devCountMap.get(id) ?? 0) + 1)
  }
  const sortedDevEntries = [...devCountMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  const devIds = sortedDevEntries.map(([id]) => id)
  const devNameMap = new Map<string, string>()
  if (devIds.length) {
    const { data: devNames } = await supabase.from("developers").select("id, name").in("id", devIds)
    for (const d of devNames ?? []) devNameMap.set(String(d.id), String(d.name ?? "Developer"))
  }
  const developerChartData = sortedDevEntries.map(([devId, count], i) => ({
    developer: devNameMap.get(devId) ?? "Developer",
    count,
    color: DEVELOPER_COLORS[i % DEVELOPER_COLORS.length],
  }))

  const projStatusRows = safeRows(projectStatusRes) as { status: string }[]
  const projStatusMap = new Map<string, number>()
  for (const row of projStatusRows) {
    const s = String(row.status ?? "")
    projStatusMap.set(s, (projStatusMap.get(s) ?? 0) + 1)
  }
  const projectStatusSeries = PROJECT_STATUSES.map(s => ({
    label: PROJECT_STATUS_LABELS[s],
    count: projStatusMap.get(s) ?? 0,
    color: PROJECT_STATUS_COLORS[s],
  }))

  const valStatusRows = safeRows(validationStatusRes) as { validation_status: string }[]
  const valStatusMap = new Map<string, number>()
  for (const row of valStatusRows) {
    const s = String(row.validation_status ?? "")
    valStatusMap.set(s, (valStatusMap.get(s) ?? 0) + 1)
  }
  const validationStatusSeries = VALIDATION_STATUSES.map(s => ({
    label: VALIDATION_STATUS_LABELS[s],
    count: valStatusMap.get(s) ?? 0,
    color: VALIDATION_STATUS_COLORS[s],
  }))

  // ── Recent data ───────────────────────────────────────────────────────────────
  const supportRows = safeRows(supportTicketsRes) as unknown[]
  const supportTickets = (supportRows as Record<string, unknown>[]).map(row => ({
    id: String(row.id ?? ""),
    title: String(row.title ?? "Untitled"),
    priority: String(row.priority ?? "normal"),
    status: String(row.status ?? "open"),
    reportedBy: pick(row.reported_by_profile),
    assignedTo: row.assigned_to_profile ? pick(row.assigned_to_profile) : null,
    createdAt: String(row.created_at ?? ""),
  }))

  const purchaseRows = safeRows(purchasesTableRes) as Record<string, unknown>[]
  const purchaseList = purchaseRows.map(row => ({
    id: String(row.id ?? ""),
    invoiceNumber: String(row.invoice_number ?? "—"),
    category: pickKey(row.purchase_categories, "category_name") ?? "General",
    taxMonth: String(row.tax_month ?? ""),
    totalAmount: Number(row.total_actual_amount ?? 0),
    createdBy: pick(row.profiles),
    createdAt: String(row.created_at ?? ""),
  }))

  const activityRows = safeRows(activityLogsRes) as Record<string, unknown>[]
  const activityFeed = activityRows.map(row => ({
    id: String(row.id ?? ""),
    description: String(row.description ?? row.action_type ?? "Activity"),
    performedBy: pick(row.profiles),
    performedRole: row.performed_role ? String(row.performed_role) : null,
    createdAt: String(row.created_at ?? ""),
  }))

  const recentSales = recentSalesRes.data ?? []

  // ── Summary cards ──────────────────────────────────────────────────────────
  const kpiCards = [
    { label: "Active Users",          value: fmtNumber(totalUsers),       detail: "Active Profiles"       },
    { label: "Active Developers",     value: fmtNumber(totalDevelopers),   detail: "Verified Partners"     },
    { label: "Total Projects",        value: fmtNumber(totalProjects),     detail: "Published"             },
    { label: "Total Sales",           value: `${Math.round(totalSalesCount / 1000)}K`, detail: "All Sales Records" },
    { label: "Sales Value",           value: `AED ${fmtNumber(Math.round(totalSalesValue))}`, detail: "Sum of Contract Prices" },
    { label: "Total Clients",         value: fmtNumber(totalClients),      detail: "Registered Leads"      },
    { label: "Total Purchases",       value: fmtNumber(totalPurchases),    detail: "Procurement Records"   },
    { label: "Open Support Tickets",  value: fmtNumber(openTickets),       detail: "Awaiting Triage"       },
  ]

  const opsCards = [
    { label: "Pending Validations",  value: fmtNumber(pendingValidations), detail: "Needs admin review"  },
    { label: "Pending Commissions",  value: fmtNumber(pendingCommissions), detail: "Awaiting payout"     },
    { label: "Active Teams",         value: fmtNumber(activeTeams),        detail: "Currently active"    },
  ]

  return {
    kpiCards, opsCards, monthlySeries, developerChartData,
    projectStatusSeries, validationStatusSeries,
    supportTickets, purchaseList, activityFeed, recentSales,
  }
}

type AdminDashboardData = Awaited<ReturnType<typeof loadAdminDashboard>>

function AdminDashboardSkeleton() {
  return (
    <div className="space-y-4 pb-12">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-black/5 animate-pulse" />
        ))}
      </div>
      <div className="h-72 rounded-2xl bg-black/5 animate-pulse" />
    </div>
  )
}

export function AdminDashboardContent({
  roleValue,
  userId,
}: {
  roleValue: string
  roleLabel: string
  userName: string
  userId: string
}) {
  const base = getDashboardRouteByRole(roleValue)
  const [data, setData] = useState<AdminDashboardData | null>(null)

  useEffect(() => {
    let active = true
    loadAdminDashboard(roleValue, userId).then((d) => {
      if (active) setData(d)
    })
    return () => {
      active = false
    }
  }, [roleValue, userId])

  if (!data) return <AdminDashboardSkeleton />

  const {
    kpiCards, opsCards, monthlySeries, developerChartData,
    projectStatusSeries, validationStatusSeries,
    supportTickets, purchaseList, activityFeed, recentSales,
  } = data

  return (
    <>
      <div className="space-y-10 pb-12">


        {/* ── Section 1: KPI cards ── */}
        <section>
          <SectionLabel index={1} title="Key Performance Indicators" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpiCards.map(card => (
              <KpiCard key={card.label} {...card} />
            ))}
          </div>
        </section>

        {/* ── Section 2: Charts ── */}
        <section>
          <SectionLabel index={2} title="Sales & Business Analytics" />
          <AdminAnalyticsCharts
            monthlySales={monthlySeries}
            developerSales={developerChartData}
            projectStatus={projectStatusSeries}
            validationStatus={validationStatusSeries}
          />
        </section>

        {/* ── Section 3: Operational insights ── */}
        <section>
          <SectionLabel index={3} title="Operational Insights" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-4">
            {opsCards.map(card => (
              <MiniCard key={card.label} {...card} />
            ))}
          </div>
          <div className="rounded-[28px] bg-white border border-[#e8eaed] shadow-[0_2px_12px_-2px_rgba(0,31,63,0.06)] p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#9ca3af] mb-1">Active Support Queue</p>
            <h3 className="text-sm font-bold text-[#0d1117] mb-4">Open & In-Progress Tickets</h3>
            <div className="space-y-2">
              {supportTickets.slice(0, 4).length === 0 && (
                <p className="text-sm text-[#6b7280]">No active tickets right now.</p>
              )}
              {supportTickets.slice(0, 4).map(ticket => (
                <div key={ticket.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#f0f2f5] bg-[#f9fafb] px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0d1117] truncate">{ticket.title}</p>
                    <p className="text-xs text-[#9ca3af]">{ticket.reportedBy} Â· {ticket.assignedTo ?? "Unassigned"}</p>
                  </div>
                  <StatusPill status={ticket.status} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 4: Recent activity tables ── */}
        <section className="space-y-5">
          <SectionLabel index={4} title="Recent Activity Tables" />

          {/* Recent Sales */}
          <TableCard title="Recent Sales" subtitle="10 latest reservations">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#f0f2f5]">
                  {["Agent","Client","Project","Developer","Contract Price","Reservation Date","Validation","Commission"].map(h => (
                    <Th key={h}>{h}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentSales.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-4 text-sm text-[#6b7280]">No sales found.</td></tr>
                )}
                {recentSales.map(sale => (
                  <tr key={sale.id} className="border-b border-[#f0f2f5] hover:bg-[#f9fafb] transition-colors">
                    <Td>{sale.profiles?.fullname ?? "—"}</Td>
                    <Td>{[sale.clients?.first_name, sale.clients?.last_name].filter(Boolean).join(" ") || "—"}</Td>
                    <Td>{sale.projects?.name ?? "—"}</Td>
                    <Td>{sale.developers?.name ?? "—"}</Td>
                    <Td>{fmtCurrency(sale.contract_price ?? 0)}</Td>
                    <Td>{fmtDate(sale.reservation_date)}</Td>
                    <Td><StatusPill status={sale.validation_status} /></Td>
                    <Td><StatusPill status={sale.commission_status} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>

          <div className="grid gap-5 xl:grid-cols-2">
            {/* Support Tickets */}
            <TableCard title="Recent Support Tickets" subtitle="Open & in-progress">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#f0f2f5]">
                    {["Title","Reported By","Priority","Status","Assigned To","Created"].map(h => (
                      <Th key={h}>{h}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {supportTickets.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-4 text-sm text-[#6b7280]">No tickets found.</td></tr>
                  )}
                  {supportTickets.map(ticket => (
                    <tr key={ticket.id} className="border-b border-[#f0f2f5] hover:bg-[#f9fafb] transition-colors">
                      <Td bold truncate>{ticket.title}</Td>
                      <Td>{ticket.reportedBy}</Td>
                      <Td>{humanize(ticket.priority)}</Td>
                      <Td><StatusPill status={ticket.status} /></Td>
                      <Td>{ticket.assignedTo ?? "Unassigned"}</Td>
                      <Td>{fmtDate(ticket.createdAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableCard>

            {/* Purchases */}
            <TableCard title="Recent Purchases" subtitle="Latest procurement entries">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#f0f2f5]">
                    {["Invoice","Category","Tax Month","Amount","Created By","Date"].map(h => (
                      <Th key={h}>{h}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {purchaseList.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-4 text-sm text-[#6b7280]">No purchases yet.</td></tr>
                  )}
                  {purchaseList.map(p => (
                    <tr key={p.id} className="border-b border-[#f0f2f5] hover:bg-[#f9fafb] transition-colors">
                      <Td bold>{p.invoiceNumber}</Td>
                      <Td>{p.category}</Td>
                      <Td>{p.taxMonth}</Td>
                      <Td>{fmtCurrency(p.totalAmount)}</Td>
                      <Td>{p.createdBy}</Td>
                      <Td>{fmtDate(p.createdAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableCard>
          </div>
        </section>

        {/* ── Section 5: Quick actions ── */}
        <section>
          <SectionLabel index={5} title="Quick Actions" />
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            {QUICK_ACTIONS.map(action => (
              <ActionCard key={action.label} action={{ ...action, href: `${base}${action.href}` }} />
            ))}
          </div>
        </section>

        {/* ── Section 6: Activity feed ── */}
        <section>
          <SectionLabel index={6} title="System Activity Feed" />
          {activityFeed.length === 0 ? (
            <div className="rounded-2xl border border-[#e8eaed] bg-white p-5 text-sm text-[#6b7280]">
              No activity recorded yet.
            </div>
          ) : (
            <div className="space-y-2">
              {activityFeed.map(item => (
                <div key={item.id} className="flex items-start justify-between gap-4 rounded-2xl border border-[#e8eaed] bg-white px-5 py-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#0d1117] leading-snug">{item.description}</p>
                    <p className="text-xs text-[#9ca3af] mt-0.5">
                      {item.performedBy} Â· {item.performedRole ? humanize(item.performedRole) : "System"}
                    </p>
                  </div>
                  <p className="text-[11px] text-[#9ca3af] shrink-0 pt-0.5">{fmtTime(item.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ index, title }: { index: number; title: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-[20px] font-bold text-[#0d1117] font-['Outfit']">{title}</h2>
    </div>
  )
}

function KpiCard({ label, value, detail, accent }: { label: string; value: string; detail?: string; accent?: string }) {
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
      <span className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] shadow-md">
        <Icon className="w-5 h-5 text-white" />
      </span>
      <div>
        <p className="text-sm font-bold text-[#0d1117]">{action.label}</p>
        <p className="text-xs text-[#9ca3af] mt-0.5">{action.desc}</p>
      </div>
    </Link>
  )
}
