"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRouter } from "next/navigation"
import {
  Menu, X, Bell, LogOut, Settings, ChevronRight, ChevronDown, Home,
} from "lucide-react"
import { createClient as createSupabaseClient } from "@/lib/supabase/client"
import { roleToLabel } from "@/lib/auth"
import { useAuth } from "@/context/auth-context"
import { getSidebarNavSections, getRoleColor, type NavItem, type NavSection } from "@/components/dashboard/sidebar-config"
import { ROLE_SHELL_BADGE, normalizeAppRole } from "@/lib/app-roles"

// ─── types ────────────────────────────────────────────────────────────────────
export interface DashboardShellProps {
  /** All of role/roleLabel/roleColor are optional — the shell derives them from
   *  the logged-in profile (AuthProvider). Props remain as explicit overrides. */
  role?: string
  roleLabel?: string
  roleColor?: string       // tailwind / hex for accent ring + active state
  userName?: string
  userAvatar?: string
  /** Override flat nav items (legacy). Prefer navSections. */
  navItems?: NavItem[]
  /** Override grouped nav sections */
  navSections?: NavSection[]
  children: React.ReactNode
}

export function DashboardShell({
  role,
  roleLabel,
  roleColor,
  userName = "User",
  userAvatar,
  navItems,
  navSections: navSectionsProp,
  children,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router = useRouter()
  const { user, profile } = useAuth()

  const effectiveRole = profile?.role ?? role ?? "member"
  const effectiveRoleLabel =
    (profile?.role ? roleToLabel(profile.role) : roleLabel) ?? roleToLabel(effectiveRole)
  const displayName = profile?.fullname || userName || user?.email || "User"
  const avatarUrl = userAvatar || profile?.profile_url || null
  // Accent color: explicit prop wins, else derive from the effective role.
  const accentColor = roleColor ?? getRoleColor(effectiveRole)

  // Resolve sections: prop override → flat navItems override wrapped → auto from role
  const resolvedSections: NavSection[] = navSectionsProp
    ?? (navItems
      ? navItems.map(item => ({ type: "item" as const, item }))
      : getSidebarNavSections(effectiveRole)
    )

  const badgeCls =
    ROLE_SHELL_BADGE[normalizeAppRole(effectiveRole)] ?? "bg-white/10 text-white/60 border-white/20"

  // ── Collapse state: keyed by group label, default open ────────────────────
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    resolvedSections.forEach(section => {
      if (section.type === "group") {
        // Auto-open group that contains the active route
        const hasActive = section.items.some(
          item => pathname === item.href || pathname.startsWith(item.href + "/")
        )
        initial[section.label] = true // default all open; active group stays open regardless
        if (hasActive) initial[section.label] = true
      }
    })
    return initial
  })

  const toggleGroup = useCallback((label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }, [])

  const handleSignOut = async () => {
    const supabase = createSupabaseClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  useEffect(() => {
    if (!notificationsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotificationsOpen(false)
    }
    const onPointer = (e: MouseEvent) => {
      const el = notificationsRef.current
      if (el && !el.contains(e.target as Node)) setNotificationsOpen(false)
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onPointer)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onPointer)
    }
  }, [notificationsOpen])

  // ── Single nav item renderer ───────────────────────────────────────────────
  const renderNavItem = (item: NavItem, indented = false) => {
    const { icon: Icon, label, href, badge } = item
    const isActive = pathname === href
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setSidebarOpen(false)}
        className={`group flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] transition-all duration-200 relative
          ${indented ? "ml-2" : ""}
          ${isActive
            ? "bg-gradient-to-r from-white/20 to-white/5 text-white font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
            : "text-white/85 font-semibold hover:bg-white/10 hover:text-white"
          }`}
      >
        {/* Active left accent */}
        {isActive && (
          <span
            className="absolute left-0 top-2.5 bottom-2.5 w-[4px] rounded-full"
            style={{ background: `linear-gradient(to bottom, ${accentColor}, #d6b357)` }}
          />
        )}
        {/* Icon bubble */}
        <span
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 ${
            isActive ? "bg-white/20 shadow-sm" : "bg-white/10 group-hover:bg-white/15"
          }`}
        >
          <Icon className={`w-[18px] h-[18px] transition-colors ${isActive ? "text-[#d6b357]" : "text-white/80 group-hover:text-white"}`} />
        </span>
        <span className="flex-1 font-['Outfit']">{label}</span>
        {badge != null && badge > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[#d6b357]/20 to-[#d6b357]/10 text-[#d6b357] border border-[#d6b357]/20">
            {badge}
          </span>
        )}
      </Link>
    )
  }

  const NavLinks = () => (
    <nav className="flex-1 overflow-y-auto px-3 py-3 scrollbar-none space-y-0.5">
      {resolvedSections.map((section, sIdx) => {
        if (section.type === "item") {
          return renderNavItem(section.item)
        }

        // ── Collapsible group ──────────────────────────────────────────────
        const { label, items } = section
        const isOpen = openGroups[label] ?? true
        const hasActiveChild = items.some(item => pathname === item.href)

        return (
          <div key={label} className="mt-1">
            {/* Group header */}
            <button
              type="button"
              onClick={() => toggleGroup(label)}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl group/hdr hover:bg-white/4 transition-colors duration-150"
            >
              <span
                className={`text-[11px] font-bold uppercase tracking-[0.14em] transition-colors duration-150 ${
                  hasActiveChild ? "text-[#d6b357]" : "text-white/60 group-hover/hdr:text-white/85"
                }`}
              >
                {label}
              </span>
              <ChevronRight
                className={`w-4 h-4 transition-all duration-200 ${
                  hasActiveChild ? "text-[#d6b357]" : "text-white/50"
                } ${isOpen ? "rotate-90" : "rotate-0"}`}
              />
            </button>

            {/* Collapsible items — CSS max-height transition */}
            <div
              className="overflow-hidden transition-all duration-200 ease-in-out"
              style={{ maxHeight: isOpen ? `${items.length * 60}px` : "0px" }}
            >
              <div className="space-y-0.5 pt-0.5 pb-1">
                {items.map(item => renderNavItem(item, true))}
              </div>
            </div>

            {/* Subtle divider after each group (except last) */}
            {sIdx < resolvedSections.length - 1 && (
              <div
                className="mx-1 mt-2 h-px"
                style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.05), transparent)" }}
              />
            )}
          </div>
        )
      })}
    </nav>
  )

  return (
    <div className="flex h-screen bg-[#f4f6f9] font-sans overflow-hidden">

      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      {/* Mobile overlay — backdrop blur */}
      <div
        className={`fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity duration-300 ${
          sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 flex flex-col bg-[#001228] shadow-2xl transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:relative lg:translate-x-0`}
      >
        {/* Top gradient accent bar */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px] shrink-0"
          style={{ background: `linear-gradient(to right, transparent, ${accentColor}, #d6b357, transparent)` }}
        />

        {/* ── FIXED: Logo + role header ── */}
        <div className="shrink-0 px-5 pt-6 pb-4">
          {/* Logo row */}
          <div className="flex items-center justify-between mb-5">
            <Link href="/" aria-label="FHI Global home" className="transition-opacity hover:opacity-80">
              <Image src="/FHI_Branding_White.png" alt="FHI Global" width={110} height={32} className="object-contain h-auto" />
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden w-7 h-7 flex items-center justify-center rounded-xl bg-white/8 hover:bg-white/15 text-white/50 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* User identity card — click to reveal account actions */}
          <button
            type="button"
            onClick={() => setProfileMenuOpen((o) => !o)}
            aria-expanded={profileMenuOpen}
            aria-label="Account menu"
            className="w-full text-left flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/8 hover:bg-white/8 transition-all"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-14 h-14 rounded-full object-cover shrink-0 shadow-lg border-2 border-[#d6b357]/60"
              />
            ) : (
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold shrink-0 shadow-lg"
                style={{ background: `linear-gradient(135deg, ${accentColor}, #d6b357)`, color: "#fff" }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-bold text-white font-['Outfit'] truncate">{displayName}</p>
              <div className={`mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider ${badgeCls}`}>
                <span className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: accentColor }} />
                {effectiveRoleLabel}
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-white/50 shrink-0 transition-transform duration-200 ${profileMenuOpen ? "rotate-180" : ""}`} />
          </button>

          {/* Account dropdown — Home / Profile Settings / Sign Out */}
          <div
            className="overflow-hidden transition-all duration-200 ease-in-out"
            style={{ maxHeight: profileMenuOpen ? "220px" : "0px" }}
          >
            <div className="pt-2 space-y-0.5">
              <Link
                href="/"
                onClick={() => { setProfileMenuOpen(false); setSidebarOpen(false) }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-white/85 hover:text-white hover:bg-white/10 transition-all duration-200 group"
              >
                <span className="w-9 h-9 rounded-xl bg-white/10 group-hover:bg-[#d6b357]/20 flex items-center justify-center shrink-0 transition-all">
                  <Home className="w-[18px] h-[18px] text-white/80 group-hover:text-[#d6b357]" />
                </span>
                <span className="font-['Outfit'] font-semibold text-[15px]">Home</span>
              </Link>
              <Link
                href="/dashboard/profile"
                onClick={() => { setProfileMenuOpen(false); setSidebarOpen(false) }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-white/85 hover:text-white hover:bg-white/10 transition-all duration-200 group"
              >
                <span className="w-9 h-9 rounded-xl bg-white/10 group-hover:bg-white/15 flex items-center justify-center shrink-0 transition-all">
                  <Settings className="w-[18px] h-[18px] text-white/80 group-hover:text-white" />
                </span>
                <span className="font-['Outfit'] font-semibold text-[15px]">Profile Settings</span>
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-2xl text-white/85 hover:text-rose-300 hover:bg-rose-500/10 transition-all duration-200 group"
              >
                <span className="w-9 h-9 rounded-xl bg-white/10 group-hover:bg-rose-500/20 flex items-center justify-center shrink-0 transition-all">
                  <LogOut className="w-[18px] h-[18px] text-white/80 group-hover:text-rose-300" />
                </span>
                <span className="font-['Outfit'] font-semibold text-[15px]">Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Gradient divider */}
        <div
          className="mx-4 mb-1 h-px shrink-0"
          style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent)" }}
        />

        {/* ── SCROLLABLE: Nav ── */}
        <NavLinks />
      </aside>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar */}
        <header className="shrink-0 flex items-center gap-4 px-6 py-4 bg-white border-b border-[#e8eaed] shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-[#6b7280] hover:text-[#0d1117] transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="font-['Outfit'] text-lg font-bold text-[#0d1117] truncate">
              {effectiveRoleLabel} Dashboard
            </h1>
            <p className="text-xs text-[#6b7280]">
              FHI Global &bull; Dubai Operations
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
                aria-haspopup="dialog"
                onClick={() => setNotificationsOpen((o) => !o)}
                className={`relative w-8 h-8 flex items-center justify-center rounded-xl text-[#6b7280] transition-all ${
                  notificationsOpen ? "bg-[#e8eaed] text-[#0d1117]" : "bg-[#f4f6f9] hover:bg-[#e8eaed]"
                }`}
              >
                <Bell className="w-4 h-4" />
              </button>
              {notificationsOpen && (
                <div
                  role="dialog"
                  aria-label="Notifications"
                  className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,20rem)] rounded-2xl border border-[#e8eaed] bg-white py-2 shadow-[0_8px_30px_-4px_rgba(0,31,63,0.12)]"
                >
                  <div className="border-b border-[#f0f2f5] px-4 py-2.5">
                    <p className="font-['Outfit'] text-sm font-bold text-[#0d1117]">Notifications</p>
                    <p className="text-[11px] text-[#9ca3af]">Alerts for your account and workspace</p>
                  </div>
                  <div className="px-4 py-10 text-center">
                    <Bell className="mx-auto mb-2 h-8 w-8 text-[#d1d5db]" aria-hidden />
                    <p className="text-sm font-medium text-[#6b7280]">No notifications yet</p>
                    <p className="mt-1 text-xs text-[#9ca3af] leading-relaxed">
                      When there are updates, they will appear here.
                    </p>
                  </div>
                </div>
              )}
            </div>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-8 h-8 rounded-xl object-cover shadow-md border border-[#e8eaed]"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-md"
                style={{ backgroundColor: "#001f3f" }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

// ─── Shared sub-components ─────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  change,
  changePositive = true,
  icon: Icon,
  accentColor = "#001f3f",
  sub,
}: {
  label: string
  value: string | number
  change?: string
  changePositive?: boolean
  icon: React.ElementType
  accentColor?: string
  sub?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#e8eaed] p-5 shadow-[0_2px_12px_-2px_rgba(0,31,63,0.06)] hover:shadow-[0_4px_20px_-2px_rgba(0,31,63,0.10)] transition-all duration-300 group">
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
          style={{ backgroundColor: `${accentColor}15` }}
        >
          <Icon className="w-5 h-5" style={{ color: accentColor }} />
        </div>
        {change && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${changePositive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`}>
            {changePositive ? "↑" : "↓"} {change}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-[#0d1117] font-['Outfit'] mb-0.5">{value}</p>
      <p className="text-xs font-medium text-[#6b7280]">{label}</p>
      {sub && <p className="text-[11px] text-[#9ca3af] mt-1">{sub}</p>}
    </div>
  )
}

export function SectionCard({ title, subtitle, children, action }: {
  title: string
  subtitle?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#e8eaed] shadow-[0_2px_12px_-2px_rgba(0,31,63,0.06)] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f2f5]">
        <div>
          <h3 className="text-sm font-bold text-[#0d1117]">{title}</h3>
          {subtitle && <p className="text-xs text-[#9ca3af] mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

export function ProgressBar({ value, max = 100, color = "#001f3f", label, sub }: {
  value: number
  max?: number
  color?: string
  label: string
  sub?: string
}) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-[#374151]">{label}</span>
        <span className="text-xs font-bold text-[#0d1117]">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-[#f0f2f5] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      {sub && <p className="text-[11px] text-[#9ca3af]">{sub}</p>}
    </div>
  )
}

export function ActivityItem({ icon: Icon, title, sub, time, color = "#001f3f" }: {
  icon: React.ElementType
  title: string
  sub: string
  time: string
  color?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${color}12` }}>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[#0d1117] leading-snug">{title}</p>
        <p className="text-[11px] text-[#9ca3af] truncate">{sub}</p>
      </div>
      <span className="text-[10px] text-[#bbb] shrink-0 mt-0.5">{time}</span>
    </div>
  )
}
