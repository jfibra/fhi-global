"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { getNavTrail } from "@/components/dashboard/sidebar-config"
import { ROLE_DASHBOARD_MAP, resolveAppRoleOrMember } from "@/lib/app-roles"

/**
 * Route-driven breadcrumb, rendered once in the shell above the page.
 *
 * Labels come from sidebar-config rather than the URL: a hub item's page lives
 * nested under its hub's own route folder (/admin/communication/support), so
 * the hub segment IS in the path — getNavTrail just turns "communication" +
 * "support" into their sidebar labels ("Communication" › "Support Tickets")
 * instead of raw slugs. Anything below a nav destination (detail routes like
 * /admin/communication/support/<uuid>, or /admin/sales/<uuid> for a plain
 * non-hub page) is appended, with id segments shown as "Details".
 */

/**
 * Paths that share a URL prefix with a nav destination but are NOT a sub-view of
 * it, so the trail must not nest them underneath. Keyed by the path relative to
 * the role's dashboard base.
 *
 * `sales/encode` is the case that matters: Encode Sale writes a new sale and is
 * reached only from the sidebar's own Encode Sale button — Sales Reports (which
 * views existing sales) never links to it. Nesting it would read as though you
 * encode a sale from inside the reports.
 */
const STANDALONE: Record<string, string> = {
  "sales/encode": "Encode Sale",
}

// Segments that aren't nav destinations and don't title-case cleanly.
const LABELS: Record<string, string> = {
  // Sale-type reports — real routes, see SALE_TYPE_SLUGS in sales-table.tsx.
  "project-sale": "Project Sale",
  "brokerage-sale": "Brokerage",
  rental: "Rental",
  profile: "Profile Settings",
  "system-logs": "Activity Logs",
  "contact-inbox": "Contact Inbox",
  "purchase-categories": "Purchase Categories",
  "tax-entities": "Tax Entities",
  "business-card": "Business Card",
  "reels-maker": "Reels Maker",
  "agent-resource": "Agent Resource",
  sales: "Sales Reports",
  support: "Support Tickets",
  users: "Account Directory",
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isDetailSegment = (seg: string) => UUID_RE.test(seg) || /^\d+$/.test(seg)

const humanize = (seg: string) => seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

const labelFor = (seg: string) =>
  isDetailSegment(seg) ? "Details" : (LABELS[seg] ?? humanize(seg))

export function DashboardBreadcrumb() {
  const pathname = usePathname()
  const { profile } = useAuth()

  const roleId = resolveAppRoleOrMember(profile?.role)
  const base = ROLE_DASHBOARD_MAP[roleId] ?? ROLE_DASHBOARD_MAP.member

  if (!pathname || !pathname.startsWith(base)) return null

  const crumbs: Array<{ label: string; href: string }> = [{ label: "Dashboard", href: base }]

  // A standalone feature that merely shares a prefix — never nested (see above).
  const relative = pathname.slice(base.length).replace(/^\/+/, "")
  const standalone = STANDALONE[relative]
  if (standalone) {
    crumbs.push({ label: standalone, href: pathname })
    return <CrumbBar crumbs={crumbs} />
  }

  // Walk up from the full path until we hit a known nav destination; whatever we
  // dropped on the way down is the detail tail (e.g. the <uuid> of a sale).
  const segs = pathname.split("/").filter(Boolean)
  let matched: Array<{ label: string; href: string }> = []
  let tailFrom = segs.length

  for (let end = segs.length; end > 1; end--) {
    const candidate = "/" + segs.slice(0, end).join("/")
    const trail = getNavTrail(profile?.role, candidate)
    if (trail.length) {
      matched = trail
      tailFrom = end
      break
    }
  }

  if (matched.length) {
    crumbs.push(...matched)
  } else if (segs.length > 1) {
    // Not a nav destination at all (e.g. /admin/sales/encode's parent chain) —
    // fall back to the URL so the trail is still complete.
    tailFrom = 1
  }

  for (let i = tailFrom; i < segs.length; i++) {
    crumbs.push({ label: labelFor(segs[i]), href: "/" + segs.slice(0, i + 1).join("/") })
  }

  // The dashboard root needs no trail of its own.
  if (crumbs.length === 1) return null

  return <CrumbBar crumbs={crumbs} />
}

function CrumbBar({ crumbs }: { crumbs: Array<{ label: string; href: string }> }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[#e8eaed] bg-white px-6 py-2 scrollbar-none"
    >
      {crumbs.map((crumb, i) => {
        const isCurrent = i === crumbs.length - 1
        return (
          <span key={`${crumb.href}-${i}`} className="flex shrink-0 items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#d1d5db]" />}
            {isCurrent ? (
              <span aria-current="page" className="whitespace-nowrap text-[13px] font-bold text-[#0d1117]">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="whitespace-nowrap text-[13px] font-semibold text-[#6b7280] transition-colors hover:text-[#001f3f] hover:underline"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
