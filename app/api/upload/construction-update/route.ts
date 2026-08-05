import { NextRequest, NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { canManageDeveloperContent, isDeveloperRole } from "@/lib/app-roles"
import { createClient } from "@/lib/supabase/server"

// Stores a construction-update file (PDF or image) for a project. Role-guarded
// to project managers (admin/editor) or developers; the row that links the file
// to a project is created + ownership-checked separately by
// /api/projects/[id]/construction-updates.

const s3 = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg",
  png: "image/png", webp: "image/webp",
  gif: "image/gif", svg: "image/svg+xml",
  pdf: "application/pdf",
}

const MAX_SIZE = 30 * 1024 * 1024 // 30 MB — construction PDFs can run long

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    const role = profile?.role ?? null
    if (!canManageDeveloperContent(role) && !isDeveloperRole(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as Blob | null
    const developerSlug = (formData.get("developer_slug") as string | null) ?? "unknown"
    const projectSlug = (formData.get("project_slug") as string | null) ?? "general"
    if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 })
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "File exceeds the 30 MB limit" }, { status: 413 })

    const originalName = (file as File).name ?? "upload"
    const ext = originalName.split(".").pop()?.toLowerCase() ?? "bin"
    const contentType = CONTENT_TYPES[ext]
    if (!contentType) {
      return NextResponse.json({ error: "Only PDF or image files are allowed." }, { status: 415 })
    }

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const key = `FHI_GLOBAL/${developerSlug}/${projectSlug}/construction/${filename}`
    const buffer = Buffer.from(await file.arrayBuffer())

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000",
      }),
    )

    return NextResponse.json({ url: `${process.env.S3_PUBLIC_URL}/${key}` })
  } catch (err) {
    console.error("[construction-update-upload]", err)
    return NextResponse.json(
      { error: err instanceof Error ? `Upload failed: ${err.message}` : "Upload failed" },
      { status: 500 },
    )
  }
}
