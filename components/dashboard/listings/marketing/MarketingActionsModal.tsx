"use client"

import { useState } from "react"
import { X, FileImage, Megaphone, Clapperboard } from "lucide-react"
import FlyerModal from "./FlyerModal"
import AnnouncementModal from "./AnnouncementModal"

type View = "menu" | "flyer" | "announce"

export default function MarketingActionsModal({
  listingId,
  listingTitle,
  onClose,
}: {
  listingId: string
  listingTitle: string
  onClose: () => void
}) {
  const [view, setView] = useState<View>("menu")

  if (view === "flyer") {
    return <FlyerModal listingId={listingId} listingTitle={listingTitle} onClose={() => setView("menu")} />
  }
  if (view === "announce") {
    return <AnnouncementModal listingId={listingId} listingTitle={listingTitle} onClose={() => setView("menu")} />
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-[#e8eaed] shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-['Outfit'] text-lg font-bold text-[#001f3f]">Quick Actions</h2>
          <button type="button" onClick={onClose} className="p-2 -mr-2 -mt-2 rounded-lg text-[#6b7280] hover:bg-[#f5f5f5]" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-[#6b7280] mb-5 truncate">{listingTitle}</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setView("flyer")}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-[#e8eaed] bg-white p-5 hover:border-[#d6b357] hover:shadow-md transition-all"
          >
            <span className="w-12 h-12 rounded-xl bg-[#001f3f]/5 text-[#001f3f] flex items-center justify-center">
              <FileImage className="w-6 h-6" />
            </span>
            <span className="text-sm font-semibold text-[#111827]">Flyer</span>
          </button>

          <button
            type="button"
            onClick={() => setView("announce")}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-[#e8eaed] bg-white p-5 hover:border-[#d6b357] hover:shadow-md transition-all"
          >
            <span className="w-12 h-12 rounded-xl bg-[#001f3f]/5 text-[#001f3f] flex items-center justify-center">
              <Megaphone className="w-6 h-6" />
            </span>
            <span className="text-sm font-semibold text-[#111827] text-center leading-tight">Just Listed / Sold</span>
          </button>

          <button
            type="button"
            disabled
            title="Coming soon"
            className="relative flex flex-col items-center justify-center gap-2 rounded-2xl border border-[#e8eaed] bg-[#fafafa] p-5 cursor-not-allowed opacity-70"
          >
            <span className="w-12 h-12 rounded-xl bg-[#9ca3af]/10 text-[#9ca3af] flex items-center justify-center">
              <Clapperboard className="w-6 h-6" />
            </span>
            <span className="text-sm font-semibold text-[#6b7280]">Reels</span>
            <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wide text-[#9ca3af] bg-white border border-[#e5e5e5] rounded-full px-1.5 py-0.5">
              Soon
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
