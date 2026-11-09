"use client"

import { useEffect, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { AlertTriangle, BadgeCheck, Hourglass, Loader2, Paperclip, ShieldCheck, Undo2, X } from "lucide-react"
import type { SaleRecord } from "@/lib/sales-service"
import { formatCurrency, formatDate, toTitleCase } from "./sale-ui"

/**
 * The team leader's "Are you sure?" before confirming a team sale — or taking
 * that back (migration 084). Built for a quick, careful read: the sale's facts
 * in one card, then the two checks every sale on the team gets — the leader's
 * and the admin's, in either order — so the leader sees where theirs fits and
 * what the sale looks like afterwards. Mounted only while shown, like
 * SaleConfirmDialog.
 */
export function LeaderConfirmDialog({
  sale,
  confirmIt,
  leaderName,
  busy = false,
  onConfirm,
  onCancel,
}: {
  sale: SaleRecord
  /** true = confirm the sale; false = take the confirmation back. */
  confirmIt: boolean
  /** The signed-in team leader, shown on their own check. */
  leaderName: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  // Escape cancels (unless the save is already in flight).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [busy, onCancel])

  if (typeof document === "undefined") return null

  const isProject = sale.sale_type === "project"
  const client = sale.clients ? toTitleCase(`${sale.clients.first_name} ${sale.clients.last_name}`) : ""
  const place = isProject ? toTitleCase(sale.projects?.name) : sale.property_type ?? ""
  const unit = isProject ? [sale.project_units?.unit_type, sale.unit_number && `Unit ${sale.unit_number}`].filter(Boolean).join(" · ") : ""
  const placeNote = isProject ? toTitleCase(sale.developers?.name) : sale.property_address ?? ""
  const recordedBy = toTitleCase(sale.profiles?.fullname) || "Team member"
  const shared = sale.partners.length > 1
  const files = sale.attachments_count
  const validated = sale.validation_status === "validated"
  const adminName = toTitleCase(sale.validation_changed_by_name)
  const you = `${toTitleCase(leaderName) || "You"} (you)`
  const titleId = `leader-confirm-${sale.id}`

  return createPortal(
    <div
      className="fixed inset-0 z-[210] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={() => { if (!busy) onCancel() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 sm:px-6">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              confirmIt ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
            }`}
          >
            {confirmIt ? <ShieldCheck className="h-6 w-6" /> : <Undo2 className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-['Outfit'] text-lg font-bold leading-tight text-[#0d1117]">
              {confirmIt ? "Confirm this sale?" : "Take back your confirmation?"}
            </h2>
            <p className="mt-1 text-sm text-[#6b7280]">
              {confirmIt ? "Your check as team leader — read it over first." : "The sale goes back to waiting for your check."}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-[#9ca3af] transition-colors hover:bg-[#f3f4f6] hover:text-[#0d1117] disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-5 sm:px-6">
          {/* The sale, one fact per row */}
          <dl className="divide-y divide-[#eef0f3] rounded-xl border border-[#e5e7eb] bg-[#fafbfc] text-sm">
            <Fact label="Client">
              <span className="font-semibold text-[#0d1117]">{client || "—"}</span>
            </Fact>
            <Fact label="Property">
              <span className="font-semibold text-[#0d1117]">{place || "—"}</span>
              {unit && <span className="block text-[#374151]">{unit}</span>}
              {placeNote && <span className="block text-xs text-[#9ca3af]">{placeNote}</span>}
            </Fact>
            <Fact label="Contract price">
              <span className="font-mono text-base font-bold text-[#0d1117]">{formatCurrency(sale.contract_price)}</span>
            </Fact>
            <Fact label="Recorded by">
              <span className="font-medium text-[#0d1117]">{recordedBy}</span>
              <span className="text-[#9ca3af]"> · {formatDate(sale.created_at)}</span>
            </Fact>
            {sale.reservation_date && (
              <Fact label="Reserved">
                <span className="text-[#0d1117]">{formatDate(sale.reservation_date)}</span>
              </Fact>
            )}
            {shared && (
              <Fact label="Split">
                {sale.partners.map((p) => (
                  <span key={p.agent_id} className="block text-[#0d1117]">
                    {toTitleCase(p.name) || "Agent"} <span className="font-semibold">{p.share}%</span>
                  </span>
                ))}
              </Fact>
            )}
            <Fact label="Files">
              {files > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-[#0d1117]">
                  <Paperclip className="h-3.5 w-3.5 text-[#6b7280]" />
                  {files} file{files === 1 ? "" : "s"} attached
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  No files attached yet
                </span>
              )}
            </Fact>
          </dl>

          {/* The two checks: the leader's (this one) and the admin's */}
          <section>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#9ca3af]">Double check</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Check
                step={1}
                who="Team leader"
                name={you}
                tone={confirmIt ? "now" : "undo"}
                status={confirmIt ? "You're confirming now" : "Goes back to waiting"}
              />
              <Check
                step={2}
                who="Admin"
                name={validated ? adminName || "Admin" : "FHI admin"}
                tone={validated ? "done" : "waiting"}
                status={
                  validated
                    ? `Validated${sale.validation_changed_at ? ` · ${formatDate(sale.validation_changed_at)}` : ""}`
                    : sale.validation_status === "under_review"
                      ? "Under review"
                      : "Validates next"
                }
              />
            </div>
            <p className={`mt-2.5 flex items-center gap-1.5 text-sm font-medium ${confirmIt && validated ? "text-emerald-700" : "text-[#6b7280]"}`}>
              {confirmIt && validated && <BadgeCheck className="h-4 w-4 shrink-0" />}
              {confirmIt
                ? validated
                  ? "After this, the sale has both checks."
                  : "After this, it waits only for the admin."
                : "The admin's decision on this sale doesn't change."}
            </p>
          </section>

          {/* What "confirm" vouches for */}
          {confirmIt && (
            <section className="rounded-xl bg-[#f4f6f9] px-4 py-3">
              <p className="text-sm font-semibold text-[#0d1117]">Before you confirm, make sure:</p>
              <ul className="mt-1.5 space-y-1 text-sm text-[#374151]">
                <li className="flex gap-2"><span className="text-[#9ca3af]">•</span>the client and the unit are right</li>
                <li className="flex gap-2"><span className="text-[#9ca3af]">•</span>the price matches the reservation form</li>
                <li className="flex gap-2"><span className="text-[#9ca3af]">•</span>the proof of payment is attached</li>
              </ul>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2.5 border-t border-[#f0f2f5] px-5 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:px-6 sm:py-4">
          {confirmIt && (
            <p className="text-center text-xs text-[#9ca3af] sm:mr-auto sm:text-left">You can take it back later from the ⋯ menu.</p>
          )}
          <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="shrink-0 rounded-xl border border-[#e5e7eb] px-4 py-2.5 text-sm font-medium text-[#6b7280] transition-colors hover:bg-[#f3f4f6] hover:text-[#0d1117] disabled:opacity-50 sm:border-transparent"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className={`inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none ${
                confirmIt ? "bg-emerald-600 hover:bg-emerald-700" : "bg-[#001f3f] hover:bg-[#00356b]"
              }`}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : confirmIt ? (
                <BadgeCheck className="h-4 w-4" />
              ) : (
                <Undo2 className="h-4 w-4" />
              )}
              {busy ? "Saving…" : confirmIt ? "Yes, confirm sale" : "Take it back"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[112px_1fr] gap-3 px-4 py-2.5">
      <dt className="pt-px text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">{label}</dt>
      <dd className="min-w-0 leading-snug">{children}</dd>
    </div>
  )
}

const CHECK_TONES = {
  now: { box: "border-emerald-300 bg-emerald-50 ring-2 ring-emerald-100", dot: "bg-emerald-600 text-white", status: "text-emerald-700" },
  done: { box: "border-emerald-200 bg-white", dot: "bg-emerald-600 text-white", status: "text-emerald-700" },
  waiting: { box: "border-[#e5e7eb] bg-white", dot: "bg-[#e5e7eb] text-[#6b7280]", status: "text-[#6b7280]" },
  undo: { box: "border-amber-200 bg-amber-50", dot: "bg-amber-500 text-white", status: "text-amber-700" },
} as const

/** One of the sale's two checks — who gives it and where it stands. */
function Check({
  step,
  who,
  name,
  status,
  tone,
}: {
  step: number
  who: string
  name: string
  status: string
  tone: keyof typeof CHECK_TONES
}) {
  const t = CHECK_TONES[tone]
  const Icon = tone === "now" || tone === "done" ? BadgeCheck : Hourglass
  return (
    <div className={`rounded-xl border px-3.5 py-3 ${t.box}`}>
      <div className="flex items-center gap-2">
        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${t.dot}`}>{step}</span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#6b7280]">{who}</span>
      </div>
      <p className="mt-1.5 truncate text-sm font-semibold text-[#0d1117]" title={name}>{name}</p>
      <p className={`mt-0.5 flex items-center gap-1 text-xs font-medium ${t.status}`}>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {status}
      </p>
    </div>
  )
}
