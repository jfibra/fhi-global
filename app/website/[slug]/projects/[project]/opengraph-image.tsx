import { ImageResponse } from "next/og"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { loadSiteBySlug } from "@/lib/website-builder-service"
import { formatPrice, isHandoverOverdue, priceFromValue } from "@/lib/project-seo"
import { loadShareContact } from "@/lib/website-project-share"
import { ogJpeg, ogPicture } from "@/lib/og-picture"
import { loadOgFonts, OG_SIZE } from "../../../_components/og-hero"

// The link preview for a project shared from an agent's website — what a
// Facebook / WhatsApp / Messenger post shows: the project photo, its name,
// price and handover, and a strip with the agent's photo, name and NUMBER, so
// the lead calls the agent straight from the feed. Rendered by next/og
// (Satori: flexbox only, explicit styles). Photos go through ogPicture
// (lib/og-picture.ts): the AVIF/WebP renders become JPEG Satori can draw, and
// a sharp that fails to load costs the photo, never the page (which imports
// this module for its metadata).

export const runtime = "nodejs"
export const alt = "Project shared by an FHI Global property advisor"
export const size = OG_SIZE
export const contentType = "image/jpeg"

const STATUS: Record<string, string> = {
  pre_launch: "PRE-LAUNCH",
  launch: "LAUNCHING NOW",
  under_construction: "UNDER CONSTRUCTION",
  completed: "READY TO MOVE IN",
}

async function render({ params }: { params: Promise<{ slug: string; project: string }> }) {
  const { slug, project: key } = await params
  const admin = createAdminSupabase()
  const [site, { data: p }] = await Promise.all([
    loadSiteBySlug(admin, slug),
    createPublicSupabaseClient()
      .from("projects")
      .select("name, status, main_image, city, location, community, launch_price_from, currency, delivery_quarter, developers ( name ), project_units ( unit_type, bedrooms, size_sqft, price_from )")
      .eq("slug", key)
      .eq("is_published", true)
      .is("deleted_at", null)
      .maybeSingle<{
        name: string
        status: string | null
        main_image: string | null
        city: string | null
        location: string | null
        community: string | null
        launch_price_from: number | string | null
        currency: string | null
        delivery_quarter: string | null
        developers: { name: string } | null
        project_units: { unit_type: string | null; bedrooms: number | null; size_sqft: number | null; price_from: number | null }[] | null
      }>(),
  ])

  const contact = site ? await loadShareContact(admin, site.agentId, site.data.agent, site.data.about.portrait) : null
  const [photo, face] = await Promise.all([ogPicture(p?.main_image, 1200, 630), ogPicture(contact?.portrait, 176, 176)])

  const name = p?.name ?? "FHI Global project"
  // Same price rule as the page (and so the og:title): a headline price the
  // unit table contradicts gives way to the cheapest credible unit.
  const from = p ? formatPrice(priceFromValue({ name: p.name, status: p.status, launch_price_from: p.launch_price_from, currency: p.currency, units: p.project_units ?? [] }), null, p.currency) : null
  const where = [p?.community, p?.location].map((v) => v?.trim()).find(Boolean) ?? p?.city?.trim() ?? ""
  const overdue = p ? isHandoverOverdue({ status: p.status, delivery_quarter: p.delivery_quarter }) : false
  const line = [from ? `From ${from}` : null, p?.delivery_quarter && !overdue ? `Handover ${p.delivery_quarter}` : null].filter(Boolean).join("   ·   ")
  const status = p?.status ? STATUS[p.status] ?? "" : ""
  const nameSize = name.length > 26 ? 56 : name.length > 18 ? 66 : 76

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", backgroundColor: "#06182e", fontFamily: "og-sans" }}>
        {photo && <img src={photo} width={1200} height={630} style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630 }} alt="" />}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            display: "flex",
            backgroundImage: "linear-gradient(90deg, rgba(6,24,46,0.94) 0%, rgba(6,24,46,0.78) 45%, rgba(6,24,46,0.15) 100%)",
          }}
        />

        {/* The project */}
        <div style={{ position: "absolute", top: 56, left: 64, width: 760, display: "flex", flexDirection: "column" }}>
          {status ? (
            <div style={{ display: "flex" }}>
              <div style={{ display: "flex", backgroundColor: "rgba(0,0,0,0.75)", color: "#ffffff", fontSize: 18, fontWeight: 700, letterSpacing: 3, padding: "10px 16px" }}>
                {status}
              </div>
            </div>
          ) : null}
          {p?.developers?.name ? (
            <div style={{ display: "flex", marginTop: 26, color: "#e3c06c", fontSize: 24, fontWeight: 700, letterSpacing: 1 }}>{p.developers.name}</div>
          ) : null}
          <div style={{ display: "flex", marginTop: 8, color: "#ffffff", fontSize: nameSize, fontWeight: 700, lineHeight: 1.05, fontFamily: "og-serif" }}>{name}</div>
          {where ? <div style={{ display: "flex", marginTop: 16, color: "rgba(255,255,255,0.82)", fontSize: 26 }}>{where}</div> : null}
          {line ? <div style={{ display: "flex", marginTop: 18, color: "#ffffff", fontSize: 30, fontWeight: 700 }}>{line}</div> : null}
        </div>

        {/* The agent, with the number */}
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: 1200,
            height: 150,
            display: "flex",
            alignItems: "center",
            backgroundColor: "#d6b357",
            padding: "0 64px",
          }}
        >
          {face ? (
            <img src={face} width={104} height={104} style={{ width: 104, height: 104, borderRadius: 52, border: "4px solid #ffffff" }} alt="" />
          ) : (
            <div style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: "#06182e", color: "#d6b357", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, fontWeight: 700 }}>
              {(contact?.first ?? "F").charAt(0)}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 28 }}>
            <div style={{ display: "flex", color: "#06182e", fontSize: 20, fontWeight: 700, letterSpacing: 2 }}>YOUR PROPERTY ADVISOR</div>
            <div style={{ display: "flex", color: "#06182e", fontSize: 38, fontWeight: 700, marginTop: 4 }}>{contact?.name ?? "FHI Global"}</div>
          </div>
          {contact?.label ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginLeft: "auto" }}>
              <div style={{ display: "flex", color: "#06182e", fontSize: 20, fontWeight: 700, letterSpacing: 2 }}>CALL OR WHATSAPP</div>
              <div style={{ display: "flex", color: "#06182e", fontSize: 44, fontWeight: 700, marginTop: 2 }}>{contact.label}</div>
            </div>
          ) : null}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await loadOgFonts() },
  )
}

/** Out as JPEG — a fraction of the PNG's size, so WhatsApp shows the preview (lib/og-picture.ts). */
export default async function Image(props: { params: Promise<{ slug: string; project: string }> }) {
  return ogJpeg(await render(props))
}
