"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { CheckCircle2, ChevronDown, Clock, ClipboardCheck, XCircle } from "lucide-react"
import type { ValidationStatus } from "@/lib/sales-service"

/**
 * The admin's validation choices for one sale, behind one labelled button —
 * it replaces three bare icons, which needed a legend to be understood and
 * took a third of the row's width. Each choice still goes through the
 * report's confirm dialog.
 *
 * The button says where the sale stands: only a pending sale gets the solid
 * navy "Review" (a to-do); a decided one shows its status in a light outline,
 * so a validated sale never reads as work still waiting (owner, 2026-11-09).
 */

const CHOICES: Array<{ status: ValidationStatus; label: string; hint: string; Icon: typeof CheckCircle2; cls: string }> = [
  { status: "validated", label: "Validate sale", hint: "Approved — it counts on the leaderboards", Icon: CheckCircle2, cls: "text-emerald-600" },
  { status: "under_review", label: "Under review", hint: "Needs more papers from the agent", Icon: Clock, cls: "text-sky-600" },
  { status: "invalid_sale", label: "Invalid sale", hint: "Rejected as a sale", Icon: XCircle, cls: "text-rose-600" },
]

const BUTTON: Record<ValidationStatus, { label: string; title: string; Icon: typeof CheckCircle2; cls: string }> = {
  pending: { label: "Review", title: "Validate this sale, or send it back", Icon: ClipboardCheck, cls: "border-[#001f3f]/15 bg-[#001f3f] text-white hover:bg-[#0a3d6b]" },
  validated: { label: "Validated", title: "Validated — change its status", Icon: CheckCircle2, cls: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
  under_review: { label: "Under review", title: "Under review — change its status", Icon: Clock, cls: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100" },
  invalid_sale: { label: "Invalid", title: "Invalid sale — change its status", Icon: XCircle, cls: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" },
}

const MENU_WIDTH = 240

export function ReviewMenu({
  current,
  onPick,
}: {
  current: ValidationStatus
  onPick: (status: ValidationStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const button = BUTTON[current] ?? BUTTON.pending

  useEffect(() => {
    if (!open) return
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect()
      if (!r) return
      const height = CHOICES.length * 52 + 16
      const below = r.bottom + 6 + height <= window.innerHeight - 8
      setPos({
        top: below ? r.bottom + 6 : Math.max(8, r.top - height - 6),
        left: Math.min(Math.max(8, r.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8),
      })
    }
    place()
    const close = (e: MouseEvent) => {
      const t = e.target as Node
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={button.title}
        className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${button.cls}`}
      >
        <button.Icon className="h-3.5 w-3.5" />
        {button.label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ position: "fixed", top: pos.top, left: pos.left, width: MENU_WIDTH, zIndex: 140 }}
          className="rounded-2xl border border-[#f0f0f0] bg-white py-1.5 shadow-2xl"
        >
          {CHOICES.map(({ status, label, hint, Icon, cls }) => {
            const isCurrent = status === current
            return (
              <button
                key={status}
                type="button"
                role="menuitem"
                disabled={isCurrent}
                onClick={() => { setOpen(false); onPick(status) }}
                className="flex w-full items-start gap-3 px-4 py-2 text-left transition-colors hover:bg-[#f8fafc] disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cls}`} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#0d1117]">
                    {label}
                    {isCurrent && <span className="ml-1.5 text-[11px] font-medium text-[#9ca3af]">(now)</span>}
                  </span>
                  <span className="block text-[11px] text-[#9ca3af]">{hint}</span>
                </span>
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </>
  )
}
