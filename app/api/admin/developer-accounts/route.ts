import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { isValidUsername, normalizeUsername, usernameToEmail } from "@/lib/developer-accounts"

export const runtime = "nodejs"

type CreateDeveloperAccountPayload = {
  username?: string
  password?: string
  developer_id?: string
  display_name?: string
}

// POST /api/admin/developer-accounts — admin-only direct creation of a developer
// partner login (username + password) bound to a developer company. Mirrors the
// /api/admin/users provisioning pattern (createUser → upsert profile → rollback
// on failure → audit) but keyed on a username mapped to a synthetic auth email;
// no real-email deliverability checks. Replaces the removed invite-link flow.
export async function POST(req: NextRequest) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const body = (await req.json()) as CreateDeveloperAccountPayload
  const username = normalizeUsername(String(body.username ?? ""))
  const password = String(body.password ?? "")
  const developerId = typeof body.developer_id === "string" ? body.developer_id.trim() : ""
  const displayName = String(body.display_name ?? "").trim()

  if (!username || !password || !developerId) {
    return NextResponse.json({ error: "Username, password, and developer company are required." }, { status: 400 })
  }
  if (!isValidUsername(username)) {
    return NextResponse.json(
      { error: "Username must be 3–32 characters: lowercase letters, numbers, dot, underscore, or hyphen." },
      { status: 400 },
    )
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
  }

  const admin = createAdminSupabase()

  // Case-insensitive uniqueness (matches the partial unique index on lower(username)).
  const { data: existing } = await admin.from("profiles").select("id").ilike("username", username).maybeSingle()
  if (existing) {
    return NextResponse.json({ error: "That username is already taken." }, { status: 409 })
  }

  // The linked company must exist and not be soft-deleted.
  const { data: developer, error: developerError } = await admin
    .from("developers")
    .select("id, name, logo_url")
    .eq("id", developerId)
    .is("deleted_at", null)
    .single()
  if (developerError || !developer) {
    return NextResponse.json({ error: "Selected developer was not found." }, { status: 400 })
  }

  // Create the auth user on a synthetic, already-confirmed email (never emailed).
  const email = usernameToEmail(username)
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { account_type: "developer", username },
  })
  if (authError || !authData.user) {
    // A duplicate synthetic email means the username is effectively taken.
    const taken = (authError?.message ?? "").toLowerCase().includes("already")
    return NextResponse.json(
      { error: taken ? "That username is already taken." : authError?.message ?? "Failed to create account." },
      { status: taken ? 409 : 500 },
    )
  }

  const newUserId = authData.user.id

  // Display name → fname/lname; fall back to the company name so the profile
  // isn't blank (developers are exempt from the profile-completion gate anyway).
  const nameSource = displayName || developer.name || username
  const parts = nameSource.split(/\s+/).filter(Boolean)
  const fname = parts[0] ?? nameSource
  const lname = parts.slice(1).join(" ") || developer.name || "Developer"
  const fullname = [fname, lname].filter(Boolean).join(" ")

  const { error: profileError } = await admin.from("profiles").upsert({
    id: newUserId,
    fname,
    lname,
    fullname,
    username,
    role: "developer",
    status: "active",
    timezone: "Asia/Dubai",
    // Default the avatar to the company logo; the developer can change it later
    // in profile settings.
    profile_url: developer.logo_url ?? null,
    metadata: { developer_id: developerId },
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(newUserId) // roll back the orphaned auth user
    const dup = profileError.code === "23505"
    return NextResponse.json(
      { error: dup ? "That username is already taken." : profileError.message },
      { status: dup ? 409 : 500 },
    )
  }

  await logAuditEvent({
    category: "user_management",
    event: "created",
    source: "dashboard",
    actor: { id: guard.context.userId, name: guard.context.profile.fullname, role: guard.context.profile.role },
    subjectType: "profiles",
    subjectId: newUserId,
    subjectLabel: fullname,
    description: `Created developer account @${username} for ${developer.name}`,
    newValues: { role: "developer", status: "active", username, developer_id: developerId },
    changedKeys: ["role", "status", "username", "developer_id"],
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ id: newUserId, username }, { status: 201 })
}
