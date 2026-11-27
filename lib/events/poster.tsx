import "server-only"

import { createHash } from "node:crypto"
import { ImageResponse } from "next/og"
import type { SupabaseClient } from "@supabase/supabase-js"
import { SITE_URL } from "@/lib/seo"
import { ogPicture } from "@/lib/og-picture"
import { Icon, asDataUri, loadFonts } from "@/lib/meeting-poster"
import { eventBrand } from "@/lib/events/brands"
import { storeEventImage } from "@/lib/events/cover"
import { eventDateRangeLabel, eventStartTime, hasCustomDayTimes, normalizeEventDays } from "@/lib/events/dates"
import { AUTO_POSTER_DIR, DEFAULT_POSTER, cleanPosterSettings, encodePosterSettings, isAutoPosterUrl, posterSettingsOf, type PosterSettings } from "@/lib/events/poster-url"

/**
 * The automatic event poster (2026-11-27, boss via Juliecor): an event made
 * from Claude without a photo gets one FHI draws — the title, the date, the
 * time and the venue on the meeting poster's look (lib/meeting-poster.tsx:
 * the Dubai skyline behind a navy veil, or deep navy with a gold glow), or
 * over a project's own photo. It becomes the event's cover, so nobody has to
 * upload one; a photo someone does upload replaces it and is never touched.
 *
 * 1600×900: the event page shows the whole cover contained over a blurred
 * copy of itself, and the cards and the link preview are landscape.
 *
 * Because it prints the date and the venue, it is drawn again whenever one
 * of them changes — refreshAutoPoster(), called by updateEvent() in
 * lib/events/write.ts for the dashboard and Claude alike. How it was drawn
 * (design, tagline, background project) rides in its address
 * (lib/events/poster-url.ts), so a redraw keeps the look.
 *
 * Satori cannot decode WebP, so the backdrop goes through ogPicture (sharp):
 * every route that can reach this file carries the sharp tracing keys in
 * next.config.mjs (/api/mcp/me, /api/admin/events, /api/events/cover).
 */

const W = 1600
const H = 900
/** Bump after a layout change: every automatic poster is then drawn again on its next save. */
const POSTER_REV = "1"
const GOLD = "#d6b357"
const GOLD_SOFT = "#f0d89b"
const NAVY = "#0a1220"

export type PosterEvent = {
  id: string
  title: string
  brand: string | null
  event_date: string | null
  event_days: number | null
  day_times: unknown
  venue: string | null
}

/** The venue as a poster can carry it: the place and its area, not the whole postal address. */
function shortVenue(venue: string | null): string {
  const parts = (venue ?? "").split(/,| - /).map((p) => p.trim()).filter(Boolean)
  const short = parts.slice(0, 2).join(", ")
  return short.length > 58 ? `${short.slice(0, 56).trimEnd()}…` : short
}

/** What the poster prints — also what its address is hashed from. */
function printed(e: PosterEvent) {
  const days = normalizeEventDays(e.event_days)
  const time = eventStartTime(e.event_date)
  const varies = days > 1 && hasCustomDayTimes(e.event_date, days, e.day_times)
  return {
    title: e.title.trim().length > 110 ? `${e.title.trim().slice(0, 108).trimEnd()}…` : e.title.trim(),
    date: eventDateRangeLabel(e.event_date, days, "long") ?? "Date to be announced",
    time: time ? `${varies ? "From " : ""}${time.toUpperCase()} GST` : "Time to be announced",
    venue: shortVenue(e.venue) || "Venue to be announced",
    brand: eventBrand(e.brand),
  }
}

/** Where this event's poster lives for these settings and these details: a new address whenever anything printed changes. */
export function posterAddress(e: PosterEvent, settings: PosterSettings): { key: string; url: string | null } {
  const p = printed(e)
  const rev = createHash("sha256")
    .update(JSON.stringify([POSTER_REV, p.title, p.date, p.time, p.venue, p.brand.key, settings.design, settings.tagline, settings.projectId]))
    .digest("hex")
    .slice(0, 12)
  const key = `${AUTO_POSTER_DIR}/${e.id}/${encodePosterSettings(settings)}.${rev}.jpg`
  const base = process.env.S3_PUBLIC_URL?.trim()
  return { key, url: base ? `${base.replace(/\/$/, "")}/${key}` : null }
}

const titleSize = (t: string) => (t.length <= 16 ? 116 : t.length <= 26 ? 98 : t.length <= 40 ? 80 : t.length <= 62 ? 64 : 52)

/** The poster as a JPEG; null when it could not be drawn. */
export async function renderEventPoster(e: PosterEvent, settings: PosterSettings, projectPhoto?: string | null): Promise<Buffer | null> {
  try {
    const p = printed(e)
    const brandLogo = p.brand.key === "fhiglobal" ? "/FHI_Branding_White.png" : (p.brand.logoOnDark ?? (p.brand.logoIsWhite ? p.brand.logo : null))
    const photoBehind = projectPhoto ?? (settings.design === "skyline" ? `${SITE_URL}/background/dubai.webp` : null)
    const [fonts, logo, backdrop] = await Promise.all([
      loadFonts(),
      brandLogo ? asDataUri(`${SITE_URL}${encodeURI(brandLogo)}`) : Promise.resolve(null),
      photoBehind ? ogPicture(photoBehind, W, H, "cover") : Promise.resolve(null),
    ])
    const eyebrow = (settings.tagline || "You're invited").toUpperCase()
    const size = titleSize(p.title)
    const title = p.title.length <= 30 ? p.title.toUpperCase() : p.title

    const detail = (kind: "calendar" | "clock" | "pin", label: string, value: string, grow: number) => (
      <div style={{ display: "flex", flex: grow, alignItems: "center", gap: 18, minWidth: 0 }}>
        <Icon kind={kind} />
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ display: "flex", fontSize: 15, fontWeight: 700, letterSpacing: 5, color: GOLD }}>{label}</div>
          <div style={{ display: "flex", marginTop: 5, fontSize: value.length > 34 ? 22 : value.length > 24 ? 25 : 29, fontWeight: 700, color: "#ffffff", lineHeight: 1.2 }}>{value}</div>
        </div>
      </div>
    )

    const res = new ImageResponse(
      (
        <div style={{ width: W, height: H, display: "flex", position: "relative", backgroundColor: NAVY, fontFamily: "Outfit", color: "#ffffff", overflow: "hidden" }}>
          {backdrop ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={backdrop} width={W} height={H} alt="" style={{ position: "absolute", top: 0, left: 0, width: W, height: H, objectFit: "cover", opacity: 0.7 }} />
          ) : (
            <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex", backgroundImage: "linear-gradient(135deg, #16294a 0%, #0a1220 55%, #050a14 100%)" }} />
          )}
          {/* The veil keeps the words readable whatever is behind them: dark on the left where they sit, lighter to the right. */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: W,
              height: H,
              display: "flex",
              backgroundImage: backdrop
                ? "linear-gradient(90deg, rgba(6,11,22,0.94) 0%, rgba(6,11,22,0.80) 42%, rgba(6,11,22,0.38) 78%, rgba(6,11,22,0.30) 100%)"
                : "radial-gradient(circle at 78% 30%, rgba(214,179,87,0.24) 0%, rgba(214,179,87,0.07) 30%, rgba(214,179,87,0) 55%)",
            }}
          />
          <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex", backgroundImage: "linear-gradient(180deg, rgba(6,10,20,0) 55%, rgba(6,10,20,0.86) 100%)" }} />
          {/* Gold rings, the brand's decoration on the studio posters. */}
          <div style={{ position: "absolute", top: -260, right: -220, width: 700, height: 700, borderRadius: 350, border: "2px solid rgba(214,179,87,0.36)", display: "flex" }} />
          <div style={{ position: "absolute", top: -300, right: -260, width: 780, height: 780, borderRadius: 390, border: "1px solid rgba(214,179,87,0.20)", display: "flex" }} />

          <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H - 54, display: "flex", flexDirection: "column", padding: "58px 84px 44px" }}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} height={62} alt="" />
            ) : (
              <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: GOLD, letterSpacing: 2 }}>{p.brand.name.toUpperCase()}</div>
            )}

            <div style={{ display: "flex", flex: 1 }} />

            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ display: "flex", width: 58, height: 2, backgroundColor: GOLD }} />
              <div style={{ display: "flex", fontSize: 22, fontWeight: 700, letterSpacing: 8, color: GOLD_SOFT }}>{eyebrow}</div>
            </div>
            <div style={{ display: "flex", marginTop: 22, maxWidth: 1180, fontFamily: "Playfair Display", fontWeight: 700, fontSize: size, lineHeight: 1.08, color: "#ffffff", letterSpacing: 0.5 }}>{title}</div>
            <div style={{ display: "flex", width: 120, height: 4, backgroundImage: "linear-gradient(90deg, #b8913f, #f0d89b, #b8913f)", marginTop: 30 }} />

            <div style={{ display: "flex", flex: 1 }} />

            <div style={{ display: "flex", width: "100%", backgroundColor: "rgba(5,10,18,0.80)", border: "1px solid rgba(214,179,87,0.5)", padding: "24px 34px", gap: 30 }}>
              {detail("calendar", "DATE", p.date, p.date.length > 30 ? 1.5 : 1.2)}
              {detail("clock", "TIME", p.time, p.time.length > 13 ? 1.1 : 0.8)}
              {detail("pin", "VENUE", p.venue, 1.5)}
            </div>
          </div>

          <div style={{ position: "absolute", bottom: 0, left: 0, width: W, height: 54, display: "flex", alignItems: "center", justifyContent: "center", backgroundImage: "linear-gradient(90deg, #b8913f 0%, #e3c98a 50%, #b8913f 100%)", color: NAVY, fontSize: 17, fontWeight: 700, letterSpacing: 5 }}>
            {`FHIGLOBAL.AE · ${p.brand.name.toUpperCase()} · DUBAI`}
          </div>
        </div>
      ),
      { width: W, height: H, fonts: fonts.map((f) => ({ name: f.name, data: f.data, weight: f.weight, style: f.style })) },
    )
    const png = Buffer.from(await res.arrayBuffer())
    const { default: sharp } = await import("sharp")
    return await sharp(png).jpeg({ quality: 88, mozjpeg: true }).toBuffer()
  } catch (e) {
    console.error("[events/poster] render", e instanceof Error ? e.message : e)
    return null
  }
}

/** The background project's photo for a settings object, or null (missing project, no photo). */
async function projectPhotoOf(admin: SupabaseClient, settings: PosterSettings): Promise<string | null> {
  if (!settings.projectId) return null
  const { data } = await admin.from("projects").select("main_image").eq("id", settings.projectId).maybeSingle<{ main_image: string | null }>()
  return data?.main_image ?? null
}

/**
 * Draws this event's poster and stores it; returns its address, or null when
 * it could not be made (no file storage, a render failure) — the caller then
 * simply leaves the event without a cover. Nothing is written to the event.
 */
export async function drawEventPoster(admin: SupabaseClient, e: PosterEvent, raw: Partial<PosterSettings> | null | undefined): Promise<string | null> {
  const settings = cleanPosterSettings(raw ?? DEFAULT_POSTER)
  const { key, url } = posterAddress(e, settings)
  if (!url) return null
  const jpeg = await renderEventPoster(e, settings, await projectPhotoOf(admin, settings))
  if (!jpeg) return null
  try {
    return await storeEventImage(key, jpeg, "image/jpeg")
  } catch (err) {
    console.error("[events/poster] store", err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * After a save: when the event's cover is an automatic poster and what it
 * prints has changed, draw it again and point the event at the new file.
 * Does nothing for a photo someone uploaded. Returns the cover's address.
 */
export async function refreshAutoPoster(admin: SupabaseClient, eventId: string): Promise<string | null> {
  const { data: row } = await admin
    .from("events")
    .select("id, title, brand, event_date, event_days, day_times, venue, image_url")
    .eq("id", eventId)
    .is("deleted_at", null)
    .maybeSingle<PosterEvent & { image_url: string | null }>()
  if (!row || !isAutoPosterUrl(row.image_url)) return row?.image_url ?? null
  const settings = posterSettingsOf(row.image_url) ?? DEFAULT_POSTER
  const { url } = posterAddress(row, settings)
  if (!url || url === row.image_url) return row.image_url
  const made = await drawEventPoster(admin, row, settings)
  if (!made) return row.image_url
  // Only while the cover is still the poster it was: a photo uploaded in the meantime is never overwritten.
  await admin.from("events").update({ image_url: made }).eq("id", eventId).eq("image_url", row.image_url as string)
  return made
}
