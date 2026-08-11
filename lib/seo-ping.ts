/**
 * Fire-and-forget publish-time SEO hook. Project, developer, and agent-listing
 * publishes run client-side through the browser Supabase client, so the server
 * never sees the moment content goes live — this tells it. The route
 * (app/api/seo/revalidate) purges the entity's ISR cache and, when the entity
 * is publicly visible, pings IndexNow. Failures are swallowed: SEO plumbing
 * must never break a publish.
 */
export function pingSeoRevalidate(
  kind: "project" | "developer" | "agent-listing",
  id: string | number,
): void {
  try {
    void fetch("/api/seo/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id: String(id) }),
      // Survives page navigations right after a publish click.
      keepalive: true,
    }).catch(() => {})
  } catch {
    // e.g. called in a non-browser context — ignore.
  }
}
