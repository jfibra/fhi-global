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
  // A till receipt: header, line items with amounts, gold total, torn edge.
  purchases: (
    <span className="relative block h-[52px] w-9 rotate-[3deg]">
      <span className="flex h-[48px] w-full flex-col rounded-t-[2px] border border-b-0 border-[#dfe4ea] bg-white p-1 shadow-md">
        <span className="mx-auto h-[3px] w-4 rounded bg-[#001f3f]" />
        <span className="mt-1 flex items-center justify-between">
          <span className="h-[3px] w-3 rounded bg-[#c3c9d1]" />
          <span className="h-[3px] w-1.5 rounded bg-[#aab3bf]" />
        </span>
        <span className="mt-0.5 flex items-center justify-between">
          <span className="h-[3px] w-4 rounded bg-[#c3c9d1]" />
          <span className="h-[3px] w-1.5 rounded bg-[#aab3bf]" />
        </span>
        <span className="mt-0.5 flex items-center justify-between">
          <span className="h-[3px] w-2.5 rounded bg-[#c3c9d1]" />
          <span className="h-[3px] w-1.5 rounded bg-[#aab3bf]" />
        </span>
        <span className="mt-auto border-t border-dashed border-[#c8d4de] pt-0.5">
          <span className="flex items-center justify-between">
            <span className="h-[3px] w-2 rounded bg-[#001f3f]" />
            <span className="h-1 w-3 rounded-[1px] bg-[#d6b357]" />
          </span>
        </span>
      </span>
      <svg viewBox="0 0 36 4" className="block h-1 w-full text-white drop-shadow-sm">
        <path d="M0 0h36L33 4 30 0l-3 4-3-4-3 4-3-4-3 4-3-4-3 4-3-4-3 4L3 0 0 4z" fill="currentColor" stroke="#dfe4ea" strokeWidth="0.4" />
      </svg>
    </span>
  ),
  // Two swing tags on a ring — one gold, one navy.
  "purchase-categories": (
    <span className="relative block h-[46px] w-[64px]">
      <span className="absolute left-3 top-1 h-9 w-7 rotate-[-14deg] rounded-[3px] bg-[#12365a] shadow-sm">
        <span className="absolute left-1/2 top-1 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#f3f5f8]" />
      </span>
      <span className="absolute left-8 top-2 flex h-9 w-7 rotate-[12deg] flex-col items-center rounded-[3px] bg-[#d6b357] p-1 shadow-md">
        <span className="h-1.5 w-1.5 rounded-full bg-[#f3f5f8] ring-1 ring-[#b8913f]" />
        <span className="mt-1.5 h-[3px] w-4 rounded bg-[#001f3f]" />
        <span className="mt-0.5 h-[3px] w-3 rounded bg-[#001f3f]/50" />
      </span>
    </span>
  ),
  // The institution: pediment, columns, steps — with a gold ledger line.
  "tax-entities": (
    <span className="relative flex h-[46px] w-[64px] flex-col items-center justify-end">
      <svg viewBox="0 0 40 10" className="w-12">
        <polygon points="20,0 40,10 0,10" fill="#001f3f" />
        <circle cx="20" cy="6" r="1.6" fill="#d6b357" />
      </svg>
      <span className="flex w-12 justify-between bg-[#f3f5f8] px-1 py-0.5" style={{ columnGap: 2 }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-4 w-1.5 rounded-[1px] bg-[#12365a]" />
        ))}
      </span>
      <span className="h-1 w-12 bg-[#001f3f]" />
      <span className="mt-0.5 h-1 w-[56px] bg-[#c8d4de]" />
      <span className="mt-0.5 h-[3px] w-8 rounded bg-[#d6b357]" />
    </span>
  ),
  // A tower going up: crane, windows lighting on, a smaller finished block.
  "sale-project": (
    <span className="relative block h-[50px] w-[70px]">
      <svg viewBox="0 0 40 30" className="absolute left-0 top-0 h-[42px] w-[58px]">
        <path
          d="M6 28V6 M2 6h22 M14 6v5"
          stroke="#b8913f"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
        <rect x="12.5" y="11" width="3" height="3" fill="#d6b357" />
      </svg>
      <span className="absolute bottom-0.5 right-8 h-5 w-4 rounded-t-[2px] bg-[#12365a]" />
      <span className="absolute bottom-0.5 right-1 grid h-9 w-6 grid-cols-2 content-start gap-0.5 rounded-t-[2px] bg-[#001f3f] p-1">
        <span className="h-1 w-1 rounded-[1px] bg-[#d6b357]" />
        <span className="h-1 w-1 rounded-[1px] bg-white/40" />
        <span className="h-1 w-1 rounded-[1px] bg-white/40" />
        <span className="h-1 w-1 rounded-[1px] bg-[#d6b357]" />
        <span className="h-1 w-1 rounded-[1px] bg-[#d6b357]" />
        <span className="h-1 w-1 rounded-[1px] bg-white/40" />
      </span>
      <span className="absolute bottom-0 left-1 right-1 h-[2px] rounded bg-[#c8d4de]" />
    </span>
  ),
  // A ready home changing hands: house with lit windows and the SOLD sticker.
  "sale-brokerage": (
    <span className="relative block h-[50px] w-[70px]">
      <svg viewBox="0 0 34 26" className="absolute bottom-0 left-1/2 h-10 w-[52px] -translate-x-1/2">
        <polygon points="17,0 34,12 0,12" fill="#1d4166" />
        <rect x="4" y="12" width="26" height="14" fill="#123252" />
        <rect x="14" y="17" width="6" height="9" fill="#d6b357" />
        <rect x="7" y="15" width="5" height="4" fill="#9fc2dd" />
        <rect x="22" y="15" width="5" height="4" fill="#9fc2dd" />
      </svg>
      <span className="absolute right-0 top-0 flex h-4 w-7 rotate-6 items-center justify-center rounded-[2px] bg-[#d6b357] shadow-sm">
        <span className="h-[3px] w-4 rounded bg-[#001f3f]" />
      </span>
    </span>
  ),
  // Keys handed over: the door, the key, and the FOR RENT chip.
  "sale-rental": (
    <span className="relative block h-[50px] w-[70px]">
      <span className="absolute bottom-1 left-3 h-10 w-7 rounded-t-[6px] bg-[#001f3f]">
        <span className="absolute right-1 top-5 h-1 w-1 rounded-full bg-[#d6b357]" />
      </span>
      <span className="absolute bottom-0.5 left-1.5 h-[2px] w-10 rounded bg-[#c8d4de]" />
      <svg viewBox="0 0 26 12" className="absolute right-0 top-2 h-4 w-9 rotate-12">
        <circle cx="5" cy="6" r="3.4" fill="none" stroke="#b8913f" strokeWidth="2" />
        <path d="M9 6h13 M17 6v4 M21 6v3" stroke="#b8913f" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="absolute bottom-1 right-0 flex h-3.5 w-8 items-center justify-center rounded-[2px] border border-[#d6b357] bg-white">
        <span className="h-[3px] w-5 rounded bg-[#b8913f]" />
      </span>
    </span>
  ),
  // An inbox: message rows with senders, the top one unread with a gold dot.
  "contact-inbox": (
    <span className="flex h-[50px] w-[74px] flex-col overflow-hidden rounded-[4px] border border-[#dfe4ea] bg-white shadow-md">
      <span className="flex h-3 shrink-0 items-center gap-1 bg-[#001f3f] px-1">
        <span className="h-[3px] w-5 rounded bg-[#d6b357]" />
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#d6b357]" />
      </span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`flex flex-1 items-center gap-1 border-b border-[#eef1f5] px-1 ${i === 0 ? "bg-[#faf7ee]" : ""}`}
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${i === 0 ? "bg-[#d6b357]" : "bg-[#c8d4de]"}`} />
          <span className="min-w-0 flex-1">
            <span className={`block h-[3px] w-7 rounded ${i === 0 ? "bg-[#001f3f]" : "bg-[#aab3bf]"}`} />
          </span>
          <span className="h-[3px] w-2 rounded bg-[#c3c9d1]" />
        </span>
      ))}
    </span>
  ),
  // A support ticket stub: notched edge, dashed tear line, priority chip.
  "support-tickets": (
    <span className="relative block rotate-[-4deg]">
      <span className="relative flex h-9 w-[72px] items-stretch overflow-hidden rounded-[4px] bg-[#001f3f] shadow-md">
        <span className="flex flex-1 flex-col justify-center gap-0.5 px-1.5">
          <span className="h-[3px] w-8 rounded bg-white/85" />
          <span className="h-[3px] w-6 rounded bg-white/40" />
          <span className="mt-0.5 h-1.5 w-5 rounded-[2px] bg-[#d6b357]" />
        </span>
        <span className="my-1 w-px border-l border-dashed border-white/40" />
        <span className="flex w-4 items-center justify-center">
          <span className="h-2 w-2 rounded-full border border-[#d6b357]" />
        </span>
        {/* ticket notches */}
        <span className="absolute -top-1 right-[18px] h-2 w-2 rounded-full bg-[#f3f5f8]" />
        <span className="absolute -bottom-1 right-[18px] h-2 w-2 rounded-full bg-[#f3f5f8]" />
      </span>
    </span>
  ),
  // A stack of marketing artworks with a gold download badge.
  materials: (
    <span className="relative block h-[50px] w-[70px]">
      <span className="absolute left-4 top-0 flex h-10 w-8 flex-col rounded-[3px] bg-[#12365a] p-1 shadow-sm rotate-3">
        <span className="h-1.5 w-1.5 rounded-full bg-[#d6b357]" />
        <span className="mt-auto h-[3px] w-4 rounded bg-white/60" />
      </span>
      <span className="absolute left-0 top-1.5 flex h-10 w-8 flex-col overflow-hidden rounded-[3px] border border-[#dfe4ea] bg-white shadow-md -rotate-3">
        <span className="relative h-4 w-full bg-[#d7e4ee]">
          <span className="absolute bottom-0 left-1 h-2 w-1.5 bg-[#1d4166]" />
          <span className="absolute bottom-0 left-3 h-3 w-1.5 bg-[#123252]" />
          <span className="absolute right-1 top-0.5 h-1 w-1 rounded-full bg-[#d6b357]" />
        </span>
        <span className="m-1 h-[3px] w-4 rounded bg-[#001f3f]" />
        <span className="mx-1 h-[3px] w-3 rounded bg-[#c3c9d1]" />
      </span>
      {/* download badge */}
      <span className="absolute -bottom-0.5 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#d6b357] shadow-sm ring-1 ring-white">
        <svg viewBox="0 0 10 10" className="h-2 w-2">
          <path d="M5 1v5M2.5 4 5 6.5 7.5 4M2 8.5h6" fill="none" stroke="#001f3f" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </span>
  ),
  // A hardcover book with spine, gold title, and a bookmark ribbon.
  ebooks: (
    <span className="relative block h-[50px] w-[64px]">
      <span className="absolute left-9 top-2 h-10 w-7 rounded-[3px] rounded-l-none bg-[#12365a] shadow-sm" />
      <span className="relative flex h-[46px] w-9 rounded-[3px] bg-[#001f3f] shadow-md">
        <span className="h-full w-1.5 rounded-l-[3px] bg-[#0b2a4d]" />
        <span className="flex flex-1 flex-col items-center pt-2">
          <span className="h-[3px] w-5 rounded bg-[#d6b357]" />
          <span className="mt-0.5 h-[3px] w-4 rounded bg-[#d6b357]/60" />
          <span className="mt-2 h-3 w-3 rounded-full border border-[#d6b357]/70" />
          <span className="mt-auto mb-1.5 h-[3px] w-4 rounded bg-white/40" />
        </span>
        {/* bookmark ribbon */}
        <svg viewBox="0 0 6 12" className="absolute right-1 -top-0.5 h-3.5 w-2">
          <path d="M0 0h6v11L3 8 0 11z" fill="#d6b357" />
        </svg>
      </span>
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
