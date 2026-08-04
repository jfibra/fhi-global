"use client"

import { useState } from "react"
import { X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react"

type ProjectImage = {
  id: number
  image_url: string
  caption?: string | null
  rank?: number | null
}

export function ProjectGallery({ images }: { images: ProjectImage[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (!images.length) return null

  const prev = () => setLightboxIndex((i) => (i !== null ? Math.max(0, i - 1) : null))
  const next = () => setLightboxIndex((i) => (i !== null ? Math.min(images.length - 1, i + 1) : null))

  return (
    <>
      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {images.map((img, idx) => (
          <button
            key={img.id}
            onClick={() => setLightboxIndex(idx)}
            className="group relative aspect-square overflow-hidden bg-[#f3f4f6] border border-[#e8eaed] hover:border-[#001f3f]/30 transition-all"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.image_url}
              alt={img.caption ?? `Image ${idx + 1}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Close */}
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Prev */}
          {lightboxIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); prev() }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Image */}
          <div onClick={(e) => e.stopPropagation()} className="max-w-5xl w-full flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[lightboxIndex].image_url}
              alt={images[lightboxIndex].caption ?? ""}
              className="max-h-[80vh] w-auto shadow-2xl object-contain"
            />
            {images[lightboxIndex].caption && (
              <p className="text-sm text-white/60">{images[lightboxIndex].caption}</p>
            )}
            <p className="text-xs text-white/30">{lightboxIndex + 1} / {images.length}</p>
          </div>

          {/* Next */}
          {lightboxIndex < images.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); next() }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>
      )}
    </>
  )
}
