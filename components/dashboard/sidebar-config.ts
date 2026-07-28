import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard, Users, Building2, Layers, Images,
  Briefcase, Landmark, ShoppingCart, Network, FolderOpen,
  Tag, TrendingUp, LifeBuoy, CreditCard, ClipboardList, KeyRound, User,
  Clapperboard, QrCode, ScrollText, Inbox, CalendarDays,
} from "lucide-react"
import {
  ROLE_DASHBOARD_MAP,
  getRoleSidebarHex,
  resolveAppRoleOrMember,
  roleInList,
  ROLES_SALES_PIPELINE,
  ROLES_SECRETARY_LIKE,
  type AppRoleId,
} from "@/lib/app-roles"

// ─── Base types ────────────────────────────────────────────────────────────────

export interface NavItem {
  icon: LucideIcon
  label: string
  href: string
  badge?: number
}

/** A standalone nav item with no parent group */
export interface NavStandaloneSection {
  type: "item"
  item: NavItem
}

/** A collapsible group of related nav items */
export interface NavGroupSection {
  type: "group"
  label: string
  items: NavItem[]
}

export type NavSection = NavStandaloneSection | NavGroupSection

function resolveRole(role: string | null | undefined): AppRoleId {
  return resolveAppRoleOrMember(role)
}

export function getRoleColor(role: string | null | undefined): string {
  return getRoleSidebarHex(role)
}

// ─── Grouped nav sections ──────────────────────────────────────────────────────

export function getSidebarNavSections(role: string | null | undefined): NavSection[] {
  const normalizedRole = resolveRole(role)
  const basePath = ROLE_DASHBOARD_MAP[normalizedRole] ?? ROLE_DASHBOARD_MAP.member

  if (normalizedRole === "super_admin" || normalizedRole === "admin") {
    return [
      {
        type: "item",
        item: { icon: LayoutDashboard, label: "Overview", href: basePath },
      },
      {
        type: "group",
        label: "User Management",
        items: [
          { icon: Users,      label: "Users", href: `${basePath}/users` },
          { icon: Network,    label: "Teams", href: `${basePath}/teams`  },
        ],
      },
      {
        type: "group",
        label: "Developer Management",
        items: [
          { icon: Building2,     label: "Developers",   href: `${basePath}/developers`      },
          { icon: FolderOpen,    label: "Projects",     href: `${basePath}/projects`        },
          { icon: ClipboardList, label: "All Listings", href: `${basePath}/listings`  },
        ],
      },
      {
        type: "group",
        label: "Finance",
        items: [
          { icon: Landmark,      label: "Tax Entities",        href: `${basePath}/tax-entities`       },
          { icon: ShoppingCart,  label: "Purchases",           href: `${basePath}/purchases`          },
          { icon: Tag,           label: "Purchase Categories", href: `${basePath}/purchase-categories` },
        ],
      },
      {
        type: "group",
        label: "Sales Management",
        items: [
          { icon: TrendingUp, label: "Sales Reports", href: `${basePath}/sales` },
        ],
      },
      {
        type: "item",
        item: { icon: CalendarDays, label: "Events", href: `${basePath}/events` },
      },
      {
        type: "group",
        label: "Support",
        items: [
          { icon: LifeBuoy, label: "Support Tickets", href: `${basePath}/support`              },
          { icon: Inbox,    label: "Contact Inbox",   href: `${basePath}/contact-inbox`  },
        ],
      },
      {
        type: "group",
        label: "System",
        items: [
          { icon: ScrollText, label: "System Logs", href: `${basePath}/system-logs` },
        ],
      },
      {
        type: "item",
        item: { icon: Clapperboard, label: "Reels Maker", href: `${basePath}/reels-maker` },
      },
      {
        type: "item",
        item: { icon: QrCode, label: "Invite", href: `${basePath}/invite` },
      },
      {
        type: "item",
        item: { icon: CreditCard, label: "Business Card", href: `${basePath}/business-card` },
      },
    ]
  }

  if (normalizedRole === "editor") {
    return [
      { type: "item", item: { icon: LayoutDashboard, label: "Overview", href: basePath } },
      {
        type: "group",
        label: "Content Management",
        items: [
          { icon: Building2,  label: "Developers", href: `${basePath}/developers` },
          { icon: FolderOpen, label: "Projects",   href: `${basePath}/projects`   },
        ],
      },
      { type: "item", item: { icon: CalendarDays, label: "Events", href: `${basePath}/events` } },
    ]
  }

  if (normalizedRole === "developer") {
    return [
      { type: "item", item: { icon: LayoutDashboard, label: "Overview",      href: basePath                } },
      { type: "item", item: { icon: Briefcase,       label: "Company Info",  href: `${basePath}/company`   } },
      { type: "item", item: { icon: Layers,          label: "My Projects",   href: `${basePath}/projects`  } },
      { type: "item", item: { icon: Images,          label: "Media / Files", href: `${basePath}/media`     } },
      { type: "item", item: { icon: LifeBuoy,        label: "Support Tickets", href: `${basePath}/support` } },
    ]
  }

  if (roleInList(normalizedRole, ROLES_SALES_PIPELINE)) {
    return [
      { type: "item", item: { icon: LayoutDashboard, label: "Overview", href: basePath } },
      { type: "item", item: { icon: ClipboardList, label: "My listings", href: `${basePath}/listings` } },
      { type: "item", item: { icon: Clapperboard, label: "Reels Maker", href: `${basePath}/reels-maker` } },
      { type: "item", item: { icon: QrCode, label: "Invite", href: `${basePath}/invite` } },
      // Team leaders manage events too (see ROLES_EVENT_MANAGERS); agents and
      // unit managers in this same branch do not.
      ...(normalizedRole === "team_leader"
        ? [{ type: "item" as const, item: { icon: CalendarDays, label: "Events", href: `${basePath}/events` } }]
        : []),
      {
        type: "group",
        label: "Sales Management",
        items: [
          { icon: TrendingUp, label: "Sales Reports", href: `${basePath}/sales` },
        ],
      },
      {
        type: "group",
        label: "Support",
        items: [
          { icon: LifeBuoy, label: "Support Tickets", href: `${basePath}/support` },
        ],
      },
      { type: "item", item: { icon: CreditCard, label: "Business Card", href: `${basePath}/business-card` } },
    ]
  }

  if (roleInList(normalizedRole, ROLES_SECRETARY_LIKE)) {
    return [
      { type: "item", item: { icon: LayoutDashboard, label: "Overview", href: basePath } },
      {
        type: "group",
        label: "Sales Management",
        items: [
          { icon: TrendingUp, label: "Sales Reports", href: `${basePath}/sales` },
        ],
      },
      {
        type: "group",
        label: "Support",
        items: [
          { icon: LifeBuoy, label: "Support Tickets", href: `${basePath}/support` },
        ],
      },
      { type: "item", item: { icon: CreditCard, label: "Business Card", href: `${basePath}/business-card` } },
    ]
  }

  if (normalizedRole === "member") {
    return [
      { type: "item", item: { icon: LayoutDashboard, label: "Overview", href: basePath } },
      {
        type: "group",
        label: "Browse listings",
        items: [
          { icon: Building2, label: "Buy", href: "/buy" },
          { icon: KeyRound, label: "Rent", href: "/rent" },
        ],
      },
      {
        type: "group",
        label: "Tools",
        items: [
          { icon: CreditCard, label: "Business Card", href: `${basePath}/business-card` },
          { icon: Clapperboard, label: "Reels Maker", href: `${basePath}/reels-maker` },
        ],
      },
      { type: "item", item: { icon: User, label: "Profile", href: `${basePath}/profile` } },
      {
        type: "group",
        label: "Support",
        items: [
          { icon: LifeBuoy, label: "Support Tickets", href: `${basePath}/support` },
        ],
      },
    ]
  }

  // Unknown roles resolve to member in UI; if we ever hit here with another id, keep minimal nav
  return [
    { type: "item", item: { icon: LayoutDashboard, label: "Overview", href: basePath } },
    { type: "item", item: { icon: LifeBuoy, label: "Support Tickets", href: `${basePath}/support` } },
  ]
}

// ─── Backward-compat flat list ─────────────────────────────────────────────────

export function getSidebarNavItems(role: string | null | undefined): NavItem[] {
  return getSidebarNavSections(role).flatMap(section =>
    section.type === "item" ? [section.item] : section.items
  )
}
