"use client"

import { useEffect, useState } from "react"
import { sampleLogoBgFromUrl } from "@/lib/logo-bg"

const DEFAULT_BG = "rgba(17, 17, 17, 0.9)"

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
      <span className="block h-full w-full overflow-hidden" style={{ backgroundColor: bg ?? DEFAULT_BG }}>
        <img src={src} alt={alt} className="block h-full w-full object-contain" />
      </span>
    </span>
  )
}
