import Image from "next/image"
import type { ReactNode } from "react"

/**
 * Slim navy masthead for the buy/rent browsers — the same construction as the
 * /projects masthead (photo under a left-weighted scrim, gold eyebrow, count
 * on the right, 3px gold rule) so the whole catalog side of the site reads as
 * one system. Deliberately short: the visitor came for the listings.
 */
export function ListingsMasthead({
  eyebrow,
  accent,
  children,
}: {
  eyebrow: string
  /** The gold word in "Properties for ___ in the UAE". */
  accent: string
  /** Right-aligned subtitle slot — the live result count. */
  children?: ReactNode
}) {
  return (
    <section className="relative bg-[#001f3f] overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/background/dubai.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#001428]/90 via-[#001428]/60 to-[#001f3f]/30" />
      </div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6b357]">{eyebrow}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <h1
            className="font-['Outfit'] text-3xl md:text-[38px] font-bold text-white leading-[1.1] tracking-tight"
            style={{ textShadow: "0 2px 20px rgba(0,10,30,0.55)" }}
          >
            Properties for <span className="text-[#d6b357]">{accent}</span> in the UAE
          </h1>
          {children}
        </div>
      </div>
      <div className="relative h-[3px] bg-[#d6b357]" />
    </section>
  )
}
