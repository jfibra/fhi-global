// Navy market-stats band.

import { BAND_STAT_ICON_FALLBACK, BRAND_GRADIENT, SAMPLE_DATA, STAT_ICONS, type WebsiteData } from "../../_data"
import { GoldRing } from "../ui"

export function StatsBandSection({ data = SAMPLE_DATA }: { data?: WebsiteData }) {
  return (
    <section id="stats" style={{ background: BRAND_GRADIENT }}>
      {/* Small screens: a shrink-wrapped grid centered as a block, so wrapped
          rows share the same column edges (uniform left alignment) instead of
          each row centering itself. Desktop: the centered flex row. */}
      <div className="mx-auto grid w-fit max-w-[1400px] grid-cols-2 gap-x-10 gap-y-6 px-5 py-9 sm:grid-cols-3 sm:px-8 lg:flex lg:w-auto lg:flex-wrap lg:items-center lg:justify-center lg:gap-x-16">
        {data.bandStats.map(({ icon, value, label }, i) => (
          <div key={`${label}-${i}`} className="flex items-center gap-3">
            <GoldRing icon={STAT_ICONS[icon ?? BAND_STAT_ICON_FALLBACK[i % BAND_STAT_ICON_FALLBACK.length]]} dark />
            <span>
              <span className="block text-lg font-bold leading-tight text-white">{value}</span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">{label}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
