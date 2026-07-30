import { NextRequest, NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
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
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const developerSlug = (formData.get("developer_slug") as string | null) ?? "unknown"
  const projectSlug = (formData.get("project_slug") as string | null) ?? "general"

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

  const rawBuffer = Buffer.from(await file.arrayBuffer())
  const { buffer, contentType, compressed } = await compressImageForUpload(rawBuffer, file.type)
  const ext = compressed ? "webp" : (file.name.split(".").pop()?.toLowerCase() ?? "jpg")
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const key = `FHI_GLOBAL/${developerSlug}/${projectSlug}/${filename}`

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  )

  const url = `${process.env.S3_PUBLIC_URL}/${key}`
  return NextResponse.json({ url })
}
