"use client"

// Gallery — categorized by tabs at the top (Photos / Certificates / Awards);
// the grid shows the active category's images.

import { useState } from "react"
import { Award, BadgeCheck, Camera } from "lucide-react"
import { GALLERY, GALLERY_CATEGORIES, GOLD, NAVY, type GalleryCategory } from "../../_data"
import { Eyebrow } from "../ui"

const CATEGORY_ICONS: Record<GalleryCategory, typeof Camera> = {
  "Event Photos": Camera,
  Certificates: BadgeCheck,
  "Awards & Recognition": Award,
}

export function GallerySection() {
  const [category, setCategory] = useState<GalleryCategory>("Event Photos")
  const images = GALLERY[category]

  return (
    <section id="gallery" className="scroll-mt-[72px]">
      <div className="mx-auto max-w-[1400px] px-5 py-16 sm:px-8">
        <Eyebrow center>Gallery</Eyebrow>
        <h2 className="mt-3 text-center font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: NAVY }}>
          Professional Highlights
        </h2>
        <div className="mx-auto mt-4 flex items-center justify-center gap-2">
          <span className="h-px w-10" style={{ backgroundColor: GOLD }} />
          <span className="h-1.5 w-1.5 rotate-45" style={{ backgroundColor: GOLD }} />
          <span className="h-px w-10" style={{ backgroundColor: GOLD }} />
        </div>

        {/* Category tabs */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {GALLERY_CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICONS[c]
            const active = category === c
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-[12.5px] font-bold transition-colors ${
                  active ? "text-white" : "border border-[#d8d3c6] text-[#5b6472] hover:border-[#9aa0aa]"
                }`}
                style={active ? { backgroundColor: NAVY } : undefined}
              >
                <Icon className="h-4 w-4" style={active ? { color: GOLD } : undefined} />
                {c}
              </button>
            )
          })}
        </div>

        {/* Grid */}
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((src, i) => (
            <div key={`${category}-${i}`} className="group overflow-hidden border border-[#e8e5dc] bg-white p-2">
              <div className="h-44 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`${category} ${i + 1}`}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
