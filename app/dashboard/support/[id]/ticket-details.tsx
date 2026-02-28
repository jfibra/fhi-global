"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Paperclip } from "lucide-react"
import {
  fetchSupportAssignableUsers,
  fetchSupportTicketById,
  isSupportAdmin,
  updateSupportTicketAdmin,
  type SupportAssignableUser,
  type SupportTicketPriority,
  type SupportTicketRecord,
  type SupportTicketStatus,
} from "@/lib/support-service"
import { TicketAttachments } from "./ticket-attachments"
import { TicketComments } from "./ticket-comments"

type TabId = "details" | "attachments" | "discussion"
type ToastType = "success" | "error"

const STATUS_VALUES: SupportTicketStatus[] = ["open", "in_progress", "waiting_user", "resolved", "closed"]
const PRIORITY_LABEL: Record<SupportTicketPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  critical: "Critical",
}

const STATUS_LABEL: Record<SupportTicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting_user: "Waiting User",
  resolved: "Resolved",
  closed: "Closed",
}

function formatDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
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

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">{label}</span>
      <span className="text-sm text-[#0d1117] font-medium">{value ?? <span className="text-[#9ca3af]">—</span>}</span>
    </div>
  )
}

export function TicketDetails({
  ticketId,
  currentUserId,
  currentRole,
}: {
  ticketId: string
  currentUserId: string
  currentRole: string
}) {
  const [ticket, setTicket] = useState<SupportTicketRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>("details")
  const [assignees, setAssignees] = useState<SupportAssignableUser[]>([])
  const [toasts, setToasts] = useState<Array<{ id: number; type: ToastType; text: string }>>([])
  const toastIdRef = useRef(0)

  const isAdmin = isSupportAdmin(currentRole)

  const addToast = (type: ToastType, text: string) => {
    const id = ++toastIdRef.current
    setToasts((prev) => [...prev, { id, type, text }])
    setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 4000)
  }

  const loadTicket = async () => {
    setLoading(true)
    try {
      const { data, error } = await fetchSupportTicketById(ticketId)
      if (error || !data) {
        addToast("error", error ?? "Unable to load ticket")
        return
      }

      if (!isAdmin && data.reported_by !== currentUserId) {
        addToast("error", "You cannot access this ticket")
        return
      }

      setTicket(data)
    } finally {
      setLoading(false)
    }
  }

  const loadAssignees = async () => {
    if (!isAdmin) return
    const { data } = await fetchSupportAssignableUsers()
    setAssignees(data ?? [])
  }

  useEffect(() => {
    void loadTicket()
    void loadAssignees()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  const detailsContent = useMemo(() => {
    if (!ticket) return null

    return (
      <div className="space-y-4">
        <div className="bg-white/60 backdrop-blur-xl rounded-[20px] border border-white/60 shadow-sm shadow-black/5 p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <DetailRow label="Ticket ID" value={ticket.id} />
            <DetailRow label="Priority" value={<PriorityBadge value={ticket.priority} />} />
            <DetailRow label="Status" value={<StatusBadge value={ticket.status} />} />
            <DetailRow label="Created" value={formatDate(ticket.created_at)} />
            <DetailRow label="Reported By" value={ticket.reported_by_profile?.fullname} />
            <DetailRow label="Assigned To" value={ticket.assigned_to_profile?.fullname} />
            <DetailRow label="Resolved At" value={formatDate(ticket.resolved_at)} />
            <DetailRow label="Attachments" value={<span className="inline-flex items-center gap-1.5"><Paperclip className="w-3.5 h-3.5" />{ticket.attachments_count}</span>} />
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4">
            <DetailRow label="Title" value={ticket.title} />
            <DetailRow label="Description" value={ticket.description} />
            <DetailRow label="Ticket Type" value={ticket.ticket_type} />
            <DetailRow label="Page URL" value={ticket.page_url} />
            <DetailRow label="Module" value={ticket.module} />
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-xl rounded-[20px] border border-white/60 shadow-sm shadow-black/5 p-6">
          <h3 className="font-['Space_Grotesk'] text-sm font-bold text-[#0d1117] uppercase tracking-wider mb-4">Environment Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            <DetailRow label="Device Type" value={ticket.device_type} />
            <DetailRow label="Device OS" value={ticket.device_os} />
            <DetailRow label="Browser" value={ticket.browser} />
            <DetailRow label="Browser Version" value={ticket.browser_version} />
            <DetailRow label="Screen Resolution" value={ticket.screen_resolution} />
            <DetailRow label="IP Address" value={ticket.ip_address} />
            <DetailRow label="Location Country" value={ticket.location_country} />
            <DetailRow label="Location City" value={ticket.location_city} />
            <DetailRow label="User Agent" value={ticket.user_agent} />
          </div>
        </div>

        {isAdmin && (
          <div className="bg-white/60 backdrop-blur-xl rounded-[20px] border border-white/60 shadow-sm shadow-black/5 p-6">
            <h3 className="font-['Space_Grotesk'] text-sm font-bold text-[#0d1117] uppercase tracking-wider mb-4">Admin Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#374151] ml-1 mb-2 block">Update Status</label>
                <select
                  value={ticket.status}
                  onChange={async (event) => {
                    const nextStatus = event.target.value as SupportTicketStatus
                    const { data, error } = await updateSupportTicketAdmin(ticket.id, { status: nextStatus }, currentRole)
                    if (error || !data) {
                      addToast("error", error ?? "Failed to update status")
                      return
                    }
                    setTicket(data)
                    addToast("success", "Ticket status updated")
                  }}
                  className="w-full px-4 py-3 rounded-2xl border border-[#e5e5e5] bg-white text-sm focus:outline-none focus:border-[#001f3f]"
                >
                  {STATUS_VALUES.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#374151] ml-1 mb-2 block">Assign Ticket</label>
                <select
                  value={ticket.assigned_to ?? ""}
                  onChange={async (event) => {
                    const assignee = event.target.value || null
                    const { data, error } = await updateSupportTicketAdmin(ticket.id, { assigned_to: assignee }, currentRole)
                    if (error || !data) {
                      addToast("error", error ?? "Failed to assign ticket")
                      return
                    }
                    setTicket(data)
                    addToast("success", "Ticket assignment updated")
                  }}
                  className="w-full px-4 py-3 rounded-2xl border border-[#e5e5e5] bg-white text-sm focus:outline-none focus:border-[#001f3f]"
                >
                  <option value="">Unassigned</option>
                  {assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.fullname ?? assignee.id}</option>)}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={async () => {
                    const { data, error } = await updateSupportTicketAdmin(ticket.id, { status: "resolved" }, currentRole)
                    if (error || !data) {
                      addToast("error", error ?? "Failed to resolve ticket")
                      return
                    }
                    setTicket(data)
                    addToast("success", "Ticket status updated")
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-5 py-2.5 rounded-2xl text-sm font-semibold shadow-md hover:translate-y-[-1px] hover:shadow-lg transition-all"
                >
                  Mark Ticket Resolved
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }, [assignees, currentRole, isAdmin, ticket])

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/support" className="inline-flex items-center gap-1.5 text-xs text-[#6b7280] hover:text-[#001f3f] transition-colors mb-3">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Support Tickets
          </Link>
          <h1 className="font-['Space_Grotesk'] text-2xl font-bold tracking-tight text-[#0d1117]">{ticket?.title ?? "Support Ticket"}</h1>
          <p className="text-sm text-[#6b7280]">Ticket details, attachments, and discussion</p>
        </div>
        {ticket && (
          <div className="flex items-center gap-2 mt-8">
            <PriorityBadge value={ticket.priority} />
            <StatusBadge value={ticket.status} />
          </div>
        )}
      </div>

      <div className="bg-white/60 backdrop-blur-xl rounded-[20px] border border-white/60 shadow-sm shadow-black/5 p-2">
        <div className="flex gap-1 bg-[#f3f4f6] p-1 rounded-2xl">
          {[
            { id: "details", label: "Ticket Details" },
            { id: "attachments", label: "Attachments" },
            { id: "discussion", label: "Discussion" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as TabId)}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${activeTab === tab.id ? "bg-white text-[#001f3f] shadow-sm" : "text-[#6b7280] hover:text-[#374151]"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((item) => <div key={item} className="h-20 rounded-2xl bg-[#f3f4f6] animate-pulse" />)}</div>
      ) : !ticket ? (
        <div className="px-6 py-10 bg-white/60 backdrop-blur-xl rounded-[20px] border border-white/60 text-center text-[#6b7280]">
          Unable to load ticket.
        </div>
      ) : (
        <>
          {activeTab === "details" && detailsContent}
          {activeTab === "attachments" && (
            <TicketAttachments
              ticketId={ticket.id}
              currentRole={currentRole}
              currentUserId={currentUserId}
              onToast={addToast}
            />
          )}
          {activeTab === "discussion" && (
            <TicketComments
              ticketId={ticket.id}
              currentUserId={currentUserId}
              currentRole={currentRole}
              onToast={addToast}
            />
          )}
        </>
      )}

      <div className="fixed bottom-6 right-6 z-[80] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold pointer-events-auto max-w-xs ${toast.type === "success" ? "bg-green-50 text-green-800 border border-green-100" : "bg-rose-50 text-rose-800 border border-rose-100"}`}
          >
            <span className="flex-1">{toast.text}</span>
            <button type="button" onClick={() => setToasts((prev) => prev.filter((item) => item.id !== toast.id))} className="opacity-60 hover:opacity-100 text-xs ml-2">✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}
