import { NextRequest, NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { isAdminStaffRole } from "@/lib/app-roles"
import { createClient } from "@/lib/supabase/server"

/**
 * Uploads one document-template file (DLD forms, agreements, company
 * templates — see the Documents tab under Library) to S3. Admin-staff only.
 *
 * This route only handles the file → S3 → URL step, the same split the other
 * upload/* routes use: the caller inserts the catalog row itself afterward
 * (lib/document-service.ts), with the title/category the admin typed in.
 */

const s3 = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId:     process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

// Document templates only — not an open file-upload endpoint. An unlisted
// extension is rejected rather than silently stored as octet-stream.
const CONTENT_TYPE_MAP: Record<string, string> = {
  pdf:  "application/pdf",
  doc:  "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls:  "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt:  "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt:  "text/plain",
  csv:  "text/csv",
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !isAdminStaffRole(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as Blob | null

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 })
    }

    const maxSize = 25 * 1024 * 1024 // 25 MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File exceeds 25 MB limit" }, { status: 413 })
    }

    const originalName = (file as File).name ?? "document"
    const ext = originalName.split(".").pop()?.toLowerCase() ?? ""
    const contentType = CONTENT_TYPE_MAP[ext]

    if (!contentType) {
      return NextResponse.json(
        { error: "Unsupported file type. Allowed: PDF, Word, Excel, PowerPoint, TXT, CSV." },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // S3 path: FHI_GLOBAL/documents/{year}/{timestamp}-{filename}
    const year = new Date().getFullYear()
    const timestamp = Date.now()
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_")
    const key = `FHI_GLOBAL/documents/${year}/${timestamp}-${safeName}`

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000",
      }),
    )

    const publicUrl = `${process.env.S3_PUBLIC_URL}/${key}`

    return NextResponse.json({
      url: publicUrl,
      file_name: originalName,
      file_size: file.size,
      mime_type: contentType,
    })
  } catch (err) {
    console.error("[document-upload]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
