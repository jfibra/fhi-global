import { NextResponse, type NextRequest } from "next/server"
import {
  canAccessDashboardPath,
  ensureProfileForUser,
  getDashboardRouteByRole,
  isInactiveProfile,
  isPathExemptFromProfileCompletionGate,
  isProfileMissingMinimumFields,
} from "@/lib/auth"
import { isAdminStaffRole } from "@/lib/app-roles"
import { updateSession } from "@/lib/supabase/middleware"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isDashboardRoute = pathname.startsWith("/dashboard")
  const isLoginRoute = pathname === "/login"

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
    url.pathname = "/dashboard/profile"
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

  return response
}

export const config = {
  matcher: ["/login", "/dashboard/:path*", "/account-inactive"],
}
