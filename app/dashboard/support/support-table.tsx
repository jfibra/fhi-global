"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  Filter,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard/shell"
import { getRoleColor } from "@/components/dashboard/sidebar-config"
import { roleToLabel } from "@/lib/auth"
import {
  fetchSupportAssignableUsers,
  fetchSupportReporters,
  fetchSupportTickets,
  updateSupportTicketAdmin,
  type SupportAssignableUser,
  type SupportTicketPriority,
  type SupportTicketRecord,
  type SupportTicketStatus,
} from "@/lib/support-service"
import { DeveloperPortalPageHeader } from "@/components/developer/developer-portal-page-header"
import { SupportFormDialog } from "./support-form-dialog"
import { TicketAttachments } from "./[id]/ticket-attachments"
import { TicketComments } from "./[id]/ticket-comments"

const PER_PAGE_OPTIONS = [10, 20, 50] as const
const STATUS_VALUES: SupportTicketStatus[] = ["open", "in_progress", "waiting_user", "resolved", "closed"]
const PRIORITY_VALUES: SupportTicketPriority[] = ["low", "normal", "high", "critical"]

type SortField = "created_at" | "updated_at" | "priority" | "status"
type SortDir = "asc" | "desc"
type ToastType = "success" | "error"

const STATUS_LABEL: Record<SupportTicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting_user: "Waiting User",
  resolved: "Resolved",
  closed: "Closed",
}

const PRIORITY_LABEL: Record<SupportTicketPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  critical: "Critical",
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function StatusBadge({ value }: { value: SupportTicketStatus }) {
  const cls: Record<SupportTicketStatus, string> = {
    open: "bg-blue-50 text-blue-700 border-blue-200",
    in_progress: "bg-sky-50 text-sky-700 border-sky-200",
    waiting_user: "bg-amber-50 text-amber-700 border-amber-200",
    resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    closed: "bg-slate-100 text-slate-700 border-slate-200",
  }
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls[value]}`}>{STATUS_LABEL[value]}</span>
}

function PriorityBadge({ value }: { value: SupportTicketPriority }) {
  const cls: Record<SupportTicketPriority, string> = {
    low: "bg-slate-100 text-slate-700 border-slate-200",
    normal: "bg-blue-50 text-blue-700 border-blue-200",
    high: "bg-amber-50 text-amber-700 border-amber-200",
    critical: "bg-rose-50 text-rose-700 border-rose-200",
  }
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls[value]}`}>{PRIORITY_LABEL[value]}</span>
}

function ToastStack({ toasts, remove }: { toasts: Array<{ id: number; type: ToastType; text: string }>; remove: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[80] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold pointer-events-auto max-w-xs ${toast.type === "success" ? "bg-green-50 text-green-800 border border-green-100" : "bg-rose-50 text-rose-800 border border-rose-100"}`}
        >
          <span className="flex-1">{toast.text}</span>
          <button type="button" onClick={() => remove(toast.id)} className="opacity-60 hover:opacity-100 text-xs ml-2">✕</button>
        </div>
      ))}
    </div>
  )
}

function QuickViewDialog({
  ticket,
  isAdmin,
  onClose,
}: {
  ticket: SupportTicketRecord | null
  isAdmin: boolean
  onClose: () => void
}) {
  if (!ticket) return null
  return (
    <>
      <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-2xl bg-white rounded-[24px] shadow-2xl p-6 space-y-4" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">{ticket.title}</h3>
              <p className="text-xs text-[#9ca3af] mt-1">{ticket.id}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-[#f3f4f6] flex items-center justify-center text-[#9ca3af]">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-xs text-[#9ca3af] uppercase">Status</p><StatusBadge value={ticket.status} /></div>
            <div><p className="text-xs text-[#9ca3af] uppercase">Priority</p><PriorityBadge value={ticket.priority} /></div>
          </div>
          <p className="text-sm text-[#374151] leading-relaxed">{ticket.description}</p>
          {isAdmin && (
            <div className="flex justify-end">
              <Link
                href={`/dashboard/support/${ticket.id}`}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-5 py-2.5 rounded-2xl text-xs font-semibold"
              >
                <ExternalLink className="w-3 h-3" /> Open Details
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function ShortcutModal({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-3xl bg-white rounded-[24px] shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">{title}</h3>
              {subtitle && <p className="text-xs text-[#9ca3af] mt-1">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-[#f3f4f6] flex items-center justify-center text-[#9ca3af]">
              <X className="w-4 h-4" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </>
  )
}

export function SupportTable({
  currentUserId,
  currentRole,
  userName,
  isAdminView,
}: {
  currentUserId: string
  currentRole: string
  userName: string
  isAdminView?: boolean
}) {
  const [rows, setRows] = useState<SupportTicketRecord[]>([])
  const [reporters, setReporters] = useState<SupportAssignableUser[]>([])
  const [assignees, setAssignees] = useState<SupportAssignableUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<10 | 20 | 50>(10)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<SupportTicketStatus | "all">("all")
  const [priorityFilter, setPriorityFilter] = useState<SupportTicketPriority | "all">("all")
  const [reportedByFilter, setReportedByFilter] = useState("all")
  const [assignedToFilter, setAssignedToFilter] = useState("all")
  const [createdDateFilter, setCreatedDateFilter] = useState("")
  const [sortField, setSortField] = useState<SortField>("created_at")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const [showCreate, setShowCreate] = useState(false)
  const [quickViewTicket, setQuickViewTicket] = useState<SupportTicketRecord | null>(null)
  const [commentsTicket, setCommentsTicket] = useState<SupportTicketRecord | null>(null)
  const [attachmentsTicket, setAttachmentsTicket] = useState<SupportTicketRecord | null>(null)
  const [statusTicket, setStatusTicket] = useState<SupportTicketRecord | null>(null)
  const [statusDraft, setStatusDraft] = useState<SupportTicketStatus>("open")

  const [toasts, setToasts] = useState<Array<{ id: number; type: ToastType; text: string }>>([])
  const toastIdRef = useRef(0)

  const isAdmin = isAdminView ?? ["admin", "super_admin"].includes(currentRole)

  const addToast = (type: ToastType, text: string) => {
    const id = ++toastIdRef.current
    setToasts((prev) => [...prev, { id, type, text }])
    setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 4000)
  }

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / perPage)), [total, perPage])
  const columnCount = isAdmin ? 8 : 6

  const loadReferenceData = useCallback(async () => {
    const [reportersRes, assigneesRes] = await Promise.all([
      fetchSupportReporters(),
      fetchSupportAssignableUsers(),
    ])
    setReporters(reportersRes.data ?? [])
    setAssignees(assigneesRes.data ?? [])
  }, [])

  const loadTickets = useCallback(async () => {
    setLoading(true)
    try {
      const { data, total: count, error } = await fetchSupportTickets({
        page,
        perPage,
        search: search || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        priority: priorityFilter === "all" ? undefined : priorityFilter,
        reportedBy: reportedByFilter === "all" ? undefined : reportedByFilter,
        assignedTo: assignedToFilter === "all" ? undefined : assignedToFilter,
        createdDate: createdDateFilter || undefined,
        sortField,
        sortDir,
        currentRole,
        currentUserId,
      })
      if (error) {
        addToast("error", error)
        return
      }
      setRows(data ?? [])
      setTotal(count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, statusFilter, priorityFilter, reportedByFilter, assignedToFilter, createdDateFilter, sortField, sortDir, currentRole, currentUserId])

  useEffect(() => { void loadReferenceData() }, [loadReferenceData])
  useEffect(() => { void loadTickets() }, [loadTickets])
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput.trim()); setPage(1) }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((prev) => prev === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("asc") }
    setPage(1)
  }

  const handleStatusUpdate = async () => {
    if (!statusTicket || !isAdmin) return
    const { data, error } = await updateSupportTicketAdmin(statusTicket.id, { status: statusDraft }, currentRole)
    if (error || !data) {
      addToast("error", error ?? "Failed to update status")
      return
    }
    setRows((prev) => prev.map((item) => item.id === data.id ? data : item))
    setStatusTicket(data)
    addToast("success", "Ticket status updated")
  }

  const createTicketButton = (
    <button
      type="button"
      onClick={() => setShowCreate(true)}
      className="inline-flex items-center gap-2 bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-4 py-2.5 rounded-full text-sm font-semibold shadow-md hover:translate-y-[-1px] hover:shadow-lg transition-all"
    >
      <Plus className="w-4 h-4" /> Create ticket
    </button>
  )

  return (
    <DashboardShell role={currentRole} roleLabel={roleToLabel(currentRole)} roleColor={getRoleColor(currentRole)} userName={userName}>
      <div className="space-y-6">
        {currentRole === "developer" ? (
          <DeveloperPortalPageHeader
            segmentLabel="Support"
            title="Support tickets"
            description="Report portal issues, listing questions, or upload problems. You only see tickets you created; our team updates status here when they respond."
            actions={createTicketButton}
          />
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#001f3f] to-[#d6b357] flex items-center justify-center shadow-lg">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0d1117]">Support Tickets</h1>
                <p className="text-sm text-[#6b7280]">
                  {isAdmin
                    ? "Manage and triage every support ticket for the team."
                    : "Send us a ticket or monitor the updates for your own reports."}
                </p>
              </div>
            </div>
            {createTicketButton}
          </div>
        )}

        {!isAdmin && (
          <div className="rounded-[24px] border border-[#e5e7eb] bg-[#f8fafc] px-5 py-4 text-sm text-[#0f172a] space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">Personal View</p>
            <p>We only expose tickets you submitted so your teammates can’t see your requests. We’ll ping you here as soon as the team updates the status.</p>
          </div>
        )}

        <div className="bg-white/60 backdrop-blur-xl rounded-[24px] border border-white/60 shadow-sm shadow-black/5 p-4 space-y-3">
          <div className="flex flex-col xl:flex-row gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search title, description, user..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f]"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-[#9ca3af]" />

              <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as SupportTicketStatus | "all"); setPage(1) }} className="pl-3 pr-8 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer">
                <option value="all">Status: All</option>
                {STATUS_VALUES.map((value) => <option key={value} value={value}>{STATUS_LABEL[value]}</option>)}
              </select>

              <select value={priorityFilter} onChange={(event) => { setPriorityFilter(event.target.value as SupportTicketPriority | "all"); setPage(1) }} className="pl-3 pr-8 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer">
                <option value="all">Priority: All</option>
                {PRIORITY_VALUES.map((value) => <option key={value} value={value}>{PRIORITY_LABEL[value]}</option>)}
              </select>

              {isAdmin && (
                <>
                  <select value={reportedByFilter} onChange={(event) => { setReportedByFilter(event.target.value); setPage(1) }} className="pl-3 pr-8 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer">
                    <option value="all">Reported By: All</option>
                    {reporters.map((item) => <option key={item.id} value={item.id}>{item.fullname ?? item.id}</option>)}
                  </select>
                  <select value={assignedToFilter} onChange={(event) => { setAssignedToFilter(event.target.value); setPage(1) }} className="pl-3 pr-8 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer">
                    <option value="all">Assigned To: All</option>
                    {assignees.map((item) => <option key={item.id} value={item.id}>{item.fullname ?? item.id}</option>)}
                  </select>
                </>
              )}

              <input type="date" value={createdDateFilter} onChange={(event) => { setCreatedDateFilter(event.target.value); setPage(1) }} className="px-3 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f]" />

              <button type="button" onClick={() => void loadTickets()} className="p-2.5 rounded-2xl border border-[#e5e5e5] bg-white/80 text-[#6b7280] hover:text-[#001f3f] hover:border-[#001f3f]/20 transition-all" title="Refresh">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-xl rounded-[24px] border border-white/60 shadow-sm shadow-black/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f0f2f5] bg-white/40">
                  <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5 pl-6">Ticket ID</th>
                  <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5">Title</th>
                  {isAdmin && (
                    <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5">Reported By</th>
                  )}
                  <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5">
                    <button type="button" onClick={() => toggleSort("priority")} className="inline-flex items-center gap-1.5 hover:text-[#001f3f]">Priority <ArrowUpDown className="w-3 h-3" /></button>
                  </th>
                  <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5">
                    <button type="button" onClick={() => toggleSort("status")} className="inline-flex items-center gap-1.5 hover:text-[#001f3f]">Status <ArrowUpDown className="w-3 h-3" /></button>
                  </th>
                  {isAdmin && (
                    <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5">Assigned To</th>
                  )}
                  <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5">
                    <button type="button" onClick={() => toggleSort("created_at")} className="inline-flex items-center gap-1.5 hover:text-[#001f3f]">Created Date <ArrowUpDown className="w-3 h-3" /></button>
                  </th>
                  <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5 pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f8f9fa]">
                {loading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index} className="border-b border-[#f3f4f6]">
                      {Array.from({ length: columnCount }).map((__, col) => (
                        <td key={col} className="px-4 py-4 first:pl-6 last:pr-6">
                          <div className={`h-3 rounded-full bg-[#f0f2f5] animate-pulse ${col === 1 ? "w-48" : "w-20"}`} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={columnCount} className="px-6 py-14 text-center">
                      <div className="flex flex-col items-center gap-2 text-[#9ca3af]">
                        <AlertCircle className="w-9 h-9 opacity-40" />
                        <p className="text-sm font-medium text-[#6b7280]">No support tickets yet.</p>
                        <p className="text-xs">Report an issue to help us improve the system.</p>
                        <button
                          type="button"
                          onClick={() => setShowCreate(true)}
                          className="mt-3 inline-flex items-center gap-2 bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-4 py-2.5 rounded-full text-sm font-semibold shadow-md hover:translate-y-[-1px] hover:shadow-lg transition-all"
                        >
                          <Plus className="w-4 h-4" />
                          Create Ticket
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-[#fcfdff] transition-colors">
                      <td className="px-4 py-3.5 pl-6 whitespace-nowrap font-mono text-xs text-[#6b7280]">{ticket.id.slice(0, 8)}...</td>
                      <td className="px-4 py-3.5 text-[#374151] min-w-[280px]">
                        <div>
                          <p className="font-semibold text-[#0d1117] line-clamp-1">{ticket.title}</p>
                          <p className="text-xs text-[#9ca3af] line-clamp-1">{ticket.module ?? "General"}</p>
                        </div>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3.5 whitespace-nowrap text-[#374151]">{ticket.reported_by_profile?.fullname ?? "—"}</td>
                      )}
                      <td className="px-4 py-3.5 whitespace-nowrap"><PriorityBadge value={ticket.priority} /></td>
                      <td className="px-4 py-3.5 whitespace-nowrap"><StatusBadge value={ticket.status} /></td>
                      {isAdmin && (
                        <td className="px-4 py-3.5 whitespace-nowrap text-[#374151]">{ticket.assigned_to_profile?.fullname ?? "—"}</td>
                      )}
                      <td className="px-4 py-3.5 whitespace-nowrap text-[#6b7280]">{formatDate(ticket.created_at)}</td>
                      <td className="px-4 py-3.5 pr-6 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setStatusTicket(ticket)
                                setStatusDraft(ticket.status)
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors"
                            >
                              <SlidersHorizontal className="w-3 h-3" /> Update Status
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setCommentsTicket(ticket)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[#dbe3ea] bg-white text-[#374151] hover:text-[#001f3f] hover:border-[#001f3f]/25 transition-colors"
                          >
                            <MessageSquare className="w-3 h-3" /> Comments
                          </button>
                          <button
                            type="button"
                            onClick={() => setAttachmentsTicket(ticket)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[#dbe3ea] bg-white text-[#374151] hover:text-[#001f3f] hover:border-[#001f3f]/25 transition-colors"
                          >
                            <Paperclip className="w-3 h-3" /> Attachments
                          </button>
                          {isAdmin && (
                            <Link
                              href={`/dashboard/support/${ticket.id}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[#dbe3ea] bg-white text-[#374151] hover:text-[#001f3f] hover:border-[#001f3f]/25 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" /> Open Details
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() => setQuickViewTicket(ticket)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[#dbe3ea] bg-white text-[#374151] hover:text-[#001f3f] hover:border-[#001f3f]/25 transition-colors"
                          >
                            <Eye className="w-3 h-3" /> Quick View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-3.5 border-t border-[#f0f2f5] bg-white/40">
            <p className="text-xs text-[#9ca3af]">Showing {total === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}</p>
            <div className="flex items-center gap-2">
              <select value={perPage} onChange={(event) => { setPerPage(Number(event.target.value) as 10 | 20 | 50); setPage(1) }} className="pl-3 pr-8 py-1.5 rounded-xl border border-[#e5e5e5] text-xs bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer">
                {PER_PAGE_OPTIONS.map((option) => <option key={option} value={option}>{option} / page</option>)}
              </select>
              <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1} className="p-1.5 rounded-xl border border-[#e5e5e5] text-[#6b7280] hover:text-[#001f3f] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs text-[#6b7280] px-1">Page {page} of {totalPages}</span>
              <button type="button" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page >= totalPages} className="p-1.5 rounded-xl border border-[#e5e5e5] text-[#6b7280] hover:text-[#001f3f] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <SupportFormDialog
        open={showCreate}
        currentUserId={currentUserId}
        currentRole={currentRole}
        onClose={() => setShowCreate(false)}
        onSaved={(ticket) => {
          setShowCreate(false)
          addToast("success", "Ticket created successfully")
          setRows((prev) => [ticket, ...prev])
          setTotal((prev) => prev + 1)
          void loadTickets()
        }}
        onError={(message) => addToast("error", message)}
      />

      <QuickViewDialog ticket={quickViewTicket} isAdmin={isAdmin} onClose={() => setQuickViewTicket(null)} />

      <ShortcutModal
        open={Boolean(statusTicket)}
        title="Update Ticket Status"
        subtitle={statusTicket ? `${statusTicket.title} Â· ${statusTicket.id}` : undefined}
        onClose={() => setStatusTicket(null)}
      >
        {statusTicket && (
          <div className="space-y-3">
            <select
              value={statusDraft}
              onChange={(event) => setStatusDraft(event.target.value as SupportTicketStatus)}
              className="w-full px-4 py-3 rounded-2xl border border-[#e5e5e5] bg-white text-sm focus:outline-none focus:border-[#001f3f]"
            >
              {STATUS_VALUES.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
            </select>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStatusTicket(null)}
                className="px-5 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:bg-[#f3f4f6] transition-all"
              >
                Close
              </button>
              <button
                type="button"
                disabled={statusDraft === statusTicket.status}
                onClick={() => void handleStatusUpdate()}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-5 py-2.5 rounded-2xl text-sm font-semibold shadow-md hover:translate-y-[-1px] hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Save Status
              </button>
            </div>
          </div>
        )}
      </ShortcutModal>

      <ShortcutModal
        open={Boolean(commentsTicket)}
        title="Support Ticket Comments"
        subtitle={commentsTicket ? `${commentsTicket.title} Â· ${commentsTicket.id}` : undefined}
        onClose={() => setCommentsTicket(null)}
      >
        {commentsTicket && (
          <TicketComments
            ticketId={commentsTicket.id}
            currentUserId={currentUserId}
            currentRole={currentRole}
            onToast={addToast}
          />
        )}
      </ShortcutModal>

      <ShortcutModal
        open={Boolean(attachmentsTicket)}
        title="Support Ticket Attachments"
        subtitle={attachmentsTicket ? `${attachmentsTicket.title} Â· ${attachmentsTicket.id}` : undefined}
        onClose={() => setAttachmentsTicket(null)}
      >
        {attachmentsTicket && (
          <TicketAttachments
            ticketId={attachmentsTicket.id}
            currentRole={currentRole}
            currentUserId={currentUserId}
            onToast={addToast}
          />
        )}
      </ShortcutModal>

      <ToastStack toasts={toasts} remove={(id) => setToasts((prev) => prev.filter((item) => item.id !== id))} />
    </DashboardShell>
  )
}
