import { NextRequest, NextResponse } from "next/server"
import { isAdminStaffRole, isKnownAppRoleId } from "@/lib/app-roles"
import { createClient } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import type { CreateUserPayload, UsersListResponse, UserRecord } from "@/lib/user-service"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { emailTypoMessage } from "@/lib/email-typo"
import { checkEmailDeliverable } from "@/lib/email-validate"

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

  // Sort — whitelist to real profile columns; default newest-joined first.
  const SORT_COLUMNS: Record<string, string> = {
    fullname: "fullname",
    role: "role",
    status: "status",
    joined_at: "joined_at",
    // Derived columns sort by their underlying metadata field.
    contact: "metadata->>phone_number",
    referred_by: "metadata->>invited_by",
  }
  const sortCol = SORT_COLUMNS[sp.get("sort") ?? ""] ?? "joined_at"
  const sortAsc = sp.get("dir") === "asc"

  const searchRaw = search.trim()
  // ilike patterns are interpolated into a PostgREST or() filter, where commas,
  // parentheses and double quotes are syntax — strip them so a query like
  // "a, b (x)" can't corrupt the filter. Collapse leftover whitespace.
  const searchSafe = searchRaw.replace(/[,()"\\]/g, " ").replace(/\s+/g, " ").trim()

  const admin = createAdminSupabase()

  // ── Resolve emails (email lives in auth.users, not profiles) ─────────────────
  // Build a complete id→email map by paging through ALL auth users, retrying a
  // page once on a transient error. Previously a single listUsers call that
  // hiccupped (rate-limit / transient error) returned no users, nulling EVERY
  // email until the next refresh — this is the "email disappears then comes back"
  // symptom. Paging + retry makes the map deterministic and resilient.
  const emailMap = new Map<string, string>()
  const AUTH_PER_PAGE = 1000
  for (let authPage = 1; authPage <= 50; authPage++) {
    let res = await admin.auth.admin.listUsers({ page: authPage, perPage: AUTH_PER_PAGE })
    if (res.error) {
      res = await admin.auth.admin.listUsers({ page: authPage, perPage: AUTH_PER_PAGE })
    }
    const batch = res.data?.users ?? []
    for (const u of batch) if (u.email) emailMap.set(u.id, u.email)
    if (batch.length < AUTH_PER_PAGE) break
  }

  // Email is matched here (it's not on profiles) as a case-insensitive substring
  // — SQL ILIKE '%term%' — and folded into the name search's OR below.
  const emailMatchIds = searchRaw
    ? [...emailMap]
        .filter(([, email]) => email.toLowerCase().includes(searchRaw.toLowerCase()))
        .map(([id]) => id)
    : []

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

  if (sortCol === "fullname") {
    // The displayed name is derived (fname/lname), and `fullname` is often null,
    // so sort the User column by first then last name to match what's shown.
    query = query
      .order("fname", { ascending: sortAsc, nullsFirst: false })
      .order("lname", { ascending: sortAsc, nullsFirst: false })
  } else {
    query = query.order(sortCol, { ascending: sortAsc, nullsFirst: false })
  }

  // Visibility. Toggle ON = archive view (only soft-deleted); OFF = only active
  // (is_deleted null or false — legacy rows may have NULL).
  if (showDeleted) {
    query = query.eq("is_deleted", true)
  } else {
    query = query.or("is_deleted.is.null,is_deleted.eq.false")
  }

  // Search: name OR email as SQL ILIKE '%term%'. Name ilikes and the resolved
  // email-match ids are combined into a single OR so one search box matches both.
  if (searchSafe || emailMatchIds.length) {
    const clauses: string[] = []
    if (searchSafe) {
      clauses.push(
        `fullname.ilike.%${searchSafe}%`,
        `fname.ilike.%${searchSafe}%`,
        `lname.ilike.%${searchSafe}%`,
      )
    }
    if (emailMatchIds.length) {
      clauses.push(`id.in.(${emailMatchIds.join(",")})`)
    }
    query = query.or(clauses.join(","))
  }

  // Filters
  if (roleFilter)   query = query.eq("role",   roleFilter)
  if (statusFilter) query = query.eq("status", statusFilter)

  const { data: profiles, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Resolve referrer display names (metadata.invited_by → fullname) in one
  // query so the "Referred by" column renders with the row, instead of waiting
  // on the separate /referrers request the client uses for the edit dropdown.
  const invitedById = (p: (typeof profiles)[number]) => {
    const v = (p.metadata as Record<string, unknown> | null)?.invited_by
    return typeof v === "string" && v ? v : null
  }
  const referrerIds = Array.from(
    new Set((profiles ?? []).map(invitedById).filter((v): v is string => !!v)),
  )
  const referrerNames = new Map<string, string>()
  if (referrerIds.length) {
    const { data: refs } = await admin
      .from("profiles")
      .select("id, fullname")
      .in("id", referrerIds)
    for (const r of refs ?? []) referrerNames.set(r.id, r.fullname ?? "")
  }

  const users: UserRecord[] = (profiles ?? []).map((p) => {
    const invitedBy = invitedById(p)
    return {
      ...p,
      email: emailMap.get(p.id) ?? null,
      referred_by_name: invitedBy ? (referrerNames.get(invitedBy) ?? null) : null,
    }
  })

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

  const typo = emailTypoMessage(email)
  if (typo) {
    return NextResponse.json({ error: typo }, { status: 400 })
  }
  const undeliverable = await checkEmailDeliverable(email)
  if (undeliverable) {
    return NextResponse.json({ error: undeliverable }, { status: 400 })
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
