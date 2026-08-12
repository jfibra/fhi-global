import { NextRequest, NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { randomUUID } from "node:crypto"
import { isAdminStaffRole } from "@/lib/app-roles"
import { createClient } from "@/lib/supabase/server"

// Attachments for dashboard emails (Compose / Reply). Anyone who can send —
// admin staff or a profile with a personal mailbox — may upload; the file
// lands under fhi_global/email-attachments/ (lowercase prefix, matching the
// other communication uploads) and the send request references it by URL.

const s3 = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

// What an email realistically carries. No SVG (scriptable), no executables.
const ALLOWED_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  csv: "text/csv",
}

const MAX_BYTES = 10 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, mailbox_address")
      .eq("id", user.id)
      .single<{ role: string | null; mailbox_address: string | null }>()
    const canSend =
      Boolean(profile) &&
      (isAdminStaffRole(profile!.role) || Boolean((profile!.mailbox_address ?? "").trim()))
    if (!canSend) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 })
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Attachments are limited to 10 MB each." }, { status: 413 })
    }

    const originalName = (file.name || "attachment").slice(-180)
    const ext = originalName.split(".").pop()?.toLowerCase() ?? ""
    const contentType = ALLOWED_TYPES[ext]
    if (!contentType) {
      return NextResponse.json(
        { error: "That file type isn't allowed — images, PDF and office documents only." },
        { status: 415 },
      )
    }

    // Keep the human name readable in the key, but never trust it raw.
    const safeName = originalName
      .split("")
      .map((ch) => (/[a-zA-Z0-9._-]/.test(ch) ? ch : "_"))
      .join("")
    const key = `fhi_global/email-attachments/${randomUUID()}-${safeName}`

    const bytes = Buffer.from(await file.arrayBuffer())
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: key,
        Body: bytes,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    )

    const base = (process.env.S3_PUBLIC_URL ?? "").replace(/\/+$/, "")
    return NextResponse.json({
      url: `${base}/${key}`,
      name: originalName,
      size: file.size,
      type: contentType,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    )
  }
}
