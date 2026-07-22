// Instant-navigation boundary for /dashboard/*.
//
// The shell (sidebar + header) lives in layout.tsx and stays mounted across
// navigation. This file is the Suspense fallback for the page segment: because
// the dashboard layout is force-dynamic, navigating to a route requires fetching
// its payload from the server — without a loading boundary the router BLOCKS on
// that fetch and nothing changes on screen. With this file, clicking a sidebar
// link commits the navigation immediately to this skeleton while the page streams
// in, so the link changes instantly. It also lets <Link> prefetch this boundary.
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="space-y-2">
        <div className="h-7 w-56 rounded-lg bg-black/5 animate-pulse" />
        <div className="h-4 w-80 rounded bg-black/5 animate-pulse" />
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-black/5 animate-pulse" />
        ))}
      </div>

      {/* Content block */}
      <div className="h-96 rounded-2xl bg-black/5 animate-pulse" />
    </div>
  )
}
