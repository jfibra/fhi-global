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

export async function POST(request: NextRequest) {
  try {
    // Authenticate the caller
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as Blob | null
    const userId = formData.get("userId") as string | null

    if (!file || !userId) {
      return NextResponse.json({ error: "Missing file or userId" }, { status: 400 })
    }

    // Security: users may only upload their own avatar
    if (userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const maxSize = 5 * 1024 * 1024 // 5 MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File exceeds 5 MB limit" }, { status: 413 })
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer())
    // The cropper always exports image/jpeg (see profile-avatar-upload.tsx),
    // so that's the type fed into compression regardless of the Blob's own type.
    const { buffer, contentType, compressed } = await compressImageForUpload(rawBuffer, "image/jpeg")
    const timestamp = Date.now()
    const key = `avatars/${userId}/${timestamp}.${compressed ? "webp" : "jpg"}`

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

    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    console.error("[avatar-upload]", err)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
