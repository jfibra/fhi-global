"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Client-side role gate for dashboard pages.
 *
 * proxy.ts already verifies the session for every /dashboard/* request and
 * redirects unauthenticated / inactive / profile-incomplete users. BUT for the
 * SHARED_DASHBOARD_PREFIXES paths (teams, sales, purchases, tax-entities,
 * listings, support, …) `canAccessDashboardPath` returns true for every role —
 * so the finer per-page role restriction is NOT enforced in middleware. It used
 * to live in each page's server `getSessionIdentity()` + redirect. Now that the
 * pages are client components (for instant navigation), that same restriction
 * lives here.
 *
 * Pass whether the current user's role is allowed. When it isn't, this redirects
 * to `fallback` and returns false so the caller renders nothing. Supabase RLS is
 * the real data guard regardless — this only keeps disallowed roles off the UI.
 */
export function useRequireAllowed(allowed: boolean, fallback = "/dashboard"): boolean {
  const router = useRouter()
  useEffect(() => {
    if (!allowed) router.replace(fallback)
  }, [allowed, router, fallback])
  return allowed
}
