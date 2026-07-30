import { NextRequest, NextResponse } from "next/server"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"

// Admin-only test bench for the upload pipeline. Compression itself now happens
// in the BROWSER (lib/upload/compress-image.ts) before anything is sent, so this
// route's only job is to store both files the client hands it — the original it
// started from and the compressed result — under a clearly-marked test prefix,
// and hand back their URLs so they can be compared at full resolution.
//
// It deliberately does no image processing: that would be testing a different
// code path than the one real uploads take.

const s3 = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

const MAX_SIZE = 25 * 1024 * 1024 // 25 MB — generous; this is for testing large phone-camera photos

export async function POST(req: NextRequest) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const bucket = process.env.S3_BUCKET_NAME
  const publicUrl = process.env.S3_PUBLIC_URL
  if (!bucket || !publicUrl) {
    return NextResponse.json({ error: "File storage is not configured" }, { status: 500 })
  }

  // Reports which stage failed and why — a bare 500 here would defeat the
  // entire purpose of a diagnostic tool.
  let stage = "reading the upload"
  try {
    const formData = await req.formData()
    const original = formData.get("original") as File | null
    const result = formData.get("result") as File | null

    if (!original || !result) {
      return NextResponse.json(
        { error: "Both the original and the compressed result are required" },
        { status: 400 },
      )
    }
    if (!original.type.startsWith("image/") || !result.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are supported here" }, { status: 415 })
    }
    if (original.size > MAX_SIZE) {
      return NextResponse.json({ error: "File exceeds 25 MB limit" }, { status: 413 })
    }

    stage = "uploading to S3"
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const base = `FHI_GLOBAL/_dev-upload-test/${stamp}`
    const extOf = (f: File) => f.name.split(".").pop()?.toLowerCase() || "bin"

    const put = async (file: File, label: string) => {
      const key = `${base}-${label}.${extOf(file)}`
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: Buffer.from(await file.arrayBuffer()),
          ContentType: file.type,
        }),
      )
      return `${publicUrl.replace(/\/$/, "")}/${key}`
    }

    const [originalUrl, resultUrl] = await Promise.all([
      put(original, "original"),
      put(result, "result"),
    ])

    return NextResponse.json({ originalUrl, resultUrl })
  } catch (err) {
    console.error("[test-compress] failed while", stage, err)
    return NextResponse.json(
      {
        error: `Failed while ${stage}: ${err instanceof Error ? err.message : String(err)}`,
        stage,
      },
      { status: 500 },
    )
  }
}
