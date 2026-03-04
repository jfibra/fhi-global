"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { MoreHorizontal, Pencil, Power, Trash2 } from "lucide-react"
import type { PurchaseCategory } from "@/lib/purchase-category-service"

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

export function PurchaseCategoryActions({
  category,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  category: PurchaseCategory
  onEdit: () => void
  onToggleActive: () => void
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
      const menuWidth = 190
      const estimatedMenuHeight = category.category_type === "custom" ? 175 : 135
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
  }, [open, category.category_type])

  useEffect(() => {
    if (!open) return

    const handle = (event: MouseEvent) => {
      const target = event.target as Node
      const insideTrigger = Boolean(triggerRef.current?.contains(target))
      const insideMenu = Boolean(menuRef.current?.contains(target))
      if (!insideTrigger && !insideMenu) setOpen(false)
    }

    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

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
              className="bg-white rounded-2xl border border-[#f0f0f0] shadow-2xl py-1.5 min-w-[190px] mt-1"
            >
              {/* Edit */}
              <button
                type="button"
                onClick={() => { setOpen(false); onEdit() }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#374151] hover:bg-[#f8fafc] transition-colors"
              >
                <Pencil className="w-3.5 h-3.5 text-[#6b7280]" />
                Edit
              </button>

              {/* Toggle active */}
              <button
                type="button"
                onClick={() => { setOpen(false); onToggleActive() }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#374151] hover:bg-[#f8fafc] transition-colors"
              >
                <Power className="w-3.5 h-3.5 text-[#6b7280]" />
                {category.is_active ? "Deactivate" : "Activate"}
              </button>

              {/* Delete â€” custom categories only */}
              {category.category_type === "custom" && (
                <>
                  <div className="border-t border-[#f0f0f0] my-1" />
                  <button
                    type="button"
                    onClick={() => { setOpen(false); onDelete() }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}
