import Link from "next/link"
import Image from "next/image"
import { Building2, Star, BadgeCheck, ArrowUpRight, Layers, Check } from "lucide-react"

export interface DeveloperCardData {
  id: string
  name: string
  slug: string
  description?: string | null
  logo_url?: string | null
  rating?: number | null
  is_verified?: boolean | null
  project_count?: number | null
}

interface DeveloperCardProps {
  developer: DeveloperCardData
  /** Split map + list reference: compact card, “Rating:” label, full-width CTA. */
  variant?: "default" | "directory"
}

export function DeveloperCard({ developer, variant = "default" }: DeveloperCardProps) {
  const { name, slug, description, logo_url, rating, is_verified, project_count } = developer
  const stars = rating != null ? Math.round(rating) : 0

  if (variant === "directory") {
    return (
      <Link
        href={`/${slug}`}
        className="group flex flex-row gap-3 sm:gap-4 rounded-lg border border-[#e8eaed] bg-white p-3 sm:p-4 shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="relative h-[100px] w-[100px] shrink-0 rounded-lg bg-[#eef2f6] flex items-center justify-center overflow-hidden sm:h-[112px] sm:w-[112px]">
          {logo_url ? (
            <Image src={logo_url} alt={name} width={80} height={80} className="object-contain p-2" />
          ) : (
            <Building2 className="h-9 w-9 text-[#001f3f]/20" aria-hidden />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-['Outfit'] text-[15px] font-bold leading-tight text-[#0f2940] line-clamp-1 sm:text-base">
              {name}
            </h3>
            {is_verified && (
              <span
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
                title="Verified"
              >
                <Check className="h-3 w-3 stroke-[3]" aria-hidden />
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-[#374151]">
            <span className="font-medium text-[#4b5563]">Rating:</span>
            {rating != null ? (
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3.5 w-3.5 ${
                      i < stars ? "fill-[#d6b357] text-[#d6b357]" : "fill-[#e5e7eb] text-[#e5e7eb]"
                    }`}
                  />
                ))}
              </div>
            ) : (
              <span className="text-xs italic text-[#9ca3af]">Not yet rated</span>
            )}
          </div>
          {description ? (
            <p className="line-clamp-2 text-[13px] leading-relaxed text-[#6b7280]">{description}</p>
          ) : null}
          <div className="mt-auto w-full border-t border-transparent pt-2">
            <span className="flex w-full items-center justify-center rounded-lg bg-[#0f2940] py-2.5 text-center text-sm font-semibold text-white transition-colors group-hover:bg-[#001f3f]">
              View Details
            </span>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link
      href={`/${slug}`}
      className="group relative flex flex-row bg-white rounded-[24px] p-4 border border-[#eaecf0] overflow-hidden transition-all duration-500 hover:shadow-[0_20px_60px_-8px_rgba(0,31,63,0.2)] hover:-translate-y-1 shadow-[0_2px_16px_rgba(0,0,0,0.05)]"
    >
      {/* ── Left: Logo Panel ── */}
      <div className="relative w-[160px] sm:w-[225px] shrink-0 bg-gradient-to-br bg-[#e5edf5] flex flex-col items-center justify-center overflow-hidden">
        {/* dot grid texture */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "18px 18px" }}
        />
        {/* right-edge gold separator */}
        <div className="absolute top-0 right-0 bottom-0 w-[1.5px] bg-gradient-to-b from-transparent via-[#d6b357]/50 to-transparent" />
        {/* warm glow */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#d6b357]/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Logo */}
        {logo_url ? (
          <Image
            src={logo_url}
            alt={name}
            width={72}
            height={72}
            className="object-contain w-[74%] h-[74%]"
          />
        ) : (
          <Building2 className="w-8 h-8 text-[#001f3f]/25" />
        )}
      </div>

      {/* ── Right: Content ── */}
      <div className="flex flex-col flex-1 min-w-0 px-5 gap-2.5">

        {/* Row 1: Name + verified badge */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-['Outfit'] font-bold text-[#0d1117] text-[16px] leading-tight group-hover:text-[#001f3f] transition-colors duration-200 line-clamp-1">
            {name}
          </h3>
          {is_verified && (
            <div className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
              <BadgeCheck className="w-3 h-3 text-emerald-500" />
              <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wide">Verified</span>
            </div>
          )}
        </div>

        {/* Row 2: Stars */}
        <div className="flex items-center gap-1">
          {rating != null ? (
            <>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3.5 h-3.5 ${i < stars ? "text-[#d6b357] fill-[#d6b357]" : "text-[#e5e7eb] fill-[#e5e7eb]"
                      }`}
                  />
                ))}
              </div>
              <span className="text-xs font-bold text-[#374151] ml-1">{rating.toFixed(1)}</span>
              <span className="text-xs text-[#9ca3af] ml-0.5">/ 5.0</span>
            </>
          ) : (
            <span className="text-xs text-[#d1d5db] italic">Not yet rated</span>
          )}
        </div>

        {/* Row 3: Description */}
        {description && (
          <p className="text-[13px] text-[#6b7280] leading-relaxed line-clamp-2 flex-1">
            {description}
          </p>
        )}

        {/* Row 4: Footer — project count + CTA */}
        <div className="flex items-center justify-between pt-1 mt-auto">
          {project_count != null && project_count > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#6b7280]">
              <Layers className="w-3 h-3 text-[#001f3f]/40" />
              {project_count} Project{project_count !== 1 ? "s" : ""}
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-[#d1d5db] uppercase tracking-widest">Developer</span>
          )}
          <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#001f3f] text-white text-[11px] font-bold tracking-wide transition-all duration-300 group-hover:bg-gradient-to-r group-hover:from-[#c9a94e] group-hover:to-[#f0d890] group-hover:text-[#001f3f] group-hover:shadow-[0_6px_20px_rgba(214,179,87,0.4)] shrink-0">
            View Details
            <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
        </div>
      </div>
    </Link>
  )
}
