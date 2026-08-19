import { NextRequest, NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { randomUUID } from "node:crypto"
import { requireActiveSession } from "@/lib/auth-guard"
import { isAdminStaffRole } from "@/lib/app-roles"

/**
 * AI Photo Studio — virtual staging for listing photos. The agent uploads a
 * property photo and a set of edit instructions (add people, furnish, fix
 * the sky…); OpenAI's gpt-image-1 EDITS the actual photo rather than
 * generating a new one, and the result is stored in our S3 so the agent gets
 * a durable URL to download and share.
 *
 * Costs real money per image (the key bills per generation), so it sits
 * behind the same role gate as the other Agent Resource studios.
 */

export const runtime = "nodejs"
// Image editing takes 30–90s. Vercel clamps this to the plan's ceiling.
export const maxDuration = 120

const MAX_BYTES = 12 * 1024 * 1024
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const QUALITIES = new Set(["low", "medium", "high"])

const s3 = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

export async function POST(req: NextRequest) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  // Admin staff only for now — each generation bills the company AI
  // account. Widen to agents later with a per-day cap.
  if (!isAdminStaffRole(session.context.profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI photo editing is not configured on the server (OPENAI_API_KEY missing)." },
      { status: 503 },
    )
  }

  const form = await req.formData().catch(() => null)
  const image = form?.get("image")
  const prompt = String(form?.get("prompt") ?? "").trim()
  const qualityRaw = String(form?.get("quality") ?? "medium")
  const quality = QUALITIES.has(qualityRaw) ? qualityRaw : "medium"

  if (!(image instanceof File)) {
    return NextResponse.json({ error: "Attach a photo to edit." }, { status: 400 })
  }
  if (image.size > MAX_BYTES) {
    return NextResponse.json({ error: "Photos are limited to 12 MB." }, { status: 413 })
  }
  if (image.type && !ALLOWED_TYPES.has(image.type)) {
    return NextResponse.json({ error: "Use a JPG, PNG or WebP photo." }, { status: 415 })
  }
  if (!prompt) {
    return NextResponse.json({ error: "Pick at least one edit or describe one." }, { status: 400 })
  }

  // gpt-image-1 edits the supplied photo in place of generating from scratch.
  const upstream = new FormData()
  upstream.append("model", "gpt-image-1")
  upstream.append("image", image, image.name || "photo.png")
  upstream.append("prompt", prompt.slice(0, 4000))
  upstream.append("size", "auto")
  upstream.append("quality", quality)
  upstream.append("output_format", "webp")
  upstream.append("n", "1")

  let res: Response
  try {
    res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    })
  } catch {
    return NextResponse.json(
      { error: "Couldn't reach the image service — try again in a moment." },
      { status: 502 },
    )
  }

  const data = (await res.json().catch(() => null)) as
    | { data?: Array<{ b64_json?: string }>; error?: { message?: string } }
    | null

  if (!res.ok) {
    // Surface the provider's reason (quota, moderation, bad key) honestly —
    // "something went wrong" would make every failure look like our bug.
    const reason = data?.error?.message ?? `Image service error (${res.status})`
    return NextResponse.json({ error: reason }, { status: 502 })
  }

  const b64 = data?.data?.[0]?.b64_json
  if (!b64) {
    return NextResponse.json({ error: "The image service returned no image." }, { status: 502 })
  }

  // Durable copy in our own bucket — the agent gets a link, not a blob.
  const bytes = Buffer.from(b64, "base64")
  const key = `fhi_global/ai-photo-studio/${randomUUID()}.webp`
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: key,
      Body: bytes,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  )

  const base = (process.env.S3_PUBLIC_URL ?? "").replace(/\/+$/, "")
  return NextResponse.json({ url: `${base}/${key}` })
}
