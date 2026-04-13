/**
 * Single source of truth for `profiles.role` values used in this app.
 * Dashboard paths, labels, colors, sidebar, and permission checks should import from here
 * so new roles or renames stay consistent.
 */

export const APP_ROLES = {
  super_admin: {
    dashboardBasePath: "/dashboard/superadmin",
    adminLabel: "Super Admin",
    sidebarHexColor: "#7c3aed",
    tableBadge: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
    shellBadge: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  },
  admin: {
    dashboardBasePath: "/dashboard/admin",
    adminLabel: "Admin",
    sidebarHexColor: "#0ea5e9",
    tableBadge: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
    shellBadge: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  },
  team_leader: {
    dashboardBasePath: "/dashboard/teamleader",
    adminLabel: "Team Leader",
    sidebarHexColor: "#10b981",
    tableBadge: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    shellBadge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  },
  unit_manager: {
    dashboardBasePath: "/dashboard/unitmanager",
    adminLabel: "Unit Manager",
    sidebarHexColor: "#f59e0b",
    tableBadge: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
    shellBadge: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  },
  agent: {
    dashboardBasePath: "/dashboard/agent",
    adminLabel: "Agent",
    sidebarHexColor: "#d6b357",
    tableBadge: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
    shellBadge: "bg-[#d6b357]/20 text-[#d6b357] border-[#d6b357]/30",
  },
  secretary: {
    dashboardBasePath: "/dashboard/secretary",
    adminLabel: "Secretary",
    sidebarHexColor: "#f43f5e",
    tableBadge: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
    shellBadge: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  },
  team_secretary: {
    dashboardBasePath: "/dashboard/teamsecretary",
    adminLabel: "Team Secretary",
    sidebarHexColor: "#14b8a6",
    tableBadge: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
    shellBadge: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  },
  member: {
    dashboardBasePath: "/dashboard/member",
    adminLabel: "Member",
    sidebarHexColor: "#64748b",
    tableBadge: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
    shellBadge: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  },
  developer: {
    dashboardBasePath: "/dashboard/developer",
    adminLabel: "Developer",
    sidebarHexColor: "#6366f1",
    tableBadge: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
    shellBadge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  },
} as const

export type AppRoleId = keyof typeof APP_ROLES

/** Order for admin dropdowns and “all app roles”. */
export const APP_ROLE_ORDER: AppRoleId[] = [
  "super_admin",
  "admin",
  "team_leader",
  "unit_manager",
  "agent",
  "developer",
  "secretary",
  "team_secretary",
  "member",
]

export function normalizeAppRole(role: string | null | undefined): string {
  return String(role ?? "").toLowerCase().trim()
}

export function isKnownAppRoleId(role: string | null | undefined): role is AppRoleId {
  return normalizeAppRole(role) in APP_ROLES
}

export function resolveAppRoleOrMember(role: string | null | undefined): AppRoleId {
  const r = normalizeAppRole(role)
  return r in APP_ROLES ? (r as AppRoleId) : "member"
}

/** Same keys as legacy `ROLE_DASHBOARD_MAP` in auth. */
export const ROLE_DASHBOARD_MAP: Record<string, string> = Object.fromEntries(
  (Object.keys(APP_ROLES) as AppRoleId[]).map((id) => [id, APP_ROLES[id].dashboardBasePath]),
)

export const ROLE_OPTIONS: Array<{ value: string; label: string }> = APP_ROLE_ORDER.map((id) => ({
  value: id,
  label: APP_ROLES[id].adminLabel,
}))

export const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = Object.fromEntries(
  (Object.keys(APP_ROLES) as AppRoleId[]).map((id) => [id, APP_ROLES[id].tableBadge]),
)

export const ROLE_SHELL_BADGE: Record<string, string> = Object.fromEntries(
  (Object.keys(APP_ROLES) as AppRoleId[]).map((id) => [id, APP_ROLES[id].shellBadge]),
)

export function getRoleSidebarHex(role: string | null | undefined): string {
  const id = resolveAppRoleOrMember(role)
  return APP_ROLES[id].sidebarHexColor
}

export function roleToLabel(role?: string | null) {
  if (!role) return APP_ROLES.member.adminLabel
  const id = normalizeAppRole(role)
  if (id in APP_ROLES) return APP_ROLES[id as AppRoleId].adminLabel
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function roleInList(role: string | null | undefined, allowed: readonly string[]): boolean {
  const r = normalizeAppRole(role)
  return allowed.some((a) => normalizeAppRole(a) === r)
}

/** Admin UI + privileged APIs (admin + super_admin). */
export const ROLES_ADMIN_STAFF: readonly AppRoleId[] = ["super_admin", "admin"]

/**
 * Sales hierarchy: agents, team leaders, and unit managers share the same pipeline tools
 * (e.g. `/dashboard/listings`, `/dashboard/sales`, public buy/rent browsing).
 */
export const ROLES_SALES_PIPELINE: readonly AppRoleId[] = ["agent", "team_leader", "unit_manager"]

export const ROLES_SECRETARY_LIKE: readonly AppRoleId[] = ["secretary", "team_secretary"]

/** `/dashboard/sales`, sale detail, and sale file uploads (view / assist with paperwork, not encode new sales). */
export const ROLES_SALES_REPORTS_ACCESS: readonly AppRoleId[] = [
  "super_admin",
  "admin",
  "team_leader",
  "unit_manager",
  "agent",
  "secretary",
  "team_secretary",
]

/**
 * Roles that may use buy/rent listing experiences (portal CTAs, future gated APIs).
 * **`/buy` and `/rent` are public**; members are included so the app treats them like other browsers here.
 */
export const ROLES_BUY_RENT_LISTINGS_ACCESS: readonly AppRoleId[] = [
  "super_admin",
  "admin",
  "agent",
  "team_leader",
  "unit_manager",
  "member",
]

export function canAccessBuyRentListings(role: string | null | undefined): boolean {
  return roleInList(role, ROLES_BUY_RENT_LISTINGS_ACCESS)
}

/** Profiles listed as sales agents. */
export const ROLES_SALE_AGENT_PROFILES: readonly AppRoleId[] = ["agent", "team_leader", "unit_manager"]

/** Reporters pool for support tickets (matches previous query). */
export const ROLES_SUPPORT_REPORTER_POOL: readonly AppRoleId[] = [
  "agent",
  "team_leader",
  "unit_manager",
  "admin",
  "secretary",
  "team_secretary",
]

/** Internal assignees in support pickers (admin + developer). */
export const ROLES_SUPPORT_INTERNAL_ASSIGNEES: readonly AppRoleId[] = ["admin", "developer"]

/** Who may use the support UI / upload ticket files (all known roles). */
export const ROLES_SUPPORT_PORTAL: readonly AppRoleId[] = [...APP_ROLE_ORDER]

/** Developer media upload route. */
export const ROLES_ADMIN_OR_DEVELOPER: readonly AppRoleId[] = ["super_admin", "admin", "developer"]

export function isAdminStaffRole(role: string | null | undefined): boolean {
  return roleInList(role, ROLES_ADMIN_STAFF)
}

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return normalizeAppRole(role) === "super_admin"
}

export function isDeveloperRole(role: string | null | undefined): boolean {
  return normalizeAppRole(role) === "developer"
}

export function isSalesPipelineRole(role: string | null | undefined): boolean {
  return roleInList(role, ROLES_SALES_PIPELINE)
}

export function isSecretaryLikeRole(role: string | null | undefined): boolean {
  return roleInList(role, ROLES_SECRETARY_LIKE)
}

export function canAccessSalesReportsArea(role: string | null | undefined): boolean {
  return roleInList(role, ROLES_SALES_REPORTS_ACCESS)
}

export function canUseSupportPortal(role: string | null | undefined): boolean {
  return roleInList(role, ROLES_SUPPORT_PORTAL)
}

export function isSupportAdminRole(role: string | null | undefined): boolean {
  return isAdminStaffRole(role)
}

export function isAdminOrDeveloperUploadRole(role: string | null | undefined): boolean {
  return roleInList(role, ROLES_ADMIN_OR_DEVELOPER)
}
