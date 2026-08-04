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
import { readCachedProfile, writeCachedProfile } from "@/lib/profile-cache"
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

  // Legacy project URLs: /projects/<slug> moved under the developer
  // (/samana-developers/samana-miami-2). The page tree streams (so a
  // page-level permanentRedirect can only ship a client-side redirect in the
  // RSC payload with HTTP 200) — a genuine 308 for crawlers and old backlinks
  // must be issued here, before anything streams. One anon PostgREST lookup,
  // on this narrow path only; on any failure, fall through and let the page's
  // own redirect handle the visitor.
  const legacyProject = pathname.match(/^\/projects\/([^/]+)$/)
  if (legacyProject) {
    try {
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (base && anon) {
        const q = `${base}/rest/v1/projects?slug=eq.${encodeURIComponent(legacyProject[1])}&deleted_at=is.null&select=slug,developers(slug)&limit=1`
        const res = await fetch(q, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } })
        if (res.ok) {
          const rows = (await res.json()) as Array<{ slug: string; developers: { slug: string | null } | null }>
          const dev = rows[0]?.developers?.slug
          if (dev) {
            const dest = request.nextUrl.clone()
            dest.pathname = `/${dev}/${rows[0].slug}`
            return NextResponse.redirect(dest, 308)
          }
        }
      }
    } catch {
      // fall through to the page
    }
    return NextResponse.next()
  }
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

  // Hot path: reuse the signed profile snapshot from a recent request rather than
  // re-querying `profiles` on every RSC fetch and every <Link> prefetch.
  const cachedProfile = await readCachedProfile(request, user.id)
  const profile =
    cachedProfile ??
    (
      await ensureProfileForUser(supabase, {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
      })
    ).profile

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

  // Active account on the held page (e.g. refreshed after an admin approved
  // them) — release them to their dashboard.
  if (pathname === "/account-inactive") {
    const url = request.nextUrl.clone()
    url.pathname = getDashboardRouteByRole(profile.role)
    return NextResponse.redirect(url)
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
  const forwarded = forwardIdentity(request, response, user, profile)
  // Refresh only on a miss — re-signing every request would slide the expiry
  // forever and let a stale role survive indefinitely.
  if (!cachedProfile) await writeCachedProfile(forwarded, user.id, profile)
  return forwarded
}

export const config = {
  matcher: [
    "/projects/:slug",
    "/login",
    "/account-inactive",
    "/dashboard",
    "/superadmin/:path*",
    "/admin/:path*",
    "/editor/:path*",
    "/teamleader/:path*",
    "/unitmanager/:path*",
    "/agent/:path*",
    "/developer/:path*",
    "/secretary/:path*",
    "/teamsecretary/:path*",
    "/member/:path*",
  ],
}
