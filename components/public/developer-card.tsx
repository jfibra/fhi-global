import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Star, Building2 } from "lucide-react"

export type DeveloperCardData = {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  rating: number | null
  is_verified: boolean | null
}

export function DeveloperCard({ developer }: { developer: DeveloperCardData }) {
  return (
    <Link
      href={`/${developer.slug}`}
      className="group block bg-white rounded-[24px] border border-[#e8eaed] p-6 transition-all duration-300 hover:translate-y-[-6px] hover:shadow-2xl hover:shadow-[#001f3f]/8 hover:border-[#001f3f]/20"
    >
      {/* Logo */}
      <div className="w-full h-24 rounded-2xl bg-[#f7f8fa] border border-[#f0f0f0] flex items-center justify-center mb-5 overflow-hidden transition-colors group-hover:bg-[#001f3f]/4">
        {developer.logo_url ? (
          <Image
            src={developer.logo_url}
            alt={developer.name}
            width={160}
            height={56}
            className="max-h-14 max-w-[80%] w-auto object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-[#9ca3af]">
            <Building2 className="w-8 h-8" />
            <span className="text-xs font-medium">{developer.name.charAt(0)}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-['Outfit'] font-bold text-[#0d1117] text-base leading-snug group-hover:text-[#001f3f] transition-colors">
            {developer.name}
          </h3>
          {developer.is_verified && (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#001f3f]/8 text-[10px] font-bold text-[#001f3f] uppercase tracking-wider">
              ✓ Verified
            </span>
          )}
        </div>

        {developer.rating && developer.rating > 0 ? (
          <div className="flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-[#d6b357] fill-[#d6b357]" />
            <span className="text-sm font-semibold text-[#374151]">{Number(developer.rating).toFixed(1)}</span>
          </div>
        ) : null}

        {developer.description && (
          <p className="text-sm text-[#6b7280] line-clamp-2 leading-relaxed">
            {developer.description}
          </p>
        )}
      </div>

      {/* CTA */}
      <div className="mt-5 pt-4 border-t border-[#f3f4f6] flex items-center justify-between">
        <span className="text-xs text-[#9ca3af] font-medium">View Projects</span>
        <span className="w-7 h-7 rounded-full bg-[#001f3f]/6 group-hover:bg-[#001f3f] flex items-center justify-center transition-all">
          <ArrowRight className="w-3.5 h-3.5 text-[#001f3f] group-hover:text-white transition-colors" />
        </span>
      </div>
    </Link>
  )
}
