"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  Users, Search, Plus, ChevronLeft, ChevronRight,
  Filter, RefreshCw, Trash2, EyeOff, Eye, MoreHorizontal, X,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard/shell"
import { roleToLabel } from "@/lib/auth"
import { UserAvatar } from "@/components/user-avatar"
import { RoleBadge } from "@/components/role-badge"
import { StatusBadge } from "@/components/status-badge"
import { UserDrawer } from "./user-drawer"
import { UserForm } from "./user-form"
import type { UserRecord, UsersListResponse } from "@/lib/user-service"
import { ROLE_OPTIONS, STATUS_OPTIONS, getUserDisplayName } from "@/lib/user-service"

const ACCENT = "#0ea5e9"

const PER_PAGE = 20

function buildQuery(params: {
  page: number
  search: string
  role: string
  status: string
  showDeleted: boolean
}) {
  const qs = new URLSearchParams()
  qs.set("page",    String(params.page))
  qs.set("perPage", String(PER_PAGE))
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

function OverlayPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null
  return createPortal(children, document.body)
}

export function AdminUsersClient(props: AdminUsersClientProps) {
  const { currentRole, roleLabel, roleColor } = props
  const [users,       setUsers]       = useState<UserRecord[]>([])
  const [total,       setTotal]       = useState(0)
  const [page,        setPage]        = useState(1)
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState("")
  const [roleFilter,  setRoleFilter]  = useState("")
  const [statusFilter,setStatusFilter]= useState("")
  const [showDeleted, setShowDeleted] = useState(false)
  const [selectedUser,setSelectedUser]= useState<UserRecord | null>(null)
  const [drawerOpen,  setDrawerOpen]  = useState(false)
  const [formOpen,    setFormOpen]    = useState(false)
  const [editUser,    setEditUser]    = useState<UserRecord | null>(null)
  const [banner,      setBanner]      = useState<{ type: "success" | "error"; msg: string } | null>(null)

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const totalPages = Math.ceil(total / PER_PAGE)

  // â”€â”€ fetch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const fetchUsers = useCallback(async (opts?: { page?: number; search?: string; role?: string; status?: string; deleted?: boolean }) => {
    setLoading(true)
    const url = buildQuery({
      page:        opts?.page        ?? page,
      search:      opts?.search      ?? search,
      role:        opts?.role        ?? roleFilter,
      status:      opts?.status      ?? statusFilter,
      showDeleted: opts?.deleted     ?? showDeleted,
    })
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
  }, [page, search, roleFilter, statusFilter, showDeleted])

  useEffect(() => { void fetchUsers() }, [fetchUsers])

  // â”€â”€ debounced search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSearch = (val: string) => {
    setSearch(val)
    setPage(1)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      void fetchUsers({ page: 1, search: val })
    }, 400)
  }

  const applyFilter = (key: "role" | "status" | "deleted", value: string | boolean) => {
    setPage(1)
    if (key === "role")    { setRoleFilter(value as string);   void fetchUsers({ page: 1, role:    value as string }) }
    if (key === "status")  { setStatusFilter(value as string); void fetchUsers({ page: 1, status:  value as string }) }
    if (key === "deleted") { setShowDeleted(value as boolean); void fetchUsers({ page: 1, deleted: value as boolean }) }
  }

  const goPage = (p: number) => {
    setPage(p)
    void fetchUsers({ page: p })
  }

  // â”€â”€ actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleUserSaved = () => {
    setBanner({ type: "success", msg: "User saved successfully." })
    setFormOpen(false)
    setEditUser(null)
    void fetchUsers()
  }

  const handleUserUpdated = (updated: UserRecord) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    if (selectedUser?.id === updated.id) setSelectedUser(updated)
  }

  const handleDelete = async (userId: string) => {
    if (!confirm("Soft-delete this user? They will be deactivated and hidden.")) return
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" })
    if (res.ok) {
      setBanner({ type: "success", msg: "User deleted." })
      void fetchUsers()
      if (drawerOpen && selectedUser?.id === userId) setDrawerOpen(false)
    } else {
      setBanner({ type: "error", msg: "Failed to delete user." })
    }
  }

  const handleToggleStatus = async (user: UserRecord) => {
    const next = user.status === "active" ? "inactive" : "active"
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    })
    if (res.ok) {
      handleUserUpdated({ ...user, status: next })
      setBanner({ type: "success", msg: `User ${next === "active" ? "activated" : "deactivated"}.` })
    } else {
      setBanner({ type: "error", msg: "Failed to update status." })
    }
  }

  const openEdit = (user: UserRecord) => {
    setEditUser(user)
    setDrawerOpen(false)
    setFormOpen(true)
  }

  const openDrawer = (user: UserRecord) => {
    setSelectedUser(user)
    setDrawerOpen(true)
  }

  // â”€â”€ render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <DashboardShell
      role={currentRole}
      roleLabel={roleLabel ?? roleToLabel(currentRole)}
      roleColor={roleColor ?? ACCENT}
      userName="Admin"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="font-['Outfit'] text-xl font-bold text-[#0d1117]">User Management</h2>
          <p className="text-sm text-[#9ca3af] mt-0.5">
            {total} user{total !== 1 ? "s" : ""} Â· manage roles, status and access
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setEditUser(null); setFormOpen(true) }}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-4 py-2.5 rounded-full text-sm font-semibold shadow-md hover:translate-y-[-1px] hover:shadow-lg transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Banner */}
      {banner && (
        <div className={`mb-4 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium ${banner?.type === "success" ? "bg-green-50 border-green-100 text-green-700" : "bg-rose-50 border-rose-100 text-rose-700"}`}>
          <span className="flex-1">{banner?.msg ?? ""}</span>
          <button onClick={() => setBanner(null)} className="text-current opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Search + filters */}
      <div className="bg-white/60 backdrop-blur-xl rounded-[24px] border border-white/60 shadow-sm shadow-black/5 p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
            <input
              type="text"
              placeholder="Search by name, emailâ€¦"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 placeholder:text-[#9ca3af]"
            />
          </div>

          {/* Role filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#9ca3af] shrink-0" />
            <select
              value={roleFilter}
              onChange={(e) => applyFilter("role", e.target.value)}
              className="pl-3 pr-8 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer"
            >
              <option value="">All Roles</option>
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => applyFilter("status", e.target.value)}
            className="pl-3 pr-8 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          {/* Show deleted toggle */}
          <button
            type="button"
            onClick={() => applyFilter("deleted", !showDeleted)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium border transition-all ${showDeleted ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-white/80 border-[#e5e5e5] text-[#6b7280] hover:border-[#d0d5dd]"}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Deleted
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => fetchUsers()}
            className="p-2.5 rounded-2xl border border-[#e5e5e5] bg-white/80 text-[#6b7280] hover:text-[#001f3f] hover:border-[#001f3f]/20 transition-all"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* User table */}
      <div className="bg-white/60 backdrop-blur-xl rounded-[24px] border border-white/60 shadow-sm shadow-black/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#f0f2f5] bg-white/40">
                {["User", "Email", "Role", "Status", "Joined", "Actions"].map((h) => (
                  <th key={h} className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-5 py-3.5 whitespace-nowrap first:pl-6 last:pr-6">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f8f9fa]">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-4 first:pl-6 last:pr-6">
                        <div className={`h-3 rounded-full bg-[#f0f2f5] animate-pulse ${j === 0 ? "w-32" : j === 4 ? "w-20" : "w-24"}`} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
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
                    onOpen={openDrawer}
                    onEdit={openEdit}
                    onToggleStatus={handleToggleStatus}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#f0f2f5] bg-white/40">
            <p className="text-xs text-[#9ca3af]">
              Showing {(page - 1) * PER_PAGE + 1}â€“{Math.min(page * PER_PAGE, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => goPage(page - 1)}
                disabled={page === 1}
                className="p-1.5 rounded-xl border border-[#e5e5e5] text-[#6b7280] hover:text-[#001f3f] hover:border-[#001f3f]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
                return (
                  <button
                    key={p}
                    onClick={() => goPage(p)}
                    className={`w-7 h-7 rounded-xl text-xs font-semibold transition-all ${page === p ? "bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white shadow-sm" : "border border-[#e5e5e5] text-[#6b7280] hover:border-[#001f3f]/20 hover:text-[#001f3f]"}`}
                  >
                    {p}
                  </button>
                )
              })}
              <button
                onClick={() => goPage(page + 1)}
                disabled={page === totalPages}
                className="p-1.5 rounded-xl border border-[#e5e5e5] text-[#6b7280] hover:text-[#001f3f] hover:border-[#001f3f]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User drawer */}
      {drawerOpen && selectedUser && (
        <UserDrawer
          user={selectedUser}
          onClose={() => setDrawerOpen(false)}
          onEdit={openEdit}
          onDelete={handleDelete}
          onToggleStatus={handleToggleStatus}
          onUpdated={handleUserUpdated}
          onBanner={(type: "success" | "error", msg: string) => setBanner({ type, msg })}
        />
      )}

      {/* Create / Edit form */}
      {formOpen && (
        <UserForm
          editUser={editUser}
          onClose={() => { setFormOpen(false); setEditUser(null) }}
          onSaved={handleUserSaved}
          onBanner={(type: "success" | "error", msg: string) => setBanner({ type, msg })}
        />
      )}
    </DashboardShell>
  )
}

// â”€â”€â”€ Row component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function UserRow({
  user,
  onOpen,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  user: UserRecord
  onOpen: (u: UserRecord) => void
  onEdit: (u: UserRecord) => void
  onToggleStatus: (u: UserRecord) => void
  onDelete: (id: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const displayName = getUserDisplayName(user)
  const isDeleted   = user.is_deleted === true

  useEffect(() => {
    if (!menuOpen || !triggerRef.current) return

    const computePosition = () => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      const menuWidth = 176
      const estimatedMenuHeight = 220
      const viewportPadding = 8

      const placeBelow = rect.bottom + 8 + estimatedMenuHeight <= window.innerHeight - viewportPadding
      const top = placeBelow
        ? rect.bottom + 6
        : Math.max(viewportPadding, rect.top - estimatedMenuHeight - 6)

      const left = Math.min(
        Math.max(viewportPadding, rect.right - menuWidth),
        window.innerWidth - menuWidth - viewportPadding,
      )

      setMenuPos({ top, left })
    }

    computePosition()
    window.addEventListener("resize", computePosition)
    window.addEventListener("scroll", computePosition, true)
    return () => {
      window.removeEventListener("resize", computePosition)
      window.removeEventListener("scroll", computePosition, true)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      const insideTrigger = Boolean(triggerRef.current?.contains(target))
      const insideMenu = Boolean(menuRef.current?.contains(target))
      if (!insideTrigger && !insideMenu) setMenuOpen(false)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false)
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [menuOpen])

  return (
    <tr
      className={`hover:bg-[#fafbfc] transition-colors ${isDeleted ? "opacity-50" : ""}`}
    >
      {/* User */}
      <td className="px-5 py-3.5 pl-6 whitespace-nowrap">
        <button
          type="button"
          className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
          onClick={() => onOpen(user)}
        >
          <UserAvatar name={displayName} imageUrl={user.profile_url} size={34} />
          <div>
            <p className="text-sm font-semibold text-[#0d1117] leading-tight">{displayName}</p>
            {isDeleted && <span className="text-[10px] text-rose-500 font-medium">Deleted</span>}
          </div>
        </button>
      </td>

      {/* Email */}
      <td className="px-5 py-3.5 text-[#6b7280] whitespace-nowrap">
        {user.email ?? <span className="text-[#d0d5dd]">â€”</span>}
      </td>

      {/* Role */}
      <td className="px-5 py-3.5 whitespace-nowrap">
        <RoleBadge role={user.role} />
      </td>

      {/* Status */}
      <td className="px-5 py-3.5 whitespace-nowrap">
        <StatusBadge status={user.status} isDeleted={user.is_deleted} />
      </td>

      {/* Joined */}
      <td className="px-5 py-3.5 text-[#9ca3af] whitespace-nowrap text-xs">
        {user.joined_at ? new Date(user.joined_at).toLocaleDateString() : "â€”"}
      </td>

      {/* Actions */}
      <td className="px-5 py-3.5 pr-6 whitespace-nowrap">
        <div ref={triggerRef} className="inline-block">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded-xl text-[#9ca3af] hover:text-[#001f3f] hover:bg-[#f4f6f9] transition-all"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {menuOpen && (
            <OverlayPortal>
              <div className="fixed inset-0 z-[130]" onClick={() => setMenuOpen(false)} />
              <div
                ref={menuRef}
                className="fixed z-[140] w-44 bg-white rounded-2xl border border-[#e8eaed] shadow-xl shadow-black/10 py-1.5 overflow-hidden"
                style={{ top: menuPos.top, left: menuPos.left }}
              >
                {[
                  { label: "View Details", action: () => { onOpen(user); setMenuOpen(false) } },
                  { label: "Edit Profile",  action: () => { onEdit(user); setMenuOpen(false) } },
                  {
                    label: user.status === "active" ? "Deactivate" : "Activate",
                    action: () => { onToggleStatus(user); setMenuOpen(false) },
                    cls: user.status === "active" ? "text-amber-600" : "text-green-600",
                  },
                  ...(!isDeleted ? [{
                    label: "Delete User",
                    action: () => { onDelete(user.id); setMenuOpen(false) },
                    cls: "text-rose-600",
                  }] : []),
                ].map(({ label, action, cls }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={action}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-[#f8f9fa] transition-colors ${cls ?? "text-[#374151]"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </OverlayPortal>
          )}
        </div>
      </td>
    </tr>
  )
}
