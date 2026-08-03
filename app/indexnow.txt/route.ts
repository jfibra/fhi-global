import { indexNowConfigured, indexNowKey } from "@/lib/indexnow"

/** IndexNow key file — proves ownership of this origin to api.indexnow.org. */
export const dynamic = "force-dynamic"

export async function GET() {
  if (!indexNowConfigured()) return new Response("Not found", { status: 404 })
  return new Response(indexNowKey(), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  })
}
