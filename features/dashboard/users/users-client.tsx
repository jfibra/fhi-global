"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Users, ChevronLeft, ChevronRight, ChevronDown,
  Trash2, Eye, X, Phone,
} from "lucide-react"
import { UserAvatar } from "@/components/user-avatar"
import { HeaderToolbar, ToolbarIconButton, TOOLBAR_GRADIENT } from "@/components/common/header-toolbar"
import { UserProfileModal } from "./user-profile-modal"
import type { UserRecord, UsersListResponse } from "@/lib/user-service"
import { ROLE_OPTIONS, STATUS_OPTIONS, ROLE_COLORS, STATUS_COLORS, getUserDisplayName } from "@/lib/user-service"

type ReferrerOption = { id: string; fullname: string; role: string }

// Phone / WhatsApp live in profile metadata (country code + number).
function contactFrom(metadata: Record<string, unknown> | null, kind: "phone" | "whatsapp"): string | null {
  const m = metadata ?? {}
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "")
  const combined = [s(m[`${kind}_country_code`]), s(m[`${kind}_number`])].filter(Boolean).join(" ")
  return combined || (kind === "phone" ? s(m.phone) || null : null)
}

function roleChipCls(role: string | null): string {
  const c = ROLE_COLORS[(role ?? "member").toLowerCase().trim()] ?? ROLE_COLORS.member
  return `${c.bg} ${c.text} ${c.border}`
}

function statusChipCls(status: string | null): string {
  const c = STATUS_COLORS[(status ?? "pending").toLowerCase().trim()] ?? STATUS_COLORS.pending
  return `${c.bg} ${c.text} ${c.border}`
}

// Date only (no time) for the Joined column.
function formatJoined(value: string | null): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

// Inline chip-style dropdown for editing role/status directly in the table.
// A native <select> sizes to its widest option, so an invisible sizer (the
// selected label) is stacked behind it to make each chip fit its own value.
function ChipSelect({
  value, options, onChange, colorClass, disabled,
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (v: string) => void
  colorClass: string
  disabled?: boolean
}) {
  const current = options.find((o) => o.value === value)
  const chip = "rounded-full text-[11px] font-bold capitalize pl-2.5 pr-6 py-1 border whitespace-nowrap"
  return (
    <div className="relative inline-block">
      {/* In-flow sizer — its width (the selected label) sets the chip width. */}
      <span aria-hidden className={`block invisible ${chip}`}>{current?.label ?? value}</span>
      {/* Absolute select overlays the sizer, so it doesn't impose its widest-option width. */}
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`absolute inset-0 w-full appearance-none cursor-pointer focus:outline-none transition-colors disabled:opacity-50 ${chip} ${colorClass}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-white text-[#111827]">{o.label}</option>
        ))}
      </select>
      <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 opacity-70 pointer-events-none" />
    </div>
  )
}

// lucide has no WhatsApp brand mark — inline the official glyph.
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15c-1.53 0-3.03-.41-4.34-1.19l-.31-.18-3.12.82.83-3.04-.2-.32a8.19 8.19 0 0 1-1.26-4.36c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.27-8.24 8.27zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.98-.14.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z"/>
    </svg>
  )
}

const ACCENT = "#0ea5e9"

const DEFAULT_PER_PAGE = 10
const PER_PAGE_OPTIONS = [10, 20, 50]

// Fixed-width pager: always renders PAGE_SLOTS page cubes (first, last, "…"
// gaps, numbers). With the prev/next buttons that's PAGE_SLOTS + 2 = 10 cubes.
// Middle → [1, "…", 6, 7, 8, 9, "…", 100]; near an end → six consecutive pages.
const PAGE_SLOTS = 8
function paginationItems(current: number, total: number): (number | "…")[] {
  // Not enough pages to need gaps — show them all.
  if (total <= PAGE_SLOTS) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const leftGap = current > 4
  const rightGap = current < total - 3
  const pages: (number | "…")[] = []

  if (!leftGap) {
    // Near start: 1..(SLOTS-2), …, total
    for (let i = 1; i <= PAGE_SLOTS - 2; i++) pages.push(i)
    pages.push("…", total)
  } else if (!rightGap) {
    // Near end: 1, …, last (SLOTS-2) pages
    pages.push(1, "…")
    for (let i = total - (PAGE_SLOTS - 3); i <= total; i++) pages.push(i)
  } else {
    // Middle: 1, …, [interior window], …, total
    const interior = PAGE_SLOTS - 4 // 4 numbers between the two gaps
    let start = current - Math.floor((interior - 1) / 2)
    start = Math.max(2, Math.min(start, total - 1 - (interior - 1)))
    pages.push(1, "…")
    for (let i = 0; i < interior; i++) pages.push(start + i)
    pages.push("…", total)
  }

  // A "…" hiding exactly one page is pointless — show that page number instead
  // (keeps the same slot count).
  return pages.map((p, i) => {
    const prev = pages[i - 1]
    const next = pages[i + 1]
    if (p === "…" && typeof prev === "number" && typeof next === "number" && next - prev === 2) {
      return prev + 1
    }
    return p
  })
}

function buildQuery(params: {
  page: number
  perPage: number
  search: string
  role: string
  status: string
  showDeleted: boolean
}) {
  const qs = new URLSearchParams()
  qs.set("page",    String(params.page))
  qs.set("perPage", String(params.perPage))
  if (params.search)     qs.set("search",  params.search)
  if (params.role)       qs.set("role",    params.role)
  if (params.status)     qs.set("status",  params.status)
  if (params.showDeleted) qs.set("deleted", "true")
  return `/api/admin/users?${qs.toString()}`
}

type AdminUsersClientProps = {
  currentRole: string
  roleLabel?: string
  roleColor?: string
}


export function AdminUsersClient(props: AdminUsersClientProps) {
  const { currentRole, roleLabel, roleColor } = props
  const [users,       setUsers]       = useState<UserRecord[]>([])
  const [total,       setTotal]       = useState(0)
  const [page,        setPage]        = useState(1)
  const [perPage,     setPerPage]     = useState(DEFAULT_PER_PAGE)
  const [loading,     setLoading]     = useState(true)
  // `searchInput` is what's typed; `search` is the debounced term used in the
  // query. Keeping them separate lets the input stay responsive while only the
  // committed term drives a fetch.
  const [searchInput, setSearchInput] = useState("")
  const [search,      setSearch]      = useState("")
  const [roleFilter,  setRoleFilter]  = useState("")
  const [statusFilter,setStatusFilter]= useState("")
  const [showDeleted, setShowDeleted] = useState(false)
  // The eye opens a read-only profile modal (complete-profile look) with an Edit toggle.
  const [viewUser,    setViewUser]    = useState<UserRecord | null>(null)
  const [banner,      setBanner]      = useState<{ type: "success" | "error"; msg: string } | null>(null)
  const [referrers,   setReferrers]   = useState<ReferrerOption[]>([])

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const totalPages = Math.ceil(total / perPage)

  // ── fetch ──────────────────────────────────────────────────────────────────
  // Single source of truth: reads the current page/search/filters from state.
  // Handlers only update state; the effect below re-fetches when any of them
  // change — so a filter change fires exactly one request (no direct calls +
  // effect double-fetch).
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const url = buildQuery({ page, perPage, search, role: roleFilter, status: statusFilter, showDeleted })
    try {
      const res = await fetch(url)
      const data: UsersListResponse = await res.json()
      setUsers(data.users)
      setTotal(data.total)
    } catch {
      setBanner({ type: "error", msg: "Failed to load users." })
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, roleFilter, statusFilter, showDeleted])

  useEffect(() => { void fetchUsers() }, [fetchUsers])

  // Eligible "Referred by" options (sales pipeline + admin staff) for the
  // inline picker + resolving each user's referrer name.
  useEffect(() => {
    let alive = true
    void fetch("/api/admin/users/referrers")
      .then((res) => (res.ok ? res.json() : { referrers: [] }))
      .then((data: { referrers?: ReferrerOption[] }) => { if (alive) setReferrers(data.referrers ?? []) })
      .catch(() => { /* non-fatal */ })
    return () => { alive = false }
  }, [])

  const referrerName = useMemo(() => new Map(referrers.map((r) => [r.id, r.fullname])), [referrers])

  // Inline edit (role / status / referrer) — optimistic, reverts on failure.
  const applyPatch = useCallback(async (id: string, patch: Record<string, unknown>) => {
    setUsers((list) => list.map((u) => {
      if (u.id !== id) return u
      const next: UserRecord = { ...u }
      if (patch.role !== undefined) next.role = patch.role as string
      if (patch.status !== undefined) next.status = patch.status as string
      if (patch.invited_by !== undefined) {
        next.metadata = { ...(u.metadata ?? {}), invited_by: patch.invited_by }
      }
      return next
    }))
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(d.error ?? "Update failed.")
      }
    } catch (e) {
      setBanner({ type: "error", msg: e instanceof Error ? e.message : "Update failed." })
      await fetchUsers() // revert optimistic change to server truth
    }
  }, [fetchUsers])

  // Debounced search — commits the term to state (which drives the fetch effect)
  // after the user stops typing, and resets to page 1.
  const handleSearch = (val: string) => {
    setSearchInput(val)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setPage(1)
      setSearch(val)
    }, 400)
  }

  // Filters only update state; the fetch effect reacts to the change.
  const applyFilter = (key: "role" | "status" | "deleted", value: string | boolean) => {
    setPage(1)
    if (key === "role")    setRoleFilter(value as string)
    if (key === "status")  setStatusFilter(value as string)
    if (key === "deleted") setShowDeleted(value as boolean)
  }

  const goPage = (p: number) => setPage(p)

  // ── actions ────────────────────────────────────────────────────────────────
  const handleDelete = async (userId: string) => {
    if (!confirm("Soft-delete this user? They will be deactivated and hidden.")) return
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" })
    if (res.ok) {
      setBanner({ type: "success", msg: "User deleted." })
      void fetchUsers()
    } else {
      setBanner({ type: "error", msg: "Failed to delete user." })
    }
  }

  const handleHardDelete = async (userId: string) => {
    if (
      !confirm(
        "Permanently delete this user? This removes the account entirely and frees the email to register again. This cannot be undone.",
      )
    )
      return
    const res = await fetch(`/api/admin/users/${userId}?hard=1`, { method: "DELETE" })
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== userId))
      setBanner({ type: "success", msg: "User permanently deleted." })
    } else {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      setBanner({ type: "error", msg: j.error ?? "Failed to permanently delete user." })
    }
  }

  // Eye action: open the read-only profile modal, with an Edit toggle inside.
  const openView = (user: UserRecord) => {
    setViewUser(user)
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <HeaderToolbar
        title="User Management"
        subtitle={`${total} - Total User${total !== 1 ? "s" : ""}`}
        icon={<Users />}
        value={searchInput}
        onChange={handleSearch}
        placeholder="Search by name, email…"
        onRefresh={() => fetchUsers()}
        refreshing={loading}
        rightSlot={
          <>
            {/* Role filter — width fits the "Roles" default; longer values truncate */}
            <div className="relative inline-block">
              <span aria-hidden className="block invisible h-10 leading-10 pl-3 pr-10 text-sm font-medium whitespace-nowrap">Roles</span>
              <select
                value={roleFilter}
                onChange={(e) => applyFilter("role", e.target.value)}
                className={`absolute inset-0 w-full h-10 pl-3 pr-9 rounded-[10px] border border-transparent text-sm font-medium text-white appearance-none cursor-pointer focus:outline-none transition-all hover:brightness-110 truncate ${TOOLBAR_GRADIENT}`}
              >
                <option value="" className="bg-white text-[#111827]">Roles</option>
                {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value} className="bg-white text-[#111827]">{r.label}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-white/80 pointer-events-none" />
            </div>

            {/* Status filter — width fits the "Status" default; longer values truncate */}
            <div className="relative inline-block">
              <span aria-hidden className="block invisible h-10 leading-10 pl-3 pr-10 text-sm font-medium whitespace-nowrap">Status</span>
              <select
                value={statusFilter}
                onChange={(e) => applyFilter("status", e.target.value)}
                className={`absolute inset-0 w-full h-10 pl-3 pr-9 rounded-[10px] border border-transparent text-sm font-medium text-white appearance-none cursor-pointer focus:outline-none transition-all hover:brightness-110 truncate ${TOOLBAR_GRADIENT}`}
              >
                <option value="" className="bg-white text-[#111827]">Status</option>
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value} className="bg-white text-[#111827]">{s.label}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-white/80 pointer-events-none" />
            </div>

            {/* Show-deleted toggle */}
            <ToolbarIconButton
              onClick={() => applyFilter("deleted", !showDeleted)}
              ariaLabel={showDeleted ? "Hide deleted users" : "Show deleted users"}
              active={showDeleted}
            >
              <Trash2 className="h-[18px] w-[18px]" />
            </ToolbarIconButton>
          </>
        }
      />

      {/* Banner */}
      {banner && (
        <div className={`mb-4 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium ${banner?.type === "success" ? "bg-green-50 border-green-100 text-green-700" : "bg-rose-50 border-rose-100 text-rose-700"}`}>
          <span className="flex-1">{banner?.msg ?? ""}</span>
          <button onClick={() => setBanner(null)} className="text-current opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* User table */}
      <div className="bg-white rounded-[18px] border border-black/[0.08] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.08] bg-[#fafafb]">
                {["User", "Contact", "Role", "Status", "Joined", "Referred by", "Actions"].map((h) => (
                  <th key={h} className="text-left font-['Outfit'] text-[11px] font-bold text-black/45 uppercase tracking-wider px-3 py-3.5 whitespace-nowrap first:pl-6 last:pr-6">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05]">
              {/* Skeleton only on the first load (no data yet). On refetches
                  (filter / search / refresh) keep the current rows visible —
                  the refresh button still spins via `refreshing={loading}`. */}
              {loading && users.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-3 py-4 first:pl-6 last:pr-6">
                        <div className={`h-3 rounded-full bg-[#f0f2f5] animate-pulse ${j === 0 ? "w-32" : j === 6 ? "w-20" : "w-24"}`} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-[#9ca3af]">
                      <Users className="w-8 h-8 opacity-40" />
                      <p className="text-sm font-medium">No users found</p>
                      <p className="text-xs">Try adjusting your search or filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    referrers={referrers}
                    referrerName={referrerName}
                    onPatch={applyPatch}
                    onOpen={openView}
                    onDelete={handleDelete}
                    onHardDelete={handleHardDelete}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-t border-black/[0.08] bg-[#fafafb]">
            <div className="flex items-center gap-2">
              <span className="h-8 inline-flex items-center px-3 rounded-[10px] border border-black/[0.08] bg-white text-xs font-medium text-black/55 whitespace-nowrap tabular-nums">
                Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
              </span>
              {/* Rows per page */}
              <div className="relative">
                <select
                  value={perPage}
                  onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }}
                  className={`h-8 pl-2.5 pr-7 rounded-[10px] border border-transparent text-xs font-medium text-white appearance-none cursor-pointer focus:outline-none transition-all hover:brightness-110 ${TOOLBAR_GRADIENT}`}
                >
                  {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n} className="bg-white text-[#111827]">{n} / page</option>)}
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-white/80 pointer-events-none" />
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goPage(page - 1)}
                  disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-[10px] border border-black/[0.08] text-black/50 hover:text-[#001f3f] hover:border-[#001f3f]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {paginationItems(page, totalPages).map((p, i) =>
                  p === "…" ? (
                    <span
                      key={`gap-${i}`}
                      className="w-8 h-8 flex items-center justify-center rounded-[10px] border border-black/[0.08] text-xs font-semibold text-black/40 select-none"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => goPage(p)}
                      className={`w-8 h-8 rounded-[10px] text-xs font-semibold transition-all ${page === p ? `${TOOLBAR_GRADIENT} text-white` : "border border-black/[0.08] text-black/50 hover:border-[#001f3f]/30 hover:text-[#001f3f]"}`}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  onClick={() => goPage(page + 1)}
                  disabled={page === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-[10px] border border-black/[0.08] text-black/50 hover:text-[#001f3f] hover:border-[#001f3f]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* View / edit profile (complete-profile look) */}
      {viewUser && (
        <UserProfileModal
          user={viewUser}
          referrers={referrers}
          onClose={() => setViewUser(null)}
          onSaved={fetchUsers}
          onBanner={(type: "success" | "error", msg: string) => setBanner({ type, msg })}
        />
      )}
    </>
  )
}

// ─── Row component ─────────────────────────────────────────────────────────────
function UserRow({
  user,
  referrers,
  referrerName,
  onPatch,
  onOpen,
  onDelete,
  onHardDelete,
}: {
  user: UserRecord
  referrers: ReferrerOption[]
  referrerName: Map<string, string>
  onPatch: (id: string, patch: Record<string, unknown>) => void | Promise<void>
  onOpen: (u: UserRecord) => void
  onDelete: (id: string) => void
  onHardDelete: (id: string) => void
}) {
  const displayName = getUserDisplayName(user)
  const isDeleted   = user.is_deleted === true
  const invitedBy   = typeof user.metadata?.invited_by === "string" ? user.metadata.invited_by : ""

  return (
    <tr
      className={`hover:bg-[#fafbfc] transition-colors ${isDeleted ? "opacity-50" : ""}`}
    >
      {/* User */}
      <td className="px-3 py-3.5 pl-6 whitespace-nowrap">
        <button
          type="button"
          className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
          onClick={() => onOpen(user)}
        >
          <UserAvatar name={displayName} imageUrl={user.profile_url} size={34} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#0d1117] leading-tight">{displayName}</p>
            <p className="text-xs text-[#6b7280] leading-tight truncate">
              {user.email ?? <span className="text-[#d0d5dd]">—</span>}
            </p>
            {isDeleted && <span className="text-[10px] text-rose-500 font-medium">Deleted</span>}
          </div>
        </button>
      </td>

      {/* Contact — phone + WhatsApp */}
      <td className="px-3 py-3.5 whitespace-nowrap text-xs text-[#6b7280]">
        <div className="space-y-0.5">
          <p className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-[#9ca3af] shrink-0" />
            {contactFrom(user.metadata, "phone") ?? <span className="text-[#d0d5dd]">—</span>}
          </p>
          <p className="flex items-center gap-1.5">
            <WhatsAppIcon className="w-3.5 h-3.5 text-[#25d366] shrink-0" />
            {contactFrom(user.metadata, "whatsapp") ?? <span className="text-[#d0d5dd]">—</span>}
          </p>
        </div>
      </td>

      {/* Role — inline editable */}
      <td className="px-3 py-3.5 whitespace-nowrap">
        <ChipSelect
          value={(user.role ?? "member").toLowerCase()}
          disabled={isDeleted}
          onChange={(v) => onPatch(user.id, { role: v })}
          options={ROLE_OPTIONS}
          colorClass={roleChipCls(user.role)}
        />
      </td>

      {/* Status — inline editable */}
      <td className="px-3 py-3.5 whitespace-nowrap">
        <ChipSelect
          value={(user.status ?? "pending").toLowerCase()}
          disabled={isDeleted}
          onChange={(v) => onPatch(user.id, { status: v })}
          options={STATUS_OPTIONS}
          colorClass={statusChipCls(user.status)}
        />
      </td>

      {/* Joined — date only */}
      <td className="px-3 py-3.5 whitespace-nowrap text-xs text-black/55 tabular-nums">
        {formatJoined(user.joined_at)}
      </td>

      {/* Referred by — inline editable */}
      <td className="px-3 py-3.5 whitespace-nowrap">
        <div className="relative inline-flex">
          <select
            value={referrers.some((r) => r.id === invitedBy) ? invitedBy : ""}
            disabled={isDeleted}
            onChange={(e) => onPatch(user.id, { invited_by: e.target.value || null })}
            className="appearance-none cursor-pointer w-[160px] truncate rounded-lg border border-[#e5e7eb] bg-white text-xs text-[#374151] pl-2.5 pr-7 py-1.5 focus:outline-none focus:border-[#001f3f] transition-colors disabled:opacity-50"
          >
            <option value="">
              {invitedBy && !referrers.some((r) => r.id === invitedBy)
                ? (user.referred_by_name ?? referrerName.get(invitedBy) ?? "Unknown")
                : "— None —"}
            </option>
            {referrers.map((r) => (
              <option key={r.id} value={r.id}>{r.fullname}</option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none" />
        </div>
      </td>


      {/* Actions — view (opens the profile drawer) + delete */}
      <td className="px-3 py-3.5 pr-6 whitespace-nowrap">
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="View profile"
            aria-label="View profile"
            onClick={() => onOpen(user)}
            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            type="button"
            title={isDeleted ? "Delete permanently" : "Delete user"}
            aria-label={isDeleted ? "Delete permanently" : "Delete user"}
            onClick={() => (isDeleted ? onHardDelete(user.id) : onDelete(user.id))}
            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}
