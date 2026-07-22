"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import {
  Search, RefreshCw, MoreHorizontal, Pencil, Trash2, ArchiveRestore,
  History, ExternalLink, ChevronLeft, ChevronRight, ClipboardList,
  ImageIcon, Building2, Home, Tag,
} from "lucide-react"
import { RoleBadge } from "@/components/role-badge"
import { UserAvatar } from "@/components/user-avatar"
import { formatDate, relativeTime, formatDateTime } from "@/lib/utils"
import {
  type AdminListingRow,
  type AdminListingsSummary,
  type DeveloperOption,
  fetchAdminListings,
  fetchDeveloperOptions,
  setAdminListingDeleted,
} from "@/lib/admin-listings-service"
import { ListingEditDialog } from "./listing-edit-dialog"
import { ListingActivityDrawer } from "./listing-activity-drawer"

// ─── Toast ──────────────────────────────────────────────────────────────────
function Portal({ children }: { children: React.ReactNode }) {
  const [m, setM] = useState(false)
  useEffect(() => setM(true), [])
  if (!m) return null
  return createPortal(children, document.body)
}

type ToastType = "success" | "error"
interface ToastMsg { id: number; type: ToastType; text: string }

function Toast({ toasts, remove }: { toasts: ToastMsg[]; remove: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[220] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold pointer-events-auto max-w-xs transition-all ${
          t.type === "success" ? "bg-green-50 text-green-800 border border-green-100" : "bg-rose-50 text-rose-800 border border-rose-100"
        }`}>
          <span className="flex-1">{t.text}</span>
          <button type="button" onClick={() => remove(t.id)} className="opacity-60 hover:opacity-100 text-xs ml-2">✕</button>
        </div>
      ))}
    </div>
  )
}

// ─── Confirm ──────────────────────────────────────────────────────────────────
function ConfirmDialog({ message, confirmLabel, onConfirm, onCancel }: { message: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Portal>
      <div className="fixed inset-0 z-[215] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} aria-hidden />
        <div className="relative bg-white rounded-[24px] p-6 max-w-sm w-full shadow-2xl border border-white/60">
          <p className="text-sm text-[#374151] leading-relaxed mb-6">{message}</p>
          <div className="flex gap-3 justify-end">
            <button onClick={onCancel} className="px-5 py-2.5 rounded-full border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] transition-all">Cancel</button>
            <button onClick={onConfirm} className="px-5 py-2.5 rounded-full bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 transition-all">{confirmLabel}</button>
          </div>
        </div>
      </div>
    </Portal>
  )
}

// ─── Row actions dropdown ─────────────────────────────────────────────────────
interface RowActionsProps {
  row: AdminListingRow
  onEdit: () => void
  onActivity: () => void
  onDelete: () => void
  onRestore: () => void
}
function RowActions({ row, onEdit, onActivity, onDelete, onRestore }: RowActionsProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open || !triggerRef.current) return
    const compute = () => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      const menuWidth = 190
      const estHeight = 220
      const pad = 8
      const placeBelow = rect.bottom + 8 + estHeight <= window.innerHeight - pad
      const top = placeBelow ? rect.bottom + 6 : Math.max(pad, rect.top - estHeight - 6)
      const left = Math.min(Math.max(pad, rect.right - menuWidth), window.innerWidth - menuWidth - pad)
      setPos({ top, left })
    }
    compute()
    window.addEventListener("resize", compute)
    window.addEventListener("scroll", compute, true)
    return () => {
      window.removeEventListener("resize", compute)
      window.removeEventListener("scroll", compute, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      const target = e.target as Node
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  const isDeleted = Boolean(row.deleted_at)
  const canViewPublic = row.status === "published" && !isDeleted

  return (
    <div ref={triggerRef} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f3f4f6] transition-colors text-[#6b7280]">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <Portal>
          <div className="fixed inset-0 z-[130]" onClick={() => setOpen(false)} />
          <div className="fixed z-[140]" style={{ top: pos.top, left: pos.left }}>
            <div ref={menuRef} className="bg-white rounded-2xl border border-[#f0f0f0] shadow-2xl py-1.5 min-w-[190px] mt-1">
              {canViewPublic && (
                <button type="button"
                  onClick={() => { setOpen(false); window.open(`/listings/${row.id}`, "_blank", "noopener,noreferrer") }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#374151] hover:bg-[#f8fafc] transition-colors">
                  <ExternalLink className="w-3.5 h-3.5 text-[#6b7280]" /> View public page
                </button>
              )}
              <button type="button" onClick={() => { setOpen(false); onActivity() }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#374151] hover:bg-[#f8fafc] transition-colors">
                <History className="w-3.5 h-3.5 text-[#6b7280]" /> Activity Log
              </button>
              {!isDeleted && (
                <button type="button" onClick={() => { setOpen(false); onEdit() }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#374151] hover:bg-[#f8fafc] transition-colors">
                  <Pencil className="w-3.5 h-3.5 text-[#6b7280]" /> Edit
                </button>
              )}
              <div className="border-t border-[#f0f0f0] my-1" />
              {isDeleted ? (
                <button type="button" onClick={() => { setOpen(false); onRestore() }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 transition-colors">
                  <ArchiveRestore className="w-3.5 h-3.5" /> Restore
                </button>
              ) : (
                <button type="button" onClick={() => { setOpen(false); onDelete() }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-rose-500 hover:bg-rose-50 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              )}
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}

// ─── Small presentational helpers ─────────────────────────────────────────────
function firstImageUrl(row: AdminListingRow): string | null {
  const imgs = row.agent_listing_images ?? []
  if (!imgs.length) return null
  return [...imgs].sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? null
}

function ListingThumb({ row }: { row: AdminListingRow }) {
  const url = firstImageUrl(row)
  if (url) {
    return (
      <div className="relative w-11 h-11 rounded-xl overflow-hidden border border-[#e5e5e5] bg-[#f3f4f6] flex-shrink-0">
        <Image src={url} alt={row.title} fill sizes="44px" className="object-cover" />
      </div>
    )
  }
  return (
    <div className="w-11 h-11 rounded-xl bg-[#f3f4f6] flex items-center justify-center flex-shrink-0">
      <ImageIcon className="w-4 h-4 text-[#d1d5db]" />
    </div>
  )
}

function KindBadge({ kind }: { kind: "sale" | "rent" }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold w-fit ${
      kind === "sale" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"
    }`}>
      {kind === "sale" ? <Tag className="w-3 h-3" /> : <Home className="w-3 h-3" />}
      {kind === "sale" ? "Sale" : "Rent"}
    </span>
  )
}

function StatusBadge({ row }: { row: AdminListingRow }) {
  if (row.deleted_at) {
    return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 w-fit">Deleted</span>
  }
  const map: Record<string, string> = {
    published: "bg-emerald-50 text-emerald-700",
    draft: "bg-amber-50 text-amber-700",
    archived: "bg-slate-100 text-slate-600",
  }
  const label = row.status.charAt(0).toUpperCase() + row.status.slice(1)
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold w-fit ${map[row.status] ?? "bg-slate-100 text-slate-600"}`}>{label}</span>
}

function priceLabel(row: AdminListingRow): string {
  if (row.project_id != null) return "Via project"
  if (row.price != null) return `${row.currency} ${row.price.toLocaleString()}`
  return "—"
}

function developerLabel(row: AdminListingRow): { dev: string; project: string | null } {
  if (!row.projects) return { dev: "Standalone", project: null }
  return { dev: row.projects.developers?.name ?? "—", project: row.projects.name ?? null }
}

// ─── Summary tile ─────────────────────────────────────────────────────────────
function SummaryTile({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="bg-white/60 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-sm px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af]">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${accent}`}>{value.toLocaleString()}</p>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-16 rounded-2xl bg-white/70 animate-pulse border border-[#f0f0f0]" />
      ))}
    </div>
  )
}

const PER_PAGE_OPTIONS = [10, 20, 50] as const
type SortField = "updated_at" | "created_at" | "title" | "price"

// ─── Main component ───────────────────────────────────────────────────────────
export function AllListingsClient() {
  const [rows, setRows] = useState<AdminListingRow[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<AdminListingsSummary | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<10 | 20 | 50>(20)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [developerId, setDeveloperId] = useState("")
  const [status, setStatus] = useState("")
  const [kind, setKind] = useState("")
  const [showDeleted, setShowDeleted] = useState(false)
  const [sortField, setSortField] = useState<SortField>("updated_at")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [loading, setLoading] = useState(false)
  const [developers, setDevelopers] = useState<DeveloperOption[]>([])

  const [editTarget, setEditTarget] = useState<AdminListingRow | null>(null)
  const [activityTarget, setActivityTarget] = useState<AdminListingRow | null>(null)
  const [confirm, setConfirm] = useState<{ message: string; label: string; action: () => void } | null>(null)
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const toastIdRef = useRef(0)

  const addToast = (type: ToastType, text: string) => {
    const id = ++toastIdRef.current
    setToasts((prev) => [...prev, { id, type, text }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500)
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, total: t, summary: s, error } = await fetchAdminListings({
        page, perPage, search,
        developerId: developerId || undefined,
        status: status || undefined,
        kind: kind || undefined,
        showDeleted,
        sort: sortField,
        dir: sortDir,
      })
      if (error) { addToast("error", error); return }
      setRows(data)
      setTotal(t)
      setSummary(s)
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, developerId, status, kind, showDeleted, sortField, sortDir])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    void (async () => {
      const { data } = await fetchDeveloperOptions()
      setDevelopers(data)
    })()
  }, [])

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const handleDelete = (row: AdminListingRow) => {
    setConfirm({
      message: `Delete "${row.title}"? It will be hidden from the agent and public listings but can be restored.`,
      label: "Delete",
      action: async () => {
        setConfirm(null)
        const { error } = await setAdminListingDeleted(row.id, true)
        if (error) { addToast("error", error); return }
        addToast("success", "Listing deleted.")
        void load()
      },
    })
  }

  const handleRestore = async (row: AdminListingRow) => {
    const { error } = await setAdminListingDeleted(row.id, false)
    if (error) { addToast("error", error); return }
    addToast("success", "Listing restored.")
    void load()
  }

  const sortToggle = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortField(field); setSortDir("desc") }
    setPage(1)
  }

  const selectCls = "px-4 py-3 rounded-2xl border border-[#e5e5e5] bg-white text-sm text-[#374151] focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 transition-all"

  return (
    <div className="space-y-6">
      <div className="max-w-12xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#001f3f] to-[#d6b357] flex items-center justify-center shadow-lg">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0d1117]">All Listings</h1>
            <p className="text-sm text-[#6b7280]">Every agent listing across the platform</p>
          </div>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryTile label="Total" value={summary?.total ?? 0} accent="text-[#0d1117]" />
          <SummaryTile label="Published" value={summary?.published ?? 0} accent="text-emerald-600" />
          <SummaryTile label="Draft" value={summary?.draft ?? 0} accent="text-amber-600" />
          <SummaryTile label="Archived" value={summary?.archived ?? 0} accent="text-slate-500" />
        </div>

        {/* Filters */}
        <div className="bg-white/60 backdrop-blur-2xl rounded-[24px] border border-white/60 shadow-xl shadow-black/5 p-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
              <input
                className="w-full pl-11 pr-4 py-3 rounded-2xl border border-[#e5e5e5] bg-white text-sm focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 transition-all"
                placeholder="Search by listing title…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>

            <select value={developerId} onChange={(e) => { setDeveloperId(e.target.value); setPage(1) }} className={selectCls}>
              <option value="">All Developers</option>
              {developers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className={selectCls}>
              <option value="">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>

            <select value={kind} onChange={(e) => { setKind(e.target.value); setPage(1) }} className={selectCls}>
              <option value="">All Types</option>
              <option value="sale">Sale</option>
              <option value="rent">Rent</option>
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

          {/* Sort pills */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs text-[#9ca3af] font-semibold uppercase tracking-wider">Sort:</span>
            {([
              ["updated_at", "Updated"],
              ["created_at", "Created"],
              ["title", "Title"],
              ["price", "Price"],
            ] as [SortField, string][]).map(([f, label]) => (
              <button key={f} type="button" onClick={() => sortToggle(f)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  sortField === f ? "bg-[#001f3f] text-white border-[#001f3f]" : "border-[#e5e5e5] text-[#6b7280] hover:border-[#001f3f] hover:text-[#001f3f]"
                }`}>
                {label}{sortField === f && <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white/60 backdrop-blur-2xl rounded-[24px] border border-white/60 shadow-xl shadow-black/5 overflow-hidden">
          <div className="overflow-x-auto">
            {/* Header */}
            <div className="hidden lg:grid grid-cols-[56px_1.6fr_150px_1.4fr_86px_120px_104px_120px_44px] lg:min-w-[1240px] gap-4 px-6 py-3 border-b border-[#f0f0f0]">
              {["", "Listing", "Agent", "Developer / Project", "Type", "Price", "Status", "Updated", ""].map((h, i) => (
                <span key={i} className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af]">{h}</span>
              ))}
            </div>

            {loading ? (
              <div className="p-6"><Skeleton /></div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <div className="w-16 h-16 rounded-2xl bg-[#f3f4f6] flex items-center justify-center mb-4">
                  <ClipboardList className="w-8 h-8 text-[#d1d5db]" />
                </div>
                <p className="text-base font-semibold text-[#374151]">No listings found</p>
                <p className="text-sm text-[#9ca3af] mt-1">Try adjusting your search or filters.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#f0f0f0]">
                {rows.map((row) => {
                  const { dev, project } = developerLabel(row)
                  return (
                    <div key={row.id}
                      className={`hidden lg:grid grid-cols-[56px_1.6fr_150px_1.4fr_86px_120px_104px_120px_44px] lg:min-w-[1240px] gap-4 items-center px-6 py-4 hover:bg-[#f8fafc] transition-colors ${row.deleted_at ? "opacity-60" : ""}`}>
                      <ListingThumb row={row} />

                      {/* Listing */}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0d1117] truncate">{row.title}</p>
                        {row.unit_type && <p className="text-xs text-[#9ca3af] truncate">{row.unit_type}</p>}
                      </div>

                      {/* Agent */}
                      <div className="flex items-center gap-2 min-w-0">
                        <UserAvatar name={row.agent?.fullname ?? "Unknown"} size={26} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#111827] truncate">{row.agent?.fullname ?? "Unknown"}</p>
                          {row.agent?.role && <RoleBadge role={row.agent.role} />}
                        </div>
                      </div>

                      {/* Developer / Project */}
                      <div className="min-w-0">
                        <p className="text-sm text-[#374151] truncate flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-[#9ca3af] flex-shrink-0" />{dev}
                        </p>
                        {project && <p className="text-xs text-[#9ca3af] truncate">{project}</p>}
                      </div>

                      {/* Type */}
                      <KindBadge kind={row.listing_kind} />

                      {/* Price */}
                      <span className="text-xs font-medium text-[#374151] truncate">{priceLabel(row)}</span>

                      {/* Status */}
                      <StatusBadge row={row} />

                      {/* Updated */}
                      <div className="min-w-0">
                        <p className="text-xs text-[#374151] truncate" title={formatDateTime(row.updated_at)}>{formatDate(row.updated_at)}</p>
                        <p className="text-[11px] text-[#9ca3af] truncate">{relativeTime(row.updated_at)}</p>
                      </div>

                      {/* Actions */}
                      <RowActions
                        row={row}
                        onEdit={() => setEditTarget(row)}
                        onActivity={() => setActivityTarget(row)}
                        onDelete={() => handleDelete(row)}
                        onRestore={() => void handleRestore(row)}
                      />
                    </div>
                  )
                })}

                {/* Mobile cards */}
                {rows.map((row) => {
                  const { dev, project } = developerLabel(row)
                  return (
                    <div key={`m-${row.id}`} className={`lg:hidden p-4 ${row.deleted_at ? "opacity-60" : ""}`}>
                      <div className="flex items-start gap-3">
                        <ListingThumb row={row} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[#0d1117] truncate">{row.title}</p>
                              <p className="text-xs text-[#9ca3af] truncate">{dev}{project ? ` · ${project}` : ""}</p>
                            </div>
                            <RowActions
                              row={row}
                              onEdit={() => setEditTarget(row)}
                              onActivity={() => setActivityTarget(row)}
                              onDelete={() => handleDelete(row)}
                              onRestore={() => void handleRestore(row)}
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <KindBadge kind={row.listing_kind} />
                            <StatusBadge row={row} />
                            <span className="text-xs text-[#6b7280]">{priceLabel(row)}</span>
                          </div>
                          <p className="text-[11px] text-[#9ca3af] mt-2">
                            {row.agent?.fullname ?? "Unknown"} · Updated {relativeTime(row.updated_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <p className="text-sm text-[#6b7280]">
              {total > 0 ? `Showing ${Math.min((page - 1) * perPage + 1, total)}–${Math.min(page * perPage, total)} of ${total}` : "No results"}
            </p>
            <select
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value) as 10 | 20 | 50); setPage(1) }}
              className="px-3 py-1.5 rounded-xl border border-[#e5e5e5] bg-white text-xs text-[#374151] focus:outline-none focus:border-[#001f3f] transition-all">
              {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n} / page</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-[#e5e5e5] text-[#6b7280] hover:border-[#001f3f] hover:text-[#001f3f] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pg = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page + i - 2
              if (pg < 1 || pg > totalPages) return null
              return (
                <button key={pg} type="button" onClick={() => setPage(pg)}
                  className={`w-9 h-9 flex items-center justify-center rounded-full text-sm font-semibold border transition-all ${
                    pg === page ? "bg-[#001f3f] text-white border-[#001f3f]" : "border-[#e5e5e5] text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f]"
                  }`}>{pg}</button>
              )
            })}
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-[#e5e5e5] text-[#6b7280] hover:border-[#001f3f] hover:text-[#001f3f] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ListingEditDialog
        listing={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={(msg) => { setEditTarget(null); addToast("success", msg); void load() }}
        onError={(msg) => addToast("error", msg)}
      />

      {activityTarget && (
        <ListingActivityDrawer listing={activityTarget} onClose={() => setActivityTarget(null)} />
      )}

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          confirmLabel={confirm.label}
          onConfirm={confirm.action}
          onCancel={() => setConfirm(null)}
        />
      )}

      <Portal>
        <Toast toasts={toasts} remove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
      </Portal>
    </div>
  )
}
