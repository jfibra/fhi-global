"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, RefreshCw, UserSearch, ChevronLeft, ChevronRight } from "lucide-react"
import { UserAvatar } from "@/components/user-avatar"
import { formatDate, relativeTime, formatDateTime } from "@/lib/utils"
import {
  type Inquiry,
  type InquiriesSummary,
  fetchInquiries,
  LOOKING_FOR_LABELS,
  CATEGORY_LABELS,
} from "@/lib/inquiries-service"
import { useAuth } from "@/context/auth-context"
import { getDashboardRouteByRole } from "@/lib/auth"

const PER_PAGE = 20

function StatusBadge({ row }: { row: Inquiry }) {
  if (row.deleted_at) {
    return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 w-fit">Archived</span>
  }
  if (row.status === "new") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#d6b357]/15 text-[#8a6d1f] w-fit">
        <span className="w-1.5 h-1.5 rounded-full bg-[#d6b357]" /> New
      </span>
    )
  }
  if (row.status === "contacted") {
    return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 w-fit">Contacted</span>
  }
  return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 w-fit">Closed</span>
}

function CategoryChip({ category }: { category: Inquiry["property_category"] }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#f3f4f6] text-[#374151] w-fit">
      {CATEGORY_LABELS[category] ?? category}
    </span>
  )
}

export function LeadsClient() {
  const router = useRouter()
  const base = getDashboardRouteByRole(useAuth().role)
  const [rows, setRows] = useState<Inquiry[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<InquiriesSummary | null>(null)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [category, setCategory] = useState("")
  const [showDeleted, setShowDeleted] = useState(false)
  const [loading, setLoading] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, total: t, summary: s, error } = await fetchInquiries({
        page, perPage: PER_PAGE, search,
        status: status || undefined,
        category: category || undefined,
        showDeleted,
      })
      if (error) return
      setRows(data)
      setTotal(t)
      setSummary(s)
    } finally {
      setLoading(false)
    }
  }, [page, search, status, category, showDeleted])

  // Deferred a tick so state updates happen outside the effect body
  // (react-hooks/set-state-in-effect) and rapid filter changes coalesce.
  useEffect(() => {
    const t = setTimeout(() => { void load() }, 0)
    return () => clearTimeout(t)
  }, [load])

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
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] flex items-center justify-center shadow-lg">
            <UserSearch className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0d1117]">Leads Inquiries</h1>
            <p className="text-sm text-[#6b7280]">
              {summary ? `${summary.new} new · ${summary.total} total leads` : "Property inquiries from project pages"}
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
                placeholder="Search by name, email, phone, or project…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>

            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className={selectCls}>
              <option value="">All Status</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="closed">Closed</option>
            </select>

            <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }} className={selectCls}>
              <option value="">All Categories</option>
              <option value="off_plan">Off Plan</option>
              <option value="ready">Ready</option>
              <option value="rent">Rent</option>
            </select>

            <label className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-[#e5e5e5] bg-white text-sm text-[#374151] cursor-pointer select-none">
              <input type="checkbox" checked={showDeleted} onChange={(e) => { setShowDeleted(e.target.checked); setPage(1) }}
                className="w-4 h-4 rounded border-[#e5e5e5] accent-[#001f3f]" />
              Show archived
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
            <div className="hidden lg:grid grid-cols-[1.4fr_150px_1.2fr_1.3fr_110px_140px_32px] lg:min-w-[1020px] gap-4 px-6 py-3 border-b border-[#f0f0f0]">
              {["Lead", "Phone", "Interest", "Project", "Status", "Submitted", ""].map((h, i) => (
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
                  <UserSearch className="w-8 h-8 text-[#d1d5db]" />
                </div>
                <p className="text-base font-semibold text-[#374151]">No leads found</p>
                <p className="text-sm text-[#9ca3af] mt-1">Inquiries from the Inquire Now form on project pages will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#f0f0f0]">
                {/* Desktop rows */}
                {rows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => router.push(`${base}/leads/${row.id}`)}
                    className={`hidden lg:grid grid-cols-[1.4fr_150px_1.2fr_1.3fr_110px_140px_32px] lg:min-w-[1020px] gap-4 items-center px-6 py-4 w-full text-left hover:bg-[#f8fafc] transition-colors ${row.deleted_at ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserAvatar name={row.name} size={34} />
                      <div className="min-w-0">
                        <p className={`text-sm truncate ${row.status === "new" && !row.deleted_at ? "font-bold text-[#0d1117]" : "font-semibold text-[#374151]"}`}>{row.name}</p>
                        <p className="text-xs text-[#9ca3af] truncate">{row.email}</p>
                      </div>
                    </div>
                    <span className="text-xs text-[#6b7280] truncate">{row.phone_country_code} {row.phone}</span>
                    <div className="min-w-0 flex flex-col gap-1">
                      <span className="text-xs text-[#6b7280] truncate">{LOOKING_FOR_LABELS[row.looking_for] ?? row.looking_for}</span>
                      <CategoryChip category={row.property_category} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-[#374151] truncate">{row.project_name ?? "—"}</p>
                      {row.developer_name && <p className="text-[11px] text-[#9ca3af] truncate">{row.developer_name}</p>}
                    </div>
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
                    onClick={() => router.push(`${base}/leads/${row.id}`)}
                    className={`lg:hidden w-full text-left p-4 hover:bg-[#f8fafc] transition-colors ${row.deleted_at ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <UserAvatar name={row.name} size={36} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm truncate ${row.status === "new" && !row.deleted_at ? "font-bold text-[#0d1117]" : "font-semibold text-[#374151]"}`}>{row.name}</p>
                          <StatusBadge row={row} />
                        </div>
                        <p className="text-xs text-[#9ca3af] truncate">{row.email} · {row.phone_country_code} {row.phone}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <CategoryChip category={row.property_category} />
                          <span className="text-[11px] text-[#9ca3af] truncate">{LOOKING_FOR_LABELS[row.looking_for] ?? row.looking_for}</span>
                        </div>
                        <p className="text-[11px] text-[#9ca3af] mt-1">{row.project_name ?? "No project"} · {relativeTime(row.created_at)}</p>
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
