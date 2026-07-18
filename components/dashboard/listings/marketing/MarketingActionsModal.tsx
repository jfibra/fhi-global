"use client"

import { useState } from "react"
import Link from "next/link"
import { X, FileImage, Megaphone, Clapperboard, Share2, Pencil, Trash2 } from "lucide-react"
import FlyerModal from "./FlyerModal"
import AnnouncementModal from "./AnnouncementModal"
import ShareCardModal from "./ShareCardModal"
import type { AgentListingStatus } from "@/lib/agent-listings-service"
import type { OgCardOptions } from "@/lib/flyer/og-card"

type View = "menu" | "flyer" | "announce" | "sharecard"

export default function MarketingActionsModal({
  listingId,
  listingTitle,
  listingStatus,
  listingKind,
  agentId,
  initialOgOptions,
  initialView = "menu",
  onOgSaved,
  onClose,
  onEdit,
  onDelete,
}: {
  listingId: string
  listingTitle: string
  listingStatus: AgentListingStatus
  listingKind: "sale" | "rent"
  agentId: string
  initialOgOptions: unknown | null
  initialView?: View
  onOgSaved: (options: OgCardOptions) => void
  onClose: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  const [view, setView] = useState<View>(initialView)

  // If the tool was opened straight from a card chip, closing it exits fully;
  // if it was reached via the menu (dots), closing returns to the menu.
  const closeTool = () => (initialView === "menu" ? setView("menu") : onClose())

  if (view === "flyer") {
    return <FlyerModal listingId={listingId} listingTitle={listingTitle} onClose={closeTool} />
  }
  if (view === "announce") {
    return <AnnouncementModal listingId={listingId} listingTitle={listingTitle} onClose={closeTool} />
  }
  if (view === "sharecard") {
    return (
      <ShareCardModal
        listingId={listingId}
        listingTitle={listingTitle}
        listingStatus={listingStatus}
        listingKind={listingKind}
        agentId={agentId}
        initialOptions={initialOgOptions}
        onSaved={onOgSaved}
        onClose={closeTool}
      />
    )
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
            <span className="w-12 h-12 rounded-xl bg-[#0891b2]/10 text-[#0e7490] flex items-center justify-center">
              <Megaphone className="w-6 h-6" />
            </span>
            <span className="text-sm font-semibold text-[#111827] text-center leading-tight">Just Listed / Sold</span>
          </button>

          <button
            type="button"
            onClick={() => setView("sharecard")}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-[#e8eaed] bg-white p-5 hover:border-[#d6b357] hover:shadow-md transition-all"
          >
            <span className="w-12 h-12 rounded-xl bg-[#d6b357]/10 text-[#b48a2c] flex items-center justify-center">
              <Share2 className="w-6 h-6" />
            </span>
            <span className="text-sm font-semibold text-[#111827] text-center leading-tight">Share card</span>
          </button>

          <Link
            href={`/dashboard/reels-maker?listing=${listingId}`}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-[#e8eaed] bg-white p-5 hover:border-[#7c3aed] hover:shadow-md transition-all"
          >
            <span className="w-12 h-12 rounded-xl bg-[#7c3aed]/10 text-[#7c3aed] flex items-center justify-center">
              <Clapperboard className="w-6 h-6" />
            </span>
            <span className="text-sm font-semibold text-[#111827]">Reels</span>
          </Link>

          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-[#e8eaed] bg-white p-5 hover:border-[#001f3f] hover:shadow-md transition-all"
            >
              <span className="w-12 h-12 rounded-xl bg-[#001f3f]/5 text-[#001f3f] flex items-center justify-center">
                <Pencil className="w-6 h-6" />
              </span>
              <span className="text-sm font-semibold text-[#111827]">Edit</span>
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-[#e8eaed] bg-white p-5 hover:border-rose-300 hover:shadow-md transition-all"
            >
              <span className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </span>
              <span className="text-sm font-semibold text-[#111827]">Delete</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
