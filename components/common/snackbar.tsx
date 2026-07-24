"use client"

import { useEffect, useRef } from "react"
import { CheckCircle2, AlertCircle, X } from "lucide-react"

export type SnackbarState = { type: "success" | "error"; msg: string } | null

/**
 * Fixed top-right toast. Auto-dismisses after `duration` ms. Show a new message
 * by setting a fresh state object (identity change re-arms the timer); pass null
 * to hide. `onClose` is read through a ref so an inline handler doesn't reset the
 * timer on every render.
 */
export function Snackbar({
  state,
  onClose,
  duration = 4000,
}: {
  state: SnackbarState
  onClose: () => void
  duration?: number
}) {
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!state) return
    const t = setTimeout(() => onCloseRef.current(), duration)
    return () => clearTimeout(t)
  }, [state, duration])

  if (!state) return null
  const success = state.type === "success"

  return (
    <div className="fixed top-4 right-4 z-[3000] max-w-[calc(100vw-2rem)] sm:max-w-sm animate-[snackbar-in_180ms_ease-out]">
      <style>{`@keyframes snackbar-in{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <div
        role="status"
        aria-live="polite"
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg shadow-black/10 ${
          success ? "bg-green-50 border-green-200 text-green-700" : "bg-rose-50 border-rose-200 text-rose-700"
        }`}
      >
        {success ? (
          <CheckCircle2 className="w-4 h-4 shrink-0" />
        ) : (
          <AlertCircle className="w-4 h-4 shrink-0" />
        )}
        <span className="flex-1">{state.msg}</span>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onClose}
          className="text-current opacity-60 hover:opacity-100 transition-opacity"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

export default Snackbar
