import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Camera, ChevronRight, Images, MapPin } from "lucide-react"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { createPageMetadata } from "@/lib/seo"

export const revalidate = 300

export const metadata: Metadata = createPageMetadata({
  title: "Gallery",
  description:
    "Photo albums from FHI Global events — showcases, developer visits and awarding ceremonies across Dubai and the UAE.",
  pathname: "/gallery",
  keywords: ["FHI Global gallery", "Dubai real estate event photos", "FHI Global events"],
})

type AlbumRow = {
  id: string
  slug: string
  title: string
  description: string | null
  event_date: string | null
  cover_url: string | null
}

function dateLabel(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-AE", { year: "numeric", month: "long" })
}

export default async function GalleryPage() {
  const supabase = createPublicSupabaseClient()
  const { data: albums } = await supabase
    .from("gallery_albums")
    .select("id, slug, title, description, event_date, cover_url")
    .eq("is_published", true)
    .order("event_date", { ascending: false, nullsFirst: false })

  // One count query for all albums — grouped in JS since PostgREST
  // aggregates are disabled on this project.
  const { data: countRows } = await supabase.from("gallery_photos").select("album_id")
  const counts = new Map<string, number>()
  for (const r of countRows ?? []) {
    counts.set(r.album_id, (counts.get(r.album_id) ?? 0) + 1)
  }

  const rows = (albums ?? []) as AlbumRow[]
  const totalPhotos = Array.from(counts.values()).reduce((a, b) => a + b, 0)
  const latestEvent = dateLabel(rows[0]?.event_date ?? null)
  const collage = rows.map((a) => a.cover_url).filter((u): u is string => Boolean(u)).slice(0, 4)

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* ── Masthead — the site's light editorial header: navy type on white,
             gold caps labels with hairline dividers, and a collage of album
             covers filling the right half. ── */}
      <section className="relative overflow-hidden bg-white border-b border-[#e8eaed]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 lg:pr-[46%] lg:min-h-[340px]">
          <div className="flex items-center gap-3 mb-3">
            <span className="h-px w-10 bg-[#d6b357]" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#b8913f]">
              FHI Global · Moments
            </span>
          </div>
          <h1 className="font-['Outfit'] text-3xl md:text-[42px] font-bold leading-[1.08] tracking-tight">
            <span className="text-[#001f3f]">Photo </span>
            <span className="text-[#b8913f]">Gallery</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[#6b7280] max-w-xl">
            Showcases, developer visits and awarding ceremonies — the moments behind FHI Global,
            album by album.
          </p>

          {/* Covers collage — right half on desktop, after the copy on mobile. */}
          <div className="relative mt-6 aspect-[16/10] bg-[#001f3f] lg:absolute lg:inset-y-0 lg:right-0 lg:left-[56%] lg:z-10 lg:mt-0 lg:aspect-auto">
            {collage.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Images className="w-14 h-14 text-[#d6b357]/50" />
              </div>
            ) : collage.length === 1 ? (
              <Image
                src={collage[0]}
                alt="FHI Global event photos"
                fill
                priority
                unoptimized
                sizes="(min-width: 1024px) 44vw, 100vw"
                className="object-cover"
              />
            ) : (
              <div className={`absolute inset-0 grid grid-cols-2 gap-[3px] bg-white ${collage.length > 2 ? "grid-rows-2" : ""}`}>
                {collage.map((url, i) => (
                  <div
                    key={url}
                    className={`relative overflow-hidden ${collage.length === 3 && i === 0 ? "row-span-2" : ""}`}
                  >
                    <Image
                      src={url}
                      alt={`FHI Global event photos ${i + 1}`}
                      fill
                      priority={i === 0}
                      unoptimized
                      sizes="(min-width: 1024px) 22vw, 50vw"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Facts — album and photo counts in the gold-label columns. */}
          <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 sm:flex sm:flex-wrap sm:gap-x-0 sm:gap-y-4">
            {[
              { label: "Albums", value: String(rows.length) },
              { label: "Photos", value: totalPhotos.toLocaleString() },
              ...(latestEvent ? [{ label: "Latest Event", value: latestEvent }] : []),
            ].map((f) => (
              <div
                key={f.label}
                className="sm:pr-8 sm:mr-8 sm:border-r sm:border-[#e8eaed] sm:last:mr-0 sm:last:border-0 sm:last:pr-0"
              >
                <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8913f] mb-1.5">
                  {f.label}
                </dt>
                <dd className="font-['Outfit'] text-2xl font-bold text-[#001f3f] leading-none">
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Albums ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {rows.length === 0 ? (
          <div className="border border-[#e5e8ec] bg-white p-16 text-center">
            <div className="w-14 h-14 bg-[#faf7ee] border border-[#e7d9a8] flex items-center justify-center mx-auto mb-5">
              <Images className="w-6 h-6 text-[#d6b357]" />
            </div>
            <h2 className="font-['Outfit'] text-xl font-bold text-[#0d1117] mb-2">No albums yet</h2>
            <p className="text-sm text-[#6b7280] max-w-sm mx-auto leading-relaxed">
              Event albums are published here — check back soon.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {rows.map((album) => {
              const count = counts.get(album.id) ?? 0
              const date = dateLabel(album.event_date)
              return (
                <Link
                  key={album.id}
                  href={`/gallery/${album.slug}`}
                  className="group bg-white border border-[#e5e8ec] overflow-hidden hover:border-[#d6b357] transition-colors duration-200"
                >
                  <div className="relative aspect-[16/10] bg-[#eef1f5] overflow-hidden">
                    {album.cover_url ? (
                      <Image
                        src={album.cover_url}
                        alt={album.title}
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-[#b8bfc9]">
                        <Images className="w-10 h-10" />
                      </div>
                    )}
                    {count > 0 && (
                      <span className="absolute bottom-0 left-0 bg-[#0a2647] text-white text-[11px] font-bold px-2.5 py-1.5 inline-flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-[#d6b357]" /> {count} photos
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <h2 className="font-['Outfit'] text-base font-bold uppercase tracking-tight text-[#001f3f] leading-snug line-clamp-2">
                      {album.title}
                    </h2>
                    <span className="block w-10 h-[2px] bg-[#d6b357] my-3" aria-hidden="true" />
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-[#6b7280] inline-flex items-center gap-1.5 min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-[#d6b357] shrink-0" />
                        <span className="truncate">{date ?? "FHI Global"}</span>
                      </p>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#001f3f] group-hover:text-[#b8913f] transition-colors shrink-0">
                        View <ChevronRight className="w-3.5 h-3.5 text-[#d6b357]" />
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
