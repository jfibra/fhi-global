import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard, Users, Building2, Layers, Images,
  Briefcase, Landmark, ShoppingCart, Network, FolderOpen,
  Tag, TrendingUp, LifeBuoy, CreditCard, ClipboardList, KeyRound,
  Clapperboard, LayoutTemplate, QrCode, ScrollText, Inbox, CalendarDays,
  Wallet, MessagesSquare, FileText, UploadCloud, Globe, FolderDown, Library,
  Mail, PanelsTopLeft, FileSignature, Star, Handshake, Presentation, Wand2, Sparkles,
} from "lucide-react"
import {
  ROLE_DASHBOARD_MAP,
  getRoleSidebarHex,
  resolveAppRoleOrMember,
  type AppRoleId,
} from "@/lib/app-roles"

// ─── How to maintain this file ────────────────────────────────────────────────
//
// Every role owns ONE list, all of them collected in ROLE_NAV at the bottom. To
// change a role's sidebar, edit that role's list — nothing else. Order in the
// list is order in the sidebar.
//
// A list holds entries, groups, or both:
//
//   • a bare NavEntry      → one plain row in the sidebar, links straight to the page
//   • a NavGroupEntry      → ONE row in the sidebar (the group's own label + icon)
//                            that opens a hub page of bento tiles, one per item
//
// So a group is never a header with children in the sidebar — it collapses to a
// single clickable row, and its items only appear as tiles on the hub page. This
// is the pattern filipinohomes-final uses for its admin dashboard.
//
// A group with exactly ONE item is pointless as a hub, so it degrades to a
// direct link to that item — no group uses that today, but it means you can add
// a group of one without it becoming a dead one-tile page.
//
// `to` is relative to the role's own dashboard base (`ROLE_DASHBOARD_MAP`), so
// the lists never repeat `/admin` / `/agent` / … and a role's whole subtree can
// be re-slugged in app-roles.ts without touching this file:
//
//   to: ""            → the role's dashboard root      (/agent)
//   to: "listings"    → a page under it                (/agent/listings)
//   to: "/buy"        → left alone (leading slash = absolute, public pages)
//
// A group's own `to` is its hub route and needs a matching folder under
// app/(users)/{role}/ for EVERY role that uses the list (admin + superadmin) —
// a four-line wrapper rendering <HubPage hub="…" />. Each ITEM inside the group
// then needs its own page nested one level further in, under that same hub
// folder (app/(users)/{role}/{hub}/{item}/…) — hubItemHref() is what builds
// that nested href, so a hub tile, a search result, and a browser URL bar all
// agree on where an item actually lives, and the sidebar's hub row stays
// highlighted (via prefix match in shell.tsx) while you're anywhere under it.
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
  /** Row only renders when the signed-in profile has a personal mailbox. */
  requiresMailbox?: boolean
  /** One-liner under the label on the hub tile. Only used inside a group. */
  description?: string
  /** Which format mockup the hub tile shows (see hub-tile-mockups.tsx). */
  mock?: string
}

/** A set of entries reachable through one sidebar row → a hub page of tiles. */
export interface NavGroupEntry {
  /** Sidebar row label, and the hub page's heading. */
  group: string
  /** The hub route, relative to the role's dashboard base. */
  to: string
  /** Sidebar row icon. */
  icon: LucideIcon
  items: NavEntry[]
}

/** One line in a role's list: a standalone entry or a group of them. */
export type RoleNavEntry = NavEntry | NavGroupEntry

/** A resolved sidebar row — what the shell renders. */
export interface NavItem {
  icon: LucideIcon
  label: string
  href: string
  badge?: number
}

/** A resolved hub tile — what HubTileGrid renders. */
export interface HubTile {
  icon: LucideIcon
  label: string
  href: string
  description: string
  mock?: string
}

/** A destination the topbar search can jump to. */
export interface NavSearchTarget {
  icon: LucideIcon
  label: string
  href: string
  /** The hub this sits under, shown as a muted hint. Absent for top-level rows. */
  group?: string
}

const isGroup = (entry: RoleNavEntry): entry is NavGroupEntry => "group" in entry

// ─── Shared entries ───────────────────────────────────────────────────────────
// Reused across several roles. Defined once so a label or icon change lands
// everywhere it should; anything role-specific stays inline in that role's list.

const OVERVIEW: NavEntry = { icon: LayoutDashboard, label: "Overview", to: "" }
const EVENTS: NavEntry = { icon: CalendarDays, label: "Events", to: "events" }
const PROJECTS: NavEntry = { icon: FolderOpen, label: "Projects", to: "projects" }
const INVITE: NavEntry = { icon: QrCode, label: "Invite", to: "invite" }
const REELS_MAKER: NavEntry = { icon: Clapperboard, label: "Reels Maker", to: "reels-maker" }
const PHOTO_STUDIO: NavEntry = { icon: Wand2, label: "AI Photo Studio", to: "photo-studio" }
const POSTER_MAKER: NavEntry = { icon: LayoutTemplate, label: "Poster Maker", to: "poster-maker" }
const BUSINESS_CARD: NavEntry = { icon: CreditCard, label: "Business Card", to: "business-card" }
const WEBSITE_BUILDER: NavEntry = { icon: PanelsTopLeft, label: "Website Builder", to: "website-builder" }
const DIGITAL_CARD: NavEntry = { icon: Globe, label: "Digital Business Card", to: "digital-business-card" }
const SALES_REPORTS: NavEntry = { icon: TrendingUp, label: "Sales Reports", to: "sales" }
const SUPPORT_TICKETS: NavEntry = { icon: LifeBuoy, label: "Support Tickets", to: "support" }
const FEEDBACK: NavEntry = { icon: Star, label: "Customer Feedback", to: "feedback" }
const A2A_AGREEMENT: NavEntry = { icon: Handshake, label: "A2A Agreement", to: "a2a-agreement" }
// Personal company mailbox (profiles.mailbox_address) — compose + own Sent.
const MY_EMAILS: NavEntry = { icon: Mail, label: "Emails", to: "leads", requiresMailbox: true }
// Shared marketing artwork. Open to every role, so it appears in all lists and
// is deliberately absent from SUB_PATH_ROLES in lib/auth.ts (unlisted = shared).
const MATERIALS: NavEntry = { icon: FolderDown, label: "Materials", to: "materials" }
// Training PDFs, also open to every role — likewise absent from SUB_PATH_ROLES.
const EBOOKS: NavEntry = { icon: Library, label: "Ebooks", to: "ebooks" }
// Owner document intake (NOC / Trakheesi) — sales pipeline + admin. Access is
// gated by SUB_PATH_ROLES["owner-documents"] in lib/auth.ts.
const OWNER_DOCUMENTS: NavEntry = { icon: FileSignature, label: "Owner Documents", to: "owner-documents" }

// ─── Per-role lists ───────────────────────────────────────────────────────────

/** super_admin + admin — the full back office, behind five hub pages. */
const ADMIN_NAV: RoleNavEntry[] = [
  OVERVIEW,
  // Top-level rather than inside the Communication hub: fresh leads are the
  // first thing admins check, so they sit one click away right under Overview.
  // Gmail-style client — leads read as an inbox, replies go out as real email.
  { icon: Mail, label: "Emails", to: "leads" },
  // The one-stop analytics assistant — answers from live queries, admin only.
  { icon: Sparkles, label: "FHI Chat", to: "fhi-chat" },
  {
    group: "Accounts & Invites",
    to: "accounts",
    icon: Users,
    items: [
      { icon: Users, label: "Account Directory", to: "users", description: "Every account, their role and status." },
      { ...INVITE,                                            description: "Invite links for onboarding new accounts." },
    ],
  },
  { icon: Network, label: "Teams", to: "teams" },
  {
    group: "Properties & Developers",
    to: "properties",
    icon: Building2,
    items: [
      { icon: Building2,     label: "Developers", to: "developers", description: "Developer companies and their profiles." },
      { ...PROJECTS,                                                description: "Developments, units and their media." },
      { icon: ClipboardList, label: "Listings",   to: "listings",   description: "Every listing across all agents." },
    ],
  },
  OWNER_DOCUMENTS,
  {
    group: "Finance",
    to: "finance",
    icon: Wallet,
    items: [
      { icon: ShoppingCart, label: "Purchases",           to: "purchases",           description: "Recorded company purchases.", mock: "purchases" },
      { icon: Tag,          label: "Purchase Categories", to: "purchase-categories", description: "Categories purchases are filed under.", mock: "purchase-categories" },
      { icon: Landmark,     label: "Tax Entities",        to: "tax-entities",        description: "Entities purchases and sales are booked to.", mock: "tax-entities" },
    ],
  },
  // Sales Reports sits at the top level rather than inside the Finance hub: it is
  // the most-visited page in that group, and every other role that can see it
  // (sales pipeline, secretaries) already reaches it in one click.
  SALES_REPORTS,
  EVENTS,
  {
    group: "Agent Resource",
    to: "agent-resource",
    icon: FileText,
    items: [
      { ...BUSINESS_CARD,  description: "Your shareable digital business card.", mock: "business-card" },
      { ...DIGITAL_CARD, description: "The one link you share — contacts, socials and QR.", mock: "digital-business-card" },
      { ...REELS_MAKER,   description: "Turn a listing or project into a shareable reel.", mock: "reels-maker" },
      { ...PHOTO_STUDIO, description: "Stage a photo with AI — add people, furniture or landscaping.", mock: "photo-studio" },
      { ...POSTER_MAKER,  description: "Flyers and posters from any listing or project.", mock: "poster-maker" },
      { icon: Presentation, label: "Meeting Poster", to: "meeting-poster", description: "Event posters with your choice of speakers.", mock: "meeting-poster" },
      { ...WEBSITE_BUILDER, description: "Build and edit your personal agent website.", mock: "website-builder" },
      { ...A2A_AGREEMENT,   description: "Fillable agent-to-agent collaboration agreement.", mock: "a2a-agreement" },
    ],
  },
  {
    group: "Communication",
    to: "communication",
    icon: MessagesSquare,
    items: [
      { icon: Inbox, label: "Contact Inbox", to: "contact-inbox", description: "Enquiries sent from the public site.", mock: "contact-inbox" },
      { ...SUPPORT_TICKETS,                                        description: "Tickets raised by agents and clients.", mock: "support-tickets" },
    ],
  },
  // Marketing artwork + training PDFs, grouped under one hub (same as the sales roles).
  {
    group: "Library",
    to: "library",
    icon: Library,
    items: [
      { ...MATERIALS, description: "Branded marketing artwork to download and share.", mock: "materials" },
      { ...EBOOKS,    description: "Training guides and reference PDFs.", mock: "ebooks" },
    ],
  },
  { icon: ScrollText, label: "Activity Logs", to: "system-logs" },
  // Dev-only test bench for the upload-compression pipeline
  // (lib/upload/compress-image.ts) — not a real business feature, just a way
  // to throw arbitrary images at the exact same server-side compression every
  // upload route runs. Admin staff only; safe to remove once that pipeline's
  // behavior is no longer in question.
  { icon: UploadCloud, label: "Upload Test", to: "upload-test" },
]

/** Content-only role: developers + projects, no admin powers. */
const EDITOR_NAV: RoleNavEntry[] = [
  OVERVIEW,
  { icon: Building2, label: "Developers", to: "developers" },
  PROJECTS,
  EVENTS,
  MATERIALS,
  EBOOKS,
]

/** External developer partners — their own company and projects only. */
const DEVELOPER_NAV: RoleNavEntry[] = [
  OVERVIEW,
  { icon: Briefcase, label: "Company Info",  to: "company"  },
  { icon: Layers,    label: "My Projects",   to: "projects" },
  { icon: Images,    label: "Media / Files", to: "media"    },
  // No MATERIALS / EBOOKS here: those are internal-only (see
  // ROLES_INTERNAL_RESOURCES in app-roles.ts), and developers are external
  // partner accounts.
  SUPPORT_TICKETS,
]

/**
 * agent / team_leader / unit_manager — identical apart from the extras a
 * particular rank gets (team leaders also manage events, per
 * ROLES_EVENT_MANAGERS in app-roles.ts).
 */
const salesPipelineNav = ({ projects = false, events = false, teamSales = false } = {}): RoleNavEntry[] => [
  OVERVIEW,
  { icon: ClipboardList, label: "My listings", to: "listings" },
  OWNER_DOCUMENTS,
  MY_EMAILS,
  // The read-only projects browser for the Poster/Reels studios — the whole
  // sales ladder has it (see ROLES_PROJECT_STUDIO_VIEWERS).
  ...(projects ? [PROJECTS] : []),
  INVITE,
  // Team leaders manage events too (see ROLES_EVENT_MANAGERS).
  ...(events ? [EVENTS] : []),
  SALES_REPORTS,
  // Team leaders / unit managers see their whole team's production
  // (keep in sync with "team-sales" in SUB_PATH_ROLES, lib/auth.ts).
  ...(teamSales ? [{ icon: Users, label: "Team Sales", to: "team-sales" } satisfies NavEntry] : []),
  FEEDBACK,
  SUPPORT_TICKETS,
  // The agent toolkit, consolidated into one hub row (mirrors admin's Agent
  // Resource). Each tile lives at agent-resource/{item} — see the matching
  // route folders under app/(users)/{agent,teamleader,unitmanager}/agent-resource.
  {
    group: "Agent Resource",
    to: "agent-resource",
    icon: FileText,
    items: [
      { ...BUSINESS_CARD,   description: "Your shareable digital business card.", mock: "business-card" },
      { ...DIGITAL_CARD,    description: "The one link you share — contacts, socials and QR.", mock: "digital-business-card" },
      { ...REELS_MAKER,     description: "Turn a listing or project into a shareable reel.", mock: "reels-maker" },
      { ...POSTER_MAKER,    description: "Flyers and posters from any listing or project.", mock: "poster-maker" },
      { ...WEBSITE_BUILDER, description: "Build and edit your personal agent website.", mock: "website-builder" },
      { ...A2A_AGREEMENT,   description: "Fillable agent-to-agent collaboration agreement.", mock: "a2a-agreement" },
    ],
  },
  // Marketing artwork + training PDFs, grouped under one hub.
  {
    group: "Library",
    to: "library",
    icon: Library,
    items: [
      { ...MATERIALS, description: "Branded marketing artwork to download and share.", mock: "materials" },
      { ...EBOOKS,    description: "Training guides and reference PDFs.", mock: "ebooks" },
    ],
  },
]

/** secretary + team_secretary — paperwork support, no listings of their own. */
const SECRETARY_NAV: RoleNavEntry[] = [
  OVERVIEW,
  SALES_REPORTS,
  SUPPORT_TICKETS,
  BUSINESS_CARD,
  DIGITAL_CARD,
  MATERIALS,
  EBOOKS,
]

/** Signed-up public users: browse, plus the self-serve tools. */
const MEMBER_NAV: RoleNavEntry[] = [
  OVERVIEW,
  // Absolute — these are the public pages, not dashboard routes.
  { icon: Building2, label: "Buy",  to: "/buy"  },
  { icon: KeyRound,  label: "Rent", to: "/rent" },
  BUSINESS_CARD,
  DIGITAL_CARD,
  REELS_MAKER,
  // Read-only projects browser, same as agents (ROLES_PROJECT_STUDIO_VIEWERS).
  PROJECTS,
  MATERIALS,
  EBOOKS,
  // No "Profile" entry — the account card's dropdown already links to
  // {base}/profile as "Profile Settings" (see SidebarAccount in shell.tsx).
  SUPPORT_TICKETS,
]

/** One list per role. Exhaustive by construction — see the note at the top. */
const ROLE_NAV: Record<AppRoleId, RoleNavEntry[]> = {
  super_admin:    ADMIN_NAV,
  admin:          ADMIN_NAV,
  editor:         EDITOR_NAV,
  developer:      DEVELOPER_NAV,
  team_leader:    salesPipelineNav({ projects: true, events: true, teamSales: true }),
  unit_manager:   salesPipelineNav({ projects: true, teamSales: true }),
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

/**
 * A hub sub-item's href, nested under its own hub's path — /admin/communication/support,
 * not /admin/support. Every page inside a hub folder actually lives on disk
 * under that hub's route folder (app/(users)/{role}/{hub}/{item}/…), so this is
 * what keeps the sidebar's hub row highlighted while browsing inside it: the
 * hub genuinely is an ancestor of the URL, not just a conceptual grouping.
 *
 * Not used for the single-item collapse case (see the `only` branches above) —
 * a one-item group bypasses its hub folder entirely and links straight to the
 * item, so that item's own `to` is used unprefixed there.
 */
function hubItemHref(base: string, group: NavGroupEntry, item: NavEntry): string {
  return hrefFor(base, `${group.to}/${item.to}`)
}

function baseFor(role: string | null | undefined): string {
  // Unknown roles resolve to member, so ROLE_NAV always has a list.
  const roleId = resolveAppRoleOrMember(role)
  return ROLE_DASHBOARD_MAP[roleId] ?? ROLE_DASHBOARD_MAP.member
}

function listFor(role: string | null | undefined): RoleNavEntry[] {
  return ROLE_NAV[resolveAppRoleOrMember(role)]
}

/** The sidebar rows for a role. Groups collapse to one row each. */
export function getSidebarNavItems(
  role: string | null | undefined,
  opts: { hasMailbox?: boolean } = {},
): NavItem[] {
  const base = baseFor(role)

  return listFor(role)
    .filter((entry) => isGroup(entry) || !entry.requiresMailbox || opts.hasMailbox)
    .map((entry) => {
    if (!isGroup(entry)) {
      return { icon: entry.icon, label: entry.label, href: hrefFor(base, entry.to), badge: entry.badge }
    }
    // A single-item group isn't worth a hub — link straight to the item, but
    // keep the group's label so the sidebar still reads as the group.
    const only = entry.items.length === 1 ? entry.items[0] : null
    return {
      icon: entry.icon,
      label: entry.group,
      href: hrefFor(base, only ? only.to : entry.to),
    }
  })
}

/**
 * Every destination this role can reach, flattened for the topbar search.
 *
 * This is why the search matters under the hub model: admin's sidebar shows
 * nine rows, but the pages inside the hubs (Account Directory, Purchases,
 * Contact Inbox …) are two clicks away and invisible until you open the hub.
 * Search surfaces them directly, tagged with the hub they live under.
 */
export function getSearchTargets(role: string | null | undefined): NavSearchTarget[] {
  const base = baseFor(role)
  const out: NavSearchTarget[] = []

  for (const entry of listFor(role)) {
    if (!isGroup(entry)) {
      out.push({ icon: entry.icon, label: entry.label, href: hrefFor(base, entry.to) })
      continue
    }
    // The hub page itself, then each page inside it.
    const only = entry.items.length === 1 ? entry.items[0] : null
    out.push({
      icon: entry.icon,
      label: entry.group,
      href: hrefFor(base, only ? only.to : entry.to),
    })
    if (only) continue
    for (const item of entry.items) {
      out.push({
        icon: item.icon,
        label: item.label,
        href: hubItemHref(base, entry, item),
        group: entry.group,
      })
    }
  }

  return out
}

/** The tiles for one hub page, or null if this role has no such hub. */
/**
 * Where `pathname` sits in this role's nav: the hub that owns it (if any),
 * then the page itself. Empty when the path isn't a nav destination.
 *
 * Hub sub-item routes are nested under their hub (/admin/communication/support),
 * so most of this now falls out of a plain href match. This still earns its
 * keep for the STANDALONE case in dashboard-breadcrumb.tsx (a page that shares
 * a URL prefix with a nav destination but isn't a sub-view of it) and for
 * detail routes below a nav destination (e.g. /admin/communication/support/<uuid>),
 * which the breadcrumb resolves by walking up the path until a prefix here
 * matches, then appending whatever it trimmed off as the tail.
 */
export function getNavTrail(
  role: string | null | undefined,
  pathname: string,
): Array<{ label: string; href: string }> {
  const base = baseFor(role)

  for (const entry of listFor(role)) {
    if (!isGroup(entry)) {
      if (hrefFor(base, entry.to) === pathname) {
        return [{ label: entry.label, href: pathname }]
      }
      continue
    }

    // Single-item groups collapse to their item — mirror getSidebarNavItems.
    const only = entry.items.length === 1 ? entry.items[0] : null
    const hubHref = hrefFor(base, only ? only.to : entry.to)
    if (hubHref === pathname) return [{ label: entry.group, href: hubHref }]
    if (only) continue

    for (const item of entry.items) {
      const itemHref = hubItemHref(base, entry, item)
      if (itemHref === pathname) {
        return [
          { label: entry.group, href: hubHref },
          { label: item.label, href: itemHref },
        ]
      }
    }
  }

  return []
}

export function getHubTiles(
  role: string | null | undefined,
  hub: string,
): { title: string; tiles: HubTile[] } | null {
  const base = baseFor(role)
  const group = listFor(role).find((e): e is NavGroupEntry => isGroup(e) && e.to === hub)
  if (!group) return null

  return {
    title: group.group,
    tiles: group.items.map((item) => ({
      icon: item.icon,
      label: item.label,
      href: hubItemHref(base, group, item),
      description: item.description ?? "",
      mock: item.mock,
    })),
  }
}
