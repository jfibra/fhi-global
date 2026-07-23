import { createAdminSupabase } from "@/lib/admin-supabase"
import { isProfileMissingMinimumFields, type AppProfile } from "@/lib/auth"

export type Recruit = {
  id: string
  fullname: string
  email: string | null
  role: string
  status: string
  joinedAt: string | null
  phone: string | null
  whatsapp: string | null
  birthday: string | null
  incomplete: boolean
}

/**
 * People who registered through `userId`'s invite link (metadata.invited_by).
 * Server-only (uses the service-role client + auth admin API). Shared by the
 * SSR invite page and the /api/invite/recruits refresh endpoint.
 */
export async function getRecruitsForUser(userId: string): Promise<Recruit[]> {
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("profiles")
    .select("id, fullname, role, status, joined_at, birthday, gender, fname, lname, timezone, metadata")
    .eq("metadata->>invited_by", userId)
    .eq("is_deleted", false)
    .order("joined_at", { ascending: false })
    .limit(200)

  if (error) throw new Error("Failed to load recruits")

  // Resolve emails from auth.users (not stored on profiles).
  const emailMap = new Map<string, string>()
  try {
    const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    for (const u of authData?.users ?? []) {
      if (u.email) emailMap.set(u.id, u.email)
    }
  } catch {
    // Non-fatal — recruits still render without emails.
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
  const phoneFrom = (metadata: Record<string, unknown> | null) => {
    const m = metadata ?? {}
    const combined = [str(m.phone_country_code), str(m.phone_number)].filter(Boolean).join(" ")
    return combined || str(m.phone) || null
  }
  const whatsappFrom = (metadata: Record<string, unknown> | null) => {
    const m = metadata ?? {}
    const combined = [str(m.whatsapp_country_code), str(m.whatsapp_number)].filter(Boolean).join(" ")
    return combined || null
  }

  return (data ?? []).map((r) => ({
    id: r.id as string,
    fullname: (r.fullname as string | null) ?? "New member",
    email: emailMap.get(r.id as string) ?? null,
    role: (r.role as string | null) ?? "member",
    status: (r.status as string | null) ?? "pending",
    joinedAt: (r.joined_at as string | null) ?? null,
    phone: phoneFrom(r.metadata as Record<string, unknown> | null),
    whatsapp: whatsappFrom(r.metadata as Record<string, unknown> | null),
    birthday: (r.birthday as string | null) ?? null,
    incomplete: isProfileMissingMinimumFields(r as unknown as AppProfile),
  }))
}
