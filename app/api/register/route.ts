import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

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
      email_confirm: false,
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

    await supabase.from("profiles").update({ role, status: "pending" }).eq("id", userId)

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

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error("[/api/register] Error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    )
  }
}
