import { NextRequest, NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { isAdminOrDeveloperUploadRole } from "@/lib/app-roles"
import { createClient } from "@/lib/supabase/server"

// Images arrive already resized + WebP-encoded by the browser
// (lib/upload/compress-image.ts), so this route just stores what it is given.

const s3 = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

// A project's media (photos, brochures, floor plans, permit QR images) is uploaded from the project
// dashboards by the people who maintain projects. Until now ANY signed-in account could write to the shared
// bucket through this route; it now takes the same roles as the developer upload.
const MAX_BYTES = 50 * 1024 * 1024 // brochures can be large; photos arrive far smaller (browser-compressed)
// Active content has no place in a public media bucket: a stored .html or .svg would run scripts on that origin.
const BLOCKED_TYPES = new Set(["text/html", "application/xhtml+xml", "image/svg+xml", "text/javascript", "application/javascript"])
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,80}$/i

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (!profile || !isAdminOrDeveloperUploadRole(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  // The slugs become path segments of the object key: anything that is not a plain slug falls back to a safe default.
  const rawDeveloper = (formData.get("developer_slug") as string | null) ?? ""
  const rawProject = (formData.get("project_slug") as string | null) ?? ""
  const developerSlug = SLUG_RE.test(rawDeveloper) ? rawDeveloper.toLowerCase() : "unknown"
  const projectSlug = SLUG_RE.test(rawProject) ? rawProject.toLowerCase() : "general"

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File exceeds the 50 MB limit" }, { status: 413 })
  if (BLOCKED_TYPES.has((file.type ?? "").toLowerCase())) {
    return NextResponse.json({ error: "That file type is not allowed" }, { status: 415 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = (file.name.split(".").pop()?.toLowerCase() ?? "jpg").replace(/[^a-z0-9]/g, "").slice(0, 8) || "jpg"
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const key = `FHI_GLOBAL/${developerSlug}/${projectSlug}/${filename}`

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    })
  )

  const url = `${process.env.S3_PUBLIC_URL}/${key}`
  return NextResponse.json({ url })
}
