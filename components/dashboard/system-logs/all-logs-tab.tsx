"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, RefreshCw, Search, ExternalLink } from "lucide-react"
import { RoleBadge } from "@/components/role-badge"
import { UserAvatar } from "@/components/user-avatar"
import { ROLE_OPTIONS } from "@/lib/app-roles"
import {
  type AuditLogRow,
  type AuditListResponse,
  categoryMeta,
  eventColor,
  humanizeEvent,
  relativeTime,
  EVENT_OPTIONS,
  SOURCE_OPTIONS,
} from "./log-meta"
import { LogDetailDrawer } from "./log-detail-drawer"

const PER_PAGE = 25
const SELECT_CLS =
  "h-9 rounded-lg border border-[#e5e7eb] bg-white px-2.5 text-xs text-[#374151] focus:outline-none focus:border-[#001f3f]"

export function AllLogsTab({ scope, categoryCounts }: { scope?: "security"; categoryCounts: Record<string, number> }) {
  const [rows, setRows] = useState<AuditLogRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AuditLogRow | null>(null)

  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [category, setCategory] = useState("")
  const [event, setEvent] = useState("")
  const [role, setRole] = useState("")
  const [source, setSource] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onSearchChange = (v: string) => {
    setSearch(v)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDebounced(v), 400)
  }

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const sp = new URLSearchParams({ page: String(page), perPage: String(PER_PAGE) })
    if (scope) sp.set("scope", scope)
    if (debounced) sp.set("search", debounced)
    if (category) sp.set("category", category)
    if (event) sp.set("event", event)
    if (role) sp.set("role", role)
    if (source) sp.set("source", source)
    if (from) sp.set("from", from)
    if (to) sp.set("to", to)
    try {
      const res = await fetch(`/api/admin/system-logs?${sp.toString()}`)
      const json = (await res.json()) as AuditListResponse
      if (res.ok) {
        setRows(json.rows ?? [])
        setTotal(json.total ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [page, scope, debounced, category, event, role, source, from, to])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  // Any filter change resets to page 1.
  useEffect(() => {
    setPage(1)
  }, [debounced, category, event, role, source, from, to])

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const categoryEntries = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 flex flex-wrap items-center gap-2.5">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={SELECT_CLS}>
          <option value="">{scope === "security" ? "All in scope" : "All categories"}</option>
          {categoryEntries.map(([c, n]) => (
            <option key={c} value={c}>
              {categoryMeta(c).label} ({n})
            </option>
          ))}
        </select>
        <select value={event} onChange={(e) => setEvent(e.target.value)} className={SELECT_CLS}>
          <option value="">All events</option>
          {EVENT_OPTIONS.map((ev) => (
            <option key={ev} value={ev}>
              {humanizeEvent(ev)}
            </option>
          ))}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)} className={SELECT_CLS}>
          <option value="">All roles</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className={SELECT_CLS}>
          <option value="">All origins</option>
          {SOURCE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={SELECT_CLS} aria-label="From date" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={SELECT_CLS} aria-label="To date" />
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search user / subject / description"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#e5e7eb] bg-white text-xs text-[#374151] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f]"
          />
        </div>
        <button
          type="button"
          onClick={() => void fetchLogs()}
          className="h-9 w-9 flex items-center justify-center rounded-lg border border-[#e5e7eb] text-[#6b7280] hover:border-[#001f3f] hover:text-[#001f3f]"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#e8eaed] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] border-b border-[#f0f2f5]">
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Event</th>
                <th className="px-5 py-3">Subject</th>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3 whitespace-nowrap">When</th>
                <th className="px-5 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#f4f6f9]">
                    <td className="px-5 py-3.5" colSpan={6}>
                      <div className="h-4 bg-[#f0f2f5] rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-[#9ca3af] text-sm">
                    No activity yet for these filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const cat = categoryMeta(row.category)
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelected(row)}
                      className="border-b border-[#f4f6f9] hover:bg-[#f9fafb] cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${cat.bg} ${cat.text}`}>
                          {cat.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-xs" style={{ color: eventColor(row.event) }}>
                          {humanizeEvent(row.event)}
                        </span>
                        <p className="text-[10px] text-[#9ca3af]">from {row.source}</p>
                      </td>
                      <td className="px-5 py-3.5 max-w-[280px]">
                        <p className="text-xs text-[#111827] truncate">
                          {row.description || row.subject_label || (row.subject_type ? `${row.subject_type} #${row.subject_id ?? "—"}` : "—")}
                        </p>
                        {row.description && row.subject_label && (
                          <p className="text-[10px] text-[#9ca3af] truncate">{row.subject_label}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <UserAvatar name={row.actor_name ?? "System"} size={24} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-[#111827] truncate max-w-[120px]">{row.actor_name ?? "System"}</p>
                            {row.actor_role && <RoleBadge role={row.actor_role} />}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-[#9ca3af]">{relativeTime(row.occurred_at)}</td>
                      <td className="px-5 py-3.5">
                        <ExternalLink className="w-3.5 h-3.5 text-[#c4c4c4]" />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#f0f2f5]">
            <p className="text-xs text-[#9ca3af]">
              Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-[#e5e5e5] text-[#6b7280] disabled:opacity-40 hover:border-[#001f3f]/20"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-semibold text-[#374151] px-2">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-[#e5e5e5] text-[#6b7280] disabled:opacity-40 hover:border-[#001f3f]/20"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selected && <LogDetailDrawer row={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
