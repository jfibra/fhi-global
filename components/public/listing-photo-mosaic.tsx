"use client"

import { useState } from "react"
import { X, ChevronLeft, ChevronRight, Images } from "lucide-react"

type MosaicImage = {
  id: number
  image_url: string
}

/**
 * homes.com-style adaptive photo mosaic: one large hero tile plus up to four
 * side tiles that auto-arrange to the photo count, with a "+N" overlay and an
 * "All photos" chip. Every tile opens the fullscreen lightbox at that photo.
 */
export function ListingPhotoMosaic({
  images,
  fullBleed = false,
}: {
  images: MosaicImage[]
  /** Edge-to-edge hero mode: no rounded corners, taller tiles. */
  fullBleed?: boolean
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (!images.length) return null

  const frame = fullBleed ? "overflow-hidden" : "rounded-2xl overflow-hidden"
  const mosaicHeights = fullBleed
    ? "h-[320px] sm:h-[460px] lg:h-[560px]"
    : "h-[300px] sm:h-[420px] lg:h-[480px]"

  const count = images.length
  const side = images.slice(1, 5)
  const hiddenCount = Math.max(0, count - 5)

  const prev = () => setLightboxIndex((i) => (i !== null ? Math.max(0, i - 1) : null))
  const next = () => setLightboxIndex((i) => (i !== null ? Math.min(count - 1, i + 1) : null))

  const tile = (img: MosaicImage, index: number, className: string, overlay?: string) => (
    <button
      key={img.id}
      type="button"
      onClick={() => setLightboxIndex(index)}
      className={`group relative overflow-hidden bg-[#f3f4f6] ${className}`}
      aria-label={overlay ? `View all ${count} photos` : `View photo ${index + 1}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img.image_url}
        alt={`Photo ${index + 1}`}
        className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-300"
      />
      {overlay ? (
        <span className="absolute inset-0 bg-[#001428]/60 flex items-center justify-center text-white font-['Outfit'] text-xl font-bold">
          {overlay}
        </span>
      ) : (
        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors" />
      )}
    </button>
  )

  return (
    <>
      {count === 1 ? (
        <div className={frame}>
          {tile(images[0], 0, `block w-full aspect-[16/9] ${fullBleed ? "max-h-[560px]" : "max-h-[480px]"}`)}
        </div>
      ) : count === 2 ? (
        <div className={`grid grid-cols-2 gap-2 ${frame} ${fullBleed ? "h-[320px] sm:h-[460px]" : "h-[280px] sm:h-[400px]"}`}>
          {tile(images[0], 0, "h-full w-full")}
          {tile(images[1], 1, "h-full w-full")}
        </div>
      ) : (
        <div className={`relative grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 grid-rows-2 gap-2 ${frame} ${mosaicHeights}`}>
          {/* Hero */}
          {tile(images[0], 0, "col-span-2 row-span-2 h-full w-full")}
          {/* Side tiles: 2 from sm, 4 from lg */}
          {side.map((img, i) => {
            const isLastVisible = i === side.length - 1
            const overlay = isLastVisible && hiddenCount > 0 ? `+${hiddenCount} photos` : undefined
            const visibility = i < 2 ? "hidden sm:block" : "hidden lg:block"
            return tile(img, i + 1, `${visibility} h-full w-full`, overlay)
          })}
          {/* All-photos chip over the hero, always visible */}
          <button
            type="button"
            onClick={() => setLightboxIndex(0)}
            className="absolute bottom-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-2 text-xs font-bold text-[#0f2940] shadow-md hover:bg-white transition-colors"
          >
            <Images className="w-3.5 h-3.5 text-[#d6b357]" />
            All {count} photos
          </button>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setLightboxIndex(null)
            }}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            aria-label="Close photos"
          >
            <X className="w-5 h-5" />
          </button>

          {lightboxIndex > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                prev()
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {lightboxIndex < count - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                next()
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              aria-label="Next photo"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[lightboxIndex].image_url}
            alt={`Photo ${lightboxIndex + 1} of ${count}`}
            className="max-h-[88vh] max-w-[92vw] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          <span className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/80 text-sm font-semibold">
            {lightboxIndex + 1} / {count}
          </span>
        </div>
      )}
    </>
  )
}
