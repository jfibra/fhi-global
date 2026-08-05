"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import {
  Users, ChevronDown, Eye, Phone, RotateCcw, Search, X,
  Calendar, Clock, User, Linkedin, Facebook, Mail,
  Building2, Briefcase, Loader2, BadgeCheck, Pencil,
  LayoutGrid, Table as TableIcon,
} from "lucide-react"
import { UserAvatar } from "@/components/user-avatar"
import { DeveloperCombobox } from "@/components/developers/developer-combobox"
import { DeveloperLogo } from "@/components/developers/developer-logo"
import { TOOLBAR_GRADIENT } from "@/components/common/header-toolbar"
import { DataTable, TablePagination } from "@/components/common/data-table"
import { toast } from "sonner"
import { UserProfileModal } from "./user-profile-modal"
import { UserDetailView } from "./user-detail-view"
import type { UserRecord, UsersListResponse } from "@/lib/user-service"
import { ROLE_OPTIONS, STATUS_OPTIONS, ROLE_COLORS, STATUS_COLORS, TIMEZONES, getUserDisplayName } from "@/lib/user-service"
import { isDeveloperRole, roleToLabel } from "@/lib/app-roles"
import type { DeveloperOption } from "@/lib/sales-service"
import { formatDateAtTimeInZone, formatDateInZone, formatTimeInZone } from "@/lib/utils"

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

/** Column sort for the directory (keys whitelisted by /api/admin/users). */
type SortState = { key: string; dir: "asc" | "desc" }
const DEFAULT_SORT: SortState = { key: "joined_at", dir: "desc" }

/** One page of the directory. Returns null on a network/parse failure. */
async function loadUsersPage(
  page: number,
  perPage: number,
  query: { fname: string; lname: string; email: string },
  sort: SortState,
): Promise<UsersListResponse | null> {
  try {
    const res = await fetch(buildQuery({
      page, perPage,
      fname: query.fname, lname: query.lname, email: query.email,
      role: "", status: "", showDeleted: false,
      sort: sort.key, dir: sort.dir,
    }))
    return (await res.json()) as UsersListResponse
  } catch {
    return null
  }
}

type AdminUsersClientProps = {
  currentRole: string
  roleLabel?: string
  roleColor?: string
}

// ─── View mode (cards ⇄ table), remembered per browser ────────────────────────
// Backed by localStorage through useSyncExternalStore: reading storage during
// render would make the server ("cards") and client disagree and break
// hydration, so the server snapshot is always "cards" and React swaps in the
// stored preference once mounted.
type ViewMode = "cards" | "table"
const VIEW_KEY = "fhi.accountDirectory.view"

const viewListeners = new Set<() => void>()
let viewCache: ViewMode | null = null

function subscribeView(onChange: () => void) {
  viewListeners.add(onChange)
  return () => { viewListeners.delete(onChange) }
}

function getViewSnapshot(): ViewMode {
  if (viewCache === null) {
    try {
      viewCache = window.localStorage.getItem(VIEW_KEY) === "table" ? "table" : "cards"
    } catch {
      viewCache = "cards"
    }
  }
  return viewCache
}

function getViewServerSnapshot(): ViewMode {
  return "cards"
}

function storeView(next: ViewMode) {
  viewCache = next
  try { window.localStorage.setItem(VIEW_KEY, next) } catch { /* private mode */ }
  for (const cb of viewListeners) cb()
}

/** Debounce for the as-you-type search (ms). */
const SEARCH_DEBOUNCE = 350


// The developer company a user is linked to (developer role → metadata.developer_id).
function developerIdOf(user: UserRecord): string {
  const v = user.metadata?.developer_id
  return typeof v === "string" ? v : ""
}

// Generic confirmation modal — used before persisting a role change so an admin
// can't flip someone's access with a stray click.
function ConfirmDialog({
  title, message, confirmLabel, busy, onConfirm, onCancel,
}: {
  title: string
  message: ReactNode
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} aria-hidden />
      <div className="relative bg-white rounded-[24px] p-6 max-w-md w-full shadow-2xl border border-white/60">
        <h3 className="font-['Outfit'] text-lg font-bold text-[#0d1117] mb-1.5">{title}</h3>
        <div className="text-sm text-[#4b5563] leading-relaxed mb-6">{message}</div>
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onCancel} disabled={busy}
            className="px-5 py-2.5 rounded-full border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] transition-all disabled:opacity-50">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy}
            className="px-5 py-2.5 rounded-full bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#002b57] transition-all disabled:opacity-50">{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

// Assign / change the developer company a developer account belongs to. The
// searchable combobox (logo + name) is the picker; the Assign button confirms.
function AssignDeveloperDialog({
  user, developers, onAssign, onClose,
}: {
  user: UserRecord
  developers: DeveloperOption[]
  onAssign: (developerId: string) => void
  onClose: () => void
}) {
  const currentId = developerIdOf(user)
  const [selected, setSelected] = useState(currentId)
  const changed = selected !== currentId
  const name = toTitleCase(getUserDisplayName(user))
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative bg-white rounded-[24px] p-6 max-w-md w-full shadow-2xl border border-white/60">
        <h3 className="font-['Outfit'] text-lg font-bold text-[#0d1117] mb-1">Assign developer company</h3>
        <p className="text-sm text-[#6b7280] mb-4">Choose the developer <strong className="text-[#374151]">{name}</strong> belongs to.</p>
        <DeveloperCombobox developers={developers} value={selected} onChange={setSelected} placeholder="Search developer…" />
        <div className="flex gap-3 justify-end mt-6">
          <button type="button" onClick={onClose}
            className="px-5 py-2.5 rounded-full border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] transition-all">Cancel</button>
          <button type="button" disabled={!changed} onClick={() => onAssign(selected)}
            className="px-5 py-2.5 rounded-full bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#002b57] transition-all disabled:opacity-50">Assign</button>
        </div>
      </div>
    </div>
  )
}

export function AdminUsersClient(props: AdminUsersClientProps) {
  const { currentRole, roleLabel, roleColor } = props
  const [users,       setUsers]       = useState<UserRecord[]>([])
  const [total,       setTotal]       = useState(0)
  const [page,        setPage]        = useState(1)
  const [perPage,     setPerPage]     = useState(DEFAULT_PER_PAGE)
  /** Request signature whose results are currently in `users`. */
  const [loadedKey,   setLoadedKey]   = useState("")
  // Structured search inputs (first / last / email) + the committed query that
  // drives a fetch. A blank query is allowed — it fetches ALL users (paginated).
  const [fnameInput,  setFnameInput]  = useState("")
  const [lnameInput,  setLnameInput]  = useState("")
  const [emailInput,  setEmailInput]  = useState("")
  // Starts as a blank query so the directory lists everyone on arrival, then
  // narrows as you type (debounced) — no need to press Search.
  const [query,       setQuery]       = useState<{ fname: string; lname: string; email: string }>({ fname: "", lname: "", email: "" })
  // Column sort (table header clicks) — server-side, so it spans all pages.
  const [sort,        setSort]        = useState<SortState>(DEFAULT_SORT)
  const view = useSyncExternalStore(subscribeView, getViewSnapshot, getViewServerSnapshot)
  // Clicking a card drills into the Account 360 view; "Edit profile" in there
  // opens the existing profile modal on top.
  const [detailUser,  setDetailUser]  = useState<UserRecord | null>(null)
  const [viewUser,    setViewUser]    = useState<UserRecord | null>(null)
  const [referrers,   setReferrers]   = useState<ReferrerOption[]>([])
  // Developer companies (for the developer badge + assign picker).
  const [developers,  setDevelopers]  = useState<DeveloperOption[]>([])
  // Pending role change awaiting confirmation, and the account whose developer
  // is being (re)assigned.
  const [confirmState, setConfirmState] = useState<{ title: string; message: ReactNode; confirmLabel: string; onConfirm: () => void } | null>(null)
  const [assignUser,  setAssignUser]  = useState<UserRecord | null>(null)
  // Bumped after a profile save so the 360 view refetches the same account.
  const [detailRefresh, setDetailRefresh] = useState(0)
  const drillReqRef = useRef(0)

  const totalPages = Math.ceil(total / perPage)

  // ── fetch ──────────────────────────────────────────────────────────────────
  // Fetches the committed first/last/email query, paginated. Empty query fields
  // send no filters → all users. `loading` is derived from whether the results
  // in state match the current request, so the effect never sets state
  // synchronously (which would cascade renders).
  const requestKey = `${page}|${perPage}|${query.fname}|${query.lname}|${query.email}|${sort.key}|${sort.dir}`
  const loading = loadedKey !== requestKey

  useEffect(() => {
    if (loadedKey === requestKey) return
    let alive = true
    void (async () => {
      const data = await loadUsersPage(page, perPage, query, sort)
      if (!alive) return
      if (data) {
        setUsers(data.users)
        setTotal(data.total)
      } else {
        toast.error("Failed to load users.")
      }
      setLoadedKey(requestKey)
    })()
    return () => { alive = false }
  }, [loadedKey, requestKey, page, perPage, query, sort])

  /** Silent re-read of the current page (after an edit, save or failed patch). */
  const refresh = useCallback(async () => {
    const data = await loadUsersPage(page, perPage, query, sort)
    if (!data) return
    setUsers(data.users)
    setTotal(data.total)
  }, [page, perPage, query, sort])

  // Header click: toggle direction on the active column, otherwise sort the new
  // column ascending. Server-side sort → back to page 1.
  const handleSort = useCallback((key: string) => {
    setSort((prev) => (prev.key === key
      ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { key, dir: "asc" }))
    setPage(1)
  }, [])

  // As-you-type search: commit the inputs after a short pause. setQuery only
  // fires from the timer, so this never cascades a synchronous render.
  useEffect(() => {
    const fname = fnameInput.trim()
    const lname = lnameInput.trim()
    const email = emailInput.trim()
    const t = setTimeout(() => {
      setQuery((prev) => {
        if (prev && prev.fname === fname && prev.lname === lname && prev.email === email) return prev
        setPage(1)
        return { fname, lname, email }
      })
    }, SEARCH_DEBOUNCE)
    return () => clearTimeout(t)
  }, [fnameInput, lnameInput, emailInput])

  const changeView = (next: ViewMode) => storeView(next)

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

  // Developer companies for the developer badge + assign picker.
  useEffect(() => {
    let alive = true
    void fetch("/api/admin/developers")
      .then((res) => (res.ok ? res.json() : { developers: [] }))
      .then((data: { developers?: DeveloperOption[] }) => { if (alive) setDevelopers(data.developers ?? []) })
      .catch(() => { /* non-fatal */ })
    return () => { alive = false }
  }, [])

  const developerById = useMemo(() => new Map(developers.map((d) => [d.id, d])), [developers])

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
      if (patch.developer_id !== undefined) {
        next.metadata = { ...(next.metadata ?? u.metadata ?? {}), developer_id: patch.developer_id }
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
      await refresh() // revert optimistic change to server truth
    }
  }, [refresh])

  const goPage = (p: number) => setPage(p)

  // Commit the first/last/email inputs → drives the fetch (page reset to 1).
  // A blank search is allowed and fetches all users.
  const runSearch = () => {
    setPage(1)
    setQuery({ fname: fnameInput.trim(), lname: lnameInput.trim(), email: emailInput.trim() })
  }

  const clearSearch = () => {
    setFnameInput(""); setLnameInput(""); setEmailInput("")
    setQuery({ fname: "", lname: "", email: "" }); setPage(1)
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
      void refresh()
    }
  }

  // Card click: open the Account 360 detail view.
  const openView = (user: UserRecord) => {
    setDetailUser(user)
  }

  // Role changes gate access, so confirm before applying (the chip stays on its
  // old value until confirmed, since it's controlled by user.role).
  const requestRoleChange = useCallback((user: UserRecord, newRole: string) => {
    if (newRole.toLowerCase() === (user.role ?? "member").toLowerCase()) return
    const name = toTitleCase(getUserDisplayName(user))
    setConfirmState({
      title: "Change role?",
      message: (
        <>
          Change <strong className="text-[#111827]">{name}</strong>&apos;s role from{" "}
          <strong className="text-[#111827]">{roleToLabel(user.role)}</strong> to{" "}
          <strong className="text-[#111827]">{roleToLabel(newRole)}</strong>?
          {isDeveloperRole(newRole) && " You can assign their developer company afterwards."}
        </>
      ),
      confirmLabel: "Change role",
      onConfirm: () => { void applyPatch(user.id, { role: newRole }); setConfirmState(null) },
    })
  }, [applyPatch])

  // Confirmed from the AssignDeveloperDialog (its Assign button is the confirm).
  const handleAssignDeveloper = useCallback((developerId: string) => {
    setAssignUser((current) => {
      if (current) void applyPatch(current.id, { developer_id: developerId })
      return null
    })
  }, [applyPatch])

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
              void refresh()
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

      {/* Result count + view switch */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-[#6b7280]">
          {loading ? "Searching…" : `${total} account${total === 1 ? "" : "s"}`}
        </p>
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#f3f4f6]" role="group" aria-label="View mode">
          {([
            { id: "cards" as const, label: "Cards", icon: <LayoutGrid className="w-3.5 h-3.5" /> },
            { id: "table" as const, label: "Table", icon: <TableIcon className="w-3.5 h-3.5" /> },
          ]).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => changeView(v.id)}
              aria-pressed={view === v.id}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                view === v.id ? "bg-white text-[#001f3f] shadow-sm" : "text-[#6b7280] hover:text-[#111827]"
              }`}
            >
              {v.icon}{v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`rounded-2xl border border-black/[0.08] bg-white animate-pulse ${view === "table" ? "h-14" : "h-52"}`} />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl border border-black/[0.08] bg-white px-6 py-16 text-center">
          <div className="flex flex-col items-center gap-2 text-[#9ca3af]">
            <Search className="w-8 h-8 opacity-40" />
            <p className="text-sm font-medium">No users found</p>
            <p className="text-xs">No one matches that first name, last name, or email.</p>
          </div>
        </div>
      ) : view === "table" ? (
        <UsersTable
          users={users}
          referrerName={referrerName}
          developerById={developerById}
          onPatch={applyPatch}
          onRequestRoleChange={requestRoleChange}
          onAssignDeveloper={setAssignUser}
          onOpen={openView}
          onRestore={handleRestore}
          sort={sort}
          onSort={handleSort}
          page={page}
          perPage={perPage}
          total={total}
          totalPages={totalPages}
          onPageChange={goPage}
          onPerPageChange={(n) => { setPerPage(n); setPage(1) }}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4">
            {users.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                referrerName={referrerName}
                developerById={developerById}
                onPatch={applyPatch}
                onRequestRoleChange={requestRoleChange}
                onAssignDeveloper={setAssignUser}
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
          onSaved={() => void refresh()}
          onBanner={(type: "success" | "error", msg: string) => (type === "success" ? toast.success(msg) : toast.error(msg))}
        />
      )}

      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}

      {assignUser && (
        <AssignDeveloperDialog
          user={assignUser}
          developers={developers}
          onAssign={handleAssignDeveloper}
          onClose={() => setAssignUser(null)}
        />
      )}
    </>
  )
}

// ─── Table view ───────────────────────────────────────────────────────────────
// Same data as the cards, one row per account. Clicking a row opens the same
// Account 360 view; the inline role/status chips keep working in place.
function UsersTable({
  users,
  referrerName,
  developerById,
  onPatch,
  onRequestRoleChange,
  onAssignDeveloper,
  onOpen,
  onRestore,
  sort,
  onSort,
  page,
  perPage,
  total,
  totalPages,
  onPageChange,
  onPerPageChange,
}: {
  users: UserRecord[]
  referrerName: Map<string, string>
  developerById: Map<string, DeveloperOption>
  onPatch: (id: string, patch: Record<string, unknown>) => void | Promise<void>
  onRequestRoleChange: (u: UserRecord, newRole: string) => void
  onAssignDeveloper: (u: UserRecord) => void
  onOpen: (u: UserRecord) => void
  onRestore: (id: string) => void
  sort: SortState
  onSort: (key: string) => void
  page: number
  perPage: number
  total: number
  totalPages: number
  onPageChange: (p: number) => void
  onPerPageChange: (n: number) => void
}) {
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <DataTable
      // sortKeys are whitelisted in /api/admin/users (SORT_COLUMNS)
      columns={[
        { label: "Account",     sortKey: "fullname" },
        { label: "Role",        sortKey: "role" },
        { label: "Phone",       sortKey: "contact" },
        { label: "Referred by", sortKey: "referred_by" },
        { label: "Joined",      sortKey: "joined_at" },
        { label: "Status",      sortKey: "status" },
        { label: "", className: "w-10" },
      ]}
      sort={sort}
      onSort={onSort}
      page={page}
      perPage={perPage}
      total={total}
      totalPages={totalPages}
      onPageChange={onPageChange}
      onPerPageChange={onPerPageChange}
      perPageOptions={PER_PAGE_OPTIONS}
    >
      {users.map((user) => {
        const displayName = toTitleCase(getUserDisplayName(user))
        const isDeleted = user.is_deleted === true
        const invitedBy = typeof user.metadata?.invited_by === "string" ? user.metadata.invited_by : ""
        const phone = contactFrom(user.metadata, "phone")
        const status = (user.status ?? "pending").toLowerCase()
        const dev = isDeveloperRole(user.role) ? developerById.get(developerIdOf(user)) ?? null : null

        return (
          <tr
            key={user.id}
            onClick={() => onOpen(user)}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(user) }
            }}
            tabIndex={0}
            aria-label={`Open ${displayName}'s account details`}
            className="border-b border-black/[0.05] last:border-0 hover:bg-[#f9fafb] focus:outline-none focus-visible:bg-[#f3f4f6] cursor-pointer transition-colors"
          >
            <td className="px-3 py-3 first:pl-6">
              <div className="flex items-center gap-3 min-w-0">
                <UserAvatar name={displayName} imageUrl={user.profile_url} size={34} />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#0d1117] truncate flex items-center gap-1.5">
                    {displayName}
                    {isDeleted && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 font-bold uppercase tracking-wide">Deleted</span>
                    )}
                  </p>
                  <p className="text-[11px] text-[#9ca3af] truncate">{user.email || "—"}</p>
                </div>
              </div>
            </td>
            <td className="px-3 py-3" onClick={stop}>
              <div className="flex flex-col items-start gap-1">
                <ChipSelect size="sm" value={(user.role ?? "member").toLowerCase()} onChange={(v) => onRequestRoleChange(user, v)} options={ROLE_OPTIONS} colorClass={roleChipCls(user.role)} />
                {isDeveloperRole(user.role) && (
                  <button type="button" onClick={() => onAssignDeveloper(user)} title={dev ? `Developer: ${dev.name} — click to reassign` : "Assign developer company"}
                    className="inline-flex items-center gap-1 max-w-[160px] text-[10px] font-semibold text-[#6b7280] hover:text-[#001f3f] transition-colors">
                    <DeveloperLogo url={dev?.logo_url ?? null} name={dev?.name ?? "?"} size={16} />
                    <span className="truncate">{dev?.name ?? "Assign developer"}</span>
                    <Pencil className="w-2.5 h-2.5 opacity-60 shrink-0" />
                  </button>
                )}
              </div>
            </td>
            <td className="px-3 py-3 text-[13px] text-[#374151] whitespace-nowrap">{phone || cardDash}</td>
            <td className="px-3 py-3 text-[13px] text-[#374151] capitalize truncate max-w-[160px]">
              {invitedBy ? toTitleCase(user.referred_by_name ?? referrerName.get(invitedBy) ?? "Unknown") : cardDash}
            </td>
            <td className="px-3 py-3 text-[12px] text-[#6b7280] whitespace-nowrap tabular-nums">
              {user.joined_at ? formatDateAtTimeInZone(user.joined_at, "Asia/Dubai") : cardDash}
            </td>
            <td className="px-3 py-3" onClick={stop}>
              <ChipSelect size="sm" value={status} onChange={(v) => onPatch(user.id, { status: v })} options={STATUS_OPTIONS} colorClass={statusChipCls(user.status)} />
            </td>
            <td className="px-3 py-3 last:pr-6 text-right whitespace-nowrap">
              {isDeleted ? (
                <button
                  type="button"
                  onClick={(e) => { stop(e); onRestore(user.id) }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restore
                </button>
              ) : (
                <Eye className="w-4 h-4 text-[#c0c6cf] inline" aria-hidden />
              )}
            </td>
          </tr>
        )
      })}
    </DataTable>
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
  developerById,
  onPatch,
  onRequestRoleChange,
  onAssignDeveloper,
  onOpen,
  onRestore,
}: {
  user: UserRecord
  referrerName: Map<string, string>
  developerById: Map<string, DeveloperOption>
  onPatch: (id: string, patch: Record<string, unknown>) => void | Promise<void>
  onRequestRoleChange: (u: UserRecord, newRole: string) => void
  onAssignDeveloper: (u: UserRecord) => void
  onOpen: (u: UserRecord) => void
  onRestore: (id: string) => void
}) {
  const displayName = toTitleCase(getUserDisplayName(user))
  const isDeleted   = user.is_deleted === true
  const developer   = isDeveloperRole(user.role) ? developerById.get(developerIdOf(user)) ?? null : null
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
      className="group cursor-pointer overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_2px_10px_rgba(0,20,40,0.06)] hover:shadow-[0_14px_40px_-14px_rgba(0,20,40,0.25)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#001f3f]/15 transition-shadow flex flex-col md:flex-row"
    >
      {/* ── Identity panel: navy, big avatar, name, role, email ───────────
          The curved right edge is the design's signature; on mobile the
          panel stacks and the curve moves to the bottom. */}
      <div className="relative shrink-0 bg-[#0a2647] md:w-[300px] px-6 py-8 md:rounded-r-[64px] flex flex-col items-center justify-center text-center overflow-hidden">
        {/* Faint concentric rings, echoing the mockup's depth */}
        <span aria-hidden="true" className="pointer-events-none absolute -left-16 -top-16 w-64 h-64 rounded-full border border-white/[0.06]" />
        <span aria-hidden="true" className="pointer-events-none absolute -right-24 -bottom-10 w-72 h-72 rounded-full border border-white/[0.05]" />

        <div className="relative">
          {/* White ring + status dot, sized big — the point of the redesign. */}
          <div className="rounded-full ring-[3px] ring-white/90 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
            <UserAvatar name={displayName} imageUrl={user.profile_url} size={116} />
          </div>
          <span
            className={`absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full ring-[3px] ring-[#0a2647] ${dotColor}`}
            title={isDeleted ? "Deleted" : status}
          />
        </div>

        <button type="button" onClick={() => onOpen(user)} className="mt-5 max-w-full">
          <h3 className="font-['Outfit'] text-[19px] font-bold text-white leading-snug break-words">
            {displayName}
          </h3>
        </button>

        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2" onClick={stop}>
          <ChipSelect
            size="sm"
            value={(user.role ?? "member").toLowerCase()}
            onChange={(v) => onRequestRoleChange(user, v)}
            options={ROLE_OPTIONS}
            colorClass={roleChipCls(user.role)}
          />
          {isDeleted && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-200 font-bold uppercase tracking-wide">
              Deleted
            </span>
          )}
          {isDeveloperRole(user.role) && (
            <button
              type="button"
              onClick={() => onAssignDeveloper(user)}
              title={developer ? `Developer: ${developer.name} — click to reassign` : "Assign developer company"}
              className="inline-flex items-center gap-1.5 max-w-[220px] px-2 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-[11px] font-semibold text-white/90 transition-colors"
            >
              <DeveloperLogo url={developer?.logo_url ?? null} name={developer?.name ?? "?"} size={18} />
              <span className="truncate">{developer?.name ?? "Assign developer"}</span>
              <Pencil className="w-2.5 h-2.5 opacity-70 shrink-0" />
            </button>
          )}
        </div>

        {user.email && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[13px] text-white/70 max-w-full">
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{user.email}</span>
          </p>
        )}
      </div>

      {/* ── Details panel ─────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 p-5 sm:p-6">
        <div className="flex items-center justify-end gap-3 mb-4">
          {isDeleted && (
            <button
              type="button"
              onClick={(e) => { stop(e); onRestore(user.id) }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Restore
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpen(user)}
            className="inline-flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-4 py-2.5 text-sm font-bold text-[#0d1117] shadow-sm hover:border-[#001f3f]/30 hover:text-[#001f3f] transition-colors"
          >
            <Eye className="w-4 h-4" />
            View details
          </button>
        </div>

        {/* Two columns of fields, hairline-separated like the design. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <div className="divide-y divide-[#f0f2f5]">
            <CardField label="Phone" icon={<Phone />} iconClass={iconBlue} className="py-3.5 first:pt-0">
              {phone || cardDash}
            </CardField>
            <CardField label="WhatsApp" icon={<WhatsAppIcon />} iconClass={iconGreen} className="py-3.5">
              {whatsapp || cardDash}
            </CardField>
            <CardField label="Facebook" icon={<Facebook />} iconClass={iconBlue} className="py-3.5">
              {facebook ? (
                <a href={facebook} target="_blank" rel="noopener noreferrer" onClick={stop} title={facebook} className="block truncate text-blue-600 hover:underline">{facebook}</a>
              ) : cardDash}
            </CardField>
            <CardField label="LinkedIn" icon={<Linkedin />} iconClass={iconBlue} className="py-3.5">
              {linkedin ? (
                <a href={linkedin} target="_blank" rel="noopener noreferrer" onClick={stop} title={linkedin} className="block truncate text-blue-600 hover:underline">{linkedin}</a>
              ) : cardDash}
            </CardField>
            <CardField label="Team" icon={<Building2 />} iconClass={iconBlue} className="py-3.5 sm:last:pb-0">
              {cardDash}
            </CardField>
          </div>

          <div className="divide-y divide-[#f0f2f5]">
            <CardField label="Referred by" icon={<Users />} iconClass={iconBlue} className="py-3.5 sm:first:pt-0">
              <span className="capitalize">
                {invitedBy
                  ? toTitleCase(user.referred_by_name ?? referrerName.get(invitedBy) ?? "Unknown")
                  : cardDash}
              </span>
            </CardField>
            <CardField label="Joined" icon={<Calendar />} iconClass={iconBlue} className="py-3.5">
              <span className="tabular-nums">{user.joined_at ? `${formatDateInZone(user.joined_at, "Asia/Dubai")} · ${formatTimeInZone(user.joined_at, "Asia/Dubai")} GST` : cardDash}</span>
            </CardField>
            <CardField label="Status" icon={<BadgeCheck />} iconClass={iconBlue} className="py-3.5">
              <span className="inline-block" onClick={stop}>
                <ChipSelect size="sm" value={status} onChange={(v) => onPatch(user.id, { status: v })} options={STATUS_OPTIONS} colorClass={statusChipCls(user.status)} />
              </span>
            </CardField>
            <CardField label="Timezone" icon={<Clock />} iconClass={iconBlue} className="py-3.5">
              <span className="truncate block">{user.timezone ? timezoneLabel(user.timezone) : cardDash}</span>
            </CardField>
            <CardField label="Team Position" icon={<Briefcase />} iconClass={iconBlue} className="py-3.5 sm:last:pb-0">
              {cardDash}
            </CardField>
          </div>
        </div>
      </div>
    </div>
  )
}
