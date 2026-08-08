import type { SupabaseClient } from "@supabase/supabase-js"
import {
  ROLE_DASHBOARD_MAP,
  ROLE_SLUGS,
  roleToLabel,
  roleToSlug,
  roleInList,
  normalizeAppRole,
  isSuperAdminRole,
  isDeveloperRole,
  ROLES_SALES_REPORTS_ACCESS,
  ROLES_SALES_PIPELINE,
  ROLES_REELS_MAKER,
  ROLES_PROJECT_STUDIO_VIEWERS,
  ROLES_INTERNAL_RESOURCES,
  ROLES_WEBSITE_BUILDER,
} from "@/lib/app-roles"

export type AppUser = {
  id: string
  email?: string | null
}

export type AppProfile = {
  id: string
  role: string | null
  fname: string | null
  lname: string | null
  fullname: string | null
  status: string | null
  profile_url: string | null
  metadata: Record<string, unknown> | null
  is_deleted?: boolean | null
  timezone: string | null
  birthday?: string | null
  gender?: string | null
}

export { ROLE_DASHBOARD_MAP, roleToLabel }

const ROLE_SLUG_SET = new Set(ROLE_SLUGS)

/**
 * First sub-segment after the role slug → role ids allowed to view it.
 * Anything not listed (the role landing, `profile`, `support`, `business-card`) is
 * shared and allowed for every role. Mirrors the sidebar in `sidebar-config.ts`.
 */
const SUB_PATH_ROLES: Record<string, readonly string[]> = {
  users: ["super_admin", "admin"],
  teams: ["super_admin", "admin"],
  developers: ["super_admin", "admin", "editor"],
  events: ["super_admin", "admin", "team_leader", "editor"], // keep in sync with ROLES_EVENT_MANAGERS in app-roles.ts
  "tax-entities": ["super_admin", "admin"],
  purchases: ["super_admin", "admin"],
  "purchase-categories": ["super_admin", "admin"],
  "contact-inbox": ["super_admin", "admin"],
  "system-logs": ["super_admin", "admin"],
  listings: ["super_admin", "admin", "agent", "team_leader", "unit_manager"],
  "owner-documents": ["super_admin", "admin", "agent", "team_leader", "unit_manager"],
  // Content managers + developers get the full editor; studio viewers get read-only.
  projects: ["super_admin", "admin", "developer", "editor", ...ROLES_PROJECT_STUDIO_VIEWERS],
  company: ["developer"],
  media: ["developer"],
  sales: [...ROLES_SALES_REPORTS_ACCESS],
  "reels-maker": [...ROLES_REELS_MAKER],
  "website-builder": [...ROLES_WEBSITE_BUILDER],
  "team-sales": ["team_leader", "unit_manager"],
  // Customer feedback — the sales ladder collects reviews on themselves.
  feedback: [...ROLES_SALES_PIPELINE],
  // Internal only — external developer partners don't get our marketing
  // artwork or training library.
  materials: [...ROLES_INTERNAL_RESOURCES],
  ebooks: [...ROLES_INTERNAL_RESOURCES],
  // Keep in sync with INVITE_GRANTABLE_ROLES in app-roles.ts, which decides what
  // each of these ranks may then set on a recruit. Members are deliberately
  // excluded — they don't recruit.
  invite: ["super_admin", "admin", "agent", "team_leader", "unit_manager"],
}

export function getDashboardRouteByRole(role?: string | null) {
  const normalizedRole = normalizeAppRole(role)
  if (!normalizedRole) return "/member"
  return ROLE_DASHBOARD_MAP[normalizedRole] ?? "/member"
}

/** After login: allow `/buy` or `/rent` as safe relative targets (open redirect safe). */
export function pickSafePostLoginRedirect(nextRaw: string | null | undefined, role: string | null | undefined): string {
  const fallback = getDashboardRouteByRole(role)
  const raw = String(nextRaw ?? "").trim()
  if (!raw) return fallback
  if (raw.includes("://") || raw.startsWith("//")) return fallback
  if (!raw.startsWith("/")) return fallback
  let pathname = ""
  let search = ""
  try {
    const u = new URL(raw, "https://internal.invalid")
    pathname = u.pathname
    search = u.search
  } catch {
    return fallback
  }
  if (pathname !== "/buy" && pathname !== "/rent") return fallback
  return pathname + search
}

export function canAccessDashboardPath(pathname: string, role?: string | null) {
  const normalizedRole = normalizeAppRole(role)
  const segments = pathname.split("/").filter(Boolean)
  const slug = segments[0] ?? ""

  // Not a role-prefixed dashboard path (e.g. the `/dashboard` redirect stub) → allow.
  if (!ROLE_SLUG_SET.has(slug)) return true

  // Super admin can access every role's dashboard.
  if (isSuperAdminRole(normalizedRole)) return true

  // Otherwise the URL's role slug must be the user's own.
  if (slug !== roleToSlug(normalizedRole)) return false

  const sub = segments[1]
  if (!sub) return true // role landing

  const allowedRoles = SUB_PATH_ROLES[sub]
  if (!allowedRoles) return true // shared page (profile, support, business-card, …)
  return roleInList(normalizedRole, allowedRoles)
}

export function isInactiveProfile(profile: Pick<AppProfile, "status"> & { is_deleted?: boolean | null }) {
  return profile.status !== "active" || profile.is_deleted === true
}

export async function getProfileByUserId(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, fullname, status, profile_url, metadata, is_deleted, fname, lname, timezone, birthday, gender")
    .eq("id", userId)
    .single<AppProfile>()

  return { profile: data, error }
}

export async function ensureProfileForUser(
  supabase: SupabaseClient,
  user: {
    id: string
    email?: string | null
    user_metadata?: Record<string, unknown> | null
  },
) {
  const current = await getProfileByUserId(supabase, user.id)
  if (current.profile) {
    return current
  }

  if (current.error && current.error.code && current.error.code !== "PGRST116") {
    return current
  }

  const metadata = user.user_metadata ?? {}
  const fname = typeof metadata.first_name === "string"
    ? metadata.first_name.trim()
    : typeof metadata.fname === "string"
      ? metadata.fname.trim()
      : ""

  const lname = typeof metadata.last_name === "string"
    ? metadata.last_name.trim()
    : typeof metadata.lname === "string"
      ? metadata.lname.trim()
      : ""

  const fullname = [fname, lname].filter(Boolean).join(" ").trim() || (user.email ?? "User")

  const { error: bootstrapError } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      fname: fname || null,
      lname: lname || null,
      fullname,
      profile_url: typeof metadata.avatar_url === "string" ? metadata.avatar_url : null,
    })

  if (bootstrapError && bootstrapError.code !== "23505") {
    return { profile: null, error: bootstrapError }
  }

  const refreshed = await getProfileByUserId(supabase, user.id)
  if (!refreshed.profile && bootstrapError) {
    return { profile: null, error: bootstrapError }
  }

  return refreshed
}

/**
 * A photo the user actually uploaded. The Google avatar that OAuth sign-in
 * copies onto profiles doesn't count: it's a 96px thumbnail of whatever they
 * chose for Gmail years ago, and the directory/business cards need a real
 * headshot — so it may sit on the profile for display, but it doesn't satisfy
 * the minimum and complete-profile asks for an upload.
 */
export function isUploadedProfilePhoto(url: string | null | undefined): boolean {
  const u = (url ?? "").trim()
  return !!u && !/googleusercontent\.com/i.test(u)
}

/**
 * Any usable profile photo for the dashboard photo gate — an uploaded headshot
 * OR the Google avatar OAuth copies onto the profile. The gate only exists to
 * stop the directory being full of blank initials, and a Google photo already
 * clears that bar, so it should not force an upload on top of one. This is the
 * looser counterpart to isUploadedProfilePhoto, which stays the rule anywhere
 * headshot quality specifically matters (e.g. business-card / top-seller art).
 */
export function hasProfilePhoto(url: string | null | undefined): boolean {
  return !!(url ?? "").trim()
}

/** The avatar a Supabase OAuth user carries in user_metadata (Google sets both
 *  `avatar_url` and `picture`), or null when there isn't one. */
export function googleAvatarUrl(userMetadata: Record<string, unknown> | null | undefined): string | null {
  const m = userMetadata ?? {}
  const raw = typeof m.avatar_url === "string" ? m.avatar_url : typeof m.picture === "string" ? m.picture : ""
  return raw.trim() || null
}

export function isProfileMissingMinimumFields(profile: AppProfile) {
  const metadata = profile.metadata ?? {}
  const meta = (k: string) => (typeof metadata[k] === "string" ? (metadata[k] as string).trim() : "")
  return (
    // The photo is deliberately NOT part of this minimum. This check drives the
    // proxy's redirect to /complete-profile; the photo is instead enforced by
    // the ProfilePhotoGate modal inside the dashboard shell, which covers every
    // role (including admin staff, who are exempt from this gate) and uses the
    // same isUploadedProfilePhoto rule so a copied Google avatar doesn't count.
    !profile.fname?.trim() ||
    !profile.lname?.trim() ||
    !profile.timezone?.trim() ||
    !profile.birthday?.trim() ||
    !profile.gender?.trim() ||
    !meta("nationality") ||
    !meta("phone_number") ||
    !meta("whatsapp_number")
  )
}

/**
 * Dashboard paths allowed before personal profile is complete (photo, fname, lname, timezone, phone).
 * Developers primarily use their own dashboard subtree; forcing profile first blocked every sidebar link.
 */
export function isPathExemptFromProfileCompletionGate(pathname: string, role?: string | null) {
  const r = normalizeAppRole(role)
  const base = getDashboardRouteByRole(r)
  if (pathname === `${base}/profile` || pathname.startsWith(`${base}/profile/`)) return true
  if (isDeveloperRole(r)) {
    return pathname === base || pathname.startsWith(`${base}/`)
  }
  return false
}

