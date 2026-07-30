"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AlertTriangle, Loader2 } from "lucide-react"

/**
 * Confirmation dialog for sale row actions. Two modes:
 *   · click  — a normal Confirm button (validation status changes).
 *   · hold   — a press-and-hold button that only fires after HOLD_MS, so a
 *              mistaken tap can't trigger an irreversible action (delete).
 *
 * Rendered only while shown (the parent mounts it conditionally), so each open
 * starts with a fresh, un-held button.
 */

const HOLD_MS = 1400

type Tone = "danger" | "primary"

export function SaleConfirmDialog({
  title,
  message,
  confirmLabel,
  tone = "primary",
  hold = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel: string
  tone?: Tone
  hold?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const [holding, setHolding] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firedRef = useRef(false)

  // Clear a pending hold timer if the dialog unmounts mid-press.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  // Escape cancels (unless a delete is already in flight).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [busy, onCancel])

  if (typeof document === "undefined") return null

  const startHold = () => {
    if (busy || firedRef.current) return
    setHolding(true)
    timerRef.current = setTimeout(() => {
      firedRef.current = true
      setHolding(false)
      onConfirm()
    }, HOLD_MS)
  }
  const cancelHold = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (!firedRef.current) setHolding(false)
  }

  const confirmCls =
    tone === "danger"
      ? "bg-rose-600 hover:bg-rose-700"
      : "bg-[#001f3f] hover:bg-[#00356b]"
  const iconTint =
    tone === "danger" ? "bg-rose-50 text-rose-600" : "bg-[#f4f6f9] text-[#001f3f]"

  return createPortal(
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={() => {
        if (!busy) onCancel()
      }}
    >
      <div
        className="w-full max-w-md bg-white rounded-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconTint}`}>
              <AlertTriangle className="w-[18px] h-[18px]" />
            </div>
            <div className="min-w-0">
              <h2 className="font-['Outfit'] text-base font-bold text-[#0d1117]">{title}</h2>
              <p className="text-sm text-[#6b7280] mt-1 leading-relaxed">{message}</p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[#6b7280] hover:text-[#0d1117] hover:bg-[#f3f4f6] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          {hold ? (
            <button
              type="button"
              onPointerDown={startHold}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
              onPointerCancel={cancelHold}
              disabled={busy}
              className={`relative overflow-hidden select-none px-5 py-2 rounded-lg text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${confirmCls}`}
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-white/25"
                style={{ width: holding ? "100%" : "0%", transition: `width ${holding ? HOLD_MS : 150}ms linear` }}
              />
              <span className="relative inline-flex items-center gap-2">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {busy ? "Deleting…" : holding ? "Keep holding…" : confirmLabel}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${confirmCls}`}
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {busy ? "Working…" : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
