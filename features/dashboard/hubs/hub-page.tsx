"use client"

import { useAuth } from "@/context/auth-context"
import { HubTileGrid } from "@/components/dashboard/hub-tile-grid"
import { getHubTiles } from "@/components/dashboard/sidebar-config"

/**
 * Renders one hub page. The role comes from the session (AuthProvider), not the
 * URL, so a single wrapper works for every role whose list defines this hub —
 * `app/(users)/{role}/{hub}/page.tsx` is just `<HubPage hub="…" />`.
 */
export function HubPage({ hub }: { hub: string }) {
  const { profile } = useAuth()
  const resolved = getHubTiles(profile?.role, hub)

  if (!resolved) {
    return (
      <p className="text-sm text-[#6b7280]">
        This section isn&apos;t available for your role.
      </p>
    )
  }

  return <HubTileGrid title={resolved.title} tiles={resolved.tiles} />
}
