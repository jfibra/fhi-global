import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard, Users, Building2, Layers, Images,
  Briefcase, Landmark, ShoppingCart, Network, FolderOpen,
  Tag, TrendingUp, LifeBuoy, CreditCard, ClipboardList, KeyRound, User,
  Clapperboard,
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
          { icon: Network,    label: "Teams", href: "/dashboard/teams"  },
        ],
      },
      {
        type: "group",
        label: "Developer Management",
        items: [
          { icon: Building2,  label: "Developers", href: "/dashboard/developers" },
          { icon: FolderOpen, label: "Projects",   href: "/dashboard/projects"   },
        ],
      },
      {
        type: "group",
        label: "Finance",
        items: [
          { icon: Landmark,      label: "Tax Entities",        href: "/dashboard/tax-entities"       },
          { icon: ShoppingCart,  label: "Purchases",           href: "/dashboard/purchases"          },
          { icon: Tag,           label: "Purchase Categories", href: "/dashboard/purchase-categories" },
        ],
      },
      {
        type: "group",
        label: "Sales Management",
        items: [
          { icon: TrendingUp, label: "Sales Reports", href: "/dashboard/sales" },
        ],
      },
      {
        type: "group",
        label: "Support",
        items: [
          { icon: LifeBuoy, label: "Support Tickets", href: "/dashboard/support" },
        ],
      },
      {
        type: "item",
        item: { icon: Clapperboard, label: "Reels Maker", href: "/dashboard/reels-maker" },
      },
      {
        type: "item",
        item: { icon: CreditCard, label: "Business Card", href: `${basePath}/business-card` },
      },
    ]
  }

  if (normalizedRole === "developer") {
    return [
      { type: "item", item: { icon: LayoutDashboard, label: "Overview",      href: basePath                } },
      { type: "item", item: { icon: Briefcase,       label: "Company Info",  href: `${basePath}/company`   } },
      { type: "item", item: { icon: Layers,          label: "My Projects",   href: `${basePath}/projects`  } },
      { type: "item", item: { icon: Images,          label: "Media / Files", href: `${basePath}/media`     } },
      { type: "item", item: { icon: LifeBuoy,        label: "Support Tickets", href: "/dashboard/support" } },
    ]
  }

  if (roleInList(normalizedRole, ROLES_SALES_PIPELINE)) {
    return [
      { type: "item", item: { icon: LayoutDashboard, label: "Overview", href: basePath } },
      { type: "item", item: { icon: ClipboardList, label: "My listings", href: "/dashboard/listings" } },
      { type: "item", item: { icon: Clapperboard, label: "Reels Maker", href: "/dashboard/reels-maker" } },
      {
        type: "group",
        label: "Sales Management",
        items: [
          { icon: TrendingUp, label: "Sales Reports", href: "/dashboard/sales" },
        ],
      },
      {
        type: "group",
        label: "Support",
        items: [
          { icon: LifeBuoy, label: "Support Tickets", href: "/dashboard/support" },
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
          { icon: TrendingUp, label: "Sales Reports", href: "/dashboard/sales" },
        ],
      },
      {
        type: "group",
        label: "Support",
        items: [
          { icon: LifeBuoy, label: "Support Tickets", href: "/dashboard/support" },
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
      { type: "item", item: { icon: User, label: "Profile", href: "/dashboard/profile" } },
      {
        type: "group",
        label: "Support",
        items: [
          { icon: LifeBuoy, label: "Support Tickets", href: "/dashboard/support" },
        ],
      },
    ]
  }

  // Unknown roles resolve to member in UI; if we ever hit here with another id, keep minimal nav
  return [
    { type: "item", item: { icon: LayoutDashboard, label: "Overview", href: basePath } },
    { type: "item", item: { icon: LifeBuoy, label: "Support Tickets", href: "/dashboard/support" } },
  ]
}

// ─── Backward-compat flat list ─────────────────────────────────────────────────

export function getSidebarNavItems(role: string | null | undefined): NavItem[] {
  return getSidebarNavSections(role).flatMap(section =>
    section.type === "item" ? [section.item] : section.items
  )
}
