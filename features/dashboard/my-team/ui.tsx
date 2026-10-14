"use client"

/** Small pieces shared by the My Team page, its member panel and its share dialog. */

import { STATUS_COLORS } from "@/lib/user-service"

export const AED = (n: number) => `AED ${Math.round(n).toLocaleString("en-AE")}`
export const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n)))
export const fmtDate = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : "—")
export const inRange = (d: string, from: string | null, to: string | null) => (!from || d >= from) && (!to || d < to)
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

export function Avatar({ name, photo, size = "h-9 w-9", ring = "" }: { name: string; photo: string | null; size?: string; ring?: string }) {
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt="" loading="lazy" className={`${size} shrink-0 rounded-full object-cover ${ring}`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#001f3f] to-[#003366] font-['Outfit'] text-sm font-bold text-white ${ring}`}>{name.charAt(0).toUpperCase()}</span>
  )
}

export function StatusChip({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.pending
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-bold capitalize ${c.bg} ${c.text} ${c.border}`}>{status}</span>
}

export const Level = ({ n }: { n: number }) => <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-[#001f3f]/5 px-1 text-[10.5px] font-bold text-[#001f3f]">L{n}</span>
