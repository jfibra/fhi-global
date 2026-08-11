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

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* ── Hero ── */}
      <section className="relative bg-[#f7f5f1] border-b border-[#ebe7e0] overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#b8913f] mb-4">
            <Camera className="w-4 h-4" />
            FHI Global · Moments
          </p>
          <h1 className="font-['Outfit'] text-4xl md:text-6xl font-bold uppercase leading-[0.95] tracking-tight">
            <span className="block text-[#001f3f]">Photo</span>
            <span className="block text-[#d6b357]">Gallery</span>
          </h1>
          <span className="block w-16 h-[3px] bg-[#d6b357] my-5" aria-hidden="true" />
          <p className="text-[#5f6368] text-[15px] leading-relaxed max-w-md">
            Showcases, developer visits and awarding ceremonies — the moments behind FHI Global,
            album by album.
          </p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
