import { requireActiveSession } from "@/lib/auth-guard"

/**
 * Same-origin proxy for the logged-in user's profile photo.
 *
 * The business card renders the avatar onto a <canvas> and exports it with
 * toDataURL(), which requires a CORS-clean image. Avatars live on hosts we
 * don't control CORS for (S3, Google), so we stream the bytes through our own
 * origin instead of loading them cross-origin.
 */
export async function GET() {
  const guard = await requireActiveSession()
  if (!guard.ok) return guard.response

  const { profile } = guard.context

  const url = typeof profile.profile_url === "string" ? profile.profile_url.trim() : ""
  if (!url || !/^https?:\/\//i.test(url)) {
    return new Response("No avatar", { status: 404 })
  }

  let upstream: Response
  try {
    upstream = await fetch(url, { cache: "no-store" })
  } catch {
    return new Response("Avatar fetch failed", { status: 502 })
  }
  if (!upstream.ok || !upstream.body) {
    return new Response("Avatar fetch failed", { status: 502 })
  }

  const contentType = upstream.headers.get("content-type") ?? "image/jpeg"
  if (!contentType.startsWith("image/")) {
    return new Response("Not an image", { status: 415 })
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300",
    },
  })
}
