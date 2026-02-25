import { NextRequest, NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { createClient } from "@/lib/supabase/server"

const s3 = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId:     process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

export async function POST(request: NextRequest) {
  try {
    // Only admins / super admins may upload developer logos
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
    if (!profile || !["super_admin", "admin", "developer"].includes(roleValue)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const formData   = await request.formData()
    const file       = formData.get("file")       as Blob   | null
    const developerSlug = formData.get("developerSlug") as string | null

    if (!file || !developerSlug) {
      return NextResponse.json({ error: "Missing file or developerSlug" }, { status: 400 })
    }

    const maxSize = 10 * 1024 * 1024 // 10 MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 413 })
    }

    const originalName = (file as File).name ?? "upload"
    const ext          = originalName.split(".").pop()?.toLowerCase() ?? "png"
    const timestamp    = Date.now()
    const key          = `FHI_GLOBAL/${developerSlug}/${timestamp}-logo.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())

    const contentTypeMap: Record<string, string> = {
      jpg: "image/jpeg", jpeg: "image/jpeg",
      png: "image/png", webp: "image/webp",
      gif: "image/gif", svg: "image/svg+xml",
      pdf: "application/pdf",
    }

    await s3.send(
      new PutObjectCommand({
        Bucket:       process.env.S3_BUCKET_NAME!,
        Key:          key,
        Body:         buffer,
        ContentType:  contentTypeMap[ext] ?? "application/octet-stream",
        CacheControl: "public, max-age=31536000",
      }),
    )

    const publicUrl = `${process.env.S3_PUBLIC_URL}/${key}`
    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    console.error("[developer-upload]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
