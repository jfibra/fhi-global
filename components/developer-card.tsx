"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Building2, BadgeCheck, ArrowUpRight, Layers, Check } from "lucide-react"
import { sampleLogoBg } from "@/lib/logo-bg"

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
  /** directory: split map + list reference — compact horizontal card.
   *  tile: the logo-wall directory — logo panel on top, slim footer. */
  variant?: "default" | "directory" | "tile"
}

export function DeveloperCard({ developer, variant = "default" }: DeveloperCardProps) {
  // Ratings are deliberately not shown: there is no review system behind the
  // number, so a star score would be an unearned claim about a third party.
  const { name, slug, description, logo_url, is_verified, project_count } = developer
  // Logo panel background sampled from the logo image itself, so baked-in
  // logo backgrounds (e.g. white) fill the panel instead of floating in it.
  const [logoBg, setLogoBg] = useState<string | null>(null)

  if (variant === "tile") {
    return (
      <Link
        href={`/${slug}`}
        className="group flex flex-col border border-[#e5e8ec] bg-white overflow-hidden transition-shadow duration-300 hover:shadow-[0_14px_40px_-16px_rgba(0,20,40,0.25)]"
      >
        {/* Logo panel — the card's hero; bg sampled from the logo itself */}
        <div
          className="relative aspect-[16/10] flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: logoBg ?? "#eef2f6" }}
        >
          {logo_url ? (
            <Image
              src={logo_url}
              // SVG bypasses the optimizer (which rejects it; upload route accepts SVG logos).
              unoptimized={logo_url.toLowerCase().includes(".svg")}
              alt={name}
              width={140}
              height={140}
              onLoad={(e) => setLogoBg(sampleLogoBg(e.currentTarget))}
              className="max-w-[55%] max-h-[55%] object-contain transition-transform duration-300 group-hover:scale-[1.06]"
            />
          ) : (
            <Building2 className="w-10 h-10 text-[#001f3f]/20" aria-hidden />
          )}
          {is_verified && (
            <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-0.5 bg-white/95 border border-[#d6b357] text-[#b8913f] text-[9px] font-bold uppercase tracking-wide">
              <BadgeCheck className="w-3 h-3" /> Verified
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[#eef0f3]">
          <div className="min-w-0">
            <h3 className="font-['Outfit'] text-[14px] font-bold text-[#0d1117] leading-tight truncate group-hover:text-[#001f3f] transition-colors">
              {name}
            </h3>
            <p className="text-[11px] font-semibold text-[#6b7280] mt-0.5">
              {project_count != null && project_count > 0
                ? `${project_count} Project${project_count !== 1 ? "s" : ""}`
                : "Developer"}
            </p>
          </div>
          <span className="w-8 h-8 shrink-0 bg-[#001f3f]/5 group-hover:bg-[#d6b357] flex items-center justify-center transition-colors duration-300">
            <ArrowUpRight className="w-4 h-4 text-[#001f3f]" />
          </span>
        </div>
      </Link>
    )
  }

  if (variant === "directory") {
    return (
      <Link
        href={`/${slug}`}
        className="group flex flex-row gap-3 sm:gap-4 border border-[#e5e8ec] bg-white p-3 sm:p-4 transition-shadow hover:shadow-md"
      >
        <div
          className="relative h-[100px] w-[100px] shrink-0 flex items-center justify-center overflow-hidden sm:h-[112px] sm:w-[112px]"
          style={{ backgroundColor: logoBg ?? "#eef2f6" }}
        >
          {logo_url ? (
            <Image
              src={logo_url}
              // SVG bypasses the optimizer (which rejects it; upload route accepts SVG logos).
              unoptimized={logo_url.toLowerCase().includes(".svg")}
              alt={name}
              width={80}
              height={80}
              onLoad={(e) => setLogoBg(sampleLogoBg(e.currentTarget))}
              className="object-contain p-2"
            />
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
          {description ? (
            <p className="line-clamp-2 text-[13px] leading-relaxed text-[#6b7280]">{description}</p>
          ) : null}
          <div className="mt-auto w-full border-t border-transparent pt-2">
            <span className="flex w-full items-center justify-center bg-[#0f2940] py-2.5 text-center text-sm font-semibold text-white transition-colors group-hover:bg-[#001f3f]">
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
      className="group relative flex flex-row bg-white p-4 border border-[#e5e8ec] overflow-hidden transition-shadow duration-300 hover:shadow-[0_14px_40px_-16px_rgba(0,20,40,0.25)]"
    >
      {/* ── Left: Logo Panel ── */}
      <div
        className="relative w-[160px] sm:w-[225px] shrink-0 flex flex-col items-center justify-center overflow-hidden"
        style={{ backgroundColor: logoBg ?? "#e5edf5" }}
      >
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
            // SVG bypasses the optimizer (which rejects it; upload route accepts SVG logos).
            unoptimized={logo_url.toLowerCase().includes(".svg")}
            alt={name}
            width={72}
            height={72}
            onLoad={(e) => setLogoBg(sampleLogoBg(e.currentTarget))}
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
            <div className="shrink-0 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-emerald-300">
              <BadgeCheck className="w-3 h-3 text-emerald-500" />
              <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wide">Verified</span>
            </div>
          )}
        </div>

        {/* Row 2: Description */}
        {description && (
          <p className="text-[13px] text-[#6b7280] leading-relaxed line-clamp-2 flex-1">
            {description}
          </p>
        )}

        {/* Row 4: Footer — project count + CTA */}
        <div className="flex items-center justify-between pt-3 mt-auto border-t border-[#eef0f3]">
          {project_count != null && project_count > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#6b7280]">
              <Layers className="w-3 h-3 text-[#001f3f]/40" />
              {project_count} Project{project_count !== 1 ? "s" : ""}
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-[#d1d5db] uppercase tracking-widest">Developer</span>
          )}
          <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#0d1117] transition-colors duration-200 group-hover:text-[#b8913f] shrink-0">
            View Details
            <ArrowUpRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
        </div>
      </div>
    </Link>
  )
}
