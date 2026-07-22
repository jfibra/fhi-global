"use client"

import { useEffect, useState } from "react"
import { QRCodeSVG } from "qrcode.react"

/**
 * Large registration QR displayed on the event hero itself — for venue
 * screens/projectors. Desktop only; on phones the poster needs the space
 * and the register card below has its own QR.
 */
export function EventHeroQr() {
  const [url, setUrl] = useState("")

  useEffect(() => {
    setUrl(window.location.href)
  }, [])

  if (!url) return null

  return (
    <div className="absolute right-6 xl:right-14 top-1/2 -translate-y-1/2 z-10 hidden lg:flex flex-col items-center gap-3 rounded-3xl bg-white px-7 py-6 shadow-[0_30px_80px_-20px_rgba(0,10,25,0.85)] ring-4 ring-[#d6b357]">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#8a6d2a]">Scan to Register</p>
      <QRCodeSVG value={url} size={190} level="M" fgColor="#001f3f" />
      <p className="text-xs font-bold text-[#0f2940] uppercase tracking-wider">Free Registration</p>
    </div>
  )
}
