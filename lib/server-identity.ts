import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { getProfileByUserId, type AppProfile } from "@/lib/auth"
import { IDENTITY_HEADERS } from "@/lib/identity-headers"

export type SessionIdentity = {
  userId: string
  email: string | null
  profile: AppProfile
}

/**
 * Resolves the logged-in user + profile for server components.
 *
 * Fast path: proxy.ts already verified the session on this exact request and
 * forwarded the result via internal headers (stripped from inbound traffic,
 * so they can't be forged). Zero extra network round trips.
 *
 * Fallback: if the headers are absent for any reason (route rendered outside
 * the proxy matcher, header size limits, future refactors), performs the full
 * Supabase check exactly like the old per-page code — never less safe.
 *
 * Returns null when there is no valid session; callers keep their own
 * redirects and role gates.
 */
export async function getSessionIdentity(): Promise<SessionIdentity | null> {
  try {
    const h = await headers()
    const userId = h.get(IDENTITY_HEADERS.userId)
    const rawProfile = h.get(IDENTITY_HEADERS.profile)
    if (userId && rawProfile) {
      const profile = JSON.parse(decodeURIComponent(rawProfile)) as AppProfile
      if (profile && typeof profile === "object" && profile.id === userId) {
        const rawEmail = h.get(IDENTITY_HEADERS.email)
        return {
          userId,
          email: rawEmail ? decodeURIComponent(rawEmail) : null,
          profile,
        }
      }
    }
  } catch {
    // Malformed header or headers() unavailable — use the full check below.
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { profile } = await getProfileByUserId(supabase, user.id)
  if (!profile) return null

  return { userId: user.id, email: user.email ?? null, profile }
}
