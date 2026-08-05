// Navy market-stats band.

import { BAND_STATS, INK } from "../../_data"
import { GoldRing } from "../ui"

export function StatsBandSection() {
  return (
    <section style={{ backgroundColor: INK }}>
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-6 px-5 py-9 sm:grid-cols-3 sm:px-8 lg:grid-cols-5">
        {BAND_STATS.map(({ icon, value, label }) => (
          <div key={label} className="flex items-center gap-3">
            <GoldRing icon={icon} dark />
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
