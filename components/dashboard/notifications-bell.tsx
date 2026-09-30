"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bell, CalendarDays, Inbox, LifeBuoy, Link2, Mail, MessageSquare, TrendingUp, UserPlus } from "lucide-react"
import type { AdminNotification } from "@/app/api/admin/notifications/route"

/**
 * The dashboard bell. For admin staff it lists what happened in the last
 * seven days (GET /api/admin/notifications) — new accounts, sales, inbox
 * replies, inquiries, contact messages, tickets, briefs, event registrations
 * — with a badge for everything since the bell was last closed. What is new
 * stays marked while the panel is open and counts as read when it closes;
 * that moment is kept in this browser (localStorage), so the badge is per
 * device. Refreshes every minute while
 * the tab is visible. Other roles keep the quiet bell.
 */

const SEEN_KEY = "fhi.notifications.seenAt"
const POLL_MS = 60_000

const KIND: Record<AdminNotification["kind"], { icon: typeof Bell; color: string; label: string }> = {
  account: { icon: UserPlus, color: "#b8913f", label: "Accounts" },
  sale: { icon: TrendingUp, color: "#15803d", label: "Sales" },
  reply: { icon: Mail, color: "#1d4ed8", label: "Inbox" },
  inquiry: { icon: Inbox, color: "#1d4ed8", label: "Inquiries" },
  contact: { icon: MessageSquare, color: "#6b7280", label: "Contact" },
  ticket: { icon: LifeBuoy, color: "#b91c1c", label: "Support" },
  brief: { icon: Link2, color: "#0f766e", label: "Buyers Link" },
  registration: { icon: CalendarDays, color: "#7c3aed", label: "Events" },
}

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return "just now"
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  const d = Math.floor(s / 86400)
  return d === 1 ? "yesterday" : `${d} days ago`
}

function readSeen(): string {
  try {
    return localStorage.getItem(SEEN_KEY) ?? ""
  } catch {
    return ""
  }
}

export function NotificationsBell({ enabled, base }: { enabled: boolean; base: string }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AdminNotification[] | null>(null)
  const [seenAt, setSeenAt] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications", { cache: "no-store" })
      if (!res.ok) return
      const json = (await res.json()) as { items?: AdminNotification[] }
      setSeenAt(readSeen())
      setItems(json.items ?? [])
    } catch {
      /* the bell stays as it was */
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void load()
    const tick = () => {
      if (document.visibilityState === "visible") void load()
    }
    const t = window.setInterval(tick, POLL_MS)
    document.addEventListener("visibilitychange", tick)
    return () => {
      window.clearInterval(t)
      document.removeEventListener("visibilitychange", tick)
    }
  }, [enabled, load])

  /** Closing the panel reads everything that was in it. */
  const close = useCallback(() => {
    setOpen(false)
    const now = new Date().toISOString()
    try {
      localStorage.setItem(SEEN_KEY, now)
    } catch {
      /* private mode: the badge just returns next load */
    }
    setSeenAt(now)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onPointer)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onPointer)
    }
  }, [open, close])

  const unread = (items ?? []).filter((n) => !seenAt || n.at > seenAt).length

  const toggle = () => (open ? close() : setOpen(true))

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggle}
        className={`relative w-8 h-8 flex items-center justify-center rounded-xl text-[#6b7280] transition-all ${
          open ? "bg-[#e8eaed] text-[#0d1117]" : "bg-[#f4f6f9] hover:bg-[#e8eaed]"
        }`}
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && !open && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c0392b] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,24rem)] overflow-hidden rounded-2xl border border-[#e8eaed] bg-white shadow-[0_8px_30px_-4px_rgba(0,31,63,0.12)]"
        >
          <div className="flex items-center justify-between border-b border-[#f0f2f5] px-4 py-2.5">
            <div>
              <p className="font-['Outfit'] text-sm font-bold text-[#0d1117]">Notifications</p>
              <p className="text-[11px] text-[#9ca3af]">{enabled ? "The last seven days across the company" : "Alerts for your account and workspace"}</p>
            </div>
            {enabled && items && items.length > 0 && <span className="text-[11px] font-semibold text-[#9ca3af]">{items.length}</span>}
          </div>

          {!enabled || (items !== null && items.length === 0) ? (
            <div className="px-4 py-10 text-center">
              <Bell className="mx-auto mb-2 h-8 w-8 text-[#d1d5db]" aria-hidden />
              <p className="text-sm font-medium text-[#6b7280]">{enabled ? "Nothing in the last seven days" : "No notifications yet"}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#9ca3af]">{enabled ? "New accounts, sales, replies and messages will show up here." : "When there are updates, they will appear here."}</p>
            </div>
          ) : items === null ? (
            <p className="px-4 py-8 text-center text-sm text-[#9ca3af]">Loading…</p>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-[#f0f2f5] overflow-y-auto">
              {items.map((n) => {
                const k = KIND[n.kind]
                const isNew = !seenAt || n.at > seenAt
                return (
                  <li key={n.id}>
                    <Link href={`${base}${n.path}`} onClick={close} className={`flex gap-3 px-4 py-3 transition-colors hover:bg-[#f9fafb] ${isNew ? "bg-[#fbfaf5]" : ""}`}>
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${k.color}14`, color: k.color }}>
                        <k.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className={`text-[13px] leading-snug text-[#0d1117] ${isNew ? "font-bold" : "font-medium"}`}>{n.title}</span>
                          {isNew && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#c0392b]" aria-label="New" />}
                        </span>
                        {n.detail && <span className="mt-0.5 block truncate text-xs text-[#6b7280]">{n.detail}</span>}
                        <span className="mt-0.5 block text-[11px] text-[#9ca3af]">
                          {k.label} · {ago(n.at)}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
