import { NextRequest, NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { randomUUID } from "crypto"

/**
 * POST /api/upload/register-id
 *
 * Pre-authentication file upload for registration ID documents.
 * Files are stored in a temporary path and referenced during final submission.
 * No auth required â€” files are stored in temp/ prefix and validated by size/type.
 *
 * Body: FormData { file: File, sessionToken: string }
 * Response: { url, key }
 */

const s3 = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId:     process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"])
const MAX_SIZE      = 10 * 1024 * 1024 // 10 MB

export async function POST(req: NextRequest) {
  try {
    const fd           = await req.formData()
    const file         = fd.get("file") as File | null
    const sessionToken = (fd.get("sessionToken") as string | null) ?? randomUUID()

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only JPG, PNG and PDF are accepted." }, { status: 415 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File exceeds the 10 MB size limit." }, { status: 413 })
    }

    const ext    = file.name.split(".").pop()?.toLowerCase() ?? "bin"
    const fileId = randomUUID()
    const key    = `fhi_global/temp/${sessionToken}/ids/${fileId}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())

    await s3.send(new PutObjectCommand({
      Bucket:      process.env.S3_BUCKET_NAME!,
      Key:         key,
      Body:        buffer,
      ContentType: file.type,
    }))

    const url = `${process.env.S3_PUBLIC_URL}/${key}`

    return NextResponse.json({ url, key })
  } catch (err: unknown) {
    console.error("[/api/upload/register-id]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    )
  }
}
