import { ImageResponse } from "next/og"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { isSafeRemoteImageUrl } from "@/lib/image-hosts"
import { ogCacheHeaders, ogColor, ogJpeg, ogPicture } from "@/lib/og-picture"

export const runtime = "nodejs"

// Share card for a developer: the logo on its own tile colour, the name, the address and a line of description.
// The logo goes through ogPicture (the renders on S3 are AVIF/WebP, which Satori draws as nothing; a transparent
// logo is flattened onto the tile's own colour), and the card is returned as a JPEG (a PNG over ~300 KB gets no
// WhatsApp preview). The page's metadata points here with a ?v= token that covers everything drawn
// (lib/og-url.ts), so a COMPLETE card is long-cached; the generic card and a failed logo fetch stay on 5 minutes.
async function render(slug: string) {
  const supabase = createAdminSupabase()

  const { data, error } = await supabase
    .from("developers")
    .select("name, description, logo_url, logo_bg, address")
    .eq("slug", slug)
    // The developer page filters on deleted_at only, so an inactive developer's shared link must not get the generic card.
    .is("deleted_at", null)
    .maybeSingle()

  const title = data?.name ?? "FHI Global Developer"
  // Addresses are free text and can run to a full sentence — one line on the card, clipped at a word-ish length.
  const rawAddress = data?.address?.replace(/\s+/g, " ").trim() || "Dubai, UAE"
  const subtitle = rawAddress.length > 90 ? `${rawAddress.slice(0, 87)}...` : rawAddress
  const description = data?.description ?? "Explore premium developers and projects on FHI Global."
  const tile = ogColor(data?.logo_bg)
  const logoUrl = data?.logo_url && isSafeRemoteImageUrl(data.logo_url) ? data.logo_url : null
  const logo = await ogPicture(logoUrl, 280, 280, "inside", tile)
  // The initial-letter fallback stays on white so it remains legible; a real logo sits on its own colour.
  const complete = !error && Boolean(data) && (!logoUrl || logo !== null)

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
          background: "linear-gradient(135deg, #001428 0%, #001f3f 45%, #002a52 100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.08,
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        <div style={{ display: "flex", width: "100%", padding: "56px", alignItems: "center", gap: 32 }}>
          <div
            style={{
              width: 180,
              height: 180,
              borderRadius: 24,
              background: logo ? tile : "white",
              border: "3px solid rgba(214,179,87,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {logo ? (
              <img src={logo} alt={title} width={140} height={140} style={{ objectFit: "contain" }} />
            ) : (
              <div style={{ color: "#001f3f", fontWeight: 800, fontSize: 56 }}>{title.charAt(0)}</div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 22, color: "#d6b357", fontWeight: 700 }}>FHI Global • Developer</div>
            <div style={{ fontSize: 60, lineHeight: 1.05, fontWeight: 800 }}>{title}</div>
            <div style={{ fontSize: 28, opacity: 0.88, maxWidth: 820 }}>{subtitle}</div>
            <div style={{ fontSize: 24, opacity: 0.75, maxWidth: 820 }}>
              {description.length > 130 ? `${description.slice(0, 127)}...` : description}
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: ogCacheHeaders(complete) },
  )
}

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  return ogJpeg(await render(slug))
}
