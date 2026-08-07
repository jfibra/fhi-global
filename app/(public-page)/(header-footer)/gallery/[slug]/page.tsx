import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Camera } from "lucide-react"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { createPageMetadata } from "@/lib/seo"
import { AlbumGrid, type GalleryPhoto } from "./album-grid"

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = createPublicSupabaseClient()
  const { data } = await supabase
    .from("gallery_albums")
    .select("title, description, cover_url")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle()
  if (!data) notFound()
  return createPageMetadata({
    title: `${data.title} | FHI Global Gallery`,
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

  const { data: album } = await supabase
    .from("gallery_albums")
    .select("id, title, description, event_date")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle()
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
      {/* ── Header ── */}
      <section className="bg-[#f7f5f1] border-b border-[#ebe7e0]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Link
            href="/gallery"
            className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7280] hover:text-[#001f3f] transition-colors mb-5"
          >
            <ArrowLeft className="w-4 h-4" /> All albums
          </Link>
          <h1 className="font-['Outfit'] text-3xl md:text-[44px] font-bold uppercase tracking-tight text-[#001f3f] leading-[1.05]">
            {album.title}
          </h1>
          <span className="block w-16 h-[3px] bg-[#d6b357] my-4" aria-hidden="true" />
          <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-[#5f6368]">
            <span className="inline-flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-[#d6b357]" /> {rows.length} photos
            </span>
            {date && <span>{date}</span>}
          </p>
        </div>
      </section>

      {/* ── Photos ── */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <AlbumGrid photos={rows} albumTitle={album.title} />
      </section>
    </div>
  )
}
