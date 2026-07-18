import type React from "react"

// Shared logo element for every flyer template. Applies the studio's logo Size
// override and White-outline (a white sticker plate behind the artwork). The
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
    <span
      style={{
        display: "inline-flex",
        padding: outline > 0 ? outline : 0,
        backgroundColor: outline > 0 ? "#ffffff" : "transparent",
        borderRadius: outline > 0 ? 8 : 0,
        ...style,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" crossOrigin="anonymous" style={{ height: size ?? height, width: "auto", objectFit: "contain", display: "block" }} />
    </span>
  )
}
