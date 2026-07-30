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

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg",
  png: "image/png",  webp: "image/webp",
  gif: "image/gif",  svg: "image/svg+xml",
  pdf: "application/pdf",
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

    const roleValue = String(profile?.role ?? "").toLowerCase().trim()
    if (!profile || !isAdminStaffRole(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const formData = await request.formData()
    const file     = formData.get("file")     as Blob | null
    const teamSlug = formData.get("teamSlug") as string | null

    if (!file || !teamSlug) {
      return NextResponse.json({ error: "Missing file or teamSlug" }, { status: 400 })
    }

    const maxSize = 10 * 1024 * 1024 // 10 MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 413 })
    }

    const originalName = (file as File).name ?? "upload"
    const ext          = originalName.split(".").pop()?.toLowerCase() ?? "png"
    const timestamp    = Date.now()

    const rawBuffer = Buffer.from(await file.arrayBuffer())
    // gif/svg/pdf pass through unchanged — compressImageForUpload only acts on
    // jpeg/png/webp.
    const { buffer, contentType, compressed } = await compressImageForUpload(
      rawBuffer,
      CONTENT_TYPES[ext] ?? "application/octet-stream",
    )
    const finalExt = compressed ? "webp" : ext
    const key      = `FHI_GLOBAL/${teamSlug}/${timestamp}-logo.${finalExt}`

    await s3.send(
      new PutObjectCommand({
        Bucket:       process.env.S3_BUCKET_NAME!,
        Key:          key,
        Body:         buffer,
        ContentType:  contentType,
        CacheControl: "public, max-age=31536000",
      }),
    )

    const publicUrl = `${process.env.S3_PUBLIC_URL}/${key}`
    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    console.error("[team-upload]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
