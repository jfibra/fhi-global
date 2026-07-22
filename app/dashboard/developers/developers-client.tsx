"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import {
  Search, Plus, RefreshCw, MoreHorizontal, Pencil, ImageIcon,
  CheckCircle2, XCircle, Archive, ArchiveRestore, Eye, ExternalLink,
  Building2, ChevronLeft, ChevronRight, Star, Globe,
  Phone, Mail, Filter, SortAsc, Trash2,
} from "lucide-react"
import {
  type Developer,
  type DevelopersListResponse,
  fetchDevelopers,
  softDeleteDeveloper,
  restoreDeveloper,
  toggleDeveloperActive,
  toggleDeveloperVerified,
} from "@/lib/developer-service"
import { isAdminStaffRole } from "@/lib/app-roles"
import { DeveloperFormDialog } from "./developer-form-dialog"
import { DeveloperLogoUpload } from "./developer-logo-upload"

// ─── Toast ─────────────────────────────────────────────────────────────────────
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
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none">
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

// ─── Confirm dialog ─────────────────────────────────────────────────────────
interface ConfirmProps { message: string; onConfirm: () => void; onCancel: () => void }
function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Portal>
      <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} aria-hidden />
        <div className="relative bg-white rounded-[24px] p-6 max-w-sm w-full shadow-2xl border border-white/60">
          <p className="text-sm text-[#374151] leading-relaxed mb-6">{message}</p>
          <div className="flex gap-3 justify-end">
            <button onClick={onCancel} className="px-5 py-2.5 rounded-full border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] transition-all">Cancel</button>
            <button onClick={onConfirm} className="px-5 py-2.5 rounded-full bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 transition-all">Confirm</button>
          </div>
        </div>
      </div>
    </Portal>
  )
}

// ─── Row actions dropdown ───────────────────────────────────────────────────
interface RowActionsProps {
  dev: Developer
  onEdit: () => void
  onLogo: () => void
  onToggleVerified: () => void
  onToggleActive: () => void
  onDelete: () => void
  onRestore: () => void
}

function RowActions({ dev, onEdit, onLogo, onToggleVerified, onToggleActive, onDelete, onRestore }: RowActionsProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open || !triggerRef.current) return

    const computePosition = () => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      const menuWidth = 180
      const estimatedMenuHeight = 260
      const viewportPadding = 8

      const placeBelow = rect.bottom + 8 + estimatedMenuHeight <= window.innerHeight - viewportPadding
      const top = placeBelow
        ? rect.bottom + 6
        : Math.max(viewportPadding, rect.top - estimatedMenuHeight - 6)

      const left = Math.min(
        Math.max(viewportPadding, rect.right - menuWidth),
        window.innerWidth - menuWidth - viewportPadding,
      )

      setMenuPosition({ top, left })
    }

    computePosition()
    window.addEventListener("resize", computePosition)
    window.addEventListener("scroll", computePosition, true)
    return () => {
      window.removeEventListener("resize", computePosition)
      window.removeEventListener("scroll", computePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      const target = e.target as Node
      const insideTrigger = Boolean(triggerRef.current?.contains(target))
      const insideMenu = Boolean(menuRef.current?.contains(target))
      if (!insideTrigger && !insideMenu) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  return (
    <div ref={triggerRef} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f3f4f6] transition-colors text-[#6b7280]">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <Portal>
          <div className="fixed inset-0 z-[130]" onClick={() => setOpen(false)} />
          <div className="fixed z-[140]" style={{ top: menuPosition.top, left: menuPosition.left }}>
            <div ref={menuRef} className="bg-white rounded-2xl border border-[#f0f0f0] shadow-2xl py-1.5 min-w-[180px] mt-1">
              {[
                ...(dev.deleted_at ? [] : [{
                  label: "View public page",
                  icon: <Eye className="w-3.5 h-3.5" />,
                  action: () => { window.open(`/developers/${dev.slug}`, "_blank", "noopener,noreferrer") },
                }]),
                { label: "Edit", icon: <Pencil className="w-3.5 h-3.5" />, action: onEdit },
                { label: "Upload Logo", icon: <ImageIcon className="w-3.5 h-3.5" />, action: onLogo },
                { label: dev.is_verified ? "Unverify" : "Verify", icon: dev.is_verified ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />, action: onToggleVerified },
                { label: dev.is_active ? "Deactivate" : "Activate", icon: dev.is_active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />, action: onToggleActive },
              ].map((item) => (
                <button key={item.label} type="button"
                  onClick={() => { setOpen(false); item.action() }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#374151] hover:bg-[#f8fafc] transition-colors">
                  <span className="text-[#6b7280]">{item.icon}</span>{item.label}
                </button>
              ))}
              <div className="border-t border-[#f0f0f0] my-1" />
              {dev.deleted_at ? (
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

// ─── Stars ──────────────────────────────────────────────────────────────────
function StarRating({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[#d1d5db] text-xs">—</span>
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map((i) => (
        <Star key={i} className={`w-3 h-3 ${i <= Math.round(value) ? "text-[#d6b357] fill-[#d6b357]" : "text-[#e5e5e5]"}`} />
      ))}
      <span className="text-xs text-[#6b7280] ml-1">{value.toFixed(1)}</span>
    </div>
  )
}

// ─── Skeleton ───────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-16 rounded-2xl bg-white/70 animate-pulse border border-[#f0f0f0]" />
      ))}
    </div>
  )
}

// ─── Logo / Initials ────────────────────────────────────────────────────────
function DeveloperLogo({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return (
      <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-[#e5e5e5] bg-white flex-shrink-0">
        <Image src={url} alt={name} fill className="object-contain p-1" />
      </div>
    )
  }
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
  return (
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#001f3f] to-[#d6b357] flex items-center justify-center flex-shrink-0">
      <span className="text-white text-xs font-bold">{initials}</span>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
interface Props {
  currentRole: string
  userId: string
}

const PER_PAGE_OPTIONS = [10, 20, 50] as const

type SortField = "name" | "created_at" | "rating"
type SortDir   = "asc" | "desc"

export function DevelopersClient({ currentRole }: Props) {
  const [devs, setDevs]         = useState<Developer[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [perPage, setPerPage]   = useState<10 | 20 | 50>(10)
  const [search, setSearch]     = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [filterVerified, setFilterVerified] = useState<boolean | null>(null)
  const [filterStatus, setFilterStatus]     = useState<"all" | "active" | "inactive">("all")
  const [showDeleted, setShowDeleted]       = useState(false)
  const [sortField, setSortField] = useState<SortField>("created_at")
  const [sortDir, setSortDir]    = useState<SortDir>("desc")
  const [loading, setLoading]    = useState(false)

  const [showForm, setShowForm]         = useState(false)
  const [editDev, setEditDev]           = useState<Developer | null>(null)
  const [showLogo, setShowLogo]         = useState(false)
  const [logoTarget, setLogoTarget]     = useState<Developer | null>(null)
  const [confirm, setConfirm]           = useState<{ message: string; action: () => void } | null>(null)
  const [toasts, setToasts]             = useState<ToastMsg[]>([])

  const toastIdRef = useRef(0)
  const addToast = (type: ToastType, text: string) => {
    const id = ++toastIdRef.current
    setToasts((prev) => [...prev, { id, type, text }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500)
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  // load with count
  const loadWithCount = useCallback(async () => {
    setLoading(true)
    try {
      const { data, total: t, error } = await fetchDevelopers({
        page, perPage, search,
        verified: filterVerified ?? undefined,
        status: filterStatus === "all" ? undefined : filterStatus === "active",
        showDeleted, sortField, sortDir,
      })
      if (error) { addToast("error", error); return }
      setDevs(data ?? [])
      setTotal(t ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, filterVerified, filterStatus, showDeleted, sortField, sortDir])

  useEffect(() => { void loadWithCount() }, [loadWithCount])

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  // ── actions ──
  const handleToggleVerified = async (dev: Developer) => {
    const { error } = await toggleDeveloperVerified(dev.id, dev.is_verified)
    if (error) { addToast("error", error); return }
    addToast("success", dev.is_verified ? "Removed verification." : "Developer verified.")
    void loadWithCount()
  }

  const handleToggleActive = async (dev: Developer) => {
    const { error } = await toggleDeveloperActive(dev.id, dev.is_active)
    if (error) { addToast("error", error); return }
    addToast("success", dev.is_active ? "Developer deactivated." : "Developer activated.")
    void loadWithCount()
  }

  const handleDelete = (dev: Developer) => {
    setConfirm({
      message: `Soft-delete "${dev.name}"? It will be hidden from listings but can be restored.`,
      action: async () => {
        setConfirm(null)
        const { error } = await softDeleteDeveloper(dev.id)
        if (error) { addToast("error", error); return }
        addToast("success", "Developer deleted.")
        void loadWithCount()
      },
    })
  }

  const handleRestore = async (dev: Developer) => {
    const { error } = await restoreDeveloper(dev.id)
    if (error) { addToast("error", error); return }
    addToast("success", "Developer restored.")
    void loadWithCount()
  }

  const sortToggle = (field: SortField) => {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("asc") }
    setPage(1)
  }

  const isAdmin = isAdminStaffRole(currentRole)

  return (
    <div className="space-y-6">
      <div className="max-w-12xl space-y-6">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#001f3f] to-[#d6b357] flex items-center justify-center shadow-lg">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0d1117]">Developers</h1>
              <p className="text-sm text-[#6b7280]">Manage real estate developer profiles</p>
            </div>
          </div>
          {isAdmin && (
            <button type="button" onClick={() => { setEditDev(null); setShowForm(true) }}
              className="bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-7 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-lg shadow-md flex items-center gap-2 self-start sm:self-auto">
              <Plus className="w-4 h-4" /> Add Developer
            </button>
          )}
        </div>

        {/* Filters bar */}
        <div className="bg-white/60 backdrop-blur-2xl rounded-[24px] border border-white/60 shadow-xl shadow-black/5 p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
              <input
                className="w-full pl-11 pr-4 py-3 rounded-2xl border border-[#e5e5e5] bg-white text-sm focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 transition-all"
                placeholder="Search by name, slug, email, website…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>

            {/* Verified filter */}
            <select
              value={filterVerified === null ? "all" : filterVerified ? "verified" : "unverified"}
              onChange={(e) => {
                setFilterVerified(e.target.value === "all" ? null : e.target.value === "verified")
                setPage(1)
              }}
              className="px-4 py-3 rounded-2xl border border-[#e5e5e5] bg-white text-sm text-[#374151] focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 transition-all">
              <option value="all">All Verified</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
            </select>

            {/* Status filter */}
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value as "all" | "active" | "inactive"); setPage(1) }}
              className="px-4 py-3 rounded-2xl border border-[#e5e5e5] bg-white text-sm text-[#374151] focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 transition-all">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            {/* Show deleted */}
            <label className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-[#e5e5e5] bg-white text-sm text-[#374151] cursor-pointer select-none">
              <input type="checkbox" checked={showDeleted} onChange={(e) => { setShowDeleted(e.target.checked); setPage(1) }}
                className="w-4 h-4 rounded border-[#e5e5e5] accent-[#001f3f]" />
              Show deleted
            </label>

            {/* Refresh */}
            <button type="button" onClick={() => void loadWithCount()}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-[#e5e5e5] bg-white text-sm text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] transition-all">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Sort pills */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs text-[#9ca3af] font-semibold uppercase tracking-wider">Sort:</span>
            {(["name", "created_at", "rating"] as SortField[]).map((f) => (
              <button key={f} type="button" onClick={() => sortToggle(f)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  sortField === f
                    ? "bg-[#001f3f] text-white border-[#001f3f]"
                    : "border-[#e5e5e5] text-[#6b7280] hover:border-[#001f3f] hover:text-[#001f3f]"
                }`}>
                {f === "created_at" ? "Date added" : f.charAt(0).toUpperCase() + f.slice(1)}
                {sortField === f && <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white/60 backdrop-blur-2xl rounded-[24px] border border-white/60 shadow-xl shadow-black/5 overflow-hidden">
          {/* Table header */}
          <div className="hidden lg:grid grid-cols-[44px_1fr_140px_1fr_100px_90px_88px_40px] gap-4 px-6 py-3 border-b border-[#f0f0f0]">
            {["", "Name", "Slug", "Contact", "Rating", "Verified", "Status", ""].map((h, i) => (
              <span key={i} className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af]">{h}</span>
            ))}
          </div>

          {loading ? (
            <div className="p-6"><Skeleton /></div>
          ) : devs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-[#f3f4f6] flex items-center justify-center mb-4">
                <Building2 className="w-8 h-8 text-[#d1d5db]" />
              </div>
              <p className="text-base font-semibold text-[#374151]">No developers found</p>
              <p className="text-sm text-[#9ca3af] mt-1">
                {search ? "Try adjusting your search or filters." : "Add your first developer to get started."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#f0f0f0]">
              {devs.map((dev) => (
                <div key={dev.id}
                  className={`hidden lg:grid grid-cols-[44px_1fr_140px_1fr_100px_90px_88px_40px] gap-4 items-center px-6 py-4 hover:bg-[#f8fafc] transition-colors ${
                    dev.deleted_at ? "opacity-50" : ""
                  }`}>
                  {/* Logo */}
                  <DeveloperLogo url={dev.logo_url} name={dev.name} />

                  {/* Name */}
                  <div className="min-w-0">
                    {dev.deleted_at ? (
                      <p className="text-sm font-semibold text-[#0d1117] truncate">{dev.name}</p>
                    ) : (
                      <a
                        href={`/developers/${dev.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`View ${dev.name} public page`}
                        className="group/name flex items-center gap-1 w-fit max-w-full text-sm font-semibold text-[#0d1117] hover:text-[#001f3f] transition-colors"
                      >
                        <span className="truncate group-hover/name:underline">{dev.name}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-0 group-hover/name:opacity-60 transition-opacity" />
                      </a>
                    )}
                    {dev.description && <p className="text-xs text-[#9ca3af] truncate">{dev.description}</p>}
                  </div>

                  {/* Slug */}
                  <span className="text-xs font-mono text-[#6b7280] truncate">{dev.slug}</span>

                  {/* Contact */}
                  <div className="min-w-0 space-y-0.5">
                    {dev.email    && <p className="text-xs text-[#6b7280] truncate flex items-center gap-1"><Mail  className="w-3 h-3 flex-shrink-0" />{dev.email}</p>}
                    {dev.website_url && <p className="text-xs text-[#6b7280] truncate flex items-center gap-1"><Globe className="w-3 h-3 flex-shrink-0" />{dev.website_url.replace(/^https?:\/\//, "")}</p>}
                    {dev.phone    && <p className="text-xs text-[#6b7280] truncate flex items-center gap-1"><Phone className="w-3 h-3 flex-shrink-0" />{dev.phone}</p>}
                  </div>

                  {/* Rating */}
                  <StarRating value={dev.rating} />

                  {/* Verified */}
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold w-fit ${
                    dev.is_verified ? "bg-emerald-50 text-emerald-700" : "bg-[#f3f4f6] text-[#6b7280]"
                  }`}>
                    {dev.is_verified ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {dev.is_verified ? "Verified" : "Unverified"}
                  </span>

                  {/* Status / Deleted */}
                  {dev.deleted_at ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 w-fit">
                      <Archive className="w-3 h-3" /> Deleted
                    </span>
                  ) : (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold w-fit ${
                      dev.is_active ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                    }`}>
                      {dev.is_active ? "Active" : "Inactive"}
                    </span>
                  )}

                  {/* Actions */}
                  {isAdmin && (
                    <RowActions
                      dev={dev}
                      onEdit={() => { setEditDev(dev); setShowForm(true) }}
                      onLogo={() => { setLogoTarget(dev); setShowLogo(true) }}
                      onToggleVerified={() => void handleToggleVerified(dev)}
                      onToggleActive={() => void handleToggleActive(dev)}
                      onDelete={() => handleDelete(dev)}
                      onRestore={() => void handleRestore(dev)}
                    />
                  )}
                </div>
              ))}

              {/* Mobile cards */}
              {devs.map((dev) => (
                <div key={`m-${dev.id}`} className={`lg:hidden p-4 ${dev.deleted_at ? "opacity-50" : ""}`}>
                  <div className="flex items-start gap-3">
                    <DeveloperLogo url={dev.logo_url} name={dev.name} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {dev.deleted_at ? (
                            <p className="text-sm font-semibold text-[#0d1117]">{dev.name}</p>
                          ) : (
                            <a
                              href={`/developers/${dev.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm font-semibold text-[#0d1117] hover:text-[#001f3f] hover:underline transition-colors"
                            >
                              {dev.name}
                              <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-60" />
                            </a>
                          )}
                          <p className="text-xs font-mono text-[#9ca3af]">{dev.slug}</p>
                        </div>
                        {isAdmin && (
                          <RowActions
                            dev={dev}
                            onEdit={() => { setEditDev(dev); setShowForm(true) }}
                            onLogo={() => { setLogoTarget(dev); setShowLogo(true) }}
                            onToggleVerified={() => void handleToggleVerified(dev)}
                            onToggleActive={() => void handleToggleActive(dev)}
                            onDelete={() => handleDelete(dev)}
                            onRestore={() => void handleRestore(dev)}
                          />
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          dev.is_verified ? "bg-emerald-50 text-emerald-700" : "bg-[#f3f4f6] text-[#6b7280]"
                        }`}>{dev.is_verified ? "✓ Verified" : "Unverified"}</span>
                        {dev.deleted_at
                          ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600">Deleted</span>
                          : <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${dev.is_active ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{dev.is_active ? "Active" : "Inactive"}</span>
                        }
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
      <DeveloperFormDialog
        open={showForm}
        editDeveloper={editDev}
        onClose={() => setShowForm(false)}
        onSaved={(dev, isEdit) => {
          setShowForm(false)
          addToast("success", isEdit ? "Developer updated." : "Developer added.")
          void loadWithCount()
        }}
        onError={(msg) => addToast("error", msg)}
      />

      {logoTarget && (
        <DeveloperLogoUpload
          open={showLogo}
          developerId={logoTarget.id}
          developerSlug={logoTarget.slug}
          developerName={logoTarget.name}
          currentLogoUrl={logoTarget.logo_url}
          onClose={() => setShowLogo(false)}
          onUploaded={(url) => {
            setShowLogo(false)
            addToast("success", "Logo uploaded.")
            setDevs((prev) => prev.map((d) => d.id === logoTarget.id ? { ...d, logo_url: url } : d))
          }}
          onRemoved={() => {
            setShowLogo(false)
            addToast("success", "Logo removed.")
            setDevs((prev) => prev.map((d) => d.id === logoTarget.id ? { ...d, logo_url: null } : d))
          }}
          onError={(msg) => addToast("error", msg)}
        />
      )}

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
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
