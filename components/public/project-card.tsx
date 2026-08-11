import Link from "next/link"
import Image from "next/image"
import { MapPin, ArrowRight, Building2 } from "lucide-react"

export type ProjectCardData = {
  id: number
  name: string
  slug: string
  main_image: string | null
  location: string | null
  city: string | null
  launch_price_from: number | null
  launch_price_to: number | null
  currency: string | null
  status: string
  is_featured: boolean | null
  developers?: { name: string; logo_url: string | null; slug: string } | null
}

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  pre_launch:          { label: "Pre-Launch",          bg: "#f0f9ff", text: "#0369a1" },
  launch:              { label: "Launching",            bg: "#f0fdf4", text: "#15803d" },
  under_construction:  { label: "Under Construction",  bg: "#fffbeb", text: "#b45309" },
  completed:           { label: "Completed",            bg: "#f0fdf4", text: "#15803d" },
}

function formatPrice(from: number | null, to: number | null, currency: string | null) {
  const cur = currency ?? "AED"
  if (!from) return null
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
    return n.toString()
  }
  if (to && to !== from) return `${cur} ${fmt(from)} – ${fmt(to)}`
  return `${cur} ${fmt(from)}`
}

export function ProjectCard({ project }: { project: ProjectCardData }) {
  const statusStyle = STATUS_STYLES[project.status] ?? { label: project.status, bg: "#f3f4f6", text: "#374151" }
  const price = formatPrice(project.launch_price_from, project.launch_price_to, project.currency)
  const locationStr = [project.location, project.city].filter(Boolean).join(", ")

  return (
    <Link
      href={project.developers?.slug ? `/${project.developers.slug}/${project.slug}` : `/projects/${project.slug}`}
      className="group block bg-white rounded-[24px] border border-[#e8eaed] overflow-hidden transition-all duration-300 hover:translate-y-[-6px] hover:shadow-2xl hover:shadow-[#001f3f]/8 hover:border-[#001f3f]/15"
    >
      {/* Image */}
      <div className="relative h-52 overflow-hidden bg-[#f3f4f6]">
        {project.main_image ? (
          <Image
            src={project.main_image}
            alt={project.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            loading="lazy"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#9ca3af]">
            <Building2 className="w-10 h-10" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span
            className="px-2.5 py-1 rounded-full text-[11px] font-bold"
            style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
          >
            {statusStyle.label}
          </span>
          {project.is_featured && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#d6b357] text-[#001f3f]">
              Featured
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Developer */}
        {project.developers && (
          <div className="flex items-center gap-2 mb-2">
            {project.developers.logo_url ? (
              <Image
                src={project.developers.logo_url}
                alt={project.developers.name}
                width={60}
                height={16}
                // The optimizer rejects SVG (dangerouslyAllowSVG is off) and
                // the logo upload route accepts them — serve those as-is.
                unoptimized={project.developers.logo_url.toLowerCase().includes(".svg")}
                className="h-4 w-auto max-w-[60px] object-contain opacity-70"
              />
            ) : (
              <span className="text-[11px] text-[#9ca3af] font-medium">{project.developers.name}</span>
            )}
          </div>
        )}

        <h3 className="font-['Outfit'] font-bold text-[#0d1117] text-base leading-snug mb-2 group-hover:text-[#001f3f] transition-colors">
          {project.name}
        </h3>

        {locationStr && (
          <div className="flex items-center gap-1.5 text-xs text-[#9ca3af] mb-4">
            <MapPin className="w-3 h-3 shrink-0" />
            {locationStr}
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-[#f3f4f6]">
          <div>
            {price ? (
              <>
                <p className="text-xs text-[#9ca3af] font-medium uppercase tracking-wider">Starting from</p>
                <p className="font-['Outfit'] font-bold text-[#001f3f] text-base">{price}</p>
              </>
            ) : (
              <p className="text-sm text-[#9ca3af]">Price on request</p>
            )}
          </div>
          <span className="w-8 h-8 rounded-full bg-[#001f3f]/6 group-hover:bg-[#001f3f] flex items-center justify-center transition-all">
            <ArrowRight className="w-3.5 h-3.5 text-[#001f3f] group-hover:text-white transition-colors" />
          </span>
        </div>
      </div>
    </Link>
  )
}
