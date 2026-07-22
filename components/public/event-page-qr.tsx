"use client"

import { useEffect, useState } from "react"
import { QRCodeSVG } from "qrcode.react"

/** QR of the current event page — lets people on a projected screen scan and register on their phones. */
export function EventPageQr() {
  const [url, setUrl] = useState("")

  useEffect(() => {
    setUrl(window.location.href)
  }, [])

  if (!url) return null

  return (
    <div className="mt-5 pt-5 border-t border-[#f0f0f0] flex items-center gap-4">
      <span className="shrink-0 rounded-xl border-2 border-[#d6b357] p-2 bg-white shadow-sm">
        <QRCodeSVG value={url} size={96} level="M" fgColor="#001f3f" />
      </span>
      <p className="text-xs text-[#6b7280] leading-relaxed">
        <span className="font-bold text-[#0f2940]">Scan to register on your phone</span> — perfect when
        this page is on a screen at the venue, or share it with friends who want to attend.
      </p>
    </div>
  )
}
