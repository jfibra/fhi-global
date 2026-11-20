import "server-only"

import type { createAdminSupabase } from "@/lib/admin-supabase"

/**
 * Profile id → login email. Emails live in auth.users (profiles has no email
 * column), reachable only through the admin API, paged 200 at a time; the
 * whole map is kept for five minutes so a list page doesn't walk every page of
 * users per request. A single id goes straight to getUserById.
 */

type Admin = ReturnType<typeof createAdminSupabase>

let cache: { at: number; map: Map<string, string> } | null = null

export async function authEmailMap(admin: Admin): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.map
  const map = new Map<string, string>()
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    for (const u of data.users) if (u.email) map.set(u.id, u.email)
    if (data.users.length < 200) break
  }
  cache = { at: Date.now(), map }
  return map
}

/** The emails of a few ids: one call each up to five, the cached map beyond. */
export async function authEmailsFor(admin: Admin, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return new Map()
  if (unique.length > 5) {
    const all = await authEmailMap(admin)
    return new Map(unique.flatMap((id) => (all.has(id) ? [[id, all.get(id)!] as const] : [])))
  }
  const out = new Map<string, string>()
  await Promise.all(
    unique.map(async (id) => {
      const res = await admin.auth.admin.getUserById(id).catch(() => null)
      const email = res?.data?.user?.email
      if (email) out.set(id, email)
    }),
  )
  return out
}
