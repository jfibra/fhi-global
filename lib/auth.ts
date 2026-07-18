import type { SupabaseClient } from "@supabase/supabase-js"
import {
  ROLE_DASHBOARD_MAP,
  roleToLabel,
  isSuperAdminRole,
  isDeveloperRole,
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
}

export { ROLE_DASHBOARD_MAP, roleToLabel }

const SHARED_DASHBOARD_PREFIXES = [
  "/dashboard/profile",
  "/dashboard/admin/users",
  "/dashboard/developers",
  "/dashboard/teams",
  "/dashboard/projects",
  "/dashboard/tax-entities",
  "/dashboard/purchase-categories",
  "/dashboard/purchases",
  "/dashboard/sales",
  "/dashboard/listings",
  "/dashboard/reels-maker",
  "/dashboard/support",
]

export function getDashboardRouteByRole(role?: string | null) {
  const normalizedRole = String(role ?? "").toLowerCase().trim()
  if (!normalizedRole) return "/dashboard/member"
  return ROLE_DASHBOARD_MAP[normalizedRole] ?? "/dashboard/member"
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
  const normalizedRole = String(role ?? "").toLowerCase().trim()

  if (!pathname.startsWith("/dashboard")) {
    return true
  }

  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return true
  }

  // Super admin can access every dashboard route
  if (isSuperAdminRole(normalizedRole)) return true

  if (SHARED_DASHBOARD_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true
  }

  const roleBase = getDashboardRouteByRole(normalizedRole)
  return pathname === roleBase || pathname.startsWith(`${roleBase}/`)
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
    .select("id, role, fullname, status, profile_url, metadata, is_deleted, fname, lname, timezone")
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

export function isProfileMissingMinimumFields(profile: AppProfile) {
  const metadata = profile.metadata ?? {}
  const phone = typeof metadata.phone_number === "string" ? metadata.phone_number.trim() : ""
  return (
    !profile.fname?.trim() ||
    !profile.lname?.trim() ||
    !profile.timezone?.trim() ||
    !phone
  )
}

/**
 * Dashboard paths allowed before personal profile is complete (fname, lname, timezone, phone).
 * Developers primarily use /dashboard/developer; forcing profile first blocked every sidebar link.
 */
export function isPathExemptFromProfileCompletionGate(pathname: string, role?: string | null) {
  if (pathname.startsWith("/dashboard/profile")) return true
  const r = String(role ?? "").toLowerCase().trim()
  if (isDeveloperRole(r)) {
    return (
      pathname.startsWith("/dashboard/developer") ||
      pathname.startsWith("/dashboard/support")
    )
  }
  return false
}

