// A page can publish ONE trailing breadcrumb crumb for the shell's route-driven
// DashboardBreadcrumb to append — e.g. the name of an open detail record that
// lives in client state and has no route of its own (the Account Directory's
// Account 360 view). Appending it turns the previously-terminal crumb (e.g.
// "Account Directory") into a link back, giving proper breadcrumb navigation
// without turning the detail into a real route.
//
// Module-level store read through useSyncExternalStore so it stays SSR-safe: the
// server snapshot is always null (no extra crumb) and the client swaps in the
// published crumb after mount — the same pattern the Account Directory already
// uses for its remembered view mode. `path` scopes the crumb to the exact route
// that published it, so a stale value can never leak onto another page.

export type BreadcrumbExtra = { label: string; path: string } | null

let current: BreadcrumbExtra = null
const listeners = new Set<() => void>()

export function setBreadcrumbExtra(next: BreadcrumbExtra) {
  // No-op guard so setting the same crumb twice doesn't churn subscribers.
  if (current?.label === next?.label && current?.path === next?.path) return
  current = next
  for (const cb of listeners) cb()
}

export function subscribeBreadcrumbExtra(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

export function getBreadcrumbExtra(): BreadcrumbExtra {
  return current
}

export function getBreadcrumbExtraServer(): BreadcrumbExtra {
  return null
}
