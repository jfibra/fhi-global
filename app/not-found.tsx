"use client"

import Link from "next/link"
import { ArrowLeft, ArrowRight, Mail } from "lucide-react"

const QUICK_LINKS = [
  { href: "/projects", label: "Projects" },
  { href: "/buy", label: "Buy" },
  { href: "/rent", label: "Rent" },
  { href: "/developers", label: "Developers" },
  { href: "/contact", label: "Contact" },
]

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#001428] font-sans flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-xl w-full text-center">
          {/* Eyebrow */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="h-px w-10 bg-[#d6b357]" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6b357]">
              FHI Global · Error 404
            </span>
            <span className="h-px w-10 bg-[#d6b357]" aria-hidden="true" />
          </div>

          {/* The number */}
          <p className="font-['Outfit'] text-[110px] md:text-[150px] font-bold leading-none select-none" aria-hidden="true">
            <span className="text-white">4</span>
            <span className="text-[#d6b357]">0</span>
            <span className="text-white">4</span>
          </p>

          <h1 className="font-['Outfit'] text-2xl md:text-3xl font-bold text-white mt-6">
            This address doesn&apos;t exist.
          </h1>
          <p className="text-white/70 text-[15px] leading-relaxed max-w-md mx-auto mt-3">
            The page may have moved, or was never built. The good news: hundreds of Dubai
            properties are one click away.
          </p>

          {/* Actions */}
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-[#d6b357] text-[#1a1408] text-sm font-bold hover:brightness-95 transition-all w-full sm:w-auto"
            >
              Back to Home <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 border border-white/35 text-white text-sm font-bold hover:border-[#d6b357] hover:text-[#d6b357] transition-colors w-full sm:w-auto"
            >
              <ArrowLeft className="w-4 h-4" /> Go Back
            </button>
          </div>

          {/* Quick routes */}
          <div className="mt-10 pt-7 border-t border-white/10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {QUICK_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/60 hover:text-[#d6b357] transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>

          <p className="mt-8 inline-flex items-center gap-2 text-xs text-white/45">
            <Mail className="w-3.5 h-3.5 text-[#d6b357]" />
            Think this is a mistake?{" "}
            <a href="mailto:info@fhiglobal.ae" className="font-semibold text-white/70 hover:text-[#d6b357] transition-colors">
              info@fhiglobal.ae
            </a>
          </p>
        </div>
      </div>

      <div className="h-[3px] bg-[#d6b357]" aria-hidden="true" />
    </div>
  )
}
