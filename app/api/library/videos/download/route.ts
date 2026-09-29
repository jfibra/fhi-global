import { NextRequest, NextResponse } from "next/server"
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_INTERNAL_RESOURCES } from "@/lib/app-roles"
import { LIBRARY_VIDEOS, filmKey } from "@/lib/films"

/**
 * Library → Videos download. The films are public on S3 for streaming, but a
 * cross-origin <a download> is ignored by browsers (they just play the MP4),
 * so this signs a short-lived S3 URL carrying `Content-Disposition:
 * attachment` and redirects to it: the browser saves the file under a clean
 * name and no video bytes pass through our server. Internal roles only, like
 * the rest of the Library.
 */

export const runtime = "nodejs"

const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

export async function GET(req: NextRequest) {
  const guard = await requireRole([...ROLES_INTERNAL_RESOURCES])
  if (!guard.ok) return guard.response

  const id = req.nextUrl.searchParams.get("id") ?? ""
  const quality = req.nextUrl.searchParams.get("q") === "sd" ? "sd" : "hd"
  const video = LIBRARY_VIDEOS.find((v) => v.film.id === id)
  if (!video) return NextResponse.json({ error: "Video not found." }, { status: 404 })

  const fileName = `${video.file}-${quality === "sd" ? "720p" : "1080p"}.mp4`
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: filmKey(video.film[quality]),
      ResponseContentDisposition: `attachment; filename="${fileName}"`,
      ResponseContentType: "video/mp4",
    }),
    { expiresIn: 600 },
  )
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } })
}
