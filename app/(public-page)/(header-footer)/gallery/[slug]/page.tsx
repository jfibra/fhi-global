import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { createPageMetadata } from "@/lib/seo"
import { AlbumGrid, type GalleryPhoto } from "./album-grid"

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase
    .from("gallery_albums")
    .select("title, description, cover_url")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle()
  // Transient failure → 5xx; only a clean miss may 404 (an outage-time
  // notFound() would be ISR-cached over a live album).
  if (error) throw new Error("Failed to load album")
  if (!data) notFound()
  return createPageMetadata({
    title: data.title,
    description: data.description ?? `Photos from ${data.title} by FHI Global.`,
    imageUrl: data.cover_url ?? undefined,
    pathname: `/gallery/${slug}`,
    keywords: [data.title, "FHI Global event photos", "Dubai real estate event"],
  })
}

function dateLabel(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-AE", { year: "numeric", month: "long", day: "numeric" })
}

export default async function AlbumPage({ params }: Props) {
  const { slug } = await params
  const supabase = createPublicSupabaseClient()

  const { data: album, error: albumError } = await supabase
    .from("gallery_albums")
    .select("id, title, description, event_date")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle()
  // Same error/miss split as generateMetadata: an outage-time notFound()
  // would be ISR-cached as a hard 404 over a live album.
  if (albumError) throw new Error("Failed to load album")
  if (!album) notFound()

  const { data: photos } = await supabase
    .from("gallery_photos")
    .select("id, section, url, thumb_url, width, height")
    .eq("album_id", album.id)
    .order("sort", { ascending: true })
    .limit(1000)

  const rows = (photos ?? []) as GalleryPhoto[]
  const date = dateLabel(album.event_date)

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* ── Header — the site's light editorial masthead language. ── */}
      <section className="bg-white border-b border-[#e8eaed]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            href="/gallery"
            className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7280] hover:text-[#001f3f] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> All albums
          </Link>
          <div className="mt-5 flex items-center gap-3 mb-3">
            <span className="h-px w-10 bg-[#d6b357]" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#b8913f]">
              FHI Global · Event Album
            </span>
          </div>
          <h1 className="font-['Outfit'] text-3xl md:text-[42px] font-bold tracking-tight text-[#001f3f] leading-[1.08]">
            {album.title}
          </h1>
          {album.description && (
            <p className="mt-4 text-[15px] leading-relaxed text-[#6b7280] max-w-2xl">{album.description}</p>
          )}

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:flex sm:flex-wrap sm:gap-x-0 sm:gap-y-4">
            {[
              { label: "Photos", value: rows.length.toLocaleString() },
              ...(date ? [{ label: "Event Date", value: date }] : []),
            ].map((f) => (
              <div
                key={f.label}
                className="sm:pr-8 sm:mr-8 sm:border-r sm:border-[#e8eaed] sm:last:mr-0 sm:last:border-0 sm:last:pr-0"
              >
                <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8913f] mb-1.5">
                  {f.label}
                </dt>
                <dd className="font-['Outfit'] text-xl font-bold text-[#001f3f] leading-none">
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Photos ── */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <AlbumGrid photos={rows} albumTitle={album.title} />
      </section>
    </div>
  )
}
