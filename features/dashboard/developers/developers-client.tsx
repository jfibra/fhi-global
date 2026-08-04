"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import {
  Search, Plus, RefreshCw, MoreHorizontal, Pencil, ImageIcon,
  CheckCircle2, XCircle, Archive, ArchiveRestore, Eye, ExternalLink,
  Building2, ChevronLeft, ChevronRight, ChevronDown, Star, Globe,
  Phone, Mail, Filter, SortAsc, Trash2, QrCode,
  LayoutGrid, Table as TableIcon,
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
import { isAdminStaffRole, canManageDeveloperContent } from "@/lib/app-roles"
import { formatDateTime, formatLongDateAtTime, relativeTime } from "@/lib/utils"
import { DeveloperFormDialog } from "./developer-form-dialog"
import { DeveloperLogoUpload } from "./developer-logo-upload"
import { DeveloperInviteDialog } from "./developer-invite-dialog"

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
  onInviteLink: () => void
  onToggleVerified: () => void
  onToggleActive: () => void
  onDelete: () => void
  onRestore: () => void
  canInvite: boolean // developer invite-registration is admin-staff only
}

function RowActions({ dev, onEdit, onLogo, onInviteLink, onToggleVerified, onToggleActive, onDelete, onRestore, canInvite }: RowActionsProps) {
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
                  action: () => { window.open(`/${dev.slug}`, "_blank", "noopener,noreferrer") },
                }]),
                { label: "Edit", icon: <Pencil className="w-3.5 h-3.5" />, action: onEdit },
                { label: "Upload Logo", icon: <ImageIcon className="w-3.5 h-3.5" />, action: onLogo },
                ...(dev.deleted_at || !canInvite ? [] : [{
                  label: "Invite link",
                  icon: <QrCode className="w-3.5 h-3.5" />,
                  action: onInviteLink,
                }]),
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
    <div className="w-9 h-9 rounded-xl bg-[#001f3f] flex items-center justify-center flex-shrink-0">
      <span className="text-white text-xs font-bold">{initials}</span>
    </div>
  )
}

// ─── View mode (cards ⇄ table), remembered per browser ────────────────────────
// Read through useSyncExternalStore: touching localStorage during render would
// make the server and client disagree and break hydration.
type ViewMode = "cards" | "table"
const VIEW_KEY = "fhi.developers.view"

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

/** Cards is the default so this page matches the Projects grid. */
function getViewServerSnapshot(): ViewMode {
  return "cards"
}

function storeView(next: ViewMode) {
  viewCache = next
  try { window.localStorage.setItem(VIEW_KEY, next) } catch { /* private mode */ }
  for (const cb of viewListeners) cb()
}

// ─── Filter dropdown ─────────────────────────────────────────────────────────
// A native <select>'s popup is drawn by the OS and can't be styled, so it broke
// the rounded look of the filter bar. This is the same control with our own menu.
function FilterSelect<T extends string>({
  value, options, onChange, ariaLabel,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  ariaLabel: string
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const current = options.find((o) => o.value === value)

  // The filter bar uses backdrop-blur, which creates a stacking context an
  // absolutely-positioned menu can't escape — the cards below would paint over
  // it. So the menu is portalled to <body> and positioned off the trigger rect.
  useEffect(() => {
    if (!open) return

    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect()
      if (!r) return
      const menuWidth = Math.max(r.width, 176)
      const estimatedHeight = options.length * 36 + 12
      const pad = 8
      const below = r.bottom + 6 + estimatedHeight <= window.innerHeight - pad
      setPos({
        top: below ? r.bottom + 6 : Math.max(pad, r.top - estimatedHeight - 6),
        left: Math.min(Math.max(pad, r.left), window.innerWidth - menuWidth - pad),
        width: menuWidth,
      })
    }

    place()
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, options.length])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`w-full sm:w-auto flex items-center justify-between gap-2 px-4 py-3 rounded-2xl border bg-white text-sm text-[#374151] transition-all ${
          open ? "border-[#001f3f] ring-4 ring-[#001f3f]/5" : "border-[#e5e5e5] hover:border-[#001f3f]/40"
        }`}
      >
        <span className="whitespace-nowrap">{current?.label ?? ""}</span>
        <ChevronDown className={`w-4 h-4 text-[#9ca3af] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <Portal>
          <div className="fixed inset-0 z-[130]" onClick={() => setOpen(false)} />
          <div
            ref={menuRef}
            role="listbox"
            aria-label={ariaLabel}
            style={{ top: pos.top, left: pos.left, minWidth: pos.width }}
            className="fixed z-[140] bg-white rounded-2xl border border-[#f0f0f0] shadow-2xl py-1.5 overflow-hidden"
          >
            {options.map((o) => {
              const selected = o.value === value
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => { onChange(o.value); setOpen(false) }}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors whitespace-nowrap ${
                    selected ? "bg-[#001f3f]/6 text-[#001f3f] font-semibold" : "text-[#374151] hover:bg-[#f8fafc]"
                  }`}
                >
                  <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${selected ? "opacity-100" : "opacity-0"}`} />
                  {o.label}
                </button>
              )
            })}
          </div>
        </Portal>
      )}
    </>
  )
}

// ─── Developer card (grid view) ──────────────────────────────────────────────
function DeveloperCard({
  dev, canManage, isAdmin, onEdit, onLogo, onInviteLink, onToggleVerified, onToggleActive, onDelete, onRestore,
}: {
  dev: Developer
  canManage: boolean
  isAdmin: boolean
  onEdit: () => void
  onLogo: () => void
  onInviteLink: () => void
  onToggleVerified: () => void
  onToggleActive: () => void
  onDelete: () => void
  onRestore: () => void
}) {
  const initials = dev.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()

  return (
    // A plain container, not role="button": putting a widget role here would
    // make its children presentational and hide the badges, contact details and
    // rating from screen readers. The click target is the overlay button below,
    // which real controls (links, kebab) sit above in z-order.
    <div
      className={`group relative h-full flex flex-col bg-white rounded-3xl border border-[#eceef2] overflow-hidden shadow-[0_2px_12px_-6px_rgba(0,31,63,0.10)] transition-all duration-200 ${
        canManage ? "hover:shadow-[0_16px_40px_-12px_rgba(0,31,63,0.28)] hover:-translate-y-1 hover:border-[#d6b357]/60 focus-within:ring-4 focus-within:ring-[#001f3f]/15" : ""
      } ${dev.deleted_at ? "opacity-60" : ""}`}
    >
      {canManage && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${dev.name}`}
          className="absolute inset-0 z-[1] cursor-pointer rounded-3xl focus:outline-none"
        />
      )}

      {/* Logo plate — light so dark brand marks stay visible */}
      <div className="relative h-32 bg-[#f6f8fb] border-b border-[#f0f2f5] flex items-center justify-center overflow-hidden">
        {dev.logo_url ? (
          <Image
            src={dev.logo_url}
            alt={dev.name}
            fill
            // Without this the browser fetches a full-viewport-width variant
            // for a ~250px plate.
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-contain p-6"
          />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-[#001f3f] flex items-center justify-center">
            <span className="text-white text-lg font-bold">{initials}</span>
          </div>
        )}

        <span className={`absolute top-3 left-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
          dev.is_verified ? "bg-emerald-500/95 text-white" : "bg-white/90 text-[#6b7280]"
        }`}>
          {dev.is_verified ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
          {dev.is_verified ? "Verified" : "Unverified"}
        </span>

        {dev.deleted_at ? (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-rose-500/95 text-white">
            <Archive className="w-3 h-3" /> Deleted
          </span>
        ) : (
          <span className={`absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
            dev.is_active ? "bg-[#001f3f]/85 text-[#d6b357]" : "bg-amber-100 text-amber-700"
          }`}>
            {dev.is_active ? "Active" : "Inactive"}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {dev.deleted_at ? (
              <p className="text-[15px] font-bold text-[#0d1117] font-['Outfit'] truncate">{dev.name}</p>
            ) : (
              <a
                href={`/${dev.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`View ${dev.name} public page`}
                className="group/name relative z-[2] inline-flex items-center gap-1 max-w-full text-[15px] font-bold text-[#0d1117] font-['Outfit'] hover:text-[#001f3f] transition-colors"
              >
                <span className="truncate group-hover/name:underline">{dev.name}</span>
                <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-0 group-hover/name:opacity-60 transition-opacity" />
              </a>
            )}
            <p className="text-xs text-[#9ca3af] mt-0.5 line-clamp-2 min-h-[2rem]">
              {dev.description || "No description yet."}
            </p>
          </div>
          {canManage && (
            <span className="relative z-[2] flex-shrink-0">
              <RowActions
                dev={dev}
                canInvite={isAdmin}
                onEdit={onEdit}
                onLogo={onLogo}
                onInviteLink={onInviteLink}
                onToggleVerified={onToggleVerified}
                onToggleActive={onToggleActive}
                onDelete={onDelete}
                onRestore={onRestore}
              />
            </span>
          )}
        </div>

        {/* Contact — real links, above the overlay, so they stay clickable and
            copyable and show the full value on hover when clipped. */}
        <div className="mt-3 space-y-1 relative z-[2] w-fit max-w-full">
          {dev.email && (
            <a href={`mailto:${dev.email}`} title={dev.email}
              className="text-[11px] text-[#6b7280] hover:text-[#001f3f] flex items-center gap-1.5 max-w-full">
              <Mail className="w-3 h-3 flex-shrink-0" /><span className="truncate">{dev.email}</span>
            </a>
          )}
          {dev.website_url && (
            <a href={dev.website_url} target="_blank" rel="noopener noreferrer" title={dev.website_url}
              className="text-[11px] text-[#6b7280] hover:text-[#001f3f] flex items-center gap-1.5 max-w-full">
              <Globe className="w-3 h-3 flex-shrink-0" /><span className="truncate">{dev.website_url.replace(/^https?:\/\//, "")}</span>
            </a>
          )}
          {dev.phone && (
            <a href={`tel:${dev.phone.replace(/\s+/g, "")}`} title={dev.phone}
              className="text-[11px] text-[#6b7280] hover:text-[#001f3f] flex items-center gap-1.5 max-w-full">
              <Phone className="w-3 h-3 flex-shrink-0" /><span className="truncate">{dev.phone}</span>
            </a>
          )}
          {!dev.email && !dev.website_url && !dev.phone && <p className="text-[11px] text-[#c0c6cf]">No contact details</p>}
        </div>

        {/* Footer: rating + added — pinned to the bottom so cards in a row line up */}
        <div className="mt-auto pt-3 border-t border-[#f4f6f9] flex items-center justify-between gap-2">
          <StarRating value={dev.rating} />
          <span className="text-[10px] text-[#9ca3af] truncate" title={formatDateTime(dev.created_at)}>
            {relativeTime(dev.created_at)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
interface Props {
  currentRole: string
  userId: string
}

// Multiples of 12 so the card grid fills evenly at every breakpoint (4, 3 or 2
// columns all divide into 12).
const PER_PAGE_OPTIONS = [12, 24, 48] as const

type SortField = "name" | "created_at" | "rating"
type SortDir   = "asc" | "desc"

export function DevelopersClient({ currentRole }: Props) {
  const [devs, setDevs]         = useState<Developer[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [perPage, setPerPage]   = useState<12 | 24 | 48>(12)
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
  const [showInvite, setShowInvite]     = useState(false)
  const [invitePreset, setInvitePreset] = useState<Developer | null>(null)
  const [confirm, setConfirm]           = useState<{ message: string; action: () => void } | null>(null)
  const [toasts, setToasts]             = useState<ToastMsg[]>([])

  const view = useSyncExternalStore(subscribeView, getViewSnapshot, getViewServerSnapshot)

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
  // Editors can manage developer records (add/edit/delete/toggles); the
  // invite-registration feature stays admin-staff only (its API is ADMIN_STAFF).
  const canManage = canManageDeveloperContent(currentRole)

  return (
    <div className="space-y-6">
      <div className="max-w-12xl space-y-6">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#001f3f] flex items-center justify-center shadow-lg">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0d1117]">Developers</h1>
              <p className="text-sm text-[#6b7280]">Manage real estate developer profiles</p>
            </div>
          </div>
          {canManage && (
            <div className="flex items-center gap-3 self-start sm:self-auto">
              {isAdmin && (
                <button type="button" onClick={() => { setInvitePreset(null); setShowInvite(true) }}
                  className="inline-flex items-center gap-2 border border-[#e5e5e5] text-[#374151] px-5 py-3 rounded-full font-semibold text-sm transition-all hover:border-[#001f3f] hover:text-[#001f3f]">
                  <QrCode className="w-4 h-4" /> Invite Registration
                </button>
              )}
              <button type="button" onClick={() => { setEditDev(null); setShowForm(true) }}
                className="bg-[#001f3f] hover:bg-[#002b57] text-white px-7 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-lg shadow-md flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add Developer
              </button>
            </div>
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
            <FilterSelect
              ariaLabel="Filter by verification"
              value={filterVerified === null ? "all" : filterVerified ? "verified" : "unverified"}
              options={[
                { value: "all", label: "All Verified" },
                { value: "verified", label: "Verified" },
                { value: "unverified", label: "Unverified" },
              ]}
              onChange={(v) => {
                setFilterVerified(v === "all" ? null : v === "verified")
                setPage(1)
              }}
            />

            {/* Status filter */}
            <FilterSelect
              ariaLabel="Filter by status"
              value={filterStatus}
              options={[
                { value: "all", label: "All Status" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
              onChange={(v) => { setFilterStatus(v); setPage(1) }}
            />

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

          {/* Sort pills + view switch */}
          <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
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

            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#f3f4f6]" role="group" aria-label="View mode">
              {([
                { id: "cards" as const, label: "Cards", icon: <LayoutGrid className="w-3.5 h-3.5" /> },
                { id: "table" as const, label: "Table", icon: <TableIcon className="w-3.5 h-3.5" /> },
              ]).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => storeView(v.id)}
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
        </div>

        {/* ── Card grid (default — matches the Projects page) ─────────────── */}
        {view === "cards" ? (
          loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-72 rounded-3xl bg-white/70 border border-[#eceef2] animate-pulse" />
              ))}
            </div>
          ) : devs.length === 0 ? (
            <div className="bg-white rounded-3xl border border-[#eceef2] flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-[#f3f4f6] flex items-center justify-center mb-4">
                <Building2 className="w-8 h-8 text-[#d1d5db]" />
              </div>
              <p className="text-base font-semibold text-[#374151]">No developers found</p>
              <p className="text-sm text-[#9ca3af] mt-1">
                {search ? "Try adjusting your search or filters." : "Add your first developer to get started."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {devs.map((dev) => (
                <DeveloperCard
                  key={dev.id}
                  dev={dev}
                  canManage={canManage}
                  isAdmin={isAdmin}
                  onEdit={() => { setEditDev(dev); setShowForm(true) }}
                  onLogo={() => { setLogoTarget(dev); setShowLogo(true) }}
                  onInviteLink={() => { setInvitePreset(dev); setShowInvite(true) }}
                  onToggleVerified={() => void handleToggleVerified(dev)}
                  onToggleActive={() => void handleToggleActive(dev)}
                  onDelete={() => handleDelete(dev)}
                  onRestore={() => void handleRestore(dev)}
                />
              ))}
            </div>
          )
        ) : (
        /* ── Table ─────────────────────────────────────────────────────────── */
        <div className="bg-white/60 backdrop-blur-2xl rounded-[24px] border border-white/60 shadow-xl shadow-black/5 overflow-hidden">
          <div className="overflow-x-auto">
          {/* Table header */}
          <div className="hidden lg:grid grid-cols-[44px_1fr_1fr_100px_90px_88px_170px_170px_40px] lg:min-w-[1200px] gap-4 px-6 py-3 border-b border-[#f0f0f0]">
            {["", "Name", "Contact", "Rating", "Verified", "Status", "Added", "Updated", ""].map((h, i) => (
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
                  className={`hidden lg:grid grid-cols-[44px_1fr_1fr_100px_90px_88px_170px_170px_40px] lg:min-w-[1200px] gap-4 items-center px-6 py-4 hover:bg-[#f8fafc] transition-colors ${
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
                        href={`/${dev.slug}`}
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

                  {/* Added */}
                  <div className="min-w-0">
                    <p className="text-xs text-[#374151] leading-tight" title={formatDateTime(dev.created_at)}>{formatLongDateAtTime(dev.created_at)}</p>
                  </div>

                  {/* Updated */}
                  <div className="min-w-0">
                    <p className="text-xs text-[#374151] leading-tight" title={formatDateTime(dev.updated_at)}>{formatLongDateAtTime(dev.updated_at)}</p>
                    <p className="text-[11px] text-[#9ca3af] mt-0.5">{relativeTime(dev.updated_at)}</p>
                  </div>

                  {/* Actions */}
                  {canManage && (
                    <RowActions
                      dev={dev}
                      canInvite={isAdmin}
                      onEdit={() => { setEditDev(dev); setShowForm(true) }}
                      onLogo={() => { setLogoTarget(dev); setShowLogo(true) }}
                      onInviteLink={() => { setInvitePreset(dev); setShowInvite(true) }}
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
                              href={`/${dev.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm font-semibold text-[#0d1117] hover:text-[#001f3f] hover:underline transition-colors"
                            >
                              {dev.name}
                              <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-60" />
                            </a>
                          )}
                          {dev.description && <p className="text-xs text-[#9ca3af] truncate">{dev.description}</p>}
                        </div>
                        {canManage && (
                          <RowActions
                            dev={dev}
                            canInvite={isAdmin}
                            onEdit={() => { setEditDev(dev); setShowForm(true) }}
                            onLogo={() => { setLogoTarget(dev); setShowLogo(true) }}
                            onInviteLink={() => { setInvitePreset(dev); setShowInvite(true) }}
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
                      <div className="text-[11px] text-[#9ca3af] mt-2 space-y-0.5">
                        <p>Added {formatLongDateAtTime(dev.created_at)}</p>
                        <p>Updated {formatLongDateAtTime(dev.updated_at)} · {relativeTime(dev.updated_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
        )}

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <p className="text-sm text-[#6b7280]">
              {total > 0 ? `Showing ${Math.min((page - 1) * perPage + 1, total)}–${Math.min(page * perPage, total)} of ${total}` : "No results"}
            </p>
            <select
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value) as 12 | 24 | 48); setPage(1) }}
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

      <DeveloperInviteDialog
        open={showInvite}
        presetDeveloper={invitePreset}
        onClose={() => setShowInvite(false)}
        onError={(msg) => addToast("error", msg)}
      />

      <Portal>
        <Toast toasts={toasts} remove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
      </Portal>
    </div>
  )
}
