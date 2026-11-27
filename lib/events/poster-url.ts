// The automatic event poster's address (2026-11-27) — the light half, with no
// drawing code, so lib/events/write.ts can ask "is this cover an automatic
// poster?" on every save without loading the renderer.
//
// An event Claude creates without a photo gets a poster FHI draws
// (lib/events/poster.tsx) as its cover. There is no column for it: the file's
// own address says it is one and carries how it was drawn, so a later save
// that changes the title, date or venue can draw it again the same way.
//
//   <S3>/FHI_GLOBAL/events/auto-poster/<event id>/<settings>.<rev>.jpg
//     settings = base64url of {"d": design, "t": tagline, "b": project id or null}
//     rev      = a hash of everything the poster prints — a new address per
//                redraw, so no browser or CDN shows the old date.
//
// A photo someone uploads has any other address, so it is never redrawn or
// replaced: their own photo always wins.

export const AUTO_POSTER_DIR = "FHI_GLOBAL/events/auto-poster"

export type PosterDesign = "skyline" | "navy"
export const POSTER_DESIGNS: Array<{ id: PosterDesign; label: string; about: string }> = [
  { id: "skyline", label: "Skyline", about: "the Dubai skyline behind a navy veil, gold accents" },
  { id: "navy", label: "Navy & gold", about: "deep navy with a gold glow" },
]

export type PosterSettings = {
  design: PosterDesign
  /** The small line above the title; "" = "You're invited". */
  tagline: string
  /** A project whose photo sits behind the title instead of the skyline, or null. */
  projectId: number | null
}

export const DEFAULT_POSTER: PosterSettings = { design: "skyline", tagline: "", projectId: null }

export const isAutoPosterUrl = (url: string | null | undefined): boolean => typeof url === "string" && url.includes(`/${AUTO_POSTER_DIR}/`)

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url")

export function cleanPosterSettings(raw: Partial<PosterSettings> | null | undefined): PosterSettings {
  const design: PosterDesign = raw?.design === "navy" ? "navy" : "skyline"
  const tagline = typeof raw?.tagline === "string" ? raw.tagline.replace(/\s+/g, " ").trim().slice(0, 60) : ""
  const projectId = typeof raw?.projectId === "number" && Number.isInteger(raw.projectId) && raw.projectId > 0 ? raw.projectId : null
  return { design, tagline, projectId }
}

/** The file name's settings part. */
export function encodePosterSettings(s: PosterSettings): string {
  return b64url(JSON.stringify({ d: s.design, t: s.tagline, b: s.projectId }))
}

/** How an automatic poster was drawn, read back from its address; null for any other picture. */
export function posterSettingsOf(url: string | null | undefined): PosterSettings | null {
  if (!isAutoPosterUrl(url)) return null
  try {
    const file = (url as string).split("?")[0].split("/").pop() ?? ""
    const encoded = file.split(".")[0]
    const raw = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as { d?: unknown; t?: unknown; b?: unknown }
    return cleanPosterSettings({ design: raw.d === "navy" ? "navy" : "skyline", tagline: typeof raw.t === "string" ? raw.t : "", projectId: typeof raw.b === "number" ? raw.b : null })
  } catch {
    return { ...DEFAULT_POSTER }
  }
}

/** The fields a poster prints. A change to any of them is a reason to draw it again. */
export const POSTER_DRAWN_FIELDS = ["title", "event_date", "event_days", "day_times", "venue", "brand"] as const
