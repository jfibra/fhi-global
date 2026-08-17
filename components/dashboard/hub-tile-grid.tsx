import Link from "next/link"
import { ChevronRight } from "lucide-react"
import type { HubTile } from "@/components/dashboard/sidebar-config"
import { TileMockup } from "@/components/dashboard/hub-tile-mockups"

/**
 * The bento picker a hub page renders. One tile per entry in the sidebar group
 * that owns this hub — the tiles are derived from sidebar-config, so a hub can
 * never drift out of sync with the nav.
 */
export function HubTileGrid({ title, tiles }: { title: string; tiles: HubTile[] }) {
  return (
    <div>
      <h2 className="font-['Outfit'] text-2xl font-bold text-[#0d1117]">{title}</h2>
      <p className="mt-1 text-sm text-[#6b7280]">
        {tiles.length} {tiles.length === 1 ? "section" : "sections"}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map(({ icon: Icon, label, href, description, mock }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col overflow-hidden rounded-2xl border border-[#e8eaed] bg-white p-5 shadow-[0_2px_12px_-2px_rgba(0,31,63,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#d6b357] hover:shadow-[0_8px_24px_-4px_rgba(0,31,63,0.12)]"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#d6b357]/12 text-[#b7913a] transition-transform duration-300 group-hover:scale-110">
                <Icon className="h-6 w-6" />
              </span>
              {/* Miniature of the format this tool produces. */}
              {mock && <TileMockup kind={mock} />}
            </div>

            <h3 className="mt-4 font-['Outfit'] text-lg font-bold text-[#0d1117]">{label}</h3>

            {description && (
              <p className="mt-1 flex-1 text-sm leading-relaxed text-[#6b7280]">{description}</p>
            )}

            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#001f3f] transition-colors group-hover:text-[#b7913a]">
              Open
              <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
