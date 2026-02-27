import type { SupabaseClient } from "@supabase/supabase-js"

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

export const ROLE_DASHBOARD_MAP: Record<string, string> = {
  super_admin: "/dashboard/superadmin",
  admin: "/dashboard/admin",
  team_leader: "/dashboard/teamleader",
  unit_manager: "/dashboard/unitmanager",
  agent: "/dashboard/agent",
  secretary: "/dashboard/secretary",
  team_secretary: "/dashboard/teamsecretary",
  member: "/dashboard/member",
  developer: "/dashboard/developer",
}

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
]

export function getDashboardRouteByRole(role?: string | null) {
  const normalizedRole = String(role ?? "").toLowerCase().trim()
  if (!normalizedRole) return "/dashboard/member"
  return ROLE_DASHBOARD_MAP[normalizedRole] ?? "/dashboard/member"
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
  if (normalizedRole === "super_admin") return true

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

export function roleToLabel(role?: string | null) {
  if (!role) return "Member"
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
