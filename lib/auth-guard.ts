import { NextResponse } from "next/server"
import { getProfileByUserId, isInactiveProfile } from "@/lib/auth"
import { normalizeAppRole } from "@/lib/app-roles"
import { createClient } from "@/lib/supabase/server"

export type GuardResult = {
  userId: string
  email: string | null
  profile: {
    id: string
    role: string | null
    fullname: string | null
    status: string | null
    profile_url: string | null
    metadata: Record<string, unknown> | null
    is_deleted?: boolean | null
    mailbox_address?: string | null
  }
}

export async function requireActiveSession() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const { profile } = await getProfileByUserId(supabase, user.id)

  if (!profile) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Profile not found" }, { status: 404 }),
    }
  }

  if (isInactiveProfile(profile)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Account inactive" }, { status: 403 }),
    }
  }

  return {
    ok: true as const,
    context: {
      userId: user.id,
      email: user.email ?? null,
      profile,
    } satisfies GuardResult,
  }
}

export async function requireRole(allowedRoles: string[]) {
  const session = await requireActiveSession()

  if (!session.ok) {
    return session
  }

  const role = normalizeAppRole(session.context.profile.role)
  const allowed = new Set(allowedRoles.map((r) => normalizeAppRole(r)))

  if (!role || !allowed.has(role)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return session
}
