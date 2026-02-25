import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import type { UpdateUserPayload } from "@/lib/user-service"

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (!profile || !["super_admin", "admin"].includes(profile.role ?? "")) return null
  return user
}

// ─── GET /api/admin/users/[id] ─────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireAdmin()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = createAdminSupabase()

  const [{ data: profile }, { data: authData }] = await Promise.all([
    admin.from("profiles").select("*").eq("id", id).single(),
    admin.auth.admin.getUserById(id),
  ])

  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 })

  return NextResponse.json({
    ...profile,
    email: authData?.user?.email ?? null,
  })
}

// ─── PATCH /api/admin/users/[id] ───────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireAdmin()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = (await req.json()) as UpdateUserPayload & { activate?: boolean; deactivate?: boolean }

  const admin = createAdminSupabase()

  // Build profile update payload
  const profileUpdate: Record<string, unknown> = {}

  if (body.fname      !== undefined) profileUpdate.fname      = body.fname || null
  if (body.mname      !== undefined) profileUpdate.mname      = body.mname || null
  if (body.lname      !== undefined) profileUpdate.lname      = body.lname || null
  if (body.birthday   !== undefined) profileUpdate.birthday   = body.birthday || null
  if (body.gender     !== undefined) profileUpdate.gender     = body.gender || null
  if (body.timezone   !== undefined) profileUpdate.timezone   = body.timezone
  if (body.role       !== undefined) profileUpdate.role       = body.role
  if (body.status     !== undefined) profileUpdate.status     = body.status

  // Rebuild fullname when name parts change
  if (body.fname !== undefined || body.mname !== undefined || body.lname !== undefined) {
    const { data: current } = await admin.from("profiles").select("fname,mname,lname").eq("id", id).single()
    const fname = body.fname ?? current?.fname ?? ""
    const mname = body.mname ?? current?.mname ?? ""
    const lname = body.lname ?? current?.lname ?? ""
    profileUpdate.fullname = [fname, mname, lname].filter(Boolean).join(" ")
  }

  // Metadata merge for phone/whatsapp + developer link
  const metaKeys = ["phone_country_code", "phone_number", "whatsapp_country_code", "whatsapp_number"] as const
  const hasMeta = metaKeys.some((k) => body[k] !== undefined)
  const hasDeveloperLink = body.developer_id !== undefined
  const hasRoleUpdate = body.role !== undefined

  if (hasMeta || hasDeveloperLink || hasRoleUpdate) {
    const { data: current } = await admin
      .from("profiles")
      .select("metadata, role")
      .eq("id", id)
      .single<{ metadata: Record<string, unknown> | null; role: string | null }>()

    const nextMetadata: Record<string, unknown> = {
      ...(current?.metadata ?? {}),
      ...Object.fromEntries(metaKeys.filter((k) => body[k] !== undefined).map((k) => [k, body[k]])),
    }

    const nextRole = String(body.role ?? current?.role ?? "").toLowerCase().trim()
    const requestedDeveloperId = typeof body.developer_id === "string" && body.developer_id.trim()
      ? body.developer_id.trim()
      : null

    if (nextRole === "developer") {
      const developerIdToUse = body.developer_id !== undefined
        ? requestedDeveloperId
        : (typeof nextMetadata.developer_id === "string" ? nextMetadata.developer_id : null)

      if (!developerIdToUse) {
        return NextResponse.json({ error: "Developer link is required for developer role." }, { status: 400 })
      }

      const { data: linkedDeveloper, error: developerError } = await admin
        .from("developers")
        .select("id")
        .eq("id", developerIdToUse)
        .is("deleted_at", null)
        .single()

      if (developerError || !linkedDeveloper) {
        return NextResponse.json({ error: "Selected developer was not found." }, { status: 400 })
      }

      nextMetadata.developer_id = developerIdToUse
    } else {
      nextMetadata.developer_id = null
    }

    profileUpdate.metadata = nextMetadata
  }

  const { error } = await admin.from("profiles").update(profileUpdate).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// ─── DELETE /api/admin/users/[id] — soft delete ────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireAdmin()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = createAdminSupabase()

  const { error } = await admin
    .from("profiles")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      status: "inactive",
    })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
