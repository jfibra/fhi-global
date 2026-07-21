import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData()
    const accountTypeRaw = String(fd.get("accountType") ?? "").toLowerCase().trim()
    const firstName = String(fd.get("firstName") ?? "").trim()
    const lastName = String(fd.get("lastName") ?? "").trim()
    const emailRaw = String(fd.get("email") ?? "").trim()
    const email = emailRaw.toLowerCase()
    const password = String(fd.get("password") ?? "")
    const companyName = fd.get("companyName") as string | null

    if (!accountTypeRaw || !firstName || !lastName || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (accountTypeRaw !== "member" && accountTypeRaw !== "developer") {
      return NextResponse.json({ error: "Invalid account type" }, { status: 400 })
    }

    const isDeveloper = accountTypeRaw === "developer"
    const role = isDeveloper ? "developer" : "member"

    const supabase = createAdminSupabase()

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      // Must be true: admin-created users are never sent a confirmation email,
      // so `false` leaves them permanently unable to sign in. Vetting happens
      // via the app's own pending→active approval gate, not email confirmation.
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        account_type: accountTypeRaw,
      },
    })

    if (authError || !authData?.user) {
      return NextResponse.json({ error: authError?.message ?? "Failed to create user" }, { status: 400 })
    }

    const userId = authData.user.id

    // Invite QR / referral link: ?ref=<inviter profile id>. Attribution is
    // best-effort — an invalid or unknown ref never blocks registration.
    const refRaw = String(fd.get("ref") ?? "").trim()
    let invitedBy: string | null = null
    if (refRaw && UUID_RE.test(refRaw)) {
      const { data: inviter } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", refRaw)
        .eq("is_deleted", false)
        .maybeSingle()
      if (inviter) invitedBy = refRaw
    }

    await supabase
      .from("profiles")
      .update({
        role,
        status: "pending",
        ...(invitedBy ? { metadata: { invited_by: invitedBy } } : {}),
      })
      .eq("id", userId)

    if (isDeveloper && companyName?.trim()) {
      const baseSlug = slugify(companyName)
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`
      await supabase.from("developers").insert({
        name: companyName.trim(),
        slug,
        email,
        is_active: false,
        is_verified: false,
      })
    }

    const ctx = requestContextFromRequest(req)
    await logAuditEvent({
      category: "auth",
      event: "register",
      source: "auth",
      actor: { id: userId, name: `${firstName} ${lastName}`.trim(), role },
      subjectType: "profiles",
      subjectId: userId,
      subjectLabel: `${firstName} ${lastName}`.trim(),
      description: `Self-registered as ${role} (pending approval)`,
      ...ctx,
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error("[/api/register] Error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    )
  }
}
