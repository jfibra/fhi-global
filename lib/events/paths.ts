// Where an event lives publicly (migration 057):
//   · a company event (agent_id NULL)      → /events/<slug>
//   · an agent's own event on their site   → /website/<site>/events/<slug>
// Shared by the API (which hands every event its path), the dashboard cards,
// the flyer QR and the certificate link, so they can never disagree.

export function eventPublicPath(
  event: { id: string; slug: string | null },
  /** The owning agent's published website slug; null/undefined for a company event. */
  siteSlug?: string | null,
): string {
  const key = event.slug ?? event.id
  return siteSlug ? `/website/${siteSlug}/events/${key}` : `/events/${key}`
}

/** An agent website's events section — the one link that lists all their events. */
export function websiteEventsPath(siteSlug: string): string {
  return `/website/${siteSlug}#events`
}
