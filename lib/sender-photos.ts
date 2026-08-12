import { createAdminSupabase } from "@/lib/admin-supabase"

/**
 * Profile photos for email senders, keyed by lowercased address.
 *
 * Server-only: resolves addresses through the service-role-only
 * auth_user_emails view (migration 043), so a thread can show a registered
 * sender's real FHI photo. Unregistered senders simply aren't in the map —
 * the client then tries Gravatar and finally falls back to initials.
 */
export async function senderPhotoMap(emails: Array<string | null | undefined>): Promise<Record<string, string>> {
  const unique = [...new Set(emails.map((e) => (e ?? "").trim().toLowerCase()).filter(Boolean))]
  if (unique.length === 0) return {}

  const admin = createAdminSupabase()
  const { data: matches } = await admin
    .from("auth_user_emails")
    .select("id, email")
    .in("email", unique)
  const rows = (matches ?? []) as Array<{ id: string; email: string }>
  if (rows.length === 0) return {}

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, profile_url")
    .in("id", rows.map((r) => r.id))
  const photoById = new Map(
    ((profiles ?? []) as Array<{ id: string; profile_url: string | null }>).map((p) => [
      p.id,
      (p.profile_url ?? "").trim(),
    ]),
  )

  const map: Record<string, string> = {}
  for (const r of rows) {
    const url = photoById.get(r.id)
    if (url) map[r.email] = url
  }
  return map
}
