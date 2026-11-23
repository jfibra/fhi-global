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
 * The Library, Agent Resource and Communication hubs use these; every tile
 * reads static assets or the signed-in user's own data, so the same sample
 * works for agents, team leaders and global partners. Communication (admin
 * only, 2026-10-16) shows miniatures of its four screens with sample people —
 * never real enquiries, leads or reviews. The other hubs keep their original
 * tiles (hub-tile-mockups.tsx).
 */

import { useEffect, useState, type ReactNode } from "react"
import Image from "next/image"
import { Check, FileText, Files, Globe, Image as ImageIcon, LifeBuoy, Play, QrCode, Star, Video } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useAuth } from "@/context/auth-context"
import { EBOOKS, ebookCoverUrl } from "@/lib/ebooks"
import { COMPANY_FILMS } from "@/lib/films"
import { SITE_URL } from "@/lib/seo"
import { FormCover } from "@/components/form-cover"
import { listDocuments, type DocumentRow } from "@/lib/document-service"
import { formCoverHref } from "@/lib/forms-shared"
import { PROFILE_THEMES } from "@/lib/profile-themes"

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

/** Three real card designs fanned (Pearl Prestige, Gilded Arc, Executive Noir), drawn by the card engine with sample data. */
function BusinessCardPreview() {
  const { data, ready } = useSample("business-card-sample:fan-3", async () => {
    const { renderCard, THUMB_W, THUMB_H } = await import("@/features/business-card/card-render")
    const sample = { name: "Juan Dela Cruz", phoneDial: "+971", phoneLocal: "501234567", email: "juan@fhiglobal.ae", avatarUrl: SAMPLE_PORTRAIT, initials: "JD" }
    return Promise.all((["platinum", "arc", "noir"] as const).map((d) => renderCard("front", d, sample, THUMB_W, THUMB_H)))
  })
  if (!ready) return <Loading />
  if (!data) return <Empty icon={FileText} text="Open to design your card" />
  const place = ["left-0 top-1 -rotate-[10deg]", "right-0 top-6 rotate-[8deg]", "left-3 bottom-2 -rotate-2"]
  const names = ["Pearl Prestige business card", "Gilded Arc business card", "Executive Noir business card"]
  return (
    <div className="relative h-[128px] w-[136px]">
      {data.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={src} alt={names[i]} className={`absolute h-[62px] w-[108px] rounded-md object-cover shadow-[0_6px_16px_rgba(0,31,63,0.25)] ${place[i]}`} />
      ))}
    </div>
  )
}

/** The digital card as it opens on a phone, in one of its real designs
 *  (PROFILE_THEMES in lib/profile-themes.ts — its photo, scrim, ink, accent and
 *  pill colours): the signed-in user's own name and photo, "Visit our website",
 *  the QR + contact panel, the action bar, WhatsApp. */
function DigitalPhone({ themeId }: { themeId: string }) {
  const { user, profile } = useAuth()
  const t = PROFILE_THEMES.find((x) => x.id === themeId) ?? PROFILE_THEMES[0]
  const name = profile?.fullname?.trim() || "Juan Dela Cruz"
  const photo = profile?.profile_url?.trim() || SAMPLE_PORTRAIT
  const email = user?.email ?? "juan@fhiglobal.ae"
  return (
    <span className="relative flex h-[136px] w-[76px] flex-col items-center overflow-hidden rounded-[10px] p-1.5 pt-2.5 shadow-[0_6px_16px_rgba(0,31,63,0.3)] ring-2 ring-[#001f3f]">
      {t.image && <Image src={t.image} alt="" fill sizes="100px" className="object-cover object-center" />}
      <span className="absolute inset-0" style={{ background: t.scrim }} />
      <span className="relative h-7 w-7 overflow-hidden rounded-full border-[1.5px] shadow" style={{ borderColor: t.accent }}>
        {photo.startsWith("/") ? (
          <Image src={photo} alt="" fill sizes="40px" className="object-cover object-top" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-full w-full object-cover object-top" />
        )}
      </span>
      <span className="relative mt-1 max-w-full truncate font-['Outfit'] text-[7px] font-bold leading-none" style={{ color: t.ink }}>{name}</span>
      <span className="relative mt-1.5 flex h-4 w-full items-center gap-1 rounded-full pl-0.5 pr-1" style={{ background: t.pillBg }}>
        <span className="flex h-3 w-3 items-center justify-center rounded-full" style={{ background: t.tile }}><Globe className="h-1.5 w-1.5" style={{ color: t.tileInk }} /></span>
        <span className="flex-1 text-center text-[5px] font-bold" style={{ color: t.pillInk }}>Visit our website</span>
      </span>
      <span className="relative mt-1.5 flex w-full items-center gap-1 rounded-md border p-1" style={{ background: t.panel, borderColor: t.panelBorder }}>
        <span className="rounded-[2px] border bg-white p-px" style={{ borderColor: t.accent }}>
          <QRCodeSVG value={`${SITE_URL}/business-card`} size={20} level="L" fgColor="#1a1612" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          {[["+971", true], [email, false], ["www.fhiglobal.ae", false]].map(([text, bold], i) => (
            <span key={i} className="flex items-center gap-0.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: t.accent }} />
              <span className={`truncate text-[4.5px] leading-none ${bold ? "font-bold" : ""}`} style={{ color: bold ? t.ink : t.inkMuted }}>{String(text)}</span>
            </span>
          ))}
        </span>
      </span>
      <span className="relative mt-1.5 flex h-3.5 w-full items-center justify-around rounded-full px-1 text-[4.5px] font-extrabold uppercase" style={{ background: t.pillBg, color: t.pillInk }}>
        <span>Save</span><span className="h-2 w-px bg-current opacity-25" /><span>Share</span><span className="h-2 w-px bg-current opacity-25" /><span>Contact</span>
      </span>
      <span className="relative mt-auto flex h-4 w-4 items-center justify-center rounded-full bg-[#25d366]">
        <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 fill-white"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.2 14.8l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 0 1 12 4zm-3 4.5c-.2 0-.5 0-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.2 5 4.4 2.5 1 3 .8 3.5.7.5 0 1.7-.7 2-1.4.2-.7.2-1.2.1-1.4l-.5-.2-1.9-.9c-.3-.1-.4-.2-.6.1l-.9 1.1c-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.5-.9-.8-1.5-1.7-1.6-2-.2-.3 0-.4.1-.6l.4-.5.3-.5v-.5l-.9-2c-.2-.5-.4-.5-.6-.5z"/></svg>
      </span>
    </span>
  )
}

/** Two of the digital card's real designs fanned like the posters: Pearl (the
 *  light one) behind, Skyline (Dubai at golden hour) in front. */
function DigitalCardPreview() {
  return (
    <div className="relative h-[146px] w-[136px]">
      <span className="absolute left-0 top-2 -rotate-[8deg]"><DigitalPhone themeId="pearl" /></span>
      <span className="absolute right-0 top-0 rotate-[6deg]"><DigitalPhone themeId="skyline" /></span>
    </div>
  )
}

/** Reels from the studio fanned like the posters: three 9:16 reels, the front one playing. */
function ReelsPreview() {
  const reels = [
    { photo: "/images/house 2.jpg", title: "Townhouse · JVC", price: "AED 1.8M · 3 beds", className: "left-0 top-3 -rotate-[9deg]", front: false },
    { photo: "/images/properties.jpg", title: "Apartment · Marina", price: "AED 1.2M · 2 beds", className: "right-0 top-3 rotate-[9deg]", front: false },
    { photo: "/images/house.jpg", title: "Luxury villa · Dubai Hills", price: "AED 4.2M · 5 beds", className: "left-1/2 top-0 -translate-x-1/2", front: true },
  ]
  return (
    <div className="relative h-[140px] w-[136px]">
      {reels.map(({ photo, title, price, className, front }) => (
        <span key={photo} className={`absolute block h-[124px] w-[68px] overflow-hidden rounded-[10px] bg-[#0a2136] shadow-[0_6px_16px_rgba(0,31,63,0.3)] ring-2 ring-[#001f3f] ${className}`}>
          <Image src={photo} alt={front ? "Reel sample" : ""} fill sizes="80px" className="object-cover" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
          <Image src="/FHI_Branding_White.png" alt="" width={28} height={10} className="absolute left-1.5 top-1.5 h-auto w-5" />
          {front && (
            <span className="absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90">
              <Play className="ml-px h-2.5 w-2.5 fill-[#001f3f] text-[#001f3f]" />
            </span>
          )}
          <span className="absolute bottom-2.5 left-1.5 right-1.5">
            <span className="block truncate text-[5.5px] font-bold text-white">{title}</span>
            <span className="block text-[5px] text-[#d6b357]">{price}</span>
          </span>
          <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/25"><span className={`block h-full bg-[#d6b357] ${front ? "w-2/3" : "w-1/4"}`} /></span>
        </span>
      ))}
    </div>
  )
}

/** A real studio job fanned like the posters: the bare room behind, the
 *  before/after split, and the AI-staged result in front (public/hub-samples). */
function PhotoStudioPreview() {
  const cards = [
    { src: "/hub-samples/photo-studio-before.jpg", alt: "Original photo", tag: "Before", className: "left-0 top-0 -rotate-[7deg]" },
    { src: "/hub-samples/photo-studio-split.jpg", alt: "Before and after comparison", tag: "Compare", className: "right-0 top-8 rotate-[6deg]" },
    { src: "/hub-samples/photo-studio-after.jpg", alt: "Staged with AI", tag: "AI staged", className: "left-2 bottom-0 -rotate-1" },
  ]
  return (
    <div className="relative h-[140px] w-[136px]">
      {cards.map((c) => (
        <span key={c.src} className={`${sheet} absolute block h-[62px] w-[104px] ${c.className}`}>
          <Image src={c.src} alt={c.alt} fill sizes="120px" className="object-cover" />
          <span className="absolute right-[3px] top-[3px] rounded-full bg-white/90 px-[4px] py-[1px] text-[4.5px] font-bold uppercase text-[#001f3f]">{c.tag}</span>
        </span>
      ))}
    </div>
  )
}

/** Ad Branding: branded property ads fanned out like the poster samples — three
 *  portrait posts behind (photos and videos) and two landscape ones in front,
 *  each with a logo and the ad permit, and a Photo / Video tag. */
function AdBrandingPreview() {
  const ads = [
    { photo: "/images/house 2.jpg", logo: "/logos/ad-branding/homes-ph-light.png", kind: "photo", className: "left-0 top-0 h-[96px] w-[56px] -rotate-[8deg]" },
    { photo: "/images/properties.jpg", logo: "/logos/ad-branding/filipinohomes-light.png", kind: "video", className: "right-0 top-0 h-[96px] w-[56px] rotate-[8deg]" },
    { photo: "/johndorf/houses/pool.jpg", logo: "/logos/FHI_Branding_White.png", kind: "video", className: "left-1/2 -top-1 h-[100px] w-[58px] -translate-x-1/2" },
    { photo: "/background/dubai.webp", logo: "/logos/ad-branding/homes-ph-light.png", kind: "video", className: "bottom-6 left-0 h-[60px] w-[100px] -rotate-[5deg]" },
    { photo: "/images/house.jpg", logo: "/logos/FHI_Branding_White.png", kind: "photo", className: "bottom-0 right-0 h-[60px] w-[100px] rotate-[3deg]" },
  ] as const
  return (
    <div className="relative h-[140px] w-[132px]">
      {ads.map(({ photo, logo, kind, className }) => (
        <span key={photo} className={`${sheet} absolute block ${className}`}>
          <Image src={photo} alt="" fill sizes="110px" className="object-cover" />
          <span className="absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-black/45 to-transparent" />
          <span className="absolute left-[4px] top-[4px] block h-[8px] w-[34px]">
            <Image src={logo} alt="" fill sizes="50px" className="object-contain object-left" />
          </span>
          <span className="absolute right-[3px] top-[3px] flex items-center gap-[1.5px] rounded-full bg-white/90 px-[3px] py-[1px] text-[4px] font-bold uppercase text-[#001f3f]">
            {kind === "video" ? <Video className="h-[5px] w-[5px]" /> : <ImageIcon className="h-[5px] w-[5px]" />}
            {kind}
          </span>
          {kind === "video" && (
            <span className="absolute left-1/2 top-1/2 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 shadow">
              <Play className="ml-[1px] h-2 w-2 fill-[#001f3f] text-[#001f3f]" />
            </span>
          )}
          <span className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-black/45 to-transparent" />
          <span className="absolute inset-x-0 bottom-[3px] text-center text-[3.4px] font-bold text-white [text-shadow:0_0_1px_#000,0_0_1px_#000]">
            FHI Global Ad Permit No. 145225
          </span>
        </span>
      ))}
    </div>
  )
}

/** Posters from the studios fanned out: a birthday card, a listing flyer and a brand poster. */
function PosterMakerPreview() {
  return (
    <div className="relative h-[140px] w-[136px]">
      <span className={`${sheet} absolute left-0 top-3 block h-[112px] w-[62px] -rotate-[9deg]`}>
        <Image src="/images/birthday1.png" alt="Birthday poster" fill sizes="80px" className="object-cover object-top" />
      </span>
      <span className={`${sheet} absolute left-1/2 top-0 block h-[112px] w-[66px] -translate-x-1/2`}>
        <Image src="/images/homes-poster.png" alt="Brand poster" fill sizes="80px" className="object-cover object-top" />
      </span>
      <span className={`${sheet} absolute right-0 top-4 flex h-[112px] w-[62px] rotate-[9deg] flex-col`}>
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

/** A real Business Meeting poster made with the tool (square, three speakers),
 *  fanned with the same poster as a story on a phone and in a WhatsApp chat. */
function MeetingPosterPreview() {
  const poster = "/hub-samples/meeting-poster-v2.jpg"
  return (
    <div className="relative h-[140px] w-[136px]">
      {/* As a story on a phone */}
      <span className="absolute right-0 top-0 flex h-[120px] w-[66px] rotate-[8deg] flex-col items-center justify-center overflow-hidden rounded-[10px] bg-[#0d1b2e] shadow-[0_6px_16px_rgba(0,31,63,0.3)] ring-2 ring-[#001f3f]">
        <span className="absolute inset-x-1.5 top-1.5 flex gap-0.5">{[0, 1, 2].map((i) => <span key={i} className={`h-[2px] flex-1 rounded ${i === 0 ? "bg-white" : "bg-white/35"}`} />)}</span>
        <span className="relative block h-[62px] w-[62px]"><Image src={poster} alt="" fill sizes="70px" className="object-cover" /></span>
        <span className="mt-1.5 rounded-full bg-[#d6b357] px-1.5 py-[1px] text-[4.5px] font-bold text-[#001f3f]">Register now</span>
      </span>
      {/* Shared in a chat */}
      <span className="absolute left-0 top-4 flex h-[96px] w-[62px] -rotate-[8deg] flex-col gap-1 overflow-hidden rounded-[10px] bg-[#e7ddd3] p-1.5 shadow-[0_6px_16px_rgba(0,31,63,0.25)] ring-2 ring-[#001f3f]">
        <span className="h-2 w-9 rounded-sm bg-[#075e54]" />
        <span className="ml-auto block w-[44px] overflow-hidden rounded-[4px] bg-[#dcf8c6] p-[2px] shadow-sm">
          <span className="relative block h-[40px] w-full"><Image src={poster} alt="" fill sizes="50px" className="object-cover" /></span>
          <span className="block px-[1px] pt-[1px] text-[3.8px] text-[#1a1612]">See you there!</span>
        </span>
      </span>
      {/* The poster itself, in front */}
      <span className={`${sheet} absolute bottom-0 left-1/2 block h-[84px] w-[84px] -translate-x-1/2 border-0`}>
        <Image src={poster} alt="Business Meeting poster" fill sizes="100px" className="object-cover" />
      </span>
    </div>
  )
}

/** The Website Builder's sample site (fhiglobal.ae/website/sample) as it looks
 *  on a PC: two browser windows, like the poster samples — the top of the page
 *  in front and the next screen (About + Featured Projects) behind it.
 *  Real desktop screenshots (1440 px wide), saved in public/hub-samples. */
function WebsiteBuilderPreview() {
  const browser = (src: string, alt: string, className: string) => (
    <span className={`${sheet} absolute flex w-[124px] flex-col ${className}`}>
      <span className="flex h-[7px] items-center gap-[2px] bg-[#eef0f3] px-[3px]">
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} className="h-[3px] w-[3px] rounded-full" style={{ background: c }} />)}
        <span className="ml-[3px] h-[3px] flex-1 rounded-full bg-white" />
      </span>
      <Image src={src} alt={alt} width={124} height={78} className="block h-[78px] w-[124px] object-cover object-top" />
    </span>
  )
  return (
    <div className="relative h-[146px] w-[150px]">
      {browser("/hub-samples/website-desktop-more.jpg", "", "right-0 bottom-0 rotate-3")}
      {browser("/hub-samples/website-desktop-top.jpg", "Sample agent website", "left-0 top-0 -rotate-3")}
    </div>
  )
}

/** The agreement as the generator produces it, fanned like the posters: the
 *  later pages behind, page 1 in front. */
function A2APreview() {
  const page = "/hub-samples/a2a-agreement.jpg"
  return (
    <div className="relative h-[140px] w-[136px]">
      <span className={`${sheet} absolute left-0 top-3 block h-[118px] w-[84px] -rotate-[8deg]`}>
        <Image src={page} alt="" fill sizes="90px" className="object-cover object-bottom" />
      </span>
      <span className={`${sheet} absolute right-0 top-3 block h-[118px] w-[84px] rotate-[8deg]`}>
        <Image src={page} alt="" fill sizes="90px" className="object-cover object-center" />
      </span>
      <span className={`${sheet} absolute left-1/2 top-0 block h-[126px] w-[90px] -translate-x-1/2`}>
        <Image src={page} alt="Agent-to-agent agreement sample" fill sizes="100px" className="object-cover object-top" />
      </span>
    </div>
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

// ─── Communication (admin) ──────────────────────────────────────────────────
// Miniatures of the four screens with sample people — no real enquiries,
// leads or reviews ever appear on the tiles.

/** The Contact Inbox: unread enquiries from the public site, newest first. */
function ContactInboxPreview() {
  const rows = [
    { i: "M", c: "bg-[#2f5d8a]", name: "Maria Santos", subject: "Viewing request · JVC", t: "2m", unread: true },
    { i: "A", c: "bg-[#b8913f]", name: "Ahmed Khalid", subject: "Payment plan question", t: "1h", unread: true },
    { i: "S", c: "bg-[#5c6b7a]", name: "Sarah Lim", subject: "Partnership enquiry", t: "3h", unread: false },
  ]
  return (
    <span className={`${sheet} flex w-[116px] flex-col`}>
      <span className="flex items-center justify-between bg-[#001f3f] px-1.5 py-1">
        <span className="text-[6.5px] font-bold text-white">Contact Inbox</span>
        <span className="rounded-full bg-[#d6b357] px-1 text-[5.5px] font-bold text-[#001f3f]">2 new</span>
      </span>
      {rows.map((r) => (
        <span key={r.name} className={`flex items-center gap-1 border-b border-[#eef0f3] px-1.5 py-1 ${r.unread ? "bg-[#fffaf0]" : ""}`}>
          <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[5.5px] font-bold text-white ${r.c}`}>{r.i}</span>
          <span className="flex min-w-0 flex-1 flex-col leading-none">
            <span className={`truncate text-[6px] ${r.unread ? "font-bold text-[#0d1117]" : "font-semibold text-[#374151]"}`}>{r.name}</span>
            <span className="mt-0.5 truncate text-[5px] text-[#6b7280]">{r.subject}</span>
          </span>
          <span className="flex flex-col items-end gap-0.5">
            <span className="text-[4.5px] text-[#9ca3af]">{r.t}</span>
            {r.unread && <span className="h-1 w-1 rounded-full bg-[#d6b357]" />}
          </span>
        </span>
      ))}
      <span className="m-1.5 flex h-3.5 items-center justify-center rounded bg-[#d6b357] text-[5.5px] font-bold text-[#001f3f]">Reply</span>
    </span>
  )
}

/** Buyer Leads: every agent's Buyers Link briefs, graded. */
function BuyerLeadsPreview() {
  const leads = [
    { name: "Ahmed K.", grade: "Priority", gc: "bg-[#d6b357] text-[#001f3f]", budget: "AED 1M – 2M", when: "Within 3 months", via: "via Juan D." },
    { name: "Grace T.", grade: "Qualified", gc: "bg-[#001f3f] text-white", budget: "AED 500K – 1M", when: "Within a year", via: "via Maria S." },
  ]
  return (
    <span className="flex w-[112px] flex-col gap-1.5">
      {leads.map((l, i) => (
        <span key={l.name} className={`${sheet} flex flex-col gap-0.5 p-1.5 ${i === 1 ? "ml-2" : "mr-2"}`}>
          <span className="flex items-center justify-between gap-1">
            <span className="truncate text-[6.5px] font-bold text-[#0d1117]">{l.name}</span>
            <span className={`rounded-full px-1 text-[5px] font-bold ${l.gc}`}>{l.grade}</span>
          </span>
          <span className="text-[5.5px] font-semibold text-[#8a6d2a]">{l.budget}</span>
          <span className="flex items-center justify-between text-[4.8px] text-[#6b7280]">
            <span>{l.when}</span>
            <span className="text-[#9ca3af]">{l.via}</span>
          </span>
        </span>
      ))}
    </span>
  )
}

/** Support Tickets: what agents and clients raised, with status. */
function SupportTicketsPreview() {
  const rows = [
    { id: "#1042", title: "Can't upload my ID", st: "Open", c: "bg-amber-100 text-amber-800" },
    { id: "#1041", title: "Commission status", st: "In progress", c: "bg-sky-100 text-sky-800" },
    { id: "#1038", title: "Password reset", st: "Resolved", c: "bg-emerald-100 text-emerald-800" },
  ]
  return (
    <span className={`${sheet} flex w-[116px] flex-col`}>
      <span className="flex items-center justify-between border-b border-[#eef0f3] px-1.5 py-1">
        <span className="text-[6.5px] font-bold text-[#001f3f]">Support Tickets</span>
        <LifeBuoy className="h-2.5 w-2.5 text-[#b8913f]" />
      </span>
      {rows.map((r) => (
        <span key={r.id} className="flex items-center gap-1 border-b border-[#f3f4f6] px-1.5 py-1 last:border-0">
          <span className="flex min-w-0 flex-1 flex-col leading-none">
            <span className="text-[4.5px] font-bold text-[#9ca3af]">{r.id}</span>
            <span className="mt-0.5 truncate text-[5.8px] font-semibold text-[#0d1117]">{r.title}</span>
          </span>
          <span className={`shrink-0 rounded-full px-1 py-px text-[4.5px] font-bold ${r.c}`}>{r.st}</span>
        </span>
      ))}
    </span>
  )
}

/** Customer Feedback: a client's review of an advisor, waiting for approval. */
function CustomerFeedbackPreview() {
  return (
    <span className="flex w-[114px] flex-col gap-1.5">
      <span className={`${sheet} flex flex-col gap-1 p-1.5`}>
        <span className="flex items-center gap-1">
          <span className="relative h-4 w-4 shrink-0 overflow-hidden rounded-full ring-1 ring-[#d6b357]">
            <Image src={SAMPLE_PORTRAIT} alt="" fill sizes="20px" className="object-cover object-top" />
          </span>
          <span className="flex min-w-0 flex-col leading-none">
            <span className="truncate text-[5.8px] font-bold text-[#0d1117]">Juan Dela Cruz</span>
            <span className="mt-0.5 flex gap-px">{[0, 1, 2, 3, 4].map((i) => <Star key={i} className="h-1.5 w-1.5 fill-[#d6b357] text-[#d6b357]" />)}</span>
          </span>
        </span>
        <span className="text-[5.3px] italic leading-snug text-[#374151]">&ldquo;Juan made buying our first apartment in Dubai easy and clear.&rdquo;</span>
        <span className="text-[4.8px] text-[#9ca3af]">— Sarah L., buyer</span>
      </span>
      <span className="flex gap-1">
        <span className="flex h-3.5 flex-1 items-center justify-center gap-0.5 rounded bg-emerald-600 text-[5.5px] font-bold text-white"><Check className="h-2 w-2" /> Approve</span>
        <span className="flex h-3.5 flex-1 items-center justify-center rounded border border-[#dfe4ea] bg-white text-[5.5px] font-bold text-[#6b7280]">Hide</span>
      </span>
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
  "ad-branding": () => <AdBrandingPreview />,
  // Communication (admin)
  "contact-inbox": () => <ContactInboxPreview />,
  "buyer-leads": () => <BuyerLeadsPreview />,
  "support-tickets": () => <SupportTicketsPreview />,
  "customer-feedback": () => <CustomerFeedbackPreview />,
}

/** The sample inside a tile's right-hand frame; null when no sample is registered for this kind. */
export function TilePreview({ kind }: { kind: string }) {
  const render = PREVIEWS[kind]
  if (!render) return null
  return <>{render()}</>
}

export const hasTilePreview = (kind: string | undefined): kind is string => !!kind && kind in PREVIEWS
