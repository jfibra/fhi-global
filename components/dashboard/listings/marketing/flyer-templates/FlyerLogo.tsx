import type React from "react"
import { outlineFilter } from "@/lib/flyer/logos"

// Shared logo element for every flyer template. Applies the studio's logo Size
// override and White-outline. The outline follows the artwork's SHAPE (its
// alpha silhouette) via stacked drop-shadows — not a rectangular plate. The
// wrapper accepts a `style` for templates that position the logo (e.g. Modern's
// absolutely-placed mark).
export default function FlyerLogo({
  src,
  height,
  size,
  outline = 0,
  style,
}: {
  src: string
  height: number
  size?: number
  outline?: number
  style?: React.CSSProperties
}) {
  return (
    <span style={{ display: "inline-flex", ...style }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        crossOrigin="anonymous"
        style={{ height: size ?? height, width: "auto", objectFit: "contain", display: "block", filter: outlineFilter(outline) }}
      />
    </span>
  )
}
