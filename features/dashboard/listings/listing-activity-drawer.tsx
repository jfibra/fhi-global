"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X, Loader2, History, Clock } from "lucide-react"
import { RoleBadge } from "@/components/role-badge"
import { UserAvatar } from "@/components/user-avatar"
import { eventColor, humanizeEvent, formatLongDateTime, relativeTime } from "@/components/dashboard/system-logs/log-meta"
import {
  type AdminListingRow,
  type AdminListingActivityRow,
  fetchAdminListingActivity,
} from "@/lib/admin-listings-service"

function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—"
  if (typeof v === "string") return v
  return JSON.stringify(v)
}

function ChangesDiff({ oldV, newV }: { oldV: Record<string, unknown> | null; newV: Record<string, unknown> | null }) {
  const keys = Array.from(new Set([...Object.keys(oldV ?? {}), ...Object.keys(newV ?? {})]))
  if (keys.length === 0) return null
  return (
    <div className="mt-2 rounded-xl border border-[#eef0f2] bg-[#f9fafb] p-3 space-y-1.5">
      {keys.map((k) => {
        const o = (oldV ?? {})[k]
        const n = (newV ?? {})[k]
        const hasOld = oldV && k in oldV
        const hasNew = newV && k in newV
        return (
          <div key={k} className="grid grid-cols-[max-content_1fr] gap-x-2.5 items-start text-[11px]">
            <span className="font-semibold text-[#374151] font-mono">{k}:</span>
            <span className="font-mono text-[#111827] break-words">
              {hasOld && hasNew ? (
                <>
                  <span className="text-rose-600">{fmtVal(o)}</span>
                  <span className="text-[#9ca3af]"> → </span>
                  <span className="text-emerald-700">{fmtVal(n)}</span>
                </>
              ) : hasNew ? (
                <span className="text-emerald-700">{fmtVal(n)}</span>
              ) : (
                <span className="text-rose-600">{fmtVal(o)}</span>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function ListingActivityDrawer({ listing, onClose }: { listing: AdminListingRow; onClose: () => void }) {
  const [rows, setRows] = useState<AdminListingActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      const { data, error: err } = await fetchAdminListingActivity(listing.id)
      if (cancelled) return
      setRows(data)
      setError(err)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [listing.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[210] flex justify-end">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f2f5] flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <History className="w-5 h-5 text-[#001f3f] flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="font-['Outfit'] text-base font-bold text-[#0d1117] leading-tight">Activity Log</h2>
              <p className="text-xs text-[#9ca3af] truncate">{listing.title}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[#9ca3af] hover:bg-[#f4f6f9] flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-[#9ca3af] py-6">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading activity…
            </div>
          ) : error ? (
            <p className="text-sm text-rose-600 py-6">{error}</p>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16">
              <History className="w-10 h-10 text-[#d1d5db] mb-3" />
              <p className="text-sm font-semibold text-[#374151]">No activity yet</p>
              <p className="text-xs text-[#9ca3af] mt-1">Changes to this listing will appear here.</p>
            </div>
          ) : (
            <ol className="relative border-l border-[#eceff3] ml-1 space-y-5">
              {rows.map((row) => (
                <li key={row.id} className="ml-4">
                  <span
                    className="absolute -left-[5px] w-2.5 h-2.5 rounded-full border-2 border-white"
                    style={{ backgroundColor: eventColor(row.event) }}
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{ color: eventColor(row.event), backgroundColor: `${eventColor(row.event)}18` }}
                    >
                      {humanizeEvent(row.event)}
                    </span>
                    <span className="text-[10px] text-[#9ca3af]">from {row.source}</span>
                    <span className="text-[10px] text-[#9ca3af] ml-auto flex items-center gap-1" title={formatLongDateTime(row.occurred_at)}>
                      <Clock className="w-3 h-3" /> {relativeTime(row.occurred_at)}
                    </span>
                  </div>

                  {row.description && <p className="text-xs text-[#374151] mt-1.5">{row.description}</p>}

                  <div className="flex items-center gap-2 mt-1.5">
                    <UserAvatar name={row.actor_name ?? "System"} size={20} />
                    <span className="text-[11px] font-medium text-[#111827]">{row.actor_name ?? "System"}</span>
                    {row.actor_role && <RoleBadge role={row.actor_role} />}
                  </div>

                  <ChangesDiff oldV={row.old_values} newV={row.new_values} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
