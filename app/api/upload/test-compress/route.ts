import { NextRequest, NextResponse } from "next/server"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import sharp from "sharp"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { compressImageForUpload } from "@/lib/upload/compress-image"

// sharp is a native module — it cannot run on the Edge runtime, so pin Node
// explicitly rather than relying on the default. Image compression is also
// CPU-bound, so allow more than the default execution window.
export const runtime = "nodejs"
export const maxDuration = 60

// Admin-only test bench for the upload-compression pipeline (see
// lib/upload/compress-image.ts) — lets an admin throw any real image at the
// exact code every upload route runs and see before/after numbers, without
// needing a real listing/avatar/logo to attach it to. Uploads both the
// original and the compressed result to S3 under a clearly-marked test prefix
// so the output can be eyeballed at full resolution, and so it's obviously not
// production content if anyone stumbles on the bucket path.

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

  // This is the admin-only diagnostic tool, so it reports exactly which
  // stage failed and why — a bare 500 here would defeat its whole purpose.
  let stage = "reading the upload"
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are supported here" }, { status: 415 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File exceeds 25 MB limit" }, { status: 413 })
    }

    stage = "decoding the image"
    const originalBuffer = Buffer.from(await file.arrayBuffer())
    const originalMeta = await sharp(originalBuffer).metadata().catch(() => null)

    stage = "compressing"
    const { buffer: compressedBuffer, contentType, compressed } = await compressImageForUpload(
      originalBuffer,
      file.type,
    )
    const compressedMeta = compressed
      ? await sharp(compressedBuffer).metadata().catch(() => null)
      : originalMeta

    stage = "uploading to S3"
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const base = `FHI_GLOBAL/_dev-upload-test/${stamp}`
    const originalExt = file.name.split(".").pop()?.toLowerCase() || "jpg"

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `${base}-original.${originalExt}`,
        Body: originalBuffer,
        ContentType: file.type,
      }),
    )
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `${base}-result.${compressed ? "webp" : originalExt}`,
        Body: compressedBuffer,
        ContentType: contentType,
      }),
    )

    const origin = publicUrl.replace(/\/$/, "")

    return NextResponse.json({
      compressed,
      original: {
        url: `${origin}/${base}-original.${originalExt}`,
        bytes: originalBuffer.byteLength,
        contentType: file.type,
        width: originalMeta?.width ?? null,
        height: originalMeta?.height ?? null,
      },
      result: {
        url: `${origin}/${base}-result.${compressed ? "webp" : originalExt}`,
        bytes: compressedBuffer.byteLength,
        contentType,
        width: compressedMeta?.width ?? null,
        height: compressedMeta?.height ?? null,
      },
    })

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
