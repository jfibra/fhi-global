import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard, Users, Building2, UsersRound, Layers, Images,
  Briefcase, Landmark, ShoppingCart, Network, FolderOpen,
  Tag, TrendingUp, LifeBuoy, CreditCard,
} from "lucide-react"

// â”€â”€â”€ Base types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Role configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ROLE_BASE_PATH: Record<string, string> = {
  super_admin:    "/dashboard/superadmin",
  admin:          "/dashboard/admin",
  team_leader:    "/dashboard/teamleader",
  unit_manager:   "/dashboard/unitmanager",
  agent:          "/dashboard/agent",
  secretary:      "/dashboard/secretary",
  team_secretary: "/dashboard/teamsecretary",
  member:         "/dashboard/member",
  developer:      "/dashboard/developer",
}

export const ROLE_COLOR: Record<string, string> = {
  super_admin:    "#7c3aed",
  admin:          "#0ea5e9",
  team_leader:    "#10b981",
  unit_manager:   "#f59e0b",
  agent:          "#d6b357",
  secretary:      "#f43f5e",
  team_secretary: "#14b8a6",
  member:         "#64748b",
  developer:      "#6366f1",
}

function resolveRole(role: string | null | undefined): string {
  const r = String(role ?? "").toLowerCase().trim()
  if (!r) return "member"
  return ROLE_BASE_PATH[r] ? r : "member"
}

export function getRoleColor(role: string | null | undefined): string {
  return ROLE_COLOR[resolveRole(role)]
}

// â”€â”€â”€ Grouped nav sections â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function getSidebarNavSections(role: string | null | undefined): NavSection[] {
  const normalizedRole = resolveRole(role)
  const basePath = ROLE_BASE_PATH[normalizedRole]

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

  if (["team_leader", "unit_manager", "agent"].includes(normalizedRole)) {
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

  if (["secretary", "team_secretary"].includes(normalizedRole)) {
    return [
      { type: "item", item: { icon: LayoutDashboard, label: "Overview",       href: basePath } },
      { type: "item", item: { icon: LifeBuoy,        label: "Support Tickets", href: "/dashboard/support" } },
      { type: "item", item: { icon: CreditCard,      label: "Business Card",   href: `${basePath}/business-card` } },
    ]
  }

  // All other roles â€” flat overview only
  return [
    { type: "item", item: { icon: LayoutDashboard, label: "Overview", href: basePath } },
    { type: "item", item: { icon: LifeBuoy, label: "Support Tickets", href: "/dashboard/support" } },
  ]
}

// â”€â”€â”€ Backward-compat flat list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function getSidebarNavItems(role: string | null | undefined): NavItem[] {
  return getSidebarNavSections(role).flatMap(section =>
    section.type === "item" ? [section.item] : section.items
  )
}
