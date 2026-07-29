"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  Users, ChevronDown, Eye, Phone, RotateCcw, Search, X,
  Calendar, Clock, User, Linkedin, Facebook, Mail,
  Building2, Briefcase, Loader2, BadgeCheck,
} from "lucide-react"
import { UserAvatar } from "@/components/user-avatar"
import { TOOLBAR_GRADIENT } from "@/components/common/header-toolbar"
import { TablePagination } from "@/components/common/data-table"
import { toast } from "sonner"
import { UserProfileModal } from "./user-profile-modal"
import { UserDetailView } from "./user-detail-view"
import type { UserRecord, UsersListResponse } from "@/lib/user-service"
import { ROLE_OPTIONS, STATUS_OPTIONS, ROLE_COLORS, STATUS_COLORS, TIMEZONES, getUserDisplayName } from "@/lib/user-service"
import { formatDateInZone, formatTimeInZone } from "@/lib/utils"

type ReferrerOption = { id: string; fullname: string; role: string }

// Phone / WhatsApp live in profile metadata (country code + number).
function contactFrom(metadata: Record<string, unknown> | null, kind: "phone" | "whatsapp"): string | null {
  const m = metadata ?? {}
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "")
  const combined = [s(m[`${kind}_country_code`]), s(m[`${kind}_number`])].filter(Boolean).join(" ")
  return combined || (kind === "phone" ? s(m.phone) || null : null)
}

// Read a string value out of profile metadata (empty string if missing).
function metaStr(metadata: Record<string, unknown> | null, key: string): string {
  const v = (metadata ?? {})[key]
  return typeof v === "string" ? v.trim() : ""
}

// Friendly timezone label (e.g. "Asia/Dubai" → "Dubai (UTC +04:00)"), matching
// the profile form; falls back to the raw value for unknown zones.
function timezoneLabel(value: string | null): string {
  if (!value) return ""
  return TIMEZONES.find((t) => t.value === value)?.label ?? value
}

function roleChipCls(role: string | null): string {
  const c = ROLE_COLORS[(role ?? "member").toLowerCase().trim()] ?? ROLE_COLORS.member
  return `${c.bg} ${c.text} ${c.border}`
}

function statusChipCls(status: string | null): string {
  const c = STATUS_COLORS[(status ?? "pending").toLowerCase().trim()] ?? STATUS_COLORS.pending
  return `${c.bg} ${c.text} ${c.border}`
}

// Title-case each word for display, normalizing ALL-CAPS DB values too
// (e.g. "MARK LAWRINCE SARGADO" → "Mark Lawrince Sargado", "o'brien" → "O'Brien").
function toTitleCase(value: string): string {
  return value.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase())
}

// Inline chip-style dropdown for editing role/status directly in the table.
// A native <select> sizes to its widest option, so an invisible sizer (the
// selected label) is stacked behind it to make each chip fit its own value.
function ChipSelect({
  value, options, onChange, colorClass, disabled, size = "md",
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (v: string) => void
  colorClass: string
  disabled?: boolean
  size?: "md" | "sm"
}) {
  const current = options.find((o) => o.value === value)
  // sm chips are used on the card and have no dropdown arrow (symmetric padding).
  const chip = size === "sm"
    ? "rounded-full text-[10px] font-bold capitalize px-2.5 py-0.5 border whitespace-nowrap"
    : "rounded-full text-[11px] font-bold capitalize pl-2.5 pr-6 py-1 border whitespace-nowrap"
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
      {size !== "sm" && (
        <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 opacity-70 pointer-events-none" />
      )}
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

function buildQuery(params: {
  page: number
  perPage: number
  search?: string
  fname?: string
  lname?: string
  email?: string
  role: string
  status: string
  showDeleted: boolean
  sort: string
  dir: "asc" | "desc"
}) {
  const qs = new URLSearchParams()
  qs.set("page",    String(params.page))
  qs.set("perPage", String(params.perPage))
  if (params.search)     qs.set("search",  params.search)
  if (params.fname)      qs.set("fname",   params.fname)
  if (params.lname)      qs.set("lname",   params.lname)
  if (params.email)      qs.set("email",   params.email)
  if (params.role)       qs.set("role",    params.role)
  if (params.status)     qs.set("status",  params.status)
  if (params.showDeleted) qs.set("deleted", "true")
  qs.set("sort", params.sort)
  qs.set("dir", params.dir)
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
  const [loading,     setLoading]     = useState(false)
  // Structured search inputs (first / last / email) + the committed query that
  // drives a fetch (null = nothing searched yet). A blank search is allowed —
  // it fetches ALL users (paginated).
  const [fnameInput,  setFnameInput]  = useState("")
  const [lnameInput,  setLnameInput]  = useState("")
  const [emailInput,  setEmailInput]  = useState("")
  const [query,       setQuery]       = useState<{ fname: string; lname: string; email: string } | null>(null)
  // Clicking a card drills into the Account 360 view; "Edit profile" in there
  // opens the existing profile modal on top.
  const [detailUser,  setDetailUser]  = useState<UserRecord | null>(null)
  const [viewUser,    setViewUser]    = useState<UserRecord | null>(null)
  const [referrers,   setReferrers]   = useState<ReferrerOption[]>([])
  // Bumped after a profile save so the 360 view refetches the same account.
  const [detailRefresh, setDetailRefresh] = useState(0)
  const drillReqRef = useRef(0)

  const totalPages = Math.ceil(total / perPage)

  // ── fetch ──────────────────────────────────────────────────────────────────
  // Fetches the committed first/last/email query, paginated. Empty query fields
  // send no filters → all users.
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const url = buildQuery({
      page, perPage,
      fname: query?.fname ?? "", lname: query?.lname ?? "", email: query?.email ?? "",
      role: "", status: "", showDeleted: false,
      sort: "joined_at", dir: "desc",
    })
    try {
      const res = await fetch(url)
      const data: UsersListResponse = await res.json()
      setUsers(data.users)
      setTotal(data.total)
    } catch {
      toast.error("Failed to load users.")
    } finally {
      setLoading(false)
    }
  }, [page, perPage, query])

  useEffect(() => {
    // Don't fetch until a search has been run (blank or not).
    if (!query) {
      setUsers([])
      setTotal(0)
      setLoading(false)
      return
    }
    void fetchUsers()
  }, [fetchUsers, query])

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
      toast.error(e instanceof Error ? e.message : "Update failed.")
      await fetchUsers() // revert optimistic change to server truth
    }
  }, [fetchUsers])

  const goPage = (p: number) => setPage(p)

  // Commit the first/last/email inputs → drives the fetch (page reset to 1).
  // A blank search is allowed and fetches all users.
  const runSearch = () => {
    setPage(1)
    setQuery({ fname: fnameInput.trim(), lname: lnameInput.trim(), email: emailInput.trim() })
  }

  const clearSearch = () => {
    setFnameInput(""); setLnameInput(""); setEmailInput("")
    setQuery(null); setUsers([]); setTotal(0); setPage(1)
  }

  // ── actions ────────────────────────────────────────────────────────────────
  // Restore a soft-deleted user — PATCH status:active un-deletes + reactivates
  // (see the [id] route). Optimistic: it leaves the deleted view immediately.
  const handleRestore = async (userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId))
    setTotal((t) => Math.max(0, t - 1))
    toast.success("User restored.")
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    })
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      toast.error(j.error ?? "Failed to restore user.")
      void fetchUsers()
    }
  }

  // Card click: open the Account 360 detail view.
  const openView = (user: UserRecord) => {
    setDetailUser(user)
  }

  // Drill from a teammate/recruit row into that person's own 360 view — the
  // row only carries an id, so pull the full record first. Sequence-guarded so
  // rapid clicks can't land on an earlier account's response.
  const openUserById = useCallback(async (id: string) => {
    const reqId = ++drillReqRef.current
    try {
      const res = await fetch(`/api/admin/users/${id}`, { cache: "no-store" })
      if (!res.ok) throw new Error()
      const record = (await res.json()) as UserRecord
      if (reqId !== drillReqRef.current) return
      setDetailUser(record)
    } catch {
      if (reqId === drillReqRef.current) toast.error("Couldn't open that account.")
    }
  }, [])

  // ── render ─────────────────────────────────────────────────────────────────
  if (detailUser) {
    return (
      <>
        <UserDetailView
          // Remount per account (and per save) so no state survives a
          // drill-through into another person's 360 view.
          key={`${detailUser.id}:${detailRefresh}`}
          user={detailUser}
          onBack={() => setDetailUser(null)}
          onEdit={() => setViewUser(detailUser)}
          onOpenUser={(id) => void openUserById(id)}
          refreshToken={detailRefresh}
        />
        {viewUser && (
          <UserProfileModal
            user={viewUser}
            referrers={referrers}
            onClose={() => setViewUser(null)}
            onSaved={() => {
              void fetchUsers()
              void openUserById(detailUser.id)
              setDetailRefresh((n) => n + 1)
            }}
            onBanner={(type: "success" | "error", msg: string) => (type === "success" ? toast.success(msg) : toast.error(msg))}
          />
        )}
      </>
    )
  }

  return (
    <>
      {/* Structured search bar */}
      <form
        onSubmit={(e) => { e.preventDefault(); runSearch() }}
        className="mb-4 flex items-center gap-3 rounded-2xl border border-black/[0.08] bg-white p-2.5 shadow-sm"
      >
          {/* First name */}
          <div className="relative flex-1 min-w-0">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
            <input
              value={fnameInput}
              onChange={(e) => setFnameInput(e.target.value)}
              placeholder="First Name"
              autoFocus
              className="h-11 w-full pl-9 pr-3 rounded-xl border border-[#eceff3] bg-[#f8fafc] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:bg-white focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/6 transition-all"
            />
          </div>
          {/* Last name */}
          <div className="relative flex-1 min-w-0">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
            <input
              value={lnameInput}
              onChange={(e) => setLnameInput(e.target.value)}
              placeholder="Last Name"
              className="h-11 w-full pl-9 pr-3 rounded-xl border border-[#eceff3] bg-[#f8fafc] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:bg-white focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/6 transition-all"
            />
          </div>
          {/* Email */}
          <div className="relative flex-[1.6] min-w-0">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
            <input
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Email Address"
              className="h-11 w-full pl-9 pr-3 rounded-xl border border-[#eceff3] bg-[#f8fafc] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:bg-white focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/6 transition-all"
            />
          </div>
          {/* Clear */}
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Clear search"
            className="shrink-0 h-11 w-11 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          {/* Search */}
          <button
            type="submit"
            disabled={loading}
            className={`shrink-0 h-11 px-6 flex items-center justify-center gap-2 rounded-xl text-white text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-80 disabled:cursor-wait ${TOOLBAR_GRADIENT}`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? "Searching…" : "Search User"}
          </button>
        </form>

      {/* Results as cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-52 rounded-2xl border border-black/[0.08] bg-white animate-pulse" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl border border-black/[0.08] bg-white px-6 py-16 text-center">
          <div className="flex flex-col items-center gap-2 text-[#9ca3af]">
            <Search className="w-8 h-8 opacity-40" />
            {query ? (
              <>
                <p className="text-sm font-medium">No users found</p>
                <p className="text-xs">No one matches that first name, last name, or email.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">Search for users</p>
                <p className="text-xs">Enter a name or email (or leave blank for all) and press Search.</p>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4">
            {users.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                referrerName={referrerName}
                onPatch={applyPatch}
                onOpen={openView}
                onRestore={handleRestore}
              />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="mt-4 rounded-2xl border border-black/[0.08] bg-white overflow-hidden">
              <TablePagination
                page={page}
                perPage={perPage}
                total={total}
                totalPages={totalPages}
                onPageChange={goPage}
                onPerPageChange={(n) => { setPerPage(n); setPage(1) }}
                perPageOptions={PER_PAGE_OPTIONS}
              />
            </div>
          )}
        </>
      )}

      {/* View / edit profile (complete-profile look) */}
      {viewUser && (
        <UserProfileModal
          user={viewUser}
          referrers={referrers}
          onClose={() => setViewUser(null)}
          onSaved={fetchUsers}
          onBanner={(type: "success" | "error", msg: string) => (type === "success" ? toast.success(msg) : toast.error(msg))}
        />
      )}
    </>
  )
}

// ─── Card component (search results) ───────────────────────────────────────────
function CardField({ label, icon, iconClass = "bg-blue-50 text-blue-600", children, className = "" }: {
  label: string
  icon: ReactNode
  iconClass?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-start gap-2.5 ${className}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 [&_svg]:w-4 [&_svg]:h-4 ${iconClass}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-black/40 mb-0.5">{label}</p>
        <div className="text-[13px] text-[#374151]">{children}</div>
      </div>
    </div>
  )
}

const cardDash = <span className="text-[#c0c6cf]">—</span>

function UserCard({
  user,
  referrerName,
  onPatch,
  onOpen,
  onRestore,
}: {
  user: UserRecord
  referrerName: Map<string, string>
  onPatch: (id: string, patch: Record<string, unknown>) => void | Promise<void>
  onOpen: (u: UserRecord) => void
  onRestore: (id: string) => void
}) {
  const displayName = toTitleCase(getUserDisplayName(user))
  const isDeleted   = user.is_deleted === true
  const invitedBy   = typeof user.metadata?.invited_by === "string" ? user.metadata.invited_by : ""
  const phone       = contactFrom(user.metadata, "phone")
  const whatsapp    = contactFrom(user.metadata, "whatsapp")
  const status      = (user.status ?? "pending").toLowerCase()
  const dotColor    = isDeleted ? "bg-rose-500" : status === "active" ? "bg-emerald-500" : status === "pending" ? "bg-amber-500" : "bg-gray-400"
  const linkedin    = metaStr(user.metadata, "linkedin")
  const facebook    = metaStr(user.metadata, "facebook")

  const iconBlue  = "bg-blue-50 text-blue-600"
  const iconGreen = "bg-green-50 text-[#25d366]"

  // The card itself opens the Account 360 view; the inline chips, links and
  // Restore action stop propagation so they still work in place.
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(user)}
      // Only when the card itself has focus — otherwise this would swallow
      // Enter/Space from the role/status selects and buttons inside it.
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(user) }
      }}
      aria-label={`Open ${displayName}'s account details`}
      className="cursor-pointer rounded-2xl border border-black/[0.08] bg-white shadow-sm hover:shadow-md hover:border-[#001f3f]/25 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#001f3f]/15 transition-all p-4 sm:p-5"
    >
      {/* Header — avatar + name + email + role (+ actions) */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <UserAvatar name={displayName} imageUrl={user.profile_url} size={52} />
            <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full ring-2 ring-white ${dotColor}`} title={isDeleted ? "Deleted" : status} />
          </div>
          <div className="min-w-0">
            {/* Name + role on one line, email below */}
            <div className="flex items-center gap-2 min-w-0">
              <button type="button" onClick={() => onOpen(user)} className="min-w-0 text-left group/name">
                <h3 className="text-[15px] font-bold text-[#0d1117] leading-tight truncate group-hover/name:text-[#001f3f] transition-colors">{displayName}</h3>
              </button>
              <span className="shrink-0" onClick={stop}>
                <ChipSelect size="sm" value={(user.role ?? "member").toLowerCase()} onChange={(v) => onPatch(user.id, { role: v })} options={ROLE_OPTIONS} colorClass={roleChipCls(user.role)} />
              </span>
              {isDeleted && <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 font-bold uppercase tracking-wide">Deleted</span>}
            </div>
            <p className="text-xs text-[#6b7280] truncate mt-0.5">{user.email || "—"}</p>
          </div>
        </div>

        {/* Actions — top right */}
        <div className="flex items-center gap-3 shrink-0">
          {isDeleted && (
            <button
              type="button"
              onClick={(e) => { stop(e); onRestore(user.id) }}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:underline"
            >
              <RotateCcw className="w-4 h-4" />
              Restore
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpen(user)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#001f3f] hover:underline"
          >
            <Eye className="w-4 h-4" />
            View details
          </button>
        </div>
      </div>

      {/* Details — three explicit columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 border-t border-[#f0f2f5] mt-4 pt-4">
        {/* Column 1 — contact */}
        <div className="space-y-4">
          <CardField label="Phone" icon={<Phone />} iconClass={iconBlue}>
            {phone || cardDash}
          </CardField>
          <CardField label="WhatsApp" icon={<WhatsAppIcon />} iconClass={iconGreen}>
            {whatsapp || cardDash}
          </CardField>
          <CardField label="Facebook" icon={<Facebook />} iconClass={iconBlue}>
            {facebook ? (
              <a href={facebook} target="_blank" rel="noopener noreferrer" onClick={stop} title={facebook} className="block truncate text-blue-600 hover:underline">{facebook}</a>
            ) : cardDash}
          </CardField>
          <CardField label="LinkedIn" icon={<Linkedin />} iconClass={iconBlue}>
            {linkedin ? (
              <a href={linkedin} target="_blank" rel="noopener noreferrer" onClick={stop} title={linkedin} className="block truncate text-blue-600 hover:underline">{linkedin}</a>
            ) : cardDash}
          </CardField>
        </div>

        {/* Column 2 — team */}
        <div className="space-y-4">
          <CardField label="Team" icon={<Building2 />} iconClass={iconBlue}>
            {cardDash}
          </CardField>
          <CardField label="Team Position" icon={<Briefcase />} iconClass={iconBlue}>
            {cardDash}
          </CardField>
          <CardField label="Timezone" icon={<Clock />} iconClass={iconBlue}>
            <span className="truncate block">{user.timezone ? timezoneLabel(user.timezone) : cardDash}</span>
          </CardField>
        </div>

        {/* Column 3 — network */}
        <div className="space-y-4">
          <CardField label="Referred by" icon={<Users />} iconClass={iconBlue}>
            <span className="capitalize">
              {invitedBy
                ? toTitleCase(user.referred_by_name ?? referrerName.get(invitedBy) ?? "Unknown")
                : cardDash}
            </span>
          </CardField>
          <CardField label="Joined" icon={<Calendar />} iconClass={iconBlue}>
            <span className="tabular-nums">{user.joined_at ? `${formatDateInZone(user.joined_at, "Asia/Dubai")} · ${formatTimeInZone(user.joined_at, "Asia/Dubai")} GST` : cardDash}</span>
          </CardField>
          <CardField label="Status" icon={<BadgeCheck />} iconClass={iconBlue}>
            <span className="inline-block" onClick={stop}>
              <ChipSelect size="sm" value={status} onChange={(v) => onPatch(user.id, { status: v })} options={STATUS_OPTIONS} colorClass={statusChipCls(user.status)} />
            </span>
          </CardField>
        </div>
      </div>
    </div>
  )
}
