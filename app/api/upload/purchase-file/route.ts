import { NextRequest, NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { isAdminStaffRole } from "@/lib/app-roles"
import { createClient } from "@/lib/supabase/server"
import { compressImageForUpload } from "@/lib/upload/compress-image"

// sharp is a native module — it cannot run on the Edge runtime, so pin Node
// explicitly rather than relying on the default. Image compression is also
// CPU-bound, so allow more than the default execution window.
export const runtime = "nodejs"
export const maxDuration = 60

const s3 = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId:     process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

const CONTENT_TYPE_MAP: Record<string, string> = {
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  png:  "image/png",
  webp: "image/webp",
  gif:  "image/gif",
  svg:  "image/svg+xml",
  pdf:  "application/pdf",
  doc:  "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls:  "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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

    const formData  = await request.formData()
    const file       = formData.get("file")       as Blob   | null
    const purchaseId = formData.get("purchaseId") as string | null

    if (!file || !purchaseId) {
      return NextResponse.json({ error: "Missing file or purchaseId" }, { status: 400 })
    }

    const maxSize = 25 * 1024 * 1024 // 25 MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File exceeds 25 MB limit" }, { status: 413 })
    }

    const originalName = (file as File).name ?? "upload"
    const ext          = originalName.split(".").pop()?.toLowerCase() ?? "bin"

    const rawBuffer = Buffer.from(await file.arrayBuffer())
    // Only receipt/attachment photos (jpeg/png/webp) get compressed; every
    // other attachment type (pdf, doc, xlsx, csv, …) passes through unchanged.
    const { buffer, contentType, compressed } = await compressImageForUpload(
      rawBuffer,
      CONTENT_TYPE_MAP[ext] ?? "application/octet-stream",
    )
    // Compression changes the actual bytes to webp, so the stored filename and
    // the file_name/file_type the UI displays must follow — otherwise a "Receipt.jpg"
    // label would point at webp-encoded bytes.
    const finalExt  = compressed ? "webp" : ext
    const finalName = compressed
      ? originalName.replace(/\.[^./]+$/, "") + ".webp"
      : originalName

    // S3 path: FHI_GLOBAL/purchases/{year}/{purchaseId}/{timestamp}-{filename}
    const year      = new Date().getFullYear()
    const timestamp = Date.now()
    const safeName  = finalName.replace(/[^a-zA-Z0-9._-]/g, "_")
    const key       = `FHI_GLOBAL/purchases/${year}/${purchaseId}/${timestamp}-${safeName}`

    await s3.send(
      new PutObjectCommand({
        Bucket:      process.env.S3_BUCKET_NAME!,
        Key:         key,
        Body:        buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000",
      }),
    )

    const publicUrl = `${process.env.S3_PUBLIC_URL}/${key}`

    return NextResponse.json({
      url:       publicUrl,
      file_name: finalName,
      file_type: finalExt.toUpperCase(),
    })
  } catch (err) {
    console.error("[purchase-file-upload]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
