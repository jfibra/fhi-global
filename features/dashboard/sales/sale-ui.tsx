// Presentation helpers shared by the Sales Reports table and the per-agent
// drill-in, so both render dates, money and status chips identically.

export function formatDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + " AED"
}

/**
 * Title-case a person / entity name for display, so mixed-casing source data
 * (e.g. "MICHELLE QUINTO GUINTO") renders uniformly as "Michelle Quinto Guinto".
 * Capitalises after a separator — space, hyphen, apostrophe, dot, ampersand,
 * slash, bracket — so O'Brien, Jean-Paul and H&H Development all survive.
 * Returns "" for blank input.
 *
 * Boundaries are listed explicitly rather than using `\b`, which is ASCII-only:
 * with \b, the non-ASCII letter in "Cañada" reads as a word boundary on both
 * sides and the name renders "CaÑAda" (likewise "JosÉ áLvarez").
 */
export function toTitleCase(value: string | null | undefined) {
  if (!value) return ""
  return value
    .toLowerCase()
    .replace(/(^|[\s\-'’.&/([])(\p{L})/gu, (_m, sep: string, c: string) => sep + c.toUpperCase())
}

/** Compact money for tiles: 4.1M / 940K / 12,500. */
export function formatCompactMoney(value: number) {
  const n = Number(value || 0)
  // 999,500+ rolls into the M branch so 999.6K never renders as "1000K".
  if (n >= 999_500) {
    const m = n / 1_000_000
    return `${m.toFixed(m >= 10 ? 0 : 1)}M AED`
  }
  if (n >= 100_000) return `${Math.round(n / 1_000)}K AED`
  return `${n.toLocaleString("en-US")} AED`
}

const STATUS_COLORS: Record<string, string> = {
  // commission statuses
  pending:      "bg-amber-50 text-amber-700 border-amber-200",
  processing:   "bg-blue-50 text-blue-700 border-blue-200",
  approved:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  released:     "bg-violet-50 text-violet-700 border-violet-200",
  rejected:     "bg-rose-50 text-rose-700 border-rose-200",
  // validation statuses
  under_review: "bg-sky-50 text-sky-700 border-sky-200",
  validated:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  invalid_sale: "bg-rose-50 text-rose-700 border-rose-200",
}

const STATUS_LABELS: Record<string, string> = {
  pending:      "Pending",
  processing:   "Processing",
  approved:     "Approved",
  released:     "Released",
  rejected:     "Rejected",
  under_review: "Under Review",
  validated:    "Validated",
  invalid_sale: "Invalid Sale",
}

export function StatusBadge({ value, type }: { value: string; type: "commission" | "validation" }) {
  void type // kept for call-site clarity; the value alone picks the colour
  const cls = STATUS_COLORS[value] ?? "bg-slate-100 text-slate-600 border-slate-200"
  const label = STATUS_LABELS[value] ?? value.replace(/_/g, " ")
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${cls}`}>
      {label}
    </span>
  )
}
