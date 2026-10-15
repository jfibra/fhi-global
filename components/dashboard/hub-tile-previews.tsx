"use client"

/**
 * The sample picture on the right of every hub bento tile — a real sample of
 * what sits behind the tile, framed like filipinohomes-final's hub cards.
 *
 * Tools show their real output: the business card drawn by the card engine,
 * the meeting poster and the A2A agreement rendered by their own generators
 * (static JPGs in public/hub-samples, made with the real code), the sample
 * website, real marketing artwork, real ebook covers and film posters.
 * The two tiles that read data (Documents, Buyers Link) load lazily with a
 * tab-level cache and show an honest empty state when there is nothing yet.
 *
 * Only the Library and Agent Resource hubs use these; every tile reads static
 * assets or the signed-in user's own data, so the same sample works for
 * agents, team leaders and global partners. The other hubs keep their
 * original tiles (hub-tile-mockups.tsx).
 */

import { useEffect, useState, type ReactNode } from "react"
import Image from "next/image"
import { FileText, Files, Globe, Play, QrCode } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useAuth } from "@/context/auth-context"
import { EBOOKS, ebookCoverUrl } from "@/lib/ebooks"
import { COMPANY_FILMS } from "@/lib/films"
import { SITE_URL } from "@/lib/seo"
import { FormCover } from "@/components/form-cover"
import { listDocuments, type DocumentRow } from "@/lib/document-service"
import { formCoverHref } from "@/lib/forms-shared"

// ─── Plumbing ─────────────────────────────────────────────────────────────────

const SAMPLE_PORTRAIT = "/background/sample-portrait.png"

/** One in-flight/settled promise per key for the life of the tab, so moving
 *  between hubs never refetches (or re-renders) a sample. */
const cache = new Map<string, Promise<unknown>>()

function useSample<T>(key: string | null, load: () => Promise<T>): { data: T | null; ready: boolean } {
  const [state, setState] = useState<{ key: string | null; data: T | null; ready: boolean }>({ key, data: null, ready: false })
  useEffect(() => {
    if (!key) return
    let alive = true
    let p = cache.get(key) as Promise<T> | undefined
    if (!p) {
      p = load().catch(() => null as T)
      cache.set(key, p)
    }
    p.then((data) => { if (alive) setState({ key, data, ready: true }) })
    return () => { alive = false }
    // `load` is a fresh closure every render; the key is the identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return state.key === key ? { data: state.data, ready: state.ready } : { data: null, ready: false }
}

/** The frame the static tool samples sit in: a card with a soft shadow. */
const sheet = "overflow-hidden rounded-md border border-[#dfe4ea] bg-white shadow-[0_4px_12px_rgba(0,31,63,0.14)]"

function Loading() {
  return (
    <div className="flex w-full flex-col gap-1.5 px-1">
      <span className="h-14 w-full animate-pulse rounded-md bg-[#e6eaef]" />
      <span className="h-2 w-3/4 animate-pulse rounded bg-[#e6eaef]" />
      <span className="h-2 w-1/2 animate-pulse rounded bg-[#eef1f5]" />
    </div>
  )
}

function Empty({ icon: Icon, text }: { icon: typeof FileText; text: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-1 text-center text-[#9aa3ae]">
      <Icon className="h-5 w-5" />
      <span className="text-[10px] leading-tight">{text}</span>
    </div>
  )
}

// ─── Library ──────────────────────────────────────────────────────────────────

/** Two real artworks from public/materials, one over the other. */
function MaterialsPreview() {
  return (
    <div className="relative h-[136px] w-[104px]">
      <span className={`${sheet} absolute right-0 top-0 block h-[104px] w-[72px] rotate-6`}>
        <Image src="/materials/motivation/motiv1.webp" alt="" fill sizes="80px" className="object-cover" />
      </span>
      <span className={`${sheet} absolute bottom-0 left-0 block h-[104px] w-[72px] -rotate-6`}>
        <Image src="/materials/1.jpg" alt="Marketing artwork" fill sizes="80px" className="object-cover" />
      </span>
    </div>
  )
}

/** Two real covers from the shelf. */
function EbooksPreview() {
  const [a, b] = EBOOKS
  return (
    <div className="flex items-end gap-2">
      {[a, b].map((book, i) => (
        <span key={book.id} className={`relative block overflow-hidden rounded-[3px] bg-[#001f3f] shadow-[4px_4px_12px_-2px_rgba(0,31,63,0.4)] ${i === 0 ? "h-[122px] w-[82px]" : "h-[104px] w-[70px]"}`} title={book.title}>
          <Image src={ebookCoverUrl(book)} alt={book.title} fill sizes="100px" className="object-cover" />
          <span className="absolute inset-y-0 left-0 w-[3px] bg-black/30" />
        </span>
      ))}
    </div>
  )
}

/** The FHI Global film's real poster frame with its play control. */
function VideosPreview() {
  const film = COMPANY_FILMS.avp
  return (
    <span className={`${sheet} relative block h-[70px] w-[112px] border-0 bg-[#06192e]`}>
      <Image src={film.poster} alt={film.title} fill sizes="120px" className="object-cover" />
      <span className="absolute inset-0 bg-gradient-to-t from-[#001f3f]/80 to-transparent" />
      <span className="absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#d6b357] shadow">
        <Play className="ml-px h-3 w-3 fill-[#001f3f] text-[#001f3f]" />
      </span>
      <span className="absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between text-[8px] text-white">
        <span className="truncate font-semibold">{film.title}</span>
        <span className="ml-1 shrink-0 text-white/70">{film.duration}</span>
      </span>
    </span>
  )
}

/** The newest uploaded document: page 1 of the real PDF, as the cover the Documents shelf shows (server-rendered, FormCover). */
function DocumentsPreview() {
  const { data, ready } = useSample("documents", async () => (await listDocuments()).data)
  if (!ready) return <Loading />
  const docs: DocumentRow[] = data ?? []
  if (!docs.length) return <Empty icon={Files} text="No documents uploaded yet" />
  const first = docs[0]
  const cover = formCoverHref(first)
  const icon = <span className="absolute inset-0 flex items-center justify-center"><FileText className="h-6 w-6 text-[#c3c9d1]" /></span>
  return (
    <div className="w-full">
      <span className={`${sheet} relative mx-auto block h-[118px] w-[86px]`}>
        {cover ? <FormCover src={cover} alt={first.title} eager priority={false} fallback={icon} /> : icon}
      </span>
    </div>
  )
}

// ─── Agent Resource ───────────────────────────────────────────────────────────

/** Two real card designs (Executive Noir over Gilded Arc), drawn by the card engine with sample data. */
function BusinessCardPreview() {
  const { data, ready } = useSample("business-card-sample:noir-arc", async () => {
    const { renderCard, THUMB_W, THUMB_H } = await import("@/features/business-card/card-render")
    const sample = { name: "Juan Dela Cruz", phoneDial: "+971", phoneLocal: "501234567", email: "juan@fhiglobal.ae", avatarUrl: SAMPLE_PORTRAIT, initials: "JD" }
    const [noir, arc] = await Promise.all([
      renderCard("front", "noir", sample, THUMB_W, THUMB_H),
      renderCard("front", "arc", sample, THUMB_W, THUMB_H),
    ])
    return { noir, arc }
  })
  if (!ready) return <Loading />
  if (!data) return <Empty icon={FileText} text="Open to design your card" />
  return (
    <div className="flex flex-col gap-1.5">
      {[data.noir, data.arc].map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={src} alt={i === 0 ? "Executive Noir business card" : "Gilded Arc business card"} className="h-[62px] w-[108px] rounded-md object-cover shadow-[0_4px_12px_rgba(0,31,63,0.18)]" />
      ))}
    </div>
  )
}

/** The digital card as it opens on a phone — the signed-in user's own name and
 *  photo on the real card layout: Dubai dusk backdrop, gold-ringed portrait,
 *  "Visit our website", the QR + contact panel, the gold action bar, WhatsApp. */
function DigitalCardPreview() {
  const { user, profile } = useAuth()
  const name = profile?.fullname?.trim() || "Juan Dela Cruz"
  const photo = profile?.profile_url?.trim() || SAMPLE_PORTRAIT
  const email = user?.email ?? "juan@fhiglobal.ae"
  return (
    <span className="relative flex h-[140px] w-[78px] flex-col items-center overflow-hidden rounded-[10px] bg-[#1a1612] p-1.5 pt-2.5 shadow-[0_6px_16px_rgba(0,31,63,0.3)] ring-2 ring-[#001f3f]">
      <Image src="/background/developers.webp" alt="" fill sizes="100px" className="object-cover object-center opacity-90" />
      <span className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/25 to-black/60" />
      <span className="relative h-7 w-7 overflow-hidden rounded-full border-[1.5px] border-[#d6b357] shadow">
        {photo.startsWith("/") ? (
          <Image src={photo} alt="" fill sizes="40px" className="object-cover object-top" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-full w-full object-cover object-top" />
        )}
      </span>
      <span className="relative mt-1 max-w-full truncate font-['Outfit'] text-[7px] font-bold leading-none text-white">{name}</span>
      <span className="relative mt-1.5 flex h-4 w-full items-center gap-1 rounded-full bg-[#fbf6ec] pl-0.5 pr-1">
        <span className="flex h-3 w-3 items-center justify-center rounded-full bg-[#c9a24a]"><Globe className="h-1.5 w-1.5 text-white" /></span>
        <span className="flex-1 text-center text-[5px] font-bold text-[#1a1612]">Visit our website</span>
      </span>
      <span className="relative mt-1.5 flex w-full items-center gap-1 rounded-md bg-black/45 p-1 backdrop-blur-[2px]">
        <span className="rounded-[2px] border border-[#d6b357] bg-white p-px">
          <QRCodeSVG value={`${SITE_URL}/business-card`} size={20} level="L" fgColor="#1a1612" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          {[["+971", true], [email, false], ["www.fhiglobal.ae", false]].map(([t, bold], i) => (
            <span key={i} className="flex items-center gap-0.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#c9a24a]" />
              <span className={`truncate text-[4.5px] leading-none ${bold ? "font-bold text-white" : "text-white/75"}`}>{String(t)}</span>
            </span>
          ))}
        </span>
      </span>
      <span className="relative mt-1.5 flex h-3.5 w-full items-center justify-around rounded-full bg-[#d6b357] px-1 text-[4.5px] font-extrabold uppercase text-[#1a1612]">
        <span>Save</span><span className="h-2 w-px bg-black/20" /><span>Share</span><span className="h-2 w-px bg-black/20" /><span>Contact</span>
      </span>
      <span className="relative mt-auto flex h-4 w-4 items-center justify-center rounded-full bg-black/55 ring-1 ring-white/20">
        <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 fill-white"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.2 14.8l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 0 1 12 4zm-3 4.5c-.2 0-.5 0-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.2 5 4.4 2.5 1 3 .8 3.5.7.5 0 1.7-.7 2-1.4.2-.7.2-1.2.1-1.4l-.5-.2-1.9-.9c-.3-.1-.4-.2-.6.1l-.9 1.1c-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.5-.9-.8-1.5-1.7-1.6-2-.2-.3 0-.4.1-.6l.4-.5.3-.5v-.5l-.9-2c-.2-.5-.4-.5-.6-.5z"/></svg>
      </span>
    </span>
  )
}

/** The reel the studio opens with: its own sample photo in a 9:16 frame. */
function ReelsPreview() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative block h-[136px] w-[76px] overflow-hidden rounded-[10px] bg-[#0a2136] shadow-[0_6px_16px_rgba(0,31,63,0.3)] ring-2 ring-[#001f3f]">
        <Image src="/images/house.jpg" alt="Reel sample" fill sizes="80px" className="object-cover" />
        <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
        <Image src="/FHI_Branding_White.png" alt="" width={28} height={10} className="absolute left-1.5 top-1.5 h-auto w-6" />
        <span className="absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90">
          <Play className="ml-px h-3 w-3 fill-[#001f3f] text-[#001f3f]" />
        </span>
        <span className="absolute bottom-3 left-1.5 right-1.5">
          <span className="block text-[6px] font-bold text-white">Luxury villa · Dubai Hills</span>
          <span className="block text-[5.5px] text-[#d6b357]">AED 4.2M · 5 beds</span>
        </span>
        <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/25"><span className="block h-full w-2/3 bg-[#d6b357]" /></span>
      </span>
      <span className="flex flex-col gap-1">
        {["/images/house 2.jpg", "/images/properties.jpg"].map((p) => (
          <span key={p} className="relative block h-9 w-7 overflow-hidden rounded border border-white shadow">
            <Image src={p} alt="" fill sizes="40px" className="object-cover" />
          </span>
        ))}
      </span>
    </div>
  )
}

/** A real studio job, one column: the bare room it started from, the
 *  before/after comparison, and the staged result (public/hub-samples). */
function PhotoStudioPreview() {
  const rows = [
    { src: "/hub-samples/photo-studio-before.jpg", alt: "Original photo" },
    { src: "/hub-samples/photo-studio-split.jpg", alt: "Before and after comparison" },
    { src: "/hub-samples/photo-studio-after.jpg", alt: "Staged with AI" },
  ]
  return (
    <div className="flex w-[112px] flex-col gap-1.5">
      {rows.map((r) => (
        <span key={r.src} className={`${sheet} relative block h-[42px] w-full border-0`}>
          <Image src={r.src} alt={r.alt} fill sizes="120px" className="object-cover" />
        </span>
      ))}
    </div>
  )
}

/** A real birthday card from the studio beside a listing flyer with the studio's sample photo. */
function PosterMakerPreview() {
  return (
    <div className="relative h-[136px] w-[108px]">
      <span className={`${sheet} absolute left-0 top-1 block h-[120px] w-[66px] -rotate-6`}>
        <Image src="/images/birthday1.png" alt="Birthday poster" fill sizes="80px" className="object-cover object-top" />
      </span>
      <span className={`${sheet} absolute right-0 top-3 flex h-[116px] w-[62px] rotate-6 flex-col`}>
        <span className="relative block h-[56%] w-full">
          <Image src="/images/house.jpg" alt="" fill sizes="80px" className="object-cover" />
          <span className="absolute left-0 top-1 bg-[#d6b357] px-1 text-[5px] font-bold uppercase tracking-wide text-[#001f3f]">For sale</span>
        </span>
        <span className="flex flex-1 flex-col justify-between p-1">
          <span>
            <span className="block text-[6px] font-bold leading-tight text-[#001f3f]">Modern Villa</span>
            <span className="block text-[5px] leading-tight text-[#6b7280]">Dubai Hills Estate</span>
          </span>
          <span className="flex items-end justify-between">
            <span className="text-[5.5px] font-bold text-[#b7913a]">AED 4.2M</span>
            <QrCode className="h-2.5 w-2.5 text-[#001f3f]/60" />
          </span>
        </span>
      </span>
    </div>
  )
}

/** A real Business Meeting poster made with the tool (square, three speakers). */
function MeetingPosterPreview() {
  return (
    <span className={`${sheet} block border-0`}>
      <Image src="/hub-samples/meeting-poster-v2.jpg" alt="Business Meeting poster" width={112} height={112} className="block h-[112px] w-[112px] object-cover" />
    </span>
  )
}

/** The sample agent site in a small browser window (the builder's own demo template). */
function WebsiteBuilderPreview() {
  return (
    <span className={`${sheet} flex w-[112px] flex-col`}>
      <span className="flex h-2.5 items-center gap-[2.5px] bg-[#d6b357]/20 px-1.5">
        {[0, 1, 2].map((i) => <span key={i} className="h-[3.5px] w-[3.5px] rounded-full bg-[#b7913a]/70" />)}
      </span>
      <Image src="/hub-samples/website.jpg" alt="Sample agent website" width={112} height={59} className="block h-[59px] w-full object-cover object-top" />
      <span className="flex gap-[3px] p-[3px]">
        {["/johndorf/houses/pool.jpg", "/johndorf/houses/townhouse-peach.jpg"].map((p) => (
          <span key={p} className="relative block h-6 w-1/2 overflow-hidden rounded-[2px]">
            <Image src={p} alt="" fill sizes="60px" className="object-cover" />
          </span>
        ))}
      </span>
    </span>
  )
}

/** Page 1 of the agreement, as the generator produces it. */
function A2APreview() {
  return (
    <span className={`${sheet} block`}>
      <Image src="/hub-samples/a2a-agreement.jpg" alt="Agent-to-agent agreement sample" width={92} height={130} className="block h-[130px] w-[92px] object-cover object-top" />
    </span>
  )
}

/** The Buyers Link brief as a client sees it on their phone. */
function BuyersLinkPreview() {
  return (
    <span className="flex h-[112px] w-[68px] flex-col gap-1 overflow-hidden rounded-[9px] border-2 border-[#001f3f] bg-white p-1.5 shadow-[0_6px_16px_rgba(0,31,63,0.25)]">
      <span className="flex gap-0.5">{[0, 1, 2, 3].map((i) => <span key={i} className={`h-[3px] flex-1 rounded ${i < 2 ? "bg-[#d6b357]" : "bg-[#dfe4ea]"}`} />)}</span>
      <span className="text-[6.5px] font-bold leading-tight text-[#001f3f]">What is your budget?</span>
      {["Up to 1M", "1M – 2M", "2M+"].map((o, i) => (
        <span key={o} className={`rounded px-1 py-0.5 text-[6px] ${i === 1 ? "bg-[#001f3f] text-white" : "border border-[#c8d4de] text-[#6b7280]"}`}>{o}</span>
      ))}
      <span className="mt-auto flex h-3 items-center justify-center rounded bg-[#d6b357] text-[5.5px] font-bold text-[#001f3f]">Send to agent</span>
    </span>
  )
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const PREVIEWS: Record<string, () => ReactNode> = {
  // Library
  materials: () => <MaterialsPreview />,
  ebooks: () => <EbooksPreview />,
  videos: () => <VideosPreview />,
  documents: () => <DocumentsPreview />,
  // Agent Resource
  "business-card": () => <BusinessCardPreview />,
  "digital-business-card": () => <DigitalCardPreview />,
  "reels-maker": () => <ReelsPreview />,
  "photo-studio": () => <PhotoStudioPreview />,
  "poster-maker": () => <PosterMakerPreview />,
  "meeting-poster": () => <MeetingPosterPreview />,
  "website-builder": () => <WebsiteBuilderPreview />,
  "a2a-agreement": () => <A2APreview />,
  "buyers-link": () => <BuyersLinkPreview />,
}

/** The sample inside a tile's right-hand frame; null when no sample is registered for this kind. */
export function TilePreview({ kind }: { kind: string }) {
  const render = PREVIEWS[kind]
  if (!render) return null
  return <>{render()}</>
}

export const hasTilePreview = (kind: string | undefined): kind is string => !!kind && kind in PREVIEWS
