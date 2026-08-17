import { NextRequest, NextResponse } from "next/server"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { requireActiveSession } from "@/lib/auth-guard"
import { canUseWebsiteBuilder } from "@/lib/app-roles"

// Imports a remote image by URL into our S3 bucket. Poster/flyer tools can't
// use an arbitrary pasted link directly: the CSP img-src allowlist blocks the
// preview and the html-to-image PNG export can't fetch cross-origin hosts —
// both only work for hosts we control, so the image must land on S3 first.
//
// This intentionally fetches user-supplied URLs, so it is role-gated and
// refuses localhost / IP-literal hosts (re-checked after redirects), accepts
// only raster image content types (no SVG — scriptable), and caps the size.

export const runtime = "nodejs"

const MAX_BYTES = 15 * 1024 * 1024

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
}

const s3 = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true // IPv4 literal
  if (h.includes(":")) return true // IPv6 literal
  return false
}

export async function POST(req: NextRequest) {
  const session = await requireActiveSession()
  if (!session.ok) {
    return session.response
  }
  if (!canUseWebsiteBuilder(session.context.profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const bucket = process.env.S3_BUCKET_NAME
  const publicUrl = process.env.S3_PUBLIC_URL
  if (!bucket || !publicUrl) {
    return NextResponse.json({ error: "File storage is not configured" }, { status: 500 })
  }

  const body = (await req.json().catch(() => null)) as { url?: string } | null
  let target: URL
  try {
    target = new URL(body?.url ?? "")
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return NextResponse.json({ error: "Only http(s) links are allowed" }, { status: 400 })
  }
  if (isBlockedHost(target.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 })
  }

  let upstream: Response
  try {
    upstream = await fetch(target.toString(), { redirect: "follow", signal: AbortSignal.timeout(15000) })
  } catch {
    return NextResponse.json({ error: "Could not download the image" }, { status: 502 })
  }
  try {
    if (upstream.url && isBlockedHost(new URL(upstream.url).hostname)) {
      return NextResponse.json({ error: "Host not allowed" }, { status: 403 })
    }
  } catch {
    /* unparseable final URL — fall through to the content checks */
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: `The link returned ${upstream.status}` }, { status: 502 })
  }

  const contentType = (upstream.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
  const ext = EXT_BY_TYPE[contentType]
  if (!ext) {
    return NextResponse.json({ error: "The link is not an image (jpg, png, webp, gif, avif)" }, { status: 415 })
  }
  const buffer = Buffer.from(await upstream.arrayBuffer())
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Image is too large (max 15 MB)" }, { status: 413 })
  }

  const userId = session.context.userId
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const key = `FHI_GLOBAL/website-builder/${userId}/${filename}`

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  )

  const url = `${publicUrl.replace(/\/$/, "")}/${key}`
  return NextResponse.json({ url })
}
