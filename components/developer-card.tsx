import Link from "next/link"
import Image from "next/image"
import { Building2, Star, BadgeCheck, ArrowRight } from "lucide-react"

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
}

export function DeveloperCard({ developer }: DeveloperCardProps) {
  const { name, slug, description, logo_url, rating, is_verified, project_count } = developer

  return (
    <Link
      href={`/developers/${slug}`}
      className="group block bg-white rounded-[24px] border border-[#eee] transition-all duration-300 hover:translate-y-[-10px] hover:shadow-2xl shadow-sky-950/5 overflow-hidden"
    >
      {/* Logo area */}
      <div className="relative w-full aspect-[3/2] bg-gradient-to-br from-[#f8f6f0] to-[#f0ede4] overflow-hidden flex items-center justify-center">
        {/* Subtle dot pattern */}
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle, #001f3f 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
        {logo_url ? (
          <Image
            src={logo_url}
            alt={name}
            width={160}
            height={80}
            className="relative object-contain w-[55%] h-[55%] transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="relative flex flex-col items-center gap-2 text-[#c0c8d4]">
            <Building2 className="w-10 h-10" />
            <span className="text-xs font-medium tracking-wide">{name}</span>
          </div>
        )}
        {/* Gold shimmer on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#d6b357]/0 to-transparent group-hover:from-[#d6b357]/8 transition-all duration-500" />
      </div>

      {/* Body */}
      <div className="p-6">
        {/* Name + verified */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-['Space_Grotesk'] font-bold text-[#0d1117] text-base leading-tight group-hover:text-[#001f3f] transition-colors">
            {name}
          </h3>
          {is_verified && (
            <BadgeCheck className="w-4 h-4 text-[#d6b357] shrink-0 mt-0.5" aria-label="Verified" />
          )}
        </div>

        {/* Rating + project count */}
        <div className="flex items-center gap-3 mb-3">
          {rating != null && (
            <div className="flex items-center gap-1 text-xs font-medium text-[#6b7280]">
              <Star className="w-3 h-3 text-[#d6b357] fill-[#d6b357]" />
              {rating.toFixed(1)}
            </div>
          )}
          {project_count != null && project_count > 0 && (
            <>
              <span className="w-1 h-1 rounded-full bg-[#d1d5db]" />
              <span className="text-xs text-[#6b7280] uppercase tracking-wider">{project_count} project{project_count !== 1 ? "s" : ""}</span>
            </>
          )}
        </div>

        {/* Description */}
        {description && (
          <p className="text-sm text-[#555] leading-relaxed line-clamp-2 mb-4">{description}</p>
        )}

        {/* Gold gradient CTA bar */}
        <div className="flex items-center justify-between pt-3 border-t border-[#f0f0f0]">
          <span className="text-xs font-bold text-[#001f3f] group-hover:text-[#d6b357] transition-colors duration-200 uppercase tracking-wider">
            View Projects
          </span>
          <div className="w-8 h-8 rounded-full bg-[#001f3f]/6 group-hover:bg-gradient-to-br group-hover:from-[#d6b357] group-hover:to-[#f0d890] flex items-center justify-center transition-all duration-300">
            <ArrowRight className="w-3.5 h-3.5 text-[#001f3f] group-hover:text-[#001f3f] transition-transform duration-200 group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    </Link>
  )
}
