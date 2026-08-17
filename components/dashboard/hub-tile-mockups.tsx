import { Play, QrCode, Star } from "lucide-react"

/**
 * Miniature format illustrations for the Agent Resource tiles — a stylized
 * model of what each tool produces (a business card, a poster, a reel…),
 * drawn in the brand's navy/gold. Pure CSS/SVG, no image files to maintain.
 */
export function TileMockup({ kind }: { kind: string }) {
  const art = MOCKUPS[kind]
  if (!art) return null
  return (
    <span
      aria-hidden="true"
      className="relative flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#e8eaed] bg-[#f3f5f8] transition-transform duration-300 group-hover:scale-105"
    >
      {art}
    </span>
  )
}

const MOCKUPS: Record<string, React.ReactNode> = {
  // Two stacked cards: white back card peeking out behind the navy front —
  // gold logo mark, name line, title, contact row.
  "business-card": (
    <span className="relative block h-[46px] w-[74px]">
      <span className="absolute left-1.5 top-1.5 h-10 w-[66px] rounded-md border border-[#dfe4ea] bg-white shadow-sm" />
      <span className="absolute left-0 top-0 block h-10 w-[66px] rounded-md bg-[#001f3f] p-1.5 shadow-md">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-[#d6b357]" />
          <span className="h-[3px] w-5 rounded bg-[#d6b357]/70" />
        </span>
        <span className="mt-1.5 block h-1 w-9 rounded bg-white/90" />
        <span className="mt-0.5 block h-[3px] w-6 rounded bg-white/40" />
        <span className="mt-1 flex items-center gap-1">
          <span className="h-1 w-1 rounded-full bg-[#d6b357]" />
          <span className="h-[3px] w-4 rounded bg-white/30" />
          <span className="h-1 w-1 rounded-full bg-[#d6b357]" />
          <span className="h-[3px] w-4 rounded bg-white/30" />
        </span>
      </span>
    </span>
  ),
  // A phone: notch, avatar, name, two action buttons, QR at the bottom.
  "digital-business-card": (
    <span className="relative flex h-[54px] w-8 flex-col items-center rounded-[7px] bg-[#001f3f] p-1 pt-2 shadow-md ring-1 ring-[#0b2a4d]">
      <span className="absolute top-[3px] h-[3px] w-3 rounded-full bg-white/25" />
      <span className="h-3.5 w-3.5 rounded-full bg-[#d6b357] ring-1 ring-white/30" />
      <span className="mt-0.5 block h-[3px] w-4 rounded bg-white/85" />
      <span className="mt-0.5 block h-[3px] w-3 rounded bg-white/35" />
      <span className="mt-1 flex w-full flex-col gap-0.5 px-0.5">
        <span className="h-1.5 w-full rounded-[2px] bg-[#d6b357]" />
        <span className="h-1.5 w-full rounded-[2px] border border-white/30" />
      </span>
      <QrCode className="mt-auto h-3 w-3 text-white/80" />
    </span>
  ),
  // A reel mid-play: skyline scene, play button, action rail, progress bar.
  "reels-maker": (
    <span className="relative h-[54px] w-8 overflow-hidden rounded-[7px] bg-[#0a2136] shadow-md ring-1 ring-[#0b2a4d]">
      <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#d6b357]" />
      <span className="absolute bottom-2.5 left-1 h-5 w-1.5 bg-[#14324f]" />
      <span className="absolute bottom-2.5 left-3 h-7 w-2 bg-[#1d4166]" />
      <span className="absolute bottom-2.5 right-1 h-4 w-1.5 bg-[#14324f]" />
      <Play className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 fill-white text-white" />
      <span className="absolute right-0.5 top-4 flex flex-col gap-1">
        <span className="h-1 w-1 rounded-full bg-white/80" />
        <span className="h-1 w-1 rounded-full bg-white/60" />
        <span className="h-1 w-1 rounded-full bg-white/40" />
      </span>
      <span className="absolute bottom-1 left-1 h-[3px] w-4 rounded bg-white/70" />
      <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/20">
        <span className="block h-full w-2/3 bg-[#d6b357]" />
      </span>
    </span>
  ),
  // A portrait flyer: skyline photo block, headline, copy, price chip.
  "poster-maker": (
    <span className="flex h-[54px] w-10 flex-col overflow-hidden rounded-[3px] border border-[#dfe4ea] bg-white shadow-md">
      <span className="relative h-[22px] w-full shrink-0 bg-[#d7e4ee]">
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#d6b357]" />
        <span className="absolute bottom-0 left-1 h-2.5 w-1.5 bg-[#123252]" />
        <span className="absolute bottom-0 left-3 h-4 w-1.5 bg-[#1d4166]" />
        <span className="absolute bottom-0 right-1.5 h-2 w-1.5 bg-[#123252]" />
      </span>
      <span className="flex min-h-0 flex-1 flex-col gap-0.5 p-1">
        <span className="h-1 w-6 rounded bg-[#001f3f]" />
        <span className="h-[3px] w-7 rounded bg-[#c3c9d1]" />
        <span className="h-[3px] w-5 rounded bg-[#c3c9d1]" />
        <span className="mt-auto flex items-center justify-between">
          <span className="h-1.5 w-4 rounded-[2px] bg-[#d6b357]" />
          <QrCode className="h-2 w-2 text-[#001f3f]/60" />
        </span>
      </span>
    </span>
  ),
  // A landscape event banner: title, date chip, speaker headshot tiles.
  "meeting-poster": (
    <span className="flex h-12 w-[78px] flex-col overflow-hidden rounded-[4px] bg-[#001f3f] p-1.5 shadow-md">
      <span className="flex items-center justify-between">
        <span className="h-1 w-8 rounded bg-[#d6b357]" />
        <span className="h-2 w-4 rounded-[2px] border border-[#d6b357]/60" />
      </span>
      <span className="mt-0.5 h-[3px] w-6 rounded bg-white/50" />
      <span className="mt-auto flex items-end gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="relative h-4 w-4 overflow-hidden rounded-[3px] bg-[#12365a]">
            <span className="absolute left-1/2 top-0.5 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#e9dcb4]" />
            <span
              className={`absolute -bottom-0.5 left-1/2 h-2 w-3 -translate-x-1/2 rounded-t-full ${
                i === 1 ? "bg-[#d6b357]" : "bg-[#3a5a7d]"
              }`}
            />
          </span>
        ))}
        <span className="ml-auto h-[3px] w-3 rounded bg-white/40" />
      </span>
    </span>
  ),
  // A browser: traffic lights + address bar, navy hero with CTA, card row.
  "website-builder": (
    <span className="flex h-12 w-[78px] flex-col overflow-hidden rounded-[5px] border border-[#dfe4ea] bg-white shadow-md">
      <span className="flex h-2.5 shrink-0 items-center gap-0.5 border-b border-[#e5e9ee] bg-[#eef1f5] px-1">
        <span className="h-1 w-1 rounded-full bg-[#d6b357]" />
        <span className="h-1 w-1 rounded-full bg-[#c3c9d1]" />
        <span className="h-1 w-1 rounded-full bg-[#c3c9d1]" />
        <span className="ml-0.5 h-1 flex-1 rounded-full bg-white" />
      </span>
      <span className="relative h-[18px] shrink-0 bg-[#001f3f] p-1">
        <span className="block h-[3px] w-6 rounded bg-white/85" />
        <span className="mt-0.5 block h-[3px] w-4 rounded bg-[#d6b357]" />
        <span className="absolute bottom-1 right-1 h-1.5 w-3.5 rounded-[2px] bg-[#d6b357]" />
      </span>
      <span className="flex flex-1 gap-0.5 p-0.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="flex flex-1 flex-col overflow-hidden rounded-[2px] bg-[#eef1f5]">
            <span className="h-1.5 w-full bg-[#c8d4de]" />
            <span className="mx-0.5 mt-0.5 h-[2px] w-3 rounded bg-[#aab3bf]" />
          </span>
        ))}
      </span>
    </span>
  ),
  // A listing flyer: house in the photo, gold SOLD banner, copy, price chip.
  "listing-posters": (
    <span className="flex h-[54px] w-10 flex-col overflow-hidden rounded-[3px] border border-[#dfe4ea] bg-white shadow-md">
      <span className="relative h-[22px] w-full shrink-0 bg-[#d7e4ee]">
        <svg viewBox="0 0 20 14" className="absolute bottom-0 left-1/2 h-3.5 w-5 -translate-x-1/2">
          <polygon points="10,0 20,7 0,7" fill="#1d4166" />
          <rect x="3" y="7" width="14" height="7" fill="#123252" />
          <rect x="8" y="9" width="4" height="5" fill="#d6b357" />
        </svg>
        <span className="absolute left-0 top-1 h-2 w-5 bg-[#d6b357]" />
      </span>
      <span className="flex min-h-0 flex-1 flex-col gap-0.5 p-1">
        <span className="h-1 w-6 rounded bg-[#001f3f]" />
        <span className="h-[3px] w-7 rounded bg-[#c3c9d1]" />
        <span className="mt-auto h-1.5 w-4 rounded-[2px] bg-[#d6b357]" />
      </span>
    </span>
  ),
  // The three project formats side by side: story, square, print.
  "project-posters": (
    <span className="flex items-end gap-1">
      <span className="flex h-[50px] w-6 flex-col rounded-[3px] bg-[#001f3f] p-1 shadow-md">
        <span className="h-[3px] w-3 rounded bg-[#d6b357]" />
        <span className="mt-0.5 h-[3px] w-4 rounded bg-white/70" />
        <span className="mt-auto h-1.5 w-3 rounded-[2px] bg-[#d6b357]" />
      </span>
      <span className="flex h-8 w-8 flex-col rounded-[3px] bg-[#12365a] p-1 shadow-md">
        <span className="h-1.5 w-1.5 rounded-full bg-[#d6b357]" />
        <span className="mt-auto h-[3px] w-5 rounded bg-white/70" />
      </span>
      <span className="flex h-11 w-8 flex-col rounded-[3px] border border-[#dfe4ea] bg-white p-1 shadow-md">
        <span className="h-3 w-full rounded-[2px] bg-[#001f3f]" />
        <span className="mt-0.5 h-[3px] w-4 rounded bg-[#c3c9d1]" />
        <span className="mt-auto h-[3px] w-3 rounded bg-[#d6b357]" />
      </span>
    </span>
  ),
  // A birthday card: confetti, framed photo, "Happy Birthday" lines, name.
  "birthday-poster": (
    <span className="relative flex h-[54px] w-10 flex-col items-center overflow-hidden rounded-[3px] bg-[#001f3f] p-1 shadow-md">
      <span className="absolute left-1 top-1 h-1 w-1 rounded-full bg-[#d6b357]/80" />
      <span className="absolute right-1.5 top-2 h-[3px] w-[3px] rounded-full bg-white/60" />
      <span className="absolute left-2 top-5 h-[3px] w-[3px] rotate-45 bg-[#d6b357]/70" />
      <span className="absolute right-1 top-6 h-1 w-1 rounded-full bg-white/40" />
      <span className="mt-1.5 h-4 w-4 rounded-full bg-[#e9dcb4] ring-2 ring-[#d6b357]" />
      <span className="mt-1 h-[3px] w-5 rounded bg-white/85" />
      <span className="mt-0.5 h-1 w-7 rounded bg-[#d6b357]" />
      <span className="mt-auto h-[3px] w-4 rounded bg-white/50" />
    </span>
  ),
  // A contract: centered title, clause lines, a real signature squiggle over
  // its line, and the gold notary seal.
  "a2a-agreement": (
    <span className="relative flex h-[54px] w-10 flex-col overflow-hidden rounded-[3px] border border-[#dfe4ea] bg-white p-1 shadow-md">
      <span className="mx-auto h-1 w-6 rounded bg-[#001f3f]" />
      <span className="mt-1 h-[3px] w-7 rounded bg-[#c9ced6]" />
      <span className="mt-0.5 h-[3px] w-6 rounded bg-[#c9ced6]" />
      <span className="mt-0.5 h-[3px] w-7 rounded bg-[#c9ced6]" />
      <span className="mt-0.5 h-[3px] w-4 rounded bg-[#c9ced6]" />
      <svg viewBox="0 0 24 8" className="mt-auto h-2 w-6 text-[#123252]">
        <path
          d="M1 6 C3 1, 5 7, 8 4 S12 1, 14 4 S18 7, 23 2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </svg>
      <span className="h-px w-6 bg-[#9aa3ae]" />
      <span className="absolute bottom-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#d6b357] ring-1 ring-[#b8913f]">
        <Star className="h-2 w-2 fill-[#001f3f] text-[#001f3f]" />
      </span>
    </span>
  ),
}
