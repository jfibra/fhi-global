import Link from "next/link"
import Image from "next/image"
import { MapPin, ArrowRight, Building2 } from "lucide-react"

export interface ProjectCardData {
  id: string
  name: string
  slug: string
  main_image?: string | null
  location?: string | null
  city?: string | null
  launch_price_from?: number | null
  launch_price_to?: number | null
  currency?: string | null
  status?: string | null
  is_featured?: boolean | null
  developers?: {
    name: string
    logo_url?: string | null
    slug?: string | null
  } | null
}

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pre_launch:         { label: "Pre-Launch",         bg: "bg-purple-50",  text: "text-purple-700", border: "border-purple-200" },
  launch:             { label: "Launching Now",       bg: "bg-blue-50",    text: "text-blue-700",   border: "border-blue-200"   },
  under_construction: { label: "Under Construction", bg: "bg-amber-50",   text: "text-amber-700",  border: "border-amber-200"  },
  completed:          { label: "Ready to Move",      bg: "bg-emerald-50", text: "text-emerald-700",border: "border-emerald-200" },
}

function formatPrice(value: number, currency = "AED"): string {
  if (value >= 1_000_000) return `${currency} ${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`
  if (value >= 1_000)     return `${currency} ${(value / 1_000).toFixed(0)}K`
  return `${currency} ${value.toLocaleString()}`
}

interface ProjectCardProps {
  project: ProjectCardData
}

export function ProjectCard({ project }: ProjectCardProps) {
  const {
    name, slug, main_image, location, city,
    launch_price_from, currency = "AED", status, is_featured, developers,
  } = project

  const s = status ? STATUS_STYLES[status] : null
  const displayLocation = city || location

  return (
    <Link
      href={`/projects/${slug}`}
      className="group block bg-white rounded-[24px] border border-[#eee] overflow-hidden transition-all duration-300 hover:translate-y-[-10px] hover:shadow-2xl shadow-sky-950/5"
    >
      {/* Image */}
      <div className="relative w-full aspect-[4/3] bg-[#f4f6f9] overflow-hidden">
        {main_image ? (
          <Image
            src={main_image}
            alt={name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#c0c8d4]">
            <Building2 className="w-12 h-12" />
            <span className="text-xs font-medium">No Image</span>
          </div>
        )}

        {/* Darkening overlay on hover for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-all duration-500" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {s && (
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border backdrop-blur-sm ${s.bg} ${s.text} ${s.border}`}>
              {s.label}
            </span>
          )}
          {is_featured && (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-gradient-to-r from-[#d6b357] to-[#f0d890] text-[#001f3f] border border-[#d6b357]/50">
              ? Featured
            </span>
          )}
        </div>

        {/* Developer logo bottom-left */}
        {developers && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/15 backdrop-blur-md border border-white/25">
            {developers.logo_url ? (
              <Image src={developers.logo_url} alt={developers.name} width={16} height={16} className="object-contain rounded" />
            ) : (
              <Building2 className="w-3 h-3 text-white/70" />
            )}
            <span className="text-[10px] font-semibold text-white truncate max-w-[100px]">{developers.name}</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-5">
        {/* Project Name */}
        <h3 className="font-['Outfit'] font-bold text-[#0d1117] text-base leading-snug mb-2 line-clamp-1 group-hover:text-[#001f3f] transition-colors">
          {name}
        </h3>

        {/* Location */}
        {displayLocation && (
          <div className="flex items-center gap-1 text-xs text-[#9ca3af] mb-4">
            <MapPin className="w-3 h-3 shrink-0 text-[#d6b357]" />
            <span className="truncate">{displayLocation}</span>
          </div>
        )}

        {/* Price + arrow */}
        <div className="flex items-center justify-between pt-3 border-t border-[#f0f0f0]">
          <div>
            {launch_price_from ? (
              <>
                <span className="text-[10px] font-medium text-[#9ca3af] uppercase tracking-wider">Starting from</span>
                <p className="font-['Outfit'] font-bold text-[#0d1117] text-base leading-none mt-0.5 group-hover:text-[#001f3f] transition-colors">
                  {formatPrice(launch_price_from, currency ?? "AED")}
                </p>
              </>
            ) : (
              <span className="text-xs font-medium text-[#9ca3af]">Price on request</span>
            )}
          </div>
          <div className="w-9 h-9 rounded-full bg-[#001f3f]/6 group-hover:bg-gradient-to-br group-hover:from-[#d6b357] group-hover:to-[#f0d890] flex items-center justify-center transition-all duration-300 shadow-sm group-hover:shadow-md">
            <ArrowRight className="w-4 h-4 text-[#001f3f] transition-transform duration-200 group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    </Link>
  )
}
