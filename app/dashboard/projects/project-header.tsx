"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { MoreHorizontal, Globe, EyeOff, Copy, Trash2, Star, Gem } from "lucide-react"
import Image from "next/image"
import type { Project } from "@/lib/project-service"

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

const STATUS_COLORS: Record<string, string> = {
  pre_launch:          "bg-yellow-100 text-yellow-700",
  launch:              "bg-blue-100 text-blue-700",
  under_construction:  "bg-orange-100 text-orange-700",
  completed:           "bg-green-100 text-green-700",
}

interface Props {
  project: Project
  onPublishToggle: () => void
  onDuplicate?: () => void
  onDelete: () => void
}

export function ProjectHeader({ project, onPublishToggle, onDuplicate, onDelete }: Props) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef    = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open || !triggerRef.current) return

    const computePosition = () => {
      if (!triggerRef.current) return
      const r = triggerRef.current.getBoundingClientRect()
      const menuWidth = 180
      const estimatedMenuHeight = 180
      const viewportPadding = 8

      const placeBelow = r.bottom + 8 + estimatedMenuHeight <= window.innerHeight - viewportPadding
      const top = placeBelow
        ? r.bottom + 4
        : Math.max(viewportPadding, r.top - estimatedMenuHeight - 4)

      const left = Math.min(
        Math.max(viewportPadding, r.right - menuWidth),
        window.innerWidth - menuWidth - viewportPadding,
      )

      setPos({ top, left })
    }

    computePosition()
    window.addEventListener("resize", computePosition)
    window.addEventListener("scroll", computePosition, true)
    return () => {
      window.removeEventListener("resize", computePosition)
      window.removeEventListener("scroll", computePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const statusLabel = project.status?.replace(/_/g, " ") ?? ""
  const statusColor = STATUS_COLORS[project.status] ?? "bg-gray-100 text-gray-600"

  return (
    <div className="bg-white border-b border-[#f0f0f0] px-6 py-5">
      <div className="flex items-start gap-5">
        {/* Image / placeholder */}
        <div className="relative w-20 h-16 rounded-2xl overflow-hidden border border-[#e5e5e5] bg-[#f3f4f6] flex-shrink-0">
          {project.main_image ? (
            <Image src={project.main_image} alt={project.name} fill className="object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <svg className="w-8 h-8 text-[#d1d5db]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21V7l9-4 9 4v14M12 21V13m-4 8v-5m8 5v-5" />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="font-['Outfit'] text-2xl font-bold text-[#001f3f] truncate">{project.name}</h2>
            {project.is_featured && (
              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#d6b357]/20 text-[#a0842c]">
                <Star className="w-3 h-3" />Featured
              </span>
            )}
            {project.is_premium && (
              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                <Gem className="w-3 h-3" />Premium
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColor}`}>{statusLabel}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${project.is_published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {project.is_published ? "Published" : "Draft"}
            </span>
            {!project.is_active && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">Inactive</span>
            )}
            {project.developers?.name && (
              <span className="text-[#6b7280] text-xs">by {project.developers.name}</span>
            )}
            {project.city && (
              <span className="text-[#9ca3af] text-xs">Â· {project.city}{project.country ? `, ${project.country}` : ""}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onPublishToggle}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              project.is_published
                ? "bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100"
                : "bg-[#001f3f] text-white hover:bg-[#001f3f]/90"
            }`}
          >
            {project.is_published ? <EyeOff className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
            {project.is_published ? "Unpublish" : "Publish"}
          </button>

          <button ref={triggerRef} type="button" onClick={() => setOpen((v) => !v)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#f3f4f6] border border-[#e5e5e5] text-[#6b7280] transition-colors">
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {open && (
            <Portal>
              <div className="fixed inset-0 z-[130]" onClick={() => setOpen(false)} />
              <div className="fixed z-[140]" style={{ top: pos.top, left: pos.left }}>
                <div ref={menuRef} className="bg-white rounded-2xl border border-[#f0f0f0] shadow-2xl py-1.5 min-w-[180px]">
                  {onDuplicate && (
                  <button type="button" onClick={() => { setOpen(false); onDuplicate() }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#374151] hover:bg-[#f8fafc] transition-colors">
                    <Copy className="w-3.5 h-3.5 text-[#6b7280]" /> Duplicate
                  </button>
                  )}
                  <div className="border-t border-[#f0f0f0] my-1" />
                  <button type="button" onClick={() => { setOpen(false); onDelete() }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-rose-500 hover:bg-rose-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            </Portal>
          )}
        </div>
      </div>
    </div>
  )
}
