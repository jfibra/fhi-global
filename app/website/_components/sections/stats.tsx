// Navy market-stats band.

import { BAND_STAT_ICON_FALLBACK, INK, SAMPLE_DATA, STAT_ICONS, type WebsiteData } from "../../_data"
import { GoldRing } from "../ui"

export function StatsBandSection({ data = SAMPLE_DATA }: { data?: WebsiteData }) {
  return (
    <section id="stats" style={{ backgroundColor: INK }}>
      {/* Flex + justify-center: the GROUP of stats stays centered whatever the
          count (2 stats don't stick left); each stat stays left-aligned inside. */}
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-center gap-x-16 gap-y-6 px-5 py-9 sm:px-8">
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
