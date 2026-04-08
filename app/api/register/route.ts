import { NextRequest, NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { createAdminSupabase } from "@/lib/admin-supabase"

// ── S3 client ─────────────────────────────────────────────────────────────────

const s3 = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId:     process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

async function uploadFileToS3(buffer: Buffer, key: string, contentType: string): Promise<string> {
  await s3.send(new PutObjectCommand({
    Bucket:      process.env.S3_BUCKET_NAME!,
    Key:         key,
    Body:        buffer,
    ContentType: contentType,
  }))
  return `${process.env.S3_PUBLIC_URL}/${key}`
}

// ── Slug helper ───────────────────────────────────────────────────────────────

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

// ── POST /api/register ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const fd            = await req.formData()
    const accountType   = fd.get("accountType")   as string
    const firstName     = fd.get("firstName")     as string
    const lastName      = fd.get("lastName")      as string
    const email         = fd.get("email")         as string
    const password      = fd.get("password")      as string
    const companyName   = fd.get("companyName")   as string | null
    const primaryIdFile = fd.get("primaryId")     as File | null
    const secondaryFile = fd.get("secondaryId")   as File | null
    const faceFile      = fd.get("faceBlob")      as File | null
    const ocrRaw        = fd.get("ocrData")       as string | null

    if (!accountType || !firstName || !lastName || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const ocrData = ocrRaw ? JSON.parse(ocrRaw) : null

    const isSalesperson = accountType === "salesperson"
    const isDeveloper   = accountType === "developer"
    const role          = isDeveloper ? "developer" : "agent"

    const supabase = createAdminSupabase()

    // ── 1. Create the auth user ──────────────────────────────────────────────
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm:   false,
      user_metadata: {
        first_name:  firstName,
        last_name:   lastName,
        account_type: accountType,
      },
    })

    if (authError || !authData?.user) {
      return NextResponse.json({ error: authError?.message ?? "Failed to create user" }, { status: 400 })
    }

    const userId = authData.user.id
    const now    = new Date()
    const year   = now.getFullYear().toString()
    const month  = String(now.getMonth() + 1).padStart(2, "0")

    // ── 2. Update profile: role + status ────────────────────────────────────
    await supabase
      .from("profiles")
      .update({ role, status: "pending" })
      .eq("id", userId)

    // ── 3. Developer path ────────────────────────────────────────────────────
    if (isDeveloper && companyName) {
      const baseSlug = slugify(companyName)
      // Ensure slug uniqueness by appending a short random suffix
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`
      await supabase.from("developers").insert({
        name:       companyName.trim(),
        slug,
        email,
        is_active:    false,
        is_verified:  false,
      })
    }

    // ── 4. Salesperson path: upload docs + insert records ───────────────────
    if (isSalesperson) {
      let primaryUrl   = ""
      let secondaryUrl = ""
      let faceUrl      = ""

      if (primaryIdFile && primaryIdFile.size > 0) {
        const buf = Buffer.from(await primaryIdFile.arrayBuffer())
        const ext = primaryIdFile.name.split(".").pop() ?? "jpg"
        const key = `fhi_global/users/${userId}/ids/${year}/${month}/primary.${ext}`
        primaryUrl = await uploadFileToS3(buf, key, primaryIdFile.type || "image/jpeg")
      }

      if (secondaryFile && secondaryFile.size > 0) {
        const buf = Buffer.from(await secondaryFile.arrayBuffer())
        const ext = secondaryFile.name.split(".").pop() ?? "jpg"
        const key = `fhi_global/users/${userId}/ids/${year}/${month}/secondary.${ext}`
        secondaryUrl = await uploadFileToS3(buf, key, secondaryFile.type || "image/jpeg")
      }

      if (faceFile && faceFile.size > 0) {
        const buf = Buffer.from(await faceFile.arrayBuffer())
        const key = `fhi_global/users/${userId}/face_verification/${year}/${month}/selfie.jpg`
        faceUrl   = await uploadFileToS3(buf, key, "image/jpeg")
      }

      // 4a. Ensure "Emirates ID / Passport" type exists (upsert by name)
      let primaryTypeId: string | null   = null
      let secondaryTypeId: string | null = null

      const { data: existingTypes } = await supabase
        .from("user_id_types")
        .select("id, name")
        .in("name", ["Primary ID", "Secondary ID"])

      const typeMap = new Map((existingTypes ?? []).map((t: { id: string; name: string }) => [t.name, t.id]))
      if (!typeMap.has("Primary ID")) {
        const { data } = await supabase.from("user_id_types").insert({ name: "Primary ID",   description: "Emirates ID, Passport or equivalent" }).select("id").single()
        if (data) primaryTypeId = data.id
      } else { primaryTypeId = typeMap.get("Primary ID") ?? null }

      if (!typeMap.has("Secondary ID")) {
        const { data } = await supabase.from("user_id_types").insert({ name: "Secondary ID", description: "Driver's License, Visa or equivalent" }).select("id").single()
        if (data) secondaryTypeId = data.id
      } else { secondaryTypeId = typeMap.get("Secondary ID") ?? null }

      // 4b. Insert identification record
      let identificationId: string | null = null
      if (primaryTypeId && ocrData?.idNumber) {
        const { data: idRow } = await supabase
          .from("user_identifications")
          .insert({
            user_id:             userId,
            id_type_id:          primaryTypeId,
            id_number:           ocrData.idNumber,
            country_code:        (ocrData.countryCode ?? "AE").slice(0, 2),
            expiry_date:         ocrData.expiryDate   || null,
            issue_date:          ocrData.dateOfBirth  || null,
            verification_status: "pending",
            metadata: { name: ocrData.name },
          })
          .select("id")
          .single()
        if (idRow) identificationId = idRow.id
      }

      // 4c. Insert file attachment rows
      const attachments = [
        primaryUrl   && primaryIdFile  ? { label: "Primary ID",   url: primaryUrl,   file: primaryIdFile,  typeId: primaryTypeId   } : null,
        secondaryUrl && secondaryFile  ? { label: "Secondary ID", url: secondaryUrl, file: secondaryFile,  typeId: secondaryTypeId } : null,
        faceUrl      && faceFile       ? { label: "Selfie",       url: faceUrl,      file: faceFile,       typeId: null            } : null,
      ].filter(Boolean)

      for (const att of attachments) {
        if (!att) continue
        await supabase.from("user_file_attachments").insert({
          user_id:       userId,
          id_record_id:  att.typeId === primaryTypeId ? identificationId : null,
          file_label:    att.label,
          file_category: att.label === "Selfie" ? "face_verification" : "identity_document",
          file_name:     att.file.name,
          file_url:      att.url,
          file_type:     att.file.type,
          file_size:     att.file.size,
          uploaded_by:   userId,
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error("[/api/register] Error:", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 })
  }
}
