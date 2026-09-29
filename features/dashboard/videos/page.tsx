import { LIBRARY_VIDEOS } from "@/lib/films"
import { VideosClient } from "./videos-client"

/**
 * Library → Videos: FHI's own films (the company film, the Dubai event, the
 * agent and landlord stories) to watch in the dashboard or download and
 * share. The same files the public About page streams (lib/films.ts).
 */
export default function VideosPage() {
  return <VideosClient videos={LIBRARY_VIDEOS} />
}
