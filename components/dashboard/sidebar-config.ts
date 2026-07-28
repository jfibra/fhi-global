import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard, Users, Building2, Layers, Images,
  Briefcase, Landmark, ShoppingCart, Network, FolderOpen,
  Tag, TrendingUp, LifeBuoy, CreditCard, ClipboardList, KeyRound,
  Clapperboard, QrCode, ScrollText, Inbox, CalendarDays,
} from "lucide-react"
import {
  ROLE_DASHBOARD_MAP,
  getRoleSidebarHex,
  resolveAppRoleOrMember,
  type AppRoleId,
} from "@/lib/app-roles"

// ─── How to maintain this file ────────────────────────────────────────────────
//
// Every role owns ONE flat list, all of them collected in ROLE_NAV at the
// bottom. To change a role's sidebar, edit that role's list — nothing else.
// Order in the list is order in the sidebar. There are no section headers: every
// entry renders as a plain icon + label row.
//
// `to` is relative to the role's own dashboard base (`ROLE_DASHBOARD_MAP`), so
// the lists never repeat `/admin` / `/agent` / … and a role's whole subtree can
// be re-slugged in app-roles.ts without touching this file:
//
//   to: ""            → the role's dashboard root      (/agent)
//   to: "listings"    → a page under it                (/agent/listings)
//   to: "/buy"        → left alone (leading slash = absolute, public pages)
//
// ROLE_NAV is a Record<AppRoleId, …>, so adding a role to APP_ROLES is a
// compile error here until you give it a list — no role can silently fall
// through to an empty or wrong sidebar.

// ─── Types ─────────────────────────────────────────────────────────────────────

/** A nav entry as authored in the per-role lists. See the `to` note above. */
export interface NavEntry {
  icon: LucideIcon
  label: string
  to: string
  badge?: number
}

/** A resolved entry — what the shell renders. */
export interface NavItem {
  icon: LucideIcon
  label: string
  href: string
  badge?: number
}

// ─── Shared entries ───────────────────────────────────────────────────────────
// Reused across several roles. Defined once so a label or icon change lands
// everywhere it should; anything role-specific stays inline in that role's list.

const OVERVIEW: NavEntry = { icon: LayoutDashboard, label: "Overview", to: "" }
const EVENTS: NavEntry = { icon: CalendarDays, label: "Events", to: "events" }
const PROJECTS: NavEntry = { icon: FolderOpen, label: "Projects", to: "projects" }
const INVITE: NavEntry = { icon: QrCode, label: "Invite", to: "invite" }
const REELS_MAKER: NavEntry = { icon: Clapperboard, label: "Reels Maker", to: "reels-maker" }
const BUSINESS_CARD: NavEntry = { icon: CreditCard, label: "Business Card", to: "business-card" }
const SALES_REPORTS: NavEntry = { icon: TrendingUp, label: "Sales Reports", to: "sales" }
const SUPPORT_TICKETS: NavEntry = { icon: LifeBuoy, label: "Support Tickets", to: "support" }

// ─── Per-role lists ───────────────────────────────────────────────────────────

/** super_admin + admin — the full back office. */
const ADMIN_NAV: NavEntry[] = [
  OVERVIEW,
  { icon: Users,         label: "Account Directory",   to: "users"               },
  { icon: Network,       label: "Teams",               to: "teams"               },
  { icon: Building2,     label: "Developers",          to: "developers"          },
  PROJECTS,
  { icon: ClipboardList, label: "All Listings",        to: "listings"            },
  { icon: Landmark,      label: "Tax Entities",        to: "tax-entities"        },
  { icon: ShoppingCart,  label: "Purchases",           to: "purchases"           },
  { icon: Tag,           label: "Purchase Categories", to: "purchase-categories" },
  SALES_REPORTS,
  EVENTS,
  SUPPORT_TICKETS,
  { icon: Inbox,      label: "Contact Inbox", to: "contact-inbox" },
  { icon: ScrollText, label: "System Logs",   to: "system-logs"   },
  REELS_MAKER,
  INVITE,
  BUSINESS_CARD,
]

/** Content-only role: developers + projects, no admin powers. */
const EDITOR_NAV: NavEntry[] = [
  OVERVIEW,
  { icon: Building2,  label: "Developers", to: "developers" },
  PROJECTS,
  EVENTS,
]

/** External developer partners — their own company and projects only. */
const DEVELOPER_NAV: NavEntry[] = [
  OVERVIEW,
  { icon: Briefcase, label: "Company Info",  to: "company"  },
  { icon: Layers,    label: "My Projects",   to: "projects" },
  { icon: Images,    label: "Media / Files", to: "media"    },
  SUPPORT_TICKETS,
]

/**
 * agent / team_leader / unit_manager — identical apart from the extras a
 * particular rank gets (team leaders also manage events, per
 * ROLES_EVENT_MANAGERS in app-roles.ts).
 */
const salesPipelineNav = ({ projects = false, events = false } = {}): NavEntry[] => [
  OVERVIEW,
  { icon: ClipboardList, label: "My listings", to: "listings" },
  // Agents get the read-only projects browser for the Poster/Reels studios
  // (see ROLES_PROJECT_STUDIO_VIEWERS); team leaders / unit managers do not.
  ...(projects ? [PROJECTS] : []),
  REELS_MAKER,
  INVITE,
  // Team leaders manage events too (see ROLES_EVENT_MANAGERS).
  ...(events ? [EVENTS] : []),
  SALES_REPORTS,
  SUPPORT_TICKETS,
  BUSINESS_CARD,
]

/** secretary + team_secretary — paperwork support, no listings of their own. */
const SECRETARY_NAV: NavEntry[] = [
  OVERVIEW,
  SALES_REPORTS,
  SUPPORT_TICKETS,
  BUSINESS_CARD,
]

/** Signed-up public users: browse, plus the self-serve tools. */
const MEMBER_NAV: NavEntry[] = [
  OVERVIEW,
  // Absolute — these are the public pages, not dashboard routes.
  { icon: Building2, label: "Buy",  to: "/buy"  },
  { icon: KeyRound,  label: "Rent", to: "/rent" },
  BUSINESS_CARD,
  REELS_MAKER,
  // Read-only projects browser, same as agents (ROLES_PROJECT_STUDIO_VIEWERS).
  PROJECTS,
  // No "Profile" entry — the account card's dropdown already links to
  // {base}/profile as "Profile Settings" (see SidebarAccount in shell.tsx).
  SUPPORT_TICKETS,
]

/** One list per role. Exhaustive by construction — see the note at the top. */
const ROLE_NAV: Record<AppRoleId, NavEntry[]> = {
  super_admin:    ADMIN_NAV,
  admin:          ADMIN_NAV,
  editor:         EDITOR_NAV,
  developer:      DEVELOPER_NAV,
  team_leader:    salesPipelineNav({ events: true }),
  unit_manager:   salesPipelineNav(),
  agent:          salesPipelineNav({ projects: true }),
  secretary:      SECRETARY_NAV,
  team_secretary: SECRETARY_NAV,
  member:         MEMBER_NAV,
}

// ─── Resolution ───────────────────────────────────────────────────────────────

export function getRoleColor(role: string | null | undefined): string {
  return getRoleSidebarHex(role)
}

/** `to` → a real href against the role's dashboard base. */
function hrefFor(base: string, to: string): string {
  if (!to) return base
  if (to.startsWith("/")) return to
  return `${base}/${to}`
}

export function getSidebarNavItems(role: string | null | undefined): NavItem[] {
  // Unknown roles resolve to member, so ROLE_NAV always has a list.
  const roleId = resolveAppRoleOrMember(role)
  const base = ROLE_DASHBOARD_MAP[roleId] ?? ROLE_DASHBOARD_MAP.member

  return ROLE_NAV[roleId].map((entry) => ({
    icon: entry.icon,
    label: entry.label,
    href: hrefFor(base, entry.to),
    badge: entry.badge,
  }))
}
