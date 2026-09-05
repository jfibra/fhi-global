import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"

/**
 * GET /api/external/users — public users API for partner sites
 * (Rentsouq.ae auto-login/account-linking).
 *
 * Currently UNAUTHENTICATED by request — an API key (FHI_EXTERNAL_API_KEY)
 * will be added later before wider rollout.
 *
 *   ?email=<address>       exact, case-insensitive single-user lookup
 *                          → { success, data: user } | 404
 *   ?page=1&limit=20       paginated list (limit ≤ 100)
 *                          → { success, data: user[], meta: { total, page, limit } }
 *
 * Soft-deleted profiles are never returned. Consumers should only auto-login
 * accounts whose status is "active".
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ExternalUser = {
  id: string
  email: string | null
  fname: string | null
  mname: string | null
  lname: string | null
  fullname: string | null
  role: string | null
  status: string | null
  avatar_url: string | null
  timezone: string | null
  joined_at: string | null
}

const PROFILE_COLUMNS =
  "id, fname, mname, lname, fullname, role, status, profile_url, timezone, joined_at, is_deleted"

type ProfileRow = {
  id: string
  fname: string | null
  mname: string | null
  lname: string | null
  fullname: string | null
  role: string | null
  status: string | null
  profile_url: string | null
  timezone: string | null
  joined_at: string | null
  is_deleted: boolean | null
}

function toExternalUser(p: ProfileRow, email: string | null): ExternalUser {
  return {
    id: p.id,
    email,
    fname: p.fname,
    mname: p.mname,
    lname: p.lname,
    fullname: p.fullname,
    role: p.role,
    status: p.status,
    avatar_url: p.profile_url,
    timezone: p.timezone,
    joined_at: p.joined_at,
  }
}

export async function GET(req: NextRequest) {
  const admin = createAdminSupabase()
  const sp = req.nextUrl.searchParams
  const emailParam = sp.get("email")?.trim().toLowerCase() ?? ""

  try {
    // ── Single-user lookup by exact email ─────────────────────────────────────
    // Email lives in auth.users (not profiles), so resolve it through the
    // GoTrue admin API — page until found, same pattern as /api/admin/users.
    if (emailParam) {
      const authUser = await findAuthUserByEmail(admin, emailParam)
      if (!authUser) {
        return NextResponse.json(
          { success: false, error: "User not found." },
          { status: 404 },
        )
      }

      const { data: profile, error } = await admin
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("id", authUser.id)
        .maybeSingle<ProfileRow>()

      if (error) throw new Error(error.message)
      if (!profile || profile.is_deleted === true) {
        return NextResponse.json(
          { success: false, error: "User not found." },
          { status: 404 },
        )
      }

      return NextResponse.json({
        success: true,
        data: toExternalUser(profile, authUser.email ?? emailParam),
      })
    }

    // ── Paginated list ─────────────────────────────────────────────────────────
    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20))
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data: profiles, count, error } = await admin
      .from("profiles")
      .select(PROFILE_COLUMNS, { count: "exact" })
      .or("is_deleted.is.null,is_deleted.eq.false")
      .order("joined_at", { ascending: false, nullsFirst: false })
      .range(from, to)
      .returns<ProfileRow[]>()

    if (error) throw new Error(error.message)

    const emailMap = await buildEmailMap(admin)
    const users = (profiles ?? []).map((p) => toExternalUser(p, emailMap.get(p.id) ?? null))

    return NextResponse.json({
      success: true,
      data: users,
      meta: { total: count ?? 0, page, limit },
    })
  } catch (error) {
    console.error("External users API failed:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch users." },
      { status: 500 },
    )
  }
}

type AdminClient = ReturnType<typeof createAdminSupabase>

const AUTH_PER_PAGE = 1000
const AUTH_MAX_PAGES = 50

async function findAuthUserByEmail(admin: AdminClient, email: string) {
  for (let page = 1; page <= AUTH_MAX_PAGES; page++) {
    let res = await admin.auth.admin.listUsers({ page, perPage: AUTH_PER_PAGE })
    if (res.error) {
      // one retry per page — transient GoTrue hiccups shouldn't 404 a real user
      res = await admin.auth.admin.listUsers({ page, perPage: AUTH_PER_PAGE })
      if (res.error) throw new Error(res.error.message)
    }
    const batch = res.data?.users ?? []
    const match = batch.find((u) => u.email?.toLowerCase() === email)
    if (match) return match
    if (batch.length < AUTH_PER_PAGE) break
  }
  return null
}

async function buildEmailMap(admin: AdminClient) {
  const emailMap = new Map<string, string>()
  for (let page = 1; page <= AUTH_MAX_PAGES; page++) {
    let res = await admin.auth.admin.listUsers({ page, perPage: AUTH_PER_PAGE })
    if (res.error) {
      res = await admin.auth.admin.listUsers({ page, perPage: AUTH_PER_PAGE })
      if (res.error) throw new Error(res.error.message)
    }
    const batch = res.data?.users ?? []
    for (const u of batch) if (u.email) emailMap.set(u.id, u.email)
    if (batch.length < AUTH_PER_PAGE) break
  }
  return emailMap
}
