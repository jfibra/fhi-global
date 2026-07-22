"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, RefreshCw, Inbox, ChevronLeft, ChevronRight } from "lucide-react"
import { UserAvatar } from "@/components/user-avatar"
import { formatDate, relativeTime, formatDateTime } from "@/lib/utils"
import {
  type ContactSubmission,
  type ContactInboxSummary,
  fetchContactInbox,
} from "@/lib/contact-inbox-service"

const SUBJECTS = [
  "General Inquiry",
  "Developer Partnership",
  "Project Listing",
  "Agent Onboarding",
  "Technical Support",
  "Press & Media",
]
const PER_PAGE = 20

function StatusBadge({ row }: { row: ContactSubmission }) {
  if (row.deleted_at) {
    return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 w-fit">Deleted</span>
  }
  if (row.status === "new") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 w-fit">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> New
      </span>
    )
  }
  if (row.status === "archived") {
    return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 w-fit">Archived</span>
  }
  return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 w-fit">Read</span>
}

export function ContactInboxClient() {
  const router = useRouter()
  const [rows, setRows] = useState<ContactSubmission[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<ContactInboxSummary | null>(null)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [subject, setSubject] = useState("")
  const [showDeleted, setShowDeleted] = useState(false)
  const [loading, setLoading] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, total: t, summary: s, error } = await fetchContactInbox({
        page, perPage: PER_PAGE, search,
        status: status || undefined,
        subject: subject || undefined,
        showDeleted,
      })
      if (error) return
      setRows(data)
      setTotal(t)
      setSummary(s)
    } finally {
      setLoading(false)
    }
  }, [page, search, status, subject, showDeleted])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const selectCls = "px-4 py-3 rounded-2xl border border-[#e5e5e5] bg-white text-sm text-[#374151] focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 transition-all"

  return (
    <div className="space-y-6">
      <div className="max-w-12xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#001f3f] to-[#d6b357] flex items-center justify-center shadow-lg">
            <Inbox className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0d1117]">Contact Inbox</h1>
            <p className="text-sm text-[#6b7280]">
              {summary ? `${summary.unread} unread · ${summary.total} total submissions` : "Inquiries from the public contact form"}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/60 backdrop-blur-2xl rounded-[24px] border border-white/60 shadow-xl shadow-black/5 p-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
              <input
                className="w-full pl-11 pr-4 py-3 rounded-2xl border border-[#e5e5e5] bg-white text-sm focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 transition-all"
                placeholder="Search by name, email, or message…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>

            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className={selectCls}>
              <option value="">All Status</option>
              <option value="new">New</option>
              <option value="read">Read</option>
              <option value="archived">Archived</option>
            </select>

            <select value={subject} onChange={(e) => { setSubject(e.target.value); setPage(1) }} className={selectCls}>
              <option value="">All Subjects</option>
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            <label className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-[#e5e5e5] bg-white text-sm text-[#374151] cursor-pointer select-none">
              <input type="checkbox" checked={showDeleted} onChange={(e) => { setShowDeleted(e.target.checked); setPage(1) }}
                className="w-4 h-4 rounded border-[#e5e5e5] accent-[#001f3f]" />
              Show deleted
            </label>

            <button type="button" onClick={() => void load()}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-[#e5e5e5] bg-white text-sm text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] transition-all">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white/60 backdrop-blur-2xl rounded-[24px] border border-white/60 shadow-xl shadow-black/5 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="hidden lg:grid grid-cols-[1.3fr_2fr_150px_120px_150px_32px] lg:min-w-[960px] gap-4 px-6 py-3 border-b border-[#f0f0f0]">
              {["Sender", "Message", "Subject", "Status", "Submitted", ""].map((h, i) => (
                <span key={i} className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af]">{h}</span>
              ))}
            </div>

            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-2xl bg-white/70 animate-pulse border border-[#f0f0f0]" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <div className="w-16 h-16 rounded-2xl bg-[#f3f4f6] flex items-center justify-center mb-4">
                  <Inbox className="w-8 h-8 text-[#d1d5db]" />
                </div>
                <p className="text-base font-semibold text-[#374151]">No inquiries found</p>
                <p className="text-sm text-[#9ca3af] mt-1">Submissions from the contact form will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#f0f0f0]">
                {/* Desktop rows */}
                {rows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => router.push(`/dashboard/admin/contact-inbox/${row.id}`)}
                    className={`hidden lg:grid grid-cols-[1.3fr_2fr_150px_120px_150px_32px] lg:min-w-[960px] gap-4 items-center px-6 py-4 w-full text-left hover:bg-[#f8fafc] transition-colors ${row.deleted_at ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserAvatar name={row.name} size={34} />
                      <div className="min-w-0">
                        <p className={`text-sm truncate ${row.status === "new" && !row.deleted_at ? "font-bold text-[#0d1117]" : "font-semibold text-[#374151]"}`}>{row.name}</p>
                        <p className="text-xs text-[#9ca3af] truncate">{row.email}</p>
                      </div>
                    </div>
                    <p className="text-xs text-[#6b7280] truncate">{row.message}</p>
                    <span className="text-xs text-[#6b7280] truncate">{row.subject ?? "—"}</span>
                    <StatusBadge row={row} />
                    <div className="min-w-0">
                      <p className="text-xs text-[#374151] truncate" title={formatDateTime(row.created_at)}>{formatDate(row.created_at)}</p>
                      <p className="text-[11px] text-[#9ca3af] truncate">{relativeTime(row.created_at)}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#c4c4c4]" />
                  </button>
                ))}

                {/* Mobile cards */}
                {rows.map((row) => (
                  <button
                    key={`m-${row.id}`}
                    type="button"
                    onClick={() => router.push(`/dashboard/admin/contact-inbox/${row.id}`)}
                    className={`lg:hidden w-full text-left p-4 hover:bg-[#f8fafc] transition-colors ${row.deleted_at ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <UserAvatar name={row.name} size={36} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm truncate ${row.status === "new" && !row.deleted_at ? "font-bold text-[#0d1117]" : "font-semibold text-[#374151]"}`}>{row.name}</p>
                          <StatusBadge row={row} />
                        </div>
                        <p className="text-xs text-[#9ca3af] truncate">{row.email}</p>
                        <p className="text-xs text-[#6b7280] line-clamp-2 mt-1">{row.message}</p>
                        <p className="text-[11px] text-[#9ca3af] mt-1">{row.subject ?? "—"} · {relativeTime(row.created_at)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-[#6b7280]">
            {total > 0 ? `Showing ${Math.min((page - 1) * PER_PAGE + 1, total)}–${Math.min(page * PER_PAGE, total)} of ${total}` : "No results"}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-[#e5e5e5] text-[#6b7280] hover:border-[#001f3f] hover:text-[#001f3f] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-[#374151] px-2">{page} / {totalPages}</span>
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-[#e5e5e5] text-[#6b7280] hover:border-[#001f3f] hover:text-[#001f3f] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
