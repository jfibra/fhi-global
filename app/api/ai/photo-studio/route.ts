import { NextRequest, NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { randomUUID } from "node:crypto"
import { requireActiveSession } from "@/lib/auth-guard"
import { isAdminStaffRole } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"

/**
 * AI Photo Studio — virtual staging for listing photos. The user uploads a
 * property photo and a set of edit instructions (add people, furnish, fix
 * the sky…); OpenAI's gpt-image-1 EDITS the actual photo rather than
 * generating a new one. Both the source and the result land in our S3, and
 * every generation is recorded in ai_photo_edits — that history powers the
 * results gallery, chained edits, deletes, and (later) per-user daily caps.
 *
 * GET lists the caller's recent generations.
 */

export const runtime = "nodejs"
// Image editing takes 30–90s. Vercel clamps this to the plan's ceiling.
export const maxDuration = 120

const MAX_BYTES = 12 * 1024 * 1024
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const QUALITIES = new Set(["low", "medium", "high"])
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

const s3 = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

const s3Base = () => (process.env.S3_PUBLIC_URL ?? "").replace(/\/+$/, "")
const STUDIO_PREFIX = "fhi_global/ai-photo-studio/"

async function requireStudioAccess() {
  const session = await requireActiveSession()
  if (!session.ok) return { response: session.response } as const
  // Admin staff only for now — each generation bills the company AI account.
  // Widen to agents later with a per-day cap over ai_photo_edits.
  if (!isAdminStaffRole(session.context.profile.role)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const
  }
  return { context: session.context } as const
}

/** The caller's recent generations, newest first. */
export async function GET() {
  const access = await requireStudioAccess()
  if ("response" in access) return access.response

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("ai_photo_edits")
    .select("id, result_url, source_url, prompt, quality, created_at")
    .eq("user_id", access.context.userId)
    .order("created_at", { ascending: false })
    .limit(40)
  // Pre-migration environments: an empty gallery, not an error page.
  if (error) return NextResponse.json({ rows: [] })
  return NextResponse.json({ rows: data ?? [] })
}

export async function POST(req: NextRequest) {
  const access = await requireStudioAccess()
  if ("response" in access) return access.response

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
  // Set when the edit chains off an earlier result: that result's URL is the
  // source of record, so history shows the true before/after of THIS step.
  const chainedSource = String(form?.get("sourceUrl") ?? "").trim()

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
  if (chainedSource && !chainedSource.startsWith(`${s3Base()}/${STUDIO_PREFIX}`)) {
    return NextResponse.json({ error: "Invalid source." }, { status: 400 })
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

  // Durable copies in our own bucket. A fresh upload also stores the source
  // (as src-*), so the gallery can replay the before/after; a chained edit
  // records the earlier result's URL instead of re-uploading it.
  const bytes = Buffer.from(b64, "base64")
  const resultKey = `${STUDIO_PREFIX}${randomUUID()}.webp`
  const puts: Promise<unknown>[] = [
    s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: resultKey,
        Body: bytes,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    ),
  ]
  let sourceUrl = chainedSource || null
  if (!sourceUrl) {
    const ext = EXT_BY_TYPE[image.type] ?? "jpg"
    const sourceKey = `${STUDIO_PREFIX}src-${randomUUID()}.${ext}`
    puts.push(
      s3.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME!,
          Key: sourceKey,
          Body: Buffer.from(await image.arrayBuffer()),
          ContentType: image.type || "image/jpeg",
          CacheControl: "public, max-age=31536000, immutable",
        }),
      ),
    )
    sourceUrl = `${s3Base()}/${sourceKey}`
  }
  await Promise.all(puts)

  const resultUrl = `${s3Base()}/${resultKey}`

  // The gallery record. A failed insert must not eat a paid generation —
  // return the image either way.
  const admin = createAdminSupabase()
  const { data: row, error: insertError } = await admin
    .from("ai_photo_edits")
    .insert({
      user_id: access.context.userId,
      result_url: resultUrl,
      source_url: sourceUrl,
      prompt: prompt.slice(0, 2000),
      quality,
    })
    .select("id")
    .maybeSingle<{ id: string }>()
  if (insertError) {
    console.warn("[ai/photo-studio] history insert failed:", insertError.message)
  }

  return NextResponse.json({ url: resultUrl, sourceUrl, id: row?.id ?? null })
}
