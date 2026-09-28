import type { Film, Story } from "@/components/public/film-player"

// FHI's own films, served from our S3 as web-encoded MP4 (1080p + 720p,
// H.264, faststart) with a one-year cache; every name carries a version so a
// re-edit can never show a stale copy. The masters live in the boss's Drive
// folder "EDITED VIDEOS"; only the English versions are on the site.

export const FILM_BASE = `${(process.env.S3_PUBLIC_URL?.trim() || "https://filipinohomes123.s3.ap-southeast-1.amazonaws.com").replace(/\/$/, "")}/FHI_GLOBAL/videos/about`

/** A film's three files by its base name, e.g. "fhi-story-mirasol" → -1080-v1.mp4, -720-v1.mp4, -poster-v1.jpg. */
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
