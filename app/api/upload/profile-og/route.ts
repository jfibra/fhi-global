import { NextRequest, NextResponse } from "next/server"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { createClient } from "@/lib/supabase/server"

// Rendered link-preview card for a public profile.
//
// The browser renders the agent's chosen Business Card front to a canvas
// (features/business-card/card-render.ts) and posts the PNG here on save; the
// stored URL becomes og:image on /business-card/[id]. Same contract as the
// other upload routes — this one just stores what it is given.
//
// A canvas render, not a user file: still size- and type-checked, because the
// route is reachable by any signed-in user with a fetch call.

const s3 = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

const MAX_SIZE = 8 * 1024 * 1024

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const bucket = process.env.S3_BUCKET_NAME
  const publicUrl = process.env.S3_PUBLIC_URL
  if (!bucket || !publicUrl) {
    return NextResponse.json({ error: "File storage is not configured" }, { status: 500 })
  }

  // Names the failing stage, so a 500 here is diagnosable from the Network tab.
  let stage = "reading the upload"
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 })
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are supported" }, { status: 415 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File exceeds 8 MB limit" }, { status: 413 })
    }

    stage = "uploading to S3"
    // Keyed by the caller's own id, so one user can never overwrite another's.
    const ext = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg"
    const key = `FHI_GLOBAL/profile-og/${user.id}/${Date.now()}.${ext}`

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from(await file.arrayBuffer()),
        ContentType: file.type,
        CacheControl: "public, max-age=31536000",
      }),
    )

    return NextResponse.json({ url: `${publicUrl.replace(/\/$/, "")}/${key}` })
  } catch (err) {
    console.error("[upload/profile-backdrop] failed while", stage, err)
    return NextResponse.json(
      { error: `Failed while ${stage}: ${err instanceof Error ? err.message : String(err)}`, stage },
      { status: 500 },
    )
  }
}
