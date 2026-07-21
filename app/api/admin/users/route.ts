import { NextRequest, NextResponse } from "next/server"
import { isAdminStaffRole, isKnownAppRoleId } from "@/lib/app-roles"
import { createClient } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import type { CreateUserPayload, UsersListResponse, UserRecord } from "@/lib/user-service"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

type AdminCaller = { id: string; name: string | null; role: string | null }

// ─── Auth guard helper ─────────────────────────────────────────────────────────
async function requireAdmin(): Promise<AdminCaller | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, fullname")
    .eq("id", user.id)
    .single()
  if (!profile || !isAdminStaffRole(profile.role)) return null
  return { id: user.id, name: profile.fullname ?? user.email ?? null, role: profile.role }
}

// ─── GET /api/admin/users ──────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const caller = await requireAdmin()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const page       = Math.max(1, parseInt(sp.get("page")      ?? "1",  10))
  const perPage    = Math.min(50, parseInt(sp.get("perPage")   ?? "20", 10))
  const search     = sp.get("search")  ?? ""
  const roleFilter = sp.get("role")    ?? ""
  const statusFilter = sp.get("status") ?? ""
  const showDeleted  = sp.get("deleted") === "true"

  const admin = createAdminSupabase()

  // ── Fetch auth users for email lookup ────────────────────────────────────────
  const { data: { users: authUsers } } = await admin.auth.admin.listUsers({
    page: 1, perPage: 1000,
  })

  // Build email map and, if email search, build allowed-id set
  const emailMap = new Map<string, string>()
  for (const u of authUsers) {
    if (u.email) emailMap.set(u.id, u.email)
  }

  // Email search: restrict to IDs whose email matches
  let allowedIds: Set<string> | null = null
  if (search && search.includes("@")) {
    allowedIds = new Set(
      authUsers.filter((u) => u.email?.toLowerCase().includes(search.toLowerCase())).map((u) => u.id),
    )
  }

  // ── Build profiles query ──────────────────────────────────────────────────────
  const from = (page - 1) * perPage
  const to   = from + perPage - 1

  let query = admin
    .from("profiles")
    .select(
      "id, fname, mname, lname, fullname, birthday, gender, profile_url, role, status, timezone, metadata, joined_at, updated_at, is_deleted, deleted_at",
      { count: "exact" },
    )
    .range(from, to)
    .order("joined_at", { ascending: false })

  // Visibility
  if (!showDeleted) {
    query = query.or("is_deleted.is.null,is_deleted.eq.false")
  }

  // Name/text search (not email)
  if (search && !search.includes("@")) {
    query = query.or(
      `fullname.ilike.%${search}%,fname.ilike.%${search}%,lname.ilike.%${search}%`,
    )
  }

  // Email search — restrict by allowed IDs
  if (allowedIds) {
    query = query.in("id", [...allowedIds])
  }

  // Filters
  if (roleFilter)   query = query.eq("role",   roleFilter)
  if (statusFilter) query = query.eq("status", statusFilter)

  const { data: profiles, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const users: UserRecord[] = (profiles ?? []).map((p) => ({
    ...p,
    email: emailMap.get(p.id) ?? null,
  }))

  const result: UsersListResponse = {
    users,
    total: count ?? 0,
    page,
    perPage,
  }

  return NextResponse.json(result)
}

// ─── POST /api/admin/users ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const caller = await requireAdmin()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json()) as CreateUserPayload
  const { email: emailRaw, password, fname, mname, lname, role, developer_id, timezone, status } = body
  const email = String(emailRaw ?? "").trim().toLowerCase()

  if (!email || !password || !fname || !lname) {
    return NextResponse.json({ error: "Required fields missing." }, { status: 400 })
  }

  const normalizedRole = String(role ?? "member").toLowerCase().trim()
  if (!isKnownAppRoleId(normalizedRole)) {
    return NextResponse.json(
      { error: `Invalid role "${normalizedRole}". Use a role defined in the app and in public.user_roles.` },
      { status: 400 },
    )
  }

  const admin = createAdminSupabase()

  // Create auth user — email already confirmed, no invite email sent
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? "Failed to create user." }, { status: 500 })
  }

  const newUserId = authData.user.id
  const fullname  = [fname, mname, lname].filter(Boolean).join(" ")

  const linkedDeveloperId = normalizedRole === "developer"
    ? (typeof developer_id === "string" && developer_id.trim() ? developer_id.trim() : null)
    : null

  if (normalizedRole === "developer" && !linkedDeveloperId) {
    await admin.auth.admin.deleteUser(newUserId)
    return NextResponse.json({ error: "Developer link is required for developer role." }, { status: 400 })
  }

  if (linkedDeveloperId) {
    const { data: linkedDeveloper, error: developerError } = await admin
      .from("developers")
      .select("id")
      .eq("id", linkedDeveloperId)
      .is("deleted_at", null)
      .single()

    if (developerError || !linkedDeveloper) {
      await admin.auth.admin.deleteUser(newUserId)
      return NextResponse.json({ error: "Selected developer was not found." }, { status: 400 })
    }
  }

  // Upsert profile record
  const { error: profileError } = await admin.from("profiles").upsert({
    id:       newUserId,
    fname,
    mname:    mname || null,
    lname,
    fullname,
    role:     normalizedRole || "member",
    timezone: timezone || "UTC",
    status:   status   || "active",
    metadata: {
      developer_id: linkedDeveloperId,
    },
  })

  if (profileError) {
    // Roll back auth user creation
    await admin.auth.admin.deleteUser(newUserId)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  await logAuditEvent({
    category: "user_management",
    event: "created",
    source: "dashboard",
    actor: caller,
    subjectType: "profiles",
    subjectId: newUserId,
    subjectLabel: fullname,
    description: `Created user ${fullname} (${normalizedRole || "member"})`,
    newValues: { role: normalizedRole || "member", status: status || "active" },
    changedKeys: ["role", "status"],
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ id: newUserId }, { status: 201 })
}
