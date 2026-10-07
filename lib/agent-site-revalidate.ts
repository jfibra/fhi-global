import "server-only"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import { agentWebsite } from "@/lib/events/access"

/**
 * Purge an agent's public site (/website/<slug>) after something the page shows
 * has changed — one of their events, an approved review. The page is ISR (300 s),
 * so without this the change waits for the window to lapse. Silent when the agent
 * has no published site, and never throws: a failed lookup must not fail the save
 * that triggered it (the page still refreshes by itself within its window).
 */
export async function revalidateAgentSite(admin: SupabaseClient, agentId: string | null | undefined): Promise<void> {
  if (!agentId) return
  try {
    const site = await agentWebsite(admin, agentId)
    if (site?.isPublished) revalidatePath(`/website/${site.slug}`)
  } catch {
    // see above
  }
}
