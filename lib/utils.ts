import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Date formatting ────────────────────────────────────────────────────────
// Shared, timezone-aware (viewer-local) formatters used across dashboards.

/** e.g. "Jan 3, 2025" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

/** e.g. "Jan 3, 2025, 4:05 PM" */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/** e.g. "July 22, 2026 at 5:30 AM" (viewer's local zone, full month name) */
export function formatLongDateAtTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  const date = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  return `${date} at ${time}`
}

/** e.g. "just now", "5m ago", "3h ago", "2d ago", "4mo ago", "1y ago" */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return "—"
  const secs = Math.round((Date.now() - then) / 1000)
  if (secs < 60) return "just now"
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.round(months / 12)}y ago`
}

/**
 * Format an instant in a specific IANA time zone, e.g. "7/22/2026 at 3:45 PM".
 * Passing an explicit `timeZone` makes the output identical on server and
 * client, so it is safe against SSR hydration mismatches.
 */
export function formatDateAtTimeInZone(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  const date = d.toLocaleDateString("en-US", { timeZone, month: "numeric", day: "numeric", year: "numeric" })
  const time = d.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" })
  return `${date} at ${time}`
}

/** Date only, in a timezone (e.g. "7/23/2026"). */
export function formatDateInZone(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-US", { timeZone, month: "numeric", day: "numeric", year: "numeric" })
}

/** Time only, in a timezone (e.g. "3:45 PM"). */
export function formatTimeInZone(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" })
}
