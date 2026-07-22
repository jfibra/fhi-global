import { NextRequest, NextResponse } from "next/server"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { requireActiveSession } from "@/lib/auth-guard"
import { isAdminStaffRole } from "@/lib/app-roles"

const s3 = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

export async function POST(req: NextRequest) {
  const session = await requireActiveSession()
  if (!session.ok) {
    return session.response
  }
  if (!isAdminStaffRole(session.context.profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const bucket = process.env.S3_BUCKET_NAME
  const publicUrl = process.env.S3_PUBLIC_URL
  if (!bucket || !publicUrl) {
    return NextResponse.json({ error: "File storage is not configured" }, { status: 500 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed" }, { status: 415 })
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const key = `FHI_GLOBAL/events/${filename}`

  const buffer = Buffer.from(await file.arrayBuffer())

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: file.type || "image/jpeg",
    }),
  )

  const url = `${publicUrl.replace(/\/$/, "")}/${key}`
  return NextResponse.json({ url })
}
