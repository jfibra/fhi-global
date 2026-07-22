"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Eye, MoreHorizontal, Paperclip, Pencil, Trash2 } from "lucide-react"
import type { Purchase } from "@/lib/purchase-service"

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

export function PurchaseActions({
  purchase,
  onView,
  onEdit,
  onAttachments,
  onDelete,
}: {
  purchase: Purchase
  onView: () => void
  onEdit: () => void
  onAttachments: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open || !triggerRef.current) return

    const computePosition = () => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      const menuWidth = 200
      const estimatedMenuHeight = 190
      const viewportPadding = 8

      const placeBelow =
        rect.bottom + 8 + estimatedMenuHeight <= window.innerHeight - viewportPadding
      const top = placeBelow
        ? rect.bottom + 6
        : Math.max(viewportPadding, rect.top - estimatedMenuHeight - 6)
      const left = Math.min(
        Math.max(viewportPadding, rect.right - menuWidth),
        window.innerWidth - menuWidth - viewportPadding,
      )
      setMenuPosition({ top, left })
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
    const handle = (e: MouseEvent) => {
      const target = e.target as Node
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  const act = (fn: () => void) => { setOpen(false); fn() }

  return (
    <div ref={triggerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f3f4f6] transition-colors text-[#6b7280]"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <Portal>
          <div className="fixed inset-0 z-[130]" onClick={() => setOpen(false)} />
          <div className="fixed z-[140]" style={{ top: menuPosition.top, left: menuPosition.left }}>
            <div
              ref={menuRef}
              className="bg-white rounded-2xl border border-[#f0f0f0] shadow-2xl py-1.5 min-w-[200px] mt-1"
            >
              <button
                type="button"
                onClick={() => act(onView)}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#374151] hover:bg-[#f8fafc] transition-colors"
              >
                <Eye className="w-3.5 h-3.5 text-[#6b7280]" />
                View Details
              </button>
              <button
                type="button"
                onClick={() => act(onEdit)}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#374151] hover:bg-[#f8fafc] transition-colors"
              >
                <Pencil className="w-3.5 h-3.5 text-[#6b7280]" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => act(onAttachments)}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#374151] hover:bg-[#f8fafc] transition-colors"
              >
                <Paperclip className="w-3.5 h-3.5 text-[#6b7280]" />
                Manage Attachments
                {purchase.attachments_count > 0 && (
                  <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-600 border border-sky-200">
                    {purchase.attachments_count}
                  </span>
                )}
              </button>

              <div className="border-t border-[#f0f0f0] my-1" />

              <button
                type="button"
                onClick={() => act(onDelete)}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}
