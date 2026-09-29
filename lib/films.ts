import type { Film, Story } from "@/components/public/film-player"

// FHI's own films, served from our S3 as web-encoded MP4 (1080p + 720p,
// H.264, faststart) with a one-year cache; every name carries a version so a
// re-edit can never show a stale copy. The masters live in the boss's Drive
// folder "EDITED VIDEOS"; only the English versions are on the site.
// One catalogue for the public About page and the dashboard Library → Videos.

/** Where the files sit in the bucket. */
export const FILM_PREFIX = "FHI_GLOBAL/videos/about"
export const FILM_BASE = `${(process.env.S3_PUBLIC_URL?.trim() || "https://filipinohomes123.s3.ap-southeast-1.amazonaws.com").replace(/\/$/, "")}/${FILM_PREFIX}`

/** A film's three files by its base name, e.g. "fhi-landlords-mirasol" → -1080-v1.mp4, -720-v1.mp4, -poster-v1.jpg. */
export function film(base: string, id: string, title: string, duration: string, ratio = 16 / 9): Film {
  return {
    id,
    title,
    duration,
    poster: `${FILM_BASE}/${base}-poster-v1.jpg`,
    hd: `${FILM_BASE}/${base}-1080-v1.mp4`,
    sd: `${FILM_BASE}/${base}-720-v1.mp4`,
    ratio,
  }
}

/** The bucket key behind one of a film's public URLs (for signed downloads). */
export const filmKey = (url: string) => `${FILM_PREFIX}/${url.split("/").pop() ?? ""}`

/** The company films: the AVP and the Dubai event. */
export const COMPANY_FILMS = {
  avp: film("fhi-global-avp", "fhi-global-avp", "FHI Global — the film", "3:12"),
  event: film("fhi-dubai-event", "fhi-dubai-event", "FHI Dubai Event", "2:14", 1920 / 816),
} satisfies Record<string, Film>

/** FHI Stories: agents on camera. */
export const AGENT_STORIES: Story[] = [
  { ...film("fhi-story-cris-gudia", "story-cris-gudia", "Cris Gudia's story", "2:22"), name: "Cris Gudia", role: "Property advisor" },
  { ...film("fhi-story-guinto-couple", "story-guinto-couple", "The Guinto couple's story", "5:17"), name: "Michelle and Carlos Guinto", role: "Team leader and property advisor" },
  { ...film("fhi-story-hector-cabrieto", "story-hector-cabrieto", "Hector Cabrieto's story", "2:25"), name: "Hector Cabrieto", role: "Property advisor" },
]

/** FHI Landlords: owners on camera. */
export const LANDLORD_STORIES: Story[] = [
  { ...film("fhi-landlords-ina-maireen", "landlords-ina-maireen", "Ina and Maireen", "2:51"), name: "Ina and Maireen", role: "Landlords" },
  { ...film("fhi-landlords-maribel-donabel", "landlords-maribel-donabel", "Maribel and Donabel", "2:22"), name: "Maribel and Donabel", role: "Landlords" },
  { ...film("fhi-landlords-mirasol", "landlords-mirasol", "Mirasol", "2:24"), name: "Mirasol", role: "Landlord" },
  { ...film("fhi-landlords-peter-ryen", "landlords-peter-ryen", "Peter and Ryen", "2:10"), name: "Peter and Ryen", role: "Landlords" },
]

/** Which agent card carries which story (profiles.id → film). The Guinto film is the couple's, so both cards get it. */
export const STORY_BY_AGENT: Record<string, Story> = {
  "b2a64c14-b63d-40de-b663-b2a513a1890a": AGENT_STORIES[0], // Cris Enrico Antonio Gudia
  "01aacc8e-99b4-41dd-9b97-168191e17a1e": AGENT_STORIES[1], // Michelle Q. Guinto
  "f58e263e-4704-479c-a016-589e183a8d6e": AGENT_STORIES[1], // Carlos Guinto
  "4637f01c-bf22-4598-b4bc-226a8ba81ff6": AGENT_STORIES[2], // Hector Rocha Cabrieto
}

// ─── Dashboard: Library → Videos ─────────────────────────────────────────────

export type VideoCategory = "Company" | "Agent stories" | "Landlords"

export type LibraryVideo = {
  film: Film
  category: VideoCategory
  name: string
  subtitle: string
  /** Download file name stem, e.g. "FHI-Global-Film" → FHI-Global-Film-1080p.mp4. */
  file: string
  /** File sizes in bytes (the files are immutable: versioned names). */
  bytes: { hd: number; sd: number }
}

const BYTES: Record<string, { hd: number; sd: number }> = {
  "fhi-global-avp": { hd: 82041565, sd: 34482415 },
  "fhi-dubai-event": { hd: 58662491, sd: 22856980 },
  "story-cris-gudia": { hd: 52840419, sd: 24166411 },
  "story-guinto-couple": { hd: 110651346, sd: 51585739 },
  "story-hector-cabrieto": { hd: 50572812, sd: 23970823 },
  "landlords-ina-maireen": { hd: 79689822, sd: 32437157 },
  "landlords-maribel-donabel": { hd: 53794378, sd: 21702647 },
  "landlords-mirasol": { hd: 58833662, sd: 23428129 },
  "landlords-peter-ryen": { hd: 67001567, sd: 25530403 },
}

const ascii = (s: string) => s.normalize("NFKD").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "")

export const LIBRARY_VIDEOS: LibraryVideo[] = [
  { film: COMPANY_FILMS.avp, category: "Company", name: "FHI Global — the film", subtitle: "Company film", file: "FHI-Global-Film", bytes: BYTES["fhi-global-avp"] },
  { film: COMPANY_FILMS.event, category: "Company", name: "FHI Dubai Event", subtitle: "Company event", file: "FHI-Dubai-Event", bytes: BYTES["fhi-dubai-event"] },
  ...AGENT_STORIES.map((st) => ({ film: st, category: "Agent stories" as const, name: st.name, subtitle: st.role, file: `FHI-Story-${ascii(st.name)}`, bytes: BYTES[st.id] })),
  ...LANDLORD_STORIES.map((st) => ({ film: st, category: "Landlords" as const, name: st.name, subtitle: st.role, file: `FHI-Landlords-${ascii(st.name)}`, bytes: BYTES[st.id] })),
]

/** "78 MB" */
export const fmtMb = (bytes: number) => `${Math.round(bytes / 1048576)} MB`
