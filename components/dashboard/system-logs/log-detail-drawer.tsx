"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X, Globe, Monitor, Link2, Clock, User as UserIcon, ShieldCheck, Loader2 } from "lucide-react"
import { RoleBadge } from "@/components/role-badge"
import {
  type AuditLogRow,
  type AuditLogDetail,
  categoryMeta,
  eventColor,
  humanizeEvent,
  formatLongDateTime,
  browserFromUserAgent,
} from "./log-meta"

function ChangesDiff({ oldV, newV }: { oldV: Record<string, unknown> | null; newV: Record<string, unknown> | null }) {
  const keys = Array.from(new Set([...Object.keys(oldV ?? {}), ...Object.keys(newV ?? {})]))
  if (keys.length === 0) return null
  const fmt = (v: unknown) =>
    v === null || v === undefined ? "—" : typeof v === "string" ? v : JSON.stringify(v)
  return (
    <div className="rounded-xl border border-[#e8eaed] bg-[#f9fafb] p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-2.5">Changes</p>
      <div className="space-y-2">
        {keys.map((k) => {
          const o = (oldV ?? {})[k]
          const n = (newV ?? {})[k]
          const hasOld = oldV && k in oldV
          const hasNew = newV && k in newV
          return (
            <div key={k} className="grid grid-cols-[max-content_1fr] gap-x-3 items-start text-xs">
              <span className="font-semibold text-[#374151] font-mono">{k}:</span>
              <span className="font-mono text-[#111827] break-words">
                {hasOld && hasNew ? (
                  <>
                    <span className="text-rose-600">{fmt(o)}</span>
                    <span className="text-[#9ca3af]"> → </span>
                    <span className="text-emerald-700">{fmt(n)}</span>
                  </>
                ) : hasNew ? (
                  <span className="text-emerald-700">{fmt(n)}</span>
                ) : (
                  <span className="text-rose-600">{fmt(o)}</span>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ReqRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 text-[#9ca3af] shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">{label}</p>
        <p className="text-xs text-[#374151] font-mono break-all">{value}</p>
      </div>
    </div>
  )
}

export function LogDetailDrawer({ row, onClose }: { row: AuditLogRow; onClose: () => void }) {
  const [detail, setDetail] = useState<AuditLogDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const res = await fetch(`/api/admin/system-logs/${row.id}`)
        const json = (await res.json()) as AuditLogDetail
        if (!cancelled && res.ok) setDetail(json)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [row.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  if (!mounted) return null

  const cat = categoryMeta(row.category)
  const evColor = eventColor(row.event)
  const oldV = detail?.old_values ?? null
  const newV = detail?.new_values ?? null
  const ua = detail?.user_agent ?? null
  const url = detail?.url ?? null
  const ip = detail?.ip_address ?? row.ip_address ?? null
  const hasRequestInfo = Boolean(ip || ua || url)

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-[210] w-full max-w-md bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f2f5]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#001f3f]" />
            <h2 className="font-['Outfit'] text-base font-bold text-[#0d1117]">Audit Log Details</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[#9ca3af] hover:bg-[#f4f6f9]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1.5">Action</p>
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{ color: evColor, backgroundColor: `${evColor}18` }}
              >
                {humanizeEvent(row.event)}
              </span>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1.5">Category</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cat.bg} ${cat.text}`}>
                {cat.label}
              </span>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1">Subject</p>
            <p className="text-sm font-semibold text-[#111827]">
              {row.subject_label || (row.subject_type ? `${row.subject_type} #${row.subject_id ?? "—"}` : "—")}
            </p>
            <p className="text-[11px] text-[#9ca3af] mt-0.5">Source: {row.source}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1.5">User</p>
            <div className="flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-[#9ca3af]" />
              <span className="text-sm font-medium text-[#111827]">{row.actor_name ?? "System"}</span>
              {row.actor_role && <RoleBadge role={row.actor_role} />}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1.5">Date &amp; Time</p>
            <div className="flex items-center gap-2 text-sm text-[#374151]">
              <Clock className="w-4 h-4 text-[#9ca3af]" />
              {formatLongDateTime(row.occurred_at)}
            </div>
          </div>

          {row.description && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1.5">Description</p>
              <p className="text-sm text-[#374151] whitespace-pre-wrap">{row.description}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-xs text-[#9ca3af]">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading details…
            </div>
          ) : (
            <>
              <ChangesDiff oldV={oldV} newV={newV} />
              {hasRequestInfo && (
                <div className="space-y-3 pt-1 border-t border-[#f0f2f5]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] pt-3">Request Information</p>
                  {ip && <ReqRow icon={Globe} label="IP Address" value={ip} />}
                  {ua && <ReqRow icon={Monitor} label="Browser" value={`${browserFromUserAgent(ua)} — ${ua}`} />}
                  {url && <ReqRow icon={Link2} label="URL" value={url} />}
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>,
    document.body,
  )
}
