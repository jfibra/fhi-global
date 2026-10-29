"use client"

// The A2A page's pop-ups, in plain words with big buttons — most people using
// this page are agents, not software people:
//   · A2ASavedDialog — the confirmation the first time a draft is saved, and
//     after Save & Download Agreement PDF ("where did my work go?" answered);
//   · A2AHelpDialog — "How it works" for the saved-agreements list.
// Rendered into document.body like SaleConfirmDialog; Escape or a click on the
// backdrop closes them.

import { useEffect, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { CheckCircle2, Clock, Download, FileDown, HelpCircle, PencilLine, RotateCcw, Save, X } from "lucide-react"

function Modal({
  labelledBy,
  onClose,
  wide = false,
  children,
}: {
  labelledBy: string
  onClose: () => void
  wide?: boolean
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  if (typeof document === "undefined") return null
  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[calc(100vh-2rem)] w-full overflow-y-auto bg-white shadow-xl ${wide ? "max-w-lg" : "max-w-md"}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** "Your draft is saved" / "Agreement saved and downloaded" — what happened, and where to find it again. */
export function A2ASavedDialog({
  kind,
  onClose,
  onDownload,
}: {
  kind: "draft" | "completed"
  onClose: () => void
  /** Completed only: the PDF again, in case the download didn't start. */
  onDownload?: () => void
}) {
  const completed = kind === "completed"
  return (
    <Modal labelledBy="a2a-saved-title" onClose={onClose}>
      <div className="p-7 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-9 w-9 text-emerald-500" />
        </div>
        <h2 id="a2a-saved-title" className="mt-4 font-['Outfit'] text-xl font-bold text-[#0d1117]">
          {completed ? "Agreement saved and downloaded" : "Your draft is saved"}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#4b5563]">
          {completed
            ? "The PDF is in your Downloads folder — print it or send it by email. The agreement is kept under My saved agreements as Completed, and the FHI admin team can see it. Documents that arrive later can still be added."
            : "You can close this page and come back anytime. Your draft is waiting at the top of this page under My saved agreements — press Continue editing to finish it."}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          {completed && onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center justify-center gap-2 border border-[#dfe3e8] bg-white px-5 py-3 text-sm font-bold text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f]"
            >
              <Download className="h-4 w-4" /> Download again
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="bg-[#001f3f] px-7 py-3 text-sm font-bold text-white hover:bg-[#0a3d6b]"
          >
            OK, got it
          </button>
        </div>
      </div>
    </Modal>
  )
}

const HELP_STEPS = [
  {
    icon: PencilLine,
    title: "Fill in the agreement",
    text: "Add each agent's details, choose the scope and the commission split, and sign on screen. Attaching each agency's documents is optional.",
  },
  {
    icon: Save,
    title: "Not finished? Save as draft",
    text: "Press Save as draft in the bar at the bottom of the screen. The agreement is kept in this list — close the page and come back anytime, then press Continue editing. Only you can see your drafts.",
  },
  {
    icon: Download,
    title: "Done? Save & Download Agreement PDF",
    text: "Press Save & Download Agreement PDF, beside Save as draft in the bar at the bottom. The agreement is saved as Completed and the PDF downloads, ready to print or email. The FHI admin team can see completed agreements. The terms are locked, but you can still add documents that arrive late.",
  },
  {
    icon: RotateCcw,
    title: "Need to change a completed agreement?",
    text: "Open it and press Edit again. It turns back into a draft — make your changes, then press Save & Download Agreement PDF again.",
  },
  {
    icon: FileDown,
    title: "Need the PDF again?",
    text: "Open the agreement from this list and press Download Agreement PDF in the bar at the bottom.",
  },
]

/** "How it works" for the saved-agreements list: the steps, and what the two statuses mean. */
export function A2AHelpDialog({ isStaff, onClose }: { isStaff: boolean; onClose: () => void }) {
  return (
    <Modal labelledBy="a2a-help-title" onClose={onClose} wide>
      <div className="flex items-start justify-between gap-3 border-b border-[#eef0f2] px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#001f3f]">
            <HelpCircle className="h-5 w-5 text-[#d6b357]" />
          </span>
          <div>
            <h2 id="a2a-help-title" className="font-['Outfit'] text-lg font-bold text-[#0d1117]">
              How saved agreements work
            </h2>
            <p className="text-sm text-[#6b7280]">Save a draft now, finish it later.</p>
          </div>
        </div>
        {/* Focus lands here (top), not on the footer button — focusing that scrolled a phone straight past the steps. */}
        <button type="button" autoFocus onClick={onClose} aria-label="Close" className="p-1 text-[#9ca3af] hover:text-[#0d1117]">
          <X className="h-5 w-5" />
        </button>
      </div>

      <ol className="space-y-4 px-6 py-5">
        {HELP_STEPS.map((step, i) => {
          const Icon = step.icon
          return (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f4f6f9] text-sm font-bold text-[#001f3f]">
                {i + 1}
              </span>
              <div>
                <p className="flex items-center gap-1.5 text-[15px] font-bold text-[#0d1117]">
                  <Icon className="h-4 w-4 shrink-0 text-[#d6b357]" /> {step.title}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-[#4b5563]">{step.text}</p>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="mx-6 mb-5 space-y-2.5 border border-[#eef0f2] bg-[#fafbfc] p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-[#374151]">What the labels mean</p>
        <p className="flex flex-wrap items-center gap-2 text-sm text-[#4b5563]">
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            <Clock className="h-3.5 w-3.5" /> Draft
          </span>
          Saved, but not finished yet.
        </p>
        <p className="flex flex-wrap items-center gap-2 text-sm text-[#4b5563]">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Completed
          </span>
          Finished and downloaded — the admin team can see it.
        </p>
        {isStaff && (
          <p className="pt-1 text-sm leading-relaxed text-[#4b5563]">
            <strong className="text-[#0d1117]">Admins:</strong> &ldquo;All agents&apos; completed&rdquo; lists every completed
            agreement — open, download or delete them there. Agents&apos; drafts stay private to them.
          </p>
        )}
      </div>

      <div className="border-t border-[#eef0f2] px-6 py-4 text-right">
        <button
          type="button"
          onClick={onClose}
          className="w-full bg-[#001f3f] px-7 py-3 text-sm font-bold text-white hover:bg-[#0a3d6b] sm:w-auto"
        >
          OK, got it
        </button>
      </div>
    </Modal>
  )
}
