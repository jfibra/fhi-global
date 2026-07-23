import { NextResponse, type NextRequest } from "next/server"
import {
  canAccessDashboardPath,
  ensureProfileForUser,
  getDashboardRouteByRole,
  isInactiveProfile,
  isPathExemptFromProfileCompletionGate,
  isProfileMissingMinimumFields,
  type AppProfile,
} from "@/lib/auth"
import { isAdminStaffRole, isKnownRoleSlug } from "@/lib/app-roles"
import { updateSession } from "@/lib/supabase/middleware"
import { IDENTITY_HEADERS } from "@/lib/identity-headers"

/**
 * Hands the verified identity down to server components via internal request
 * headers (see lib/server-identity.ts), so pages skip their own duplicate
 * Supabase auth + profile round trips. Rebuilds the pass-through response with
 * the enriched request and re-applies any refreshed auth cookies.
 */
function forwardIdentity(
  request: NextRequest,
  response: NextResponse,
  user: { id: string; email?: string | null },
  profile: AppProfile,
) {
  const encodedProfile = encodeURIComponent(JSON.stringify(profile))
  // Oversized profiles (e.g. a bloated metadata blob) could blow the server's
  // header size limit — skip forwarding and let pages run their full fallback.
  if (encodedProfile.length > 6_000) {
    return response
  }
  request.headers.set(IDENTITY_HEADERS.userId, user.id)
  // Encoded like the profile: raw non-Latin-1 characters (internationalized
  // emails) would make Headers.set throw and 500 the whole request.
  request.headers.set(IDENTITY_HEADERS.email, encodeURIComponent(user.email ?? ""))
  request.headers.set(IDENTITY_HEADERS.profile, encodedProfile)
  const forwarded = NextResponse.next({ request })
  for (const cookie of response.cookies.getAll()) {
    forwarded.cookies.set(cookie)
  }
  return forwarded
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? ""
  // Dashboard routes are now role-prefixed (`/admin/*`, `/agent/*`, …); `/dashboard`
  // is kept only as a role-agnostic redirect stub.
  const isDashboardRoute = pathname === "/dashboard" || isKnownRoleSlug(firstSegment)
  const isLoginRoute = pathname === "/login"

  // Anti-forgery: never trust identity headers arriving from the outside.
  for (const header of Object.values(IDENTITY_HEADERS)) {
    request.headers.delete(header)
  }

  const { supabase, response, user, missingEnv } = await updateSession(request)

  if (missingEnv) {
    if (isDashboardRoute) {
      const url = request.nextUrl.clone()
      url.pathname = "/"
      return NextResponse.redirect(url)
    }

    return response
  }

  if (!supabase) {
    return response
  }

  if (!user) {
    if (isDashboardRoute) {
      const url = request.nextUrl.clone()
      url.pathname = "/"
      return NextResponse.redirect(url)
    }
    return response
  }

  const { profile } = await ensureProfileForUser(supabase, {
    id: user.id,
    email: user.email,
    user_metadata: user.user_metadata,
  })

  if (!profile) {
    if (isDashboardRoute || isLoginRoute) {
      const url = request.nextUrl.clone()
      url.pathname = "/"
      return NextResponse.redirect(url)
    }

    return response
  }

  if (isInactiveProfile(profile)) {
    // Inactive users may still finish their profile first; once it's complete
    // they're held on /account-inactive until an admin activates them.
    if (!isAdminStaffRole(profile.role) && isProfileMissingMinimumFields(profile)) {
      const url = request.nextUrl.clone()
      url.pathname = "/complete-profile"
      return NextResponse.redirect(url)
    }

    if (pathname !== "/account-inactive") {
      const url = request.nextUrl.clone()
      url.pathname = "/account-inactive"
      return NextResponse.redirect(url)
    }

    return response
  }

  const isPrivilegedRole = isAdminStaffRole(profile.role)

  if (
    isDashboardRoute &&
    !isPrivilegedRole &&
    isProfileMissingMinimumFields(profile) &&
    !isPathExemptFromProfileCompletionGate(pathname, profile.role)
  ) {
    const url = request.nextUrl.clone()
    url.pathname = "/complete-profile"
    return NextResponse.redirect(url)
  }

  if (isDashboardRoute && !canAccessDashboardPath(pathname, profile.role)) {
    const url = request.nextUrl.clone()
    url.pathname = getDashboardRouteByRole(profile.role)
    return NextResponse.redirect(url)
  }

  if (isLoginRoute) {
    const url = request.nextUrl.clone()
    url.pathname = getDashboardRouteByRole(profile.role)
    return NextResponse.redirect(url)
  }

  // Authenticated pass-through: hand the already-verified identity to the page.
  return forwardIdentity(request, response, user, profile)
}

export const config = {
  matcher: [
    "/login",
    "/account-inactive",
    "/dashboard",
    "/superadmin/:path*",
    "/admin/:path*",
    "/teamleader/:path*",
    "/unitmanager/:path*",
    "/agent/:path*",
    "/developer/:path*",
    "/secretary/:path*",
    "/teamsecretary/:path*",
    "/member/:path*",
  ],
}
