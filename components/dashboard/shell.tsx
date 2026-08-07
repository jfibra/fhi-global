"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRouter } from "next/navigation"
import {
  Menu, X, Bell, LogOut, Settings, ChevronDown, Home, Plus,
} from "lucide-react"
import { createClient as createSupabaseClient } from "@/lib/supabase/client"
import { roleToLabel, getDashboardRouteByRole } from "@/lib/auth"
import { useAuth } from "@/context/auth-context"
import { getSidebarNavItems, getRoleColor, type NavItem } from "@/components/dashboard/sidebar-config"
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb"
import { DashboardSearch } from "@/components/dashboard/dashboard-search"
import { useNewLeadsCount } from "@/components/dashboard/use-new-leads-count"
import { RequiredSaleProofGate } from "@/components/dashboard/required-sale-proof-gate"
import { ViewAsMenuItem, ViewAsBanner } from "@/components/dashboard/view-as"
import { ROLE_SHELL_BADGE, normalizeAppRole, isAdminStaffRole, isSalesPipelineRole } from "@/lib/app-roles"

// ─── Render-once contract ────────────────────────────────────────────────────
//
// This shell renders ONCE per session. Two rules keep it that way — break either
// and the sidebar starts re-rendering on every click again:
//
//  1. NEVER call usePathname() (or any router hook) in DashboardShell. It lives
//     in the (users) layout, and App Router layouts do not re-render on client
//     navigation — the page swaps below them, inside Next's LayoutRouter. So the
//     only thing that CAN re-render the shell is a hook subscription. usePathname
//     re-runs every component that calls it on every route change; that single
//     call at the top of this file was what made the whole sidebar re-render.
//     <SidebarNav> is the one piece whose output depends on the URL (active
//     highlighting), so the hook lives there and nowhere else.
//
//  2. Keep transient UI state in the piece that owns it. `notificationsOpen`
//     belongs to the top bar, `profileMenuOpen` to the account card — hoisting
//     them into DashboardShell would make opening a dropdown re-render the nav.
//     Only `sidebarOpen` is shared (the mobile drawer + its overlay + the burger
//     button), so that one stays here.
//
// No memo() anywhere: it would only paper over a violation of rule 1.

// ─── types ────────────────────────────────────────────────────────────────────
export interface DashboardShellProps {
  /** All of role/roleLabel/roleColor are optional — the shell derives them from
   *  the logged-in profile (AuthProvider). Props remain as explicit overrides. */
  role?: string
  roleLabel?: string
  roleColor?: string       // tailwind / hex for accent ring + active state
  userName?: string
  userAvatar?: string
  /** Override the role's nav list (otherwise derived from the role). */
  navItems?: NavItem[]
  children: React.ReactNode
}

// ─── Single nav link ─────────────────────────────────────────────────────────
function NavLink({
  item,
  isActive,
  accentColor,
  onNavigate,
}: {
  item: NavItem
  isActive: boolean
  accentColor: string
  onNavigate: () => void
}) {
  const { icon: Icon, label, href, badge } = item
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`group flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] transition-all duration-200 relative
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

// ─── Nav ─────────────────────────────────────────────────────────────────────
// A flat list — no section headers, no collapse. The ONLY part of the shell
// that reads the pathname (see rule 1 above). Its only state is the unread-
// leads badge count, which lives here (not in DashboardShell) per rule 2:
// the nav is the piece that displays it, so a count update re-renders the
// nav alone.
function SidebarNav({
  items,
  accentColor,
  dashboardBase,
  onNavigate,
}: {
  items: NavItem[]
  accentColor: string
  /** The role's bare dashboard root (e.g. /admin) — see isActive below. */
  dashboardBase: string
  onNavigate: () => void
}) {
  const pathname = usePathname()

  // Unread-emails badge — only fetched when this role's list actually has the
  // Emails row (admin + superadmin).
  const leadsHref = `${dashboardBase}/leads`
  const newLeads = useNewLeadsCount(items.some((i) => i.href === leadsHref), pathname)

  // px-5 matches the account header above, so the active row's highlight lines
  // up with the account card and the Record Your Sale button instead of bleeding 8px
  // wider on each side.
  return (
    <nav className="flex-1 overflow-y-auto px-5 py-3 scrollbar-none space-y-0.5">
      {items.map(item => {
        // A hub row's href is an ancestor of every page inside it
        // (/admin/communication is a prefix of /admin/communication/support),
        // so a plain equality check would only ever light up the hub's own
        // tile-grid page, never while actually browsing inside it. Every other
        // row gets the same prefix check for the same reason (e.g. a Sales
        // Reports detail page keeps that row lit). The one row this must NOT
        // apply to is the bare dashboard root (Overview) — its href equals
        // dashboardBase, which is a prefix of literally every other route, so
        // prefix-matching it would keep Overview lit everywhere.
        const isActive =
          item.href === dashboardBase
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`)
        const resolved =
          item.href === leadsHref && newLeads > 0 ? { ...item, badge: newLeads } : item
        return (
          <NavLink
            key={item.href}
            item={resolved}
            isActive={isActive}
            accentColor={accentColor}
            onNavigate={onNavigate}
          />
        )
      })}
    </nav>
  )
}

// ─── User identity card + account dropdown + Record Your Sale ────────────────
// Owns `profileMenuOpen` so toggling the dropdown re-renders this card only.
function SidebarAccount({
  displayName,
  avatarUrl,
  roleLabel,
  badgeCls,
  accentColor,
  dashboardBase,
  showEncodeSale,
  canSwitchPov,
  onNavigate,
}: {
  displayName: string
  avatarUrl: string | null
  roleLabel: string
  badgeCls: string
  accentColor: string
  dashboardBase: string
  showEncodeSale: boolean
  canSwitchPov: boolean
  onNavigate: () => void
}) {
  const router = useRouter()
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)

  const closeAll = () => {
    setProfileMenuOpen(false)
    onNavigate()
  }

  const handleSignOut = async () => {
    const supabase = createSupabaseClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <>
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
            {roleLabel}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-white/50 shrink-0 transition-transform duration-200 ${profileMenuOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Account dropdown — Profile Settings / (Change Role) / Sign Out.
          Home lives in the top bar, so it isn't repeated here. */}
      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{ maxHeight: profileMenuOpen ? (canSwitchPov ? "224px" : "160px") : "0px" }}
      >
        <div className="pt-2 space-y-0.5">
          <Link
            href={`${dashboardBase}/profile`}
            onClick={closeAll}
            className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-white/85 hover:text-white hover:bg-white/10 transition-all duration-200 group"
          >
            <span className="w-9 h-9 rounded-xl bg-white/10 group-hover:bg-white/15 flex items-center justify-center shrink-0 transition-all">
              <Settings className="w-[18px] h-[18px] text-white/80 group-hover:text-white" />
            </span>
            <span className="font-['Outfit'] font-semibold text-[15px]">Profile Settings</span>
          </Link>
          {canSwitchPov && <ViewAsMenuItem onNavigate={closeAll} />}
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

      {/* Record Your Sale — the seller's most important action, always one tap
          away. The route stays /sales/encode; only the wording changed. */}
      {showEncodeSale && (
        <Link
          href={`${dashboardBase}/sales/encode`}
          onClick={onNavigate}
          className="mt-4 w-full inline-flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl bg-[#d6b357] text-[#001428] font-['Outfit'] font-bold text-[17px] hover:bg-[#c9a449] hover:-translate-y-0.5 transition-all duration-200 shadow-md"
        >
          <Plus className="w-5 h-5" strokeWidth={2.5} />
          Record Your Sale
        </Link>
      )}
    </>
  )
}

// ─── Top bar ─────────────────────────────────────────────────────────────────
// Owns `notificationsOpen` so opening the bell re-renders the header only.
function DashboardTopBar({
  roleLabel,
  onOpenSidebar,
}: {
  roleLabel: string
  onOpenSidebar: () => void
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const notificationsRef = useRef<HTMLDivElement>(null)

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

  return (
    <header className="shrink-0 flex items-center gap-4 px-6 py-4 bg-white border-b border-[#e8eaed] shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
      <button
        onClick={onOpenSidebar}
        className="lg:hidden text-[#6b7280] hover:text-[#0d1117] transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Back to the public site. */}
      <Link
        href="/"
        className="flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-[15px] font-semibold text-[#374151] transition-colors hover:bg-[#f4f6f9] hover:text-[#001f3f]"
      >
        <Home className="h-[18px] w-[18px]" />
        <span className="hidden md:inline">Home</span>
      </Link>

      <DashboardSearch />

      <div className="min-w-0 flex-1">
        <h1 className="hidden truncate text-right font-['Outfit'] text-sm font-bold text-[#0d1117] xl:block">
          {roleLabel} Dashboard
        </h1>
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
      </div>
    </header>
  )
}

// ─── Shell ───────────────────────────────────────────────────────────────────
export function DashboardShell({
  role,
  roleLabel,
  roleColor,
  userName = "User",
  userAvatar,
  navItems,
  children,
}: DashboardShellProps) {
  // Shared state only — the mobile drawer, its backdrop and the burger button.
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, profile, role: contextRole, realRole } = useAuth()

  const closeSidebar = () => setSidebarOpen(false)

  // Effective role drives the entire shell. Context wins so an admin previewing
  // another role (view-as) gets that role's sidebar, header, badge and accent;
  // otherwise it's the real role from the profile.
  const effectiveRole = contextRole ?? profile?.role ?? role ?? "member"
  const dashboardBase = getDashboardRouteByRole(effectiveRole)
  const effectiveRoleLabel = roleToLabel(effectiveRole) ?? roleLabel
  const displayName = profile?.fullname || userName || user?.email || "User"
  const avatarUrl = userAvatar || profile?.profile_url || null
  // Accent color: explicit prop wins, else derive from the effective role.
  const accentColor = roleColor ?? getRoleColor(effectiveRole)

  const badgeCls =
    ROLE_SHELL_BADGE[normalizeAppRole(effectiveRole)] ?? "bg-white/10 text-white/60 border-white/20"

  // Prop override wins, else the role's own list from sidebar-config.
  const resolvedItems: NavItem[] = navItems ?? getSidebarNavItems(effectiveRole)

  return (
    // The :has() classes are the full-bleed editor gate: when the page below
    // renders an element with data-wb-full-bleed (the Website Builder), the
    // sidebar hides and <main> drops its padding/scroll — pure CSS, so the
    // shell's render-once contract (no usePathname here) stays intact.
    <div className="flex h-screen bg-[#f4f6f9] font-sans overflow-hidden [&:has([data-wb-full-bleed])>aside]:hidden [&:has([data-wb-full-bleed])_main]:p-0 [&:has([data-wb-full-bleed])_main]:overflow-hidden">

      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      {/* Mobile overlay — backdrop blur */}
      <div
        className={`fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity duration-300 ${
          sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={closeSidebar}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 flex flex-col bg-[#001228] shadow-2xl transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:relative lg:translate-x-0`}
      >
        {/* ── FIXED: account header ── */}
        <div className="shrink-0 px-5 pt-6 pb-4">
          {/* Close button — mobile only, so the drawer stays dismissable.
              Hidden on lg so it costs no vertical space on desktop. */}
          <div className="flex justify-end mb-3 lg:hidden">
            <button
              onClick={closeSidebar}
              aria-label="Close menu"
              className="w-7 h-7 flex items-center justify-center rounded-xl bg-white/8 hover:bg-white/15 text-white/50 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <SidebarAccount
            displayName={displayName}
            avatarUrl={avatarUrl}
            roleLabel={effectiveRoleLabel}
            badgeCls={badgeCls}
            accentColor={accentColor}
            dashboardBase={dashboardBase}
            showEncodeSale={isSalesPipelineRole(effectiveRole) || isAdminStaffRole(effectiveRole)}
            canSwitchPov={isAdminStaffRole(realRole)}
            onNavigate={closeSidebar}
          />
        </div>

        {/* Gradient divider */}
        <div
          className="mx-5 mb-1 h-px shrink-0"
          style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent)" }}
        />

        {/* ── SCROLLABLE: Nav ── */}
        <SidebarNav
          items={resolvedItems}
          accentColor={accentColor}
          dashboardBase={dashboardBase}
          onNavigate={closeSidebar}
        />
      </aside>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        <DashboardTopBar
          roleLabel={effectiveRoleLabel}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        {/* Admin role-preview strip — only renders while previewing. */}
        <ViewAsBanner />

        {/* Route trail. Reads the pathname itself, so it re-renders on
            navigation without dragging the rest of the shell with it. */}
        <DashboardBreadcrumb />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scrollbar-none p-6">
          {children}
        </main>
      </div>

      {/* Login-time enforcement: any of the user's own sales still missing a
          proof of transaction must be resolved before using the dashboard. */}
      <RequiredSaleProofGate />
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
