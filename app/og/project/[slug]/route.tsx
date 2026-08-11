import { readFile } from "node:fs/promises"
import path from "node:path"
import { ImageResponse } from "next/og"
import { createAdminSupabase } from "@/lib/admin-supabase"

export const runtime = "nodejs"

// Fallback background when a project has no main_image. Read off disk and
// memoized as a data URL (satori can't fetch relative URLs) — same trick as
// app/og/business-card's logoDataUrl. Replaces the legacy Supabase JPG, whose
// host now answers HTTP 402.
let ogDefaultDataUrl: string | null = null
async function defaultBackground(): Promise<string> {
  if (!ogDefaultDataUrl) {
    const buf = await readFile(path.join(process.cwd(), "public", "og-default.jpg"))
    ogDefaultDataUrl = `data:image/jpeg;base64,${buf.toString("base64")}`
  }
  return ogDefaultDataUrl
}

// Without this header ImageResponse defaults to a YEAR of immutable caching —
// scrapers would keep a stale card forever after the project's image or name
// changes. 5 minutes matches app/og/business-card. (Being a fresh Response per
// request, the constant is safe to share.)
const CACHE_HEADERS = { "cache-control": "public, max-age=300, s-maxage=300" }

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  const supabase = createAdminSupabase()

  const { data } = await supabase
    .from("projects")
    .select("name, city, location, main_image, developers(name)")
    .eq("slug", slug)
    .eq("is_active", true)
    .eq("is_published", true)
    .is("deleted_at", null)
    .maybeSingle()

  const title = data?.name ?? "FHI Global Project"
  // developers(name) is a to-one embed → an OBJECT, not an array; the old
  // [0] access made the developer name silently vanish from every card.
  const developerName = (data?.developers as unknown as { name?: string | null } | null)?.name
  const subtitle = [developerName, data?.city ?? data?.location].filter(Boolean).join(" • ")
  const image = data?.main_image ?? (await defaultBackground())

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          fontFamily: "Arial, sans-serif",
          color: "white",
          background: "#001f3f",
        }}
      >
        <img
          src={image}
          alt={title}
          width={1200}
          height={630}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            position: "absolute",
            inset: 0,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,20,40,0.2) 0%, rgba(0,20,40,0.85) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 48,
            right: 48,
            bottom: 44,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 22, color: "#d6b357", fontWeight: 700 }}>FHI Global • Project</div>
          <div style={{ fontSize: 56, lineHeight: 1.05, fontWeight: 800, maxWidth: "90%" }}>{title}</div>
          <div style={{ fontSize: 28, opacity: 0.9 }}>{subtitle || "Dubai Real Estate"}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: CACHE_HEADERS },
  )
}
