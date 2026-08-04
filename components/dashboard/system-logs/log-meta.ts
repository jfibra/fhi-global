// Shared taxonomy, types, and formatters for the System Logs UI. Kept in one
// module so every tab (Overview, All Logs, Security, Management) and the detail
// drawer render categories/events consistently.

export type AuditLogRow = {
  id: string
  occurred_at: string
  category: string
  event: string
  source: string
  actor_id: string | null
  actor_name: string | null
  actor_role: string | null
  actor_avatar_url: string | null
  subject_type: string | null
  subject_id: string | null
  subject_label: string | null
  description: string | null
  changed_keys: string[] | null
  ip_address: string | null
}

export type AuditLogDetail = AuditLogRow & {
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  user_agent: string | null
  url: string | null
  request_id: string | null
  created_at: string
}

export type AuditListResponse = { rows: AuditLogRow[]; total: number; page: number; perPage: number }

export type OverviewStats = {
  today: number
  last_7d: number
  last_30d: number
  total: number
  security_7d: number
  top_category_7d: string | null
  top_category_7d_count: number
}

export type StorageStats = {
  total_rows: number
  bytes: number
  oldest: string | null
  newest: string | null
  age_buckets: { last_30d: number; in_30_90d: number; in_90_180d: number; older_180d: number }
  deletion_preview: Record<string, number>
}

// category → pill styling + label. Unknown categories fall back to slate.
export const CATEGORY_META: Record<string, { label: string; bg: string; text: string }> = {
  user_management: { label: "User Management", bg: "bg-violet-50", text: "text-violet-700" },
  listings: { label: "Listings", bg: "bg-sky-50", text: "text-sky-700" },
  projects: { label: "Projects", bg: "bg-amber-50", text: "text-amber-700" },
  developers: { label: "Developers", bg: "bg-indigo-50", text: "text-indigo-700" },
  events: { label: "Events", bg: "bg-fuchsia-50", text: "text-fuchsia-700" },
  teams: { label: "Teams", bg: "bg-emerald-50", text: "text-emerald-700" },
  sales: { label: "Sales", bg: "bg-teal-50", text: "text-teal-700" },
  finance: { label: "Finance", bg: "bg-lime-50", text: "text-lime-700" },
  support: { label: "Support", bg: "bg-orange-50", text: "text-orange-700" },
  contact: { label: "Contact", bg: "bg-cyan-50", text: "text-cyan-700" },
  inquiry: { label: "Inquiries", bg: "bg-emerald-50", text: "text-emerald-700" },
  auth: { label: "Auth", bg: "bg-rose-50", text: "text-rose-700" },
  security: { label: "Security", bg: "bg-red-50", text: "text-red-700" },
  mailer: { label: "Mailer", bg: "bg-blue-50", text: "text-blue-700" },
  system: { label: "System", bg: "bg-slate-100", text: "text-slate-600" },
  data: { label: "Data", bg: "bg-slate-50", text: "text-slate-600" },
}

export function categoryMeta(category: string) {
  return CATEGORY_META[category] ?? { label: category, bg: "bg-slate-50", text: "text-slate-600" }
}

// event → text color (hex, for inline style).
export const EVENT_COLOR: Record<string, string> = {
  created: "#16a34a",
  updated: "#2563eb",
  deleted: "#dc2626",
  restored: "#059669",
  login: "#16a34a",
  login_failed: "#dc2626",
  register: "#0891b2",
  role_granted: "#b45309",
  password_reset: "#dc2626",
  user_provisioned: "#7c3aed",
  activated: "#16a34a",
  deactivated: "#b45309",
  hard_deleted: "#b91c1c",
  cleared_logs: "#b91c1c",
  exported: "#0891b2",
  email_sent: "#2563eb",
  email_failed: "#dc2626",
}

export function eventColor(event: string): string {
  return EVENT_COLOR[event] ?? "#6b7280"
}

export function humanizeEvent(event: string): string {
  return event.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

// Fixed filter option lists.
export const EVENT_OPTIONS = Object.keys(EVENT_COLOR)
export const SOURCE_OPTIONS = ["database", "auth", "dashboard", "system", "app"]


export function formatDateTime(iso: string | null): string {
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

export function formatLongDateTime(iso: string | null, timeZone?: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  })
}

export function relativeTime(iso: string | null): string {
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

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

// Coarse browser/OS label from a user-agent string (for the detail drawer).
export function browserFromUserAgent(ua: string | null): string {
  if (!ua) return "Unknown"
  const b = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua) && !/Chromium/.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua) && !/Chrome/.test(ua)
            ? "Safari"
            : "Browser"
  const os = /iPhone|iPad|iOS/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X|Macintosh/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : ""
  return os ? `${b} · ${os}` : b
}
