// Service Areas — hover-to-expand accordion strip over a background photo
// with a soft white wash (same treatment as the homepage's Trusted Partners).

import { GOLD, IMG, NAVY, SAMPLE_DATA, type WebsiteData } from "../../_data"
import { Eyebrow } from "../ui"

export function ServiceAreasSection({ data = SAMPLE_DATA }: { data?: WebsiteData }) {
  return (
    <section id="areas" className="relative scroll-mt-[72px] overflow-hidden">
      {/* Background photo + white wash */}
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={IMG.featuredBg} alt="" aria-hidden className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/95 via-white/80 to-white/75" />
      </div>
      <div className="relative mx-auto max-w-[1400px] px-5 py-16 sm:px-8">
        <Eyebrow center>Service Areas</Eyebrow>
        <h2 className="mt-3 text-center font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: NAVY }}>
          Areas I Specialize In
        </h2>
        <div className="mx-auto mt-4 flex items-center justify-center gap-2">
          <span className="h-px w-10" style={{ backgroundColor: GOLD }} />
          <span className="h-1.5 w-1.5 rotate-45" style={{ backgroundColor: GOLD }} />
          <span className="h-px w-10" style={{ backgroundColor: GOLD }} />
        </div>
        {/* Mobile: a simple photo grid. Desktop: the hover-expand accordion. */}
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:h-[420px]">
          {data.areas.map((a, i) => (
            <div
              key={`${a.label}-${i}`}
              className="group relative h-44 min-w-0 cursor-pointer overflow-hidden transition-all duration-500 ease-out sm:h-52 lg:h-auto lg:flex-1 lg:hover:flex-[3.5]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.image} alt={a.label} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/25" />
              <div className="absolute bottom-4 left-5 right-5 text-center">
                <p className="truncate text-[17px] font-semibold text-white">{a.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
