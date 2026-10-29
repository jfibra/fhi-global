"use client"

// What the A2A page tells people about saving, where they're looking:
//   · A2AStatusStrip — above the form: which agreement is open, and its state;
//   · A2ASaveBar — pinned to the bottom of the screen while the page scrolls:
//     the page's two actions side by side — Save as draft (not finished) and
//     Save & Download Agreement PDF (done) — with the save status in words
//     right beside them ("Draft saved · 4:15 PM", "You have unsaved changes",
//     "Not saved yet"), so nobody has to scroll or guess whether their work is
//     kept. Same idea as the Digital Business Card's save bar, squared off.
// A finished agreement is "Completed" (stored as status 'submitted'): that's
// what Save & Download Agreement PDF does; afterwards it just downloads again.

import type { ReactNode } from "react"
import { AlertCircle, CheckCircle2, Download, Loader2, Lock, PencilLine, RotateCcw, Save, Trash2 } from "lucide-react"

/** The agreement in the form, as the status UI needs it. */
export type A2AFormState =
  | { kind: "new" }
  | { kind: "draft"; savedAt: string | null }
  /** Completed — saved as finished with Save & Download (status 'submitted'). */
  | { kind: "submitted"; submittedAt: string | null; mine: boolean; by?: string | null }

/** What's running: "complete" is Save & Download Agreement PDF. */
export type A2ABusy = null | "save" | "complete" | "withdraw" | "download" | "party"

const fmtWhen = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
    : ""

/** Just the time when it's today — "4:15 PM" — else the full date and time. */
function fmtSaved(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : fmtWhen(iso)
}

export function A2AStatusStrip({ state, title }: { state: A2AFormState; title: string }) {
  if (state.kind === "submitted") {
    return (
      <div className="flex items-start gap-3 border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm sm:px-5 sm:py-4 sm:text-[15px]">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
        <div className="min-w-0 leading-relaxed">
          <p className="font-bold text-emerald-900">
            Completed {fmtWhen(state.submittedAt)}
            {state.by ? ` by ${state.by}` : ""}
            {title ? ` — ${title}` : ""}
          </p>
          <p className="text-emerald-800">
            {state.mine
              ? "The terms are locked. You can still add documents that arrive late. Download Agreement PDF and Edit again are in the bar at the bottom."
              : "View only — you can look at its documents, and download the PDF from the bar at the bottom."}
          </p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-3 border border-[#e8eaed] bg-white px-4 py-3 text-sm sm:px-5 sm:py-4 sm:text-[15px]">
      <PencilLine className="mt-0.5 h-5 w-5 shrink-0 text-[#d6b357]" />
      <div className="min-w-0 leading-relaxed">
        <p className="font-bold text-[#0d1117]">
          {state.kind === "draft" ? `Editing your draft${title ? `: ${title}` : ""}` : "New agreement"}
        </p>
        <p className="text-[#6b7280]">
          {state.kind === "draft"
            ? "Not finished yet. In the bar at the bottom, press Save as draft to keep your changes, or Save & Download Agreement PDF when it's done."
            : "Not finished? Press Save as draft in the bar at the bottom. Done? Press Save & Download Agreement PDF beside it."}
        </p>
      </div>
    </div>
  )
}

function Status({ tone, flash = false, children }: { tone: "busy" | "error" | "ok" | "warn" | "muted"; flash?: boolean; children: ReactNode }) {
  const color = { busy: "text-[#374151]", error: "text-rose-600", ok: "text-emerald-700", warn: "text-[#8a6a10]", muted: "text-[#6b7280]" }[tone]
  return (
    <p
      role="status"
      aria-live="polite"
      className={`flex min-w-0 items-center gap-2 text-sm font-semibold transition-colors sm:text-[15px] ${color} ${flash ? "-mx-2 bg-emerald-50 px-2 py-1" : ""}`}
    >
      {tone === "busy" ? (
        <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
      ) : tone === "error" ? (
        <AlertCircle className="h-5 w-5 shrink-0" />
      ) : tone === "ok" ? (
        <CheckCircle2 className="h-5 w-5 shrink-0" />
      ) : tone === "warn" ? (
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#d6b357]" aria-hidden />
      ) : (
        <PencilLine className="h-5 w-5 shrink-0" />
      )}
      <span className="min-w-0">{children}</span>
    </p>
  )
}

// The page's actions, side by side: on a phone the two buttons share the
// bar's row as equal columns (with shorter labels); from sm up they sit in a
// line at their natural width.
const btn = "inline-flex min-w-0 items-center justify-center gap-2 px-3 py-3 text-sm font-bold transition-colors disabled:opacity-60 sm:px-5"
const primary = `${btn} bg-[#001f3f] text-white hover:bg-[#0a3d6b]`
const outline = `${btn} border border-[#001f3f] bg-white text-[#001f3f] hover:bg-[#f7f9fc]`

/** A label that shortens on a phone, where two buttons share one row. */
function Label({ short, long }: { short: string; long: string }) {
  return (
    <>
      <span className="sm:hidden">{short}</span>
      <span className="hidden sm:inline">{long}</span>
    </>
  )
}

export function A2ASaveBar({
  state,
  dirty,
  busy,
  justSaved,
  error,
  canEdit,
  canEditAgain,
  canDelete,
  onSave,
  onFinish,
  onDownload,
  onEditAgain,
  onDelete,
}: {
  state: A2AFormState
  dirty: boolean
  busy: A2ABusy
  /** A save just finished: the status and the Save button confirm it for a moment. */
  justSaved: boolean
  /** Why the last save failed, shown where the button was pressed. */
  error: string | null
  /** New or own draft: Save as draft + Save & Download Agreement PDF. */
  canEdit: boolean
  /** Own completed agreement: Edit again (+ Download Agreement PDF). */
  canEditAgain: boolean
  /** Admin viewing someone's completed agreement: Delete (+ Download Agreement PDF). */
  canDelete: boolean
  onSave: () => void
  /** Save & Download Agreement PDF — saves it as Completed, then downloads it. */
  onFinish: () => void
  /** Download Agreement PDF — a completed agreement's PDF again. */
  onDownload: () => void
  onEditAgain: () => void
  onDelete: () => void
}) {
  const savedFlash = justSaved && !dirty && state.kind === "draft"
  const status =
    busy === "save" ? (
      <Status tone="busy">Saving your draft…</Status>
    ) : busy === "complete" ? (
      <Status tone="busy">Saving &amp; downloading…</Status>
    ) : busy === "withdraw" ? (
      <Status tone="busy">Opening it for editing…</Status>
    ) : error ? (
      <Status tone="error">{error}</Status>
    ) : state.kind === "submitted" ? (
      <Status tone="ok">Completed · {fmtWhen(state.submittedAt)}</Status>
    ) : dirty ? (
      <Status tone="warn">
        {state.kind === "new" ? "Not saved yet — press Save as draft to keep your work" : "You have unsaved changes"}
      </Status>
    ) : state.kind === "draft" ? (
      <Status tone="ok" flash={savedFlash}>Draft saved · {fmtSaved(state.savedAt)}</Status>
    ) : (
      <Status tone="muted">Not saved yet</Status>
    )

  const downloadButton = (wide: boolean) => (
    <button
      type="button"
      onClick={onDownload}
      disabled={busy !== null}
      title="Two pages, FHI letterhead, ready to print or email"
      className={`${primary} ${wide ? "col-span-2" : ""}`}
    >
      {busy === "download" ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Download className="h-4 w-4 shrink-0" />}
      {busy === "download" ? "Building PDF…" : <Label short="Download PDF" long="Download Agreement PDF" />}
    </button>
  )

  // Docked to the bottom edge, edge to edge across the content area: the
  // dashboard's <main> is the scroll box and has p-6, and a sticky box stops
  // short of a scroll box's padding — so bottom/sides go -6 (-1.5rem) to sit
  // flush, and -mb-6 eats main's bottom padding so the page ends on the bar
  // instead of a strip of background under it.
  return (
    <div className="sticky -bottom-6 z-20 -mx-6 -mb-6 border-t border-[#e4e7ec] bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-6px_16px_-8px_rgba(0,31,63,0.18)] sm:px-6 sm:py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {status}
        <div className="ml-auto grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
          {canEdit ? (
            <>
              <button
                type="button"
                onClick={onSave}
                disabled={busy !== null}
                className={
                  savedFlash ? `${btn} border border-emerald-500 bg-emerald-50 text-emerald-700` : outline
                }
              >
                {busy === "save" ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : savedFlash ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <Save className="h-4 w-4 shrink-0" />
                )}
                {busy === "save" ? "Saving…" : savedFlash ? "Saved" : <Label short="Save draft" long="Save as draft" />}
              </button>
              <button
                type="button"
                onClick={onFinish}
                disabled={busy !== null}
                title="Saves the finished agreement, then downloads it — two pages, FHI letterhead, ready to print or email"
                className={primary}
              >
                {busy === "complete" ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 shrink-0" />
                )}
                {busy === "complete" ? "Saving…" : <Label short="Save & Download" long="Save & Download Agreement PDF" />}
              </button>
            </>
          ) : (
            <>
              {canEditAgain && (
                <button type="button" onClick={onEditAgain} disabled={busy !== null} className={outline}>
                  {busy === "withdraw" ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <RotateCcw className="h-4 w-4 shrink-0" />}
                  Edit again
                </button>
              )}
              {downloadButton(!canEditAgain && !canDelete)}
              {canDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={busy !== null}
                  className={`${btn} border border-[#dfe3e8] bg-white text-rose-600 hover:border-rose-300`}
                >
                  <Trash2 className="h-4 w-4 shrink-0" /> Delete
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
