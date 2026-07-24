"use client"

import type { ReactNode } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown } from "lucide-react"
import { TOOLBAR_GRADIENT } from "./header-toolbar"

// A column is a plain label, or an object. Give it a `sortKey` (plus DataTable's
// `sort`/`onSort` props) to make its header a clickable sort toggle.
export type DataTableColumn = string | { label: string; className?: string; sortKey?: string }

// ── Pagination page list ──────────────────────────────────────────────────────
// Fixed-width pager: always renders PAGE_SLOTS page cubes (first, last, "…" gaps,
// numbers). With the prev/next buttons that's PAGE_SLOTS + 2 = 10 cubes.
// Middle → [1, "…", 6, 7, 8, 9, "…", 100]; near an end → six consecutive pages.
export const PAGE_SLOTS = 8
export function paginationItems(current: number, total: number): (number | "…")[] {
  if (total <= PAGE_SLOTS) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const leftGap = current > 4
  const rightGap = current < total - 3
  const pages: (number | "…")[] = []

  if (!leftGap) {
    for (let i = 1; i <= PAGE_SLOTS - 2; i++) pages.push(i)
    pages.push("…", total)
  } else if (!rightGap) {
    pages.push(1, "…")
    for (let i = total - (PAGE_SLOTS - 3); i <= total; i++) pages.push(i)
  } else {
    const interior = PAGE_SLOTS - 4
    let start = current - Math.floor((interior - 1) / 2)
    start = Math.max(2, Math.min(start, total - 1 - (interior - 1)))
    pages.push(1, "…")
    for (let i = 0; i < interior; i++) pages.push(start + i)
    pages.push("…", total)
  }

  // A "…" hiding exactly one page is pointless — show that page number instead.
  return pages.map((p, i) => {
    const prev = pages[i - 1]
    const next = pages[i + 1]
    if (p === "…" && typeof prev === "number" && typeof next === "number" && next - prev === 2) {
      return prev + 1
    }
    return p
  })
}

// ── Footer: rows-per-page + page navigation ──────────────────────────────────
export function TablePagination({
  page,
  perPage,
  total,
  totalPages,
  onPageChange,
  onPerPageChange,
  perPageOptions = [10, 20, 50],
}: {
  page: number
  perPage: number
  total: number
  totalPages: number
  onPageChange: (page: number) => void
  onPerPageChange: (perPage: number) => void
  perPageOptions?: number[]
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-t border-black/[0.08] bg-[#fafafb]">
      <div className="flex items-center gap-2">
        <span className="h-8 inline-flex items-center px-3 rounded-[10px] border border-black/[0.08] bg-white text-xs font-medium text-black/55 whitespace-nowrap tabular-nums">
          Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
        </span>
        <div className="relative">
          <select
            value={perPage}
            onChange={(e) => onPerPageChange(Number(e.target.value))}
            className={`h-8 pl-2.5 pr-7 rounded-[10px] border border-transparent text-xs font-medium text-white appearance-none cursor-pointer focus:outline-none transition-all hover:brightness-110 ${TOOLBAR_GRADIENT}`}
          >
            {perPageOptions.map((n) => <option key={n} value={n} className="bg-white text-[#111827]">{n} / page</option>)}
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-white/80 pointer-events-none" />
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="w-8 h-8 flex items-center justify-center rounded-[10px] border border-black/[0.08] text-black/50 hover:text-[#001f3f] hover:border-[#001f3f]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          {paginationItems(page, totalPages).map((p, i) =>
            p === "…" ? (
              <span
                key={`gap-${i}`}
                className="w-8 h-8 flex items-center justify-center rounded-[10px] border border-black/[0.08] text-xs font-semibold text-black/40 select-none"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`w-8 h-8 rounded-[10px] text-xs font-semibold transition-all ${page === p ? `${TOOLBAR_GRADIENT} text-white` : "border border-black/[0.08] text-black/50 hover:border-[#001f3f]/30 hover:text-[#001f3f]"}`}
              >
                {p}
              </button>
            ),
          )}
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="w-8 h-8 flex items-center justify-center rounded-[10px] border border-black/[0.08] text-black/50 hover:text-[#001f3f] hover:border-[#001f3f]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Table shell (card + header + skeleton + empty state + footer) ─────────────
export function DataTable({
  columns,
  loading = false,
  empty = false,
  emptyState,
  skeletonRows = 5,
  children,
  page,
  perPage,
  total,
  totalPages,
  onPageChange,
  onPerPageChange,
  perPageOptions,
  sort,
  onSort,
}: {
  columns: DataTableColumn[]
  /** True while fetching. Shows skeleton only when there's no data yet. */
  loading?: boolean
  /** True when there are no rows to show. */
  empty?: boolean
  /** Custom empty-state content (defaults to a simple "No records found"). */
  emptyState?: ReactNode
  skeletonRows?: number
  /** The <tr> rows (rendered inside <tbody>). */
  children?: ReactNode
  // Pagination (footer shows when total > 0)
  page: number
  perPage: number
  total: number
  totalPages: number
  onPageChange: (page: number) => void
  onPerPageChange: (perPage: number) => void
  perPageOptions?: number[]
  /** Current sort (column sortKey + direction) — drives the header indicator. */
  sort?: { key: string; dir: "asc" | "desc" } | null
  /** Called with a column's sortKey when its (sortable) header is clicked. */
  onSort?: (key: string) => void
}) {
  const colCount = columns.length

  return (
    <div className="bg-white rounded-[18px] border border-black/[0.08] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[0.08] bg-[#fafafb]">
              {columns.map((c) => {
                const label = typeof c === "string" ? c : c.label
                const cls = typeof c === "string" ? "" : (c.className ?? "")
                const sortKey = typeof c === "string" ? undefined : c.sortKey
                const sortable = Boolean(sortKey && onSort)
                const active = sortable && sort?.key === sortKey
                return (
                  <th
                    key={label}
                    className={`text-left font-['Outfit'] text-[11px] font-bold text-black/45 uppercase tracking-wider px-3 py-3.5 whitespace-nowrap first:pl-6 last:pr-6 ${cls}`}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => onSort?.(sortKey as string)}
                        className="group/sort inline-flex items-center gap-1 hover:text-[#001f3f] transition-colors"
                        aria-label={`Sort by ${label}`}
                      >
                        {label}
                        {active ? (
                          sort?.dir === "asc"
                            ? <ChevronUp className="w-3.5 h-3.5 text-[#001f3f]" />
                            : <ChevronDown className="w-3.5 h-3.5 text-[#001f3f]" />
                        ) : (
                          <ChevronsUpDown className="w-3.5 h-3.5 text-black/20 group-hover/sort:text-black/40" />
                        )}
                      </button>
                    ) : (
                      label
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.05]">
            {/* Skeleton only on the first load (no data yet). On refetches keep
                the current rows visible — the caller's refresh button spins. */}
            {loading && empty ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: colCount }).map((_, j) => (
                    <td key={j} className="px-3 py-4 first:pl-6 last:pr-6">
                      <div className={`h-3 rounded-full bg-[#f0f2f5] animate-pulse ${j === 0 ? "w-32" : j === colCount - 1 ? "w-20" : "w-24"}`} />
                    </td>
                  ))}
                </tr>
              ))
            ) : empty ? (
              <tr>
                <td colSpan={colCount} className="px-6 py-12 text-center">
                  {emptyState ?? <p className="text-sm font-medium text-black/45">No records found</p>}
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <TablePagination
          page={page}
          perPage={perPage}
          total={total}
          totalPages={totalPages}
          onPageChange={onPageChange}
          onPerPageChange={onPerPageChange}
          perPageOptions={perPageOptions}
        />
      )}
    </div>
  )
}

export default DataTable
