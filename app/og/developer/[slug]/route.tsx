import { ImageResponse } from "next/og"
import { createAdminSupabase } from "@/lib/admin-supabase"

export const runtime = "nodejs"

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  const supabase = createAdminSupabase()

  const { data } = await supabase
    .from("developers")
    .select("name, description, logo_url, address")
    .eq("slug", slug)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle()

  const title = data?.name ?? "FHI Global Developer"
  const subtitle = data?.address ?? "Dubai, UAE"
  const description = data?.description ?? "Explore premium developers and projects on FHI Global."
  const logo = data?.logo_url

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
              background: "white",
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
            <div style={{ fontSize: 28, opacity: 0.88 }}>{subtitle}</div>
            <div style={{ fontSize: 24, opacity: 0.75, maxWidth: 820 }}>
              {description.length > 130 ? `${description.slice(0, 127)}...` : description}
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
