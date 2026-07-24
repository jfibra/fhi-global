"use client"

import type { ReactNode } from "react"
import { Search as SearchIcon, X as CloseIcon, RefreshCw } from "lucide-react"

export type HeaderToolbarProps = {
  /** Section title (rendered as an <h2>). */
  title: string
  /** Optional subtitle — a node so callers can pass a rich/highlighted count. */
  subtitle?: ReactNode
  /** Optional icon rendered inside the accent-gradient tile. */
  icon?: ReactNode

  /** Search field. Omit `value`/`onChange` to hide the search box entirely. */
  value?: string
  onChange?: (value: string) => void
  /** Custom clear handler; defaults to `onChange("")`. */
  onClear?: () => void
  placeholder?: string

  /** Show a gradient refresh button when provided. */
  onRefresh?: () => void
  /** Spins the refresh icon while true. */
  refreshing?: boolean

  /** Extra controls (filters, toggles, "Add" buttons) rendered on the right. */
  rightSlot?: ReactNode

  className?: string
}

const GRADIENT = "bg-gradient-to-b from-[#0a3d6b] to-[#001f3f]"

/**
 * Shared dashboard header + toolbar. Tailwind counterpart of
 * `filipinohomes-final/src/components/common/Search.tsx` (that one is MUI):
 * an accent-gradient icon tile, Outfit/`title` + subtitle, an optional search
 * field with a clear button, an optional refresh button, and a `rightSlot`
 * for page-specific controls.
 */
export function HeaderToolbar({
  title,
  subtitle,
  icon,
  value,
  onChange,
  onClear,
  placeholder = "Search…",
  onRefresh,
  refreshing = false,
  rightSlot,
  className = "",
}: HeaderToolbarProps) {
  const showSearch = typeof value === "string" && typeof onChange === "function"
  const clear = () => (onClear ? onClear() : onChange?.(""))

  return (
    <div
      className={`relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-[18px] border border-black/[0.08] bg-white px-4 py-3.5 md:px-5 md:py-4 mb-4 ${className}`}
    >
      {/* Title block */}
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[13px] text-white [&_svg]:h-5 [&_svg]:w-5 ${GRADIENT}`}>
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="font-['Outfit'] text-[17px] md:text-[19px] font-extrabold tracking-[-0.01em] leading-tight text-[#1d1d1f] truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 font-['Outfit'] text-[13px] font-medium text-black/55">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap md:flex-nowrap items-center gap-2 w-full md:w-auto md:ml-auto">
        {showSearch && (
          <div className="relative flex-1 md:flex-none">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-[#001f3f]" />
            <input
              type="text"
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              placeholder={placeholder}
              className="h-10 w-full md:w-[280px] rounded-[10px] border border-black/[0.14] bg-white pl-10 pr-9 text-sm font-semibold text-[#1d1d1f] placeholder:font-normal placeholder:text-black/50 focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/10 transition-all"
            />
            {value && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={clear}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-black/45 hover:text-black/70 transition-colors"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {onRefresh && (
          <button
            type="button"
            aria-label="Refresh"
            onClick={onRefresh}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-white transition-all hover:brightness-110 ${GRADIENT}`}
          >
            <RefreshCw className={`h-[18px] w-[18px] ${refreshing ? "animate-spin" : ""}`} />
          </button>
        )}

        {rightSlot && <div className="flex shrink-0 items-center gap-1.5">{rightSlot}</div>}
      </div>
    </div>
  )
}

export default HeaderToolbar
