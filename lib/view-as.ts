// Admin "view as role" (role preview). A client-set cookie holds a role id; the
// proxy honors it for route gating ONLY when the real DB role is admin-staff,
// and the client shell mirrors it to render that role's UI. It has NO effect on
// API authorization or RLS (both re-derive the role from the DB), so it can
// never escalate real permissions — it only changes navigation + which role's
// interface renders. See proxy.ts and context/auth-context.tsx.

import { getDashboardRouteByRole } from "@/lib/auth"
import { APP_ROLE_ORDER, isAdminStaffRole, type AppRoleId } from "@/lib/app-roles"

export const VIEW_AS_COOKIE = "fhi-view-as"

// Roles an admin can preview: every role except the admin-staff ones, senior→junior.
export const PREVIEWABLE_ROLES: AppRoleId[] = APP_ROLE_ORDER.filter((r) => !isAdminStaffRole(r))

/** Read the current view-as role id from the cookie (client-only). */
export function readViewAsCookie(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${VIEW_AS_COOKIE}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : null
}

/** Start previewing a role: set the cookie and hard-navigate to its dashboard so
 *  the proxy + the client gate both re-read the cookie cleanly. */
export function enterViewAs(roleId: string): void {
  if (typeof document === "undefined") return
  document.cookie = `${VIEW_AS_COOKIE}=${encodeURIComponent(roleId)}; path=/; max-age=86400; samesite=lax`
  window.location.assign(getDashboardRouteByRole(roleId))
}

/** Stop previewing: clear the cookie and hard-navigate back to the real dashboard. */
export function exitViewAs(realRole: string | null | undefined): void {
  if (typeof document === "undefined") return
  document.cookie = `${VIEW_AS_COOKIE}=; path=/; max-age=0; samesite=lax`
  window.location.assign(getDashboardRouteByRole(realRole))
}
