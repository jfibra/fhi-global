"use client"

import { useEffect, useState } from "react"
import { sampleLogoBgFromUrl } from "@/lib/logo-bg"

// White, not dark: transparent logos are mostly drawn in the developer's own
// dark ink (Ellington, Azizi …) and vanish on a black tile. The sampler only
// returns null for transparent images, so opaque logos still blend into their
// own baked-in background colour.
const DEFAULT_BG = "#ffffff"

export function DeveloperLogoTile({ src, alt }: { src: string; alt: string }) {
  const [bg, setBg] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const sampleSrc = src.toLowerCase().includes(".svg")
      ? src
      : `/_next/image?url=${encodeURIComponent(src)}&w=64&q=75`
    sampleLogoBgFromUrl(sampleSrc).then((c) => { if (alive) setBg(c) })
    return () => { alive = false }
  }, [src])

  return (
    <span
      className="-my-2 block h-11 w-16 shrink-0 -translate-y-[7px] p-px"
      style={{ background: "linear-gradient(105deg, var(--wb-gold-a60) 0%, rgba(255,255,255,0.3) 30%, var(--wb-gold-a40) 50%, rgba(255,255,255,0.06) 78%, rgba(255,255,255,0) 100%)" }}
    >
      <span className="block h-full w-full overflow-hidden p-1" style={{ backgroundColor: bg ?? DEFAULT_BG }}>
        <img src={src} alt={alt} className="block h-full w-full object-contain" />
      </span>
    </span>
  )
}
