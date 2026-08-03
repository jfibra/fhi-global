"use client"

// Dropdown for the dashboard filter bars.
//
// A native <select> renders its popup through the OS, so it can't be themed and
// it can't do anything clever — which showed on the Sales Report, where picking
// an agent meant scrolling ~200 unstyled rows. This is the same navy/gold
// language as PillSelect but with a search box once the list is long enough to
// need one, and a popup that can be wider than its trigger so the trigger stays
// narrow without truncating the options.
//
// Radix Popover + cmdk rather than Radix Select: Select owns typing for its own
// typeahead, so a search field inside it fights the component.

import * as React from "react"
import * as Popover from "@radix-ui/react-popover"
import { Command } from "cmdk"
import { Check, ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"

export type FilterSelectOption = { label: string; value: string; hint?: string }

/** Below this many options a search box is more clutter than help. */
const SEARCH_THRESHOLD = 8

export function FilterSelect({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  ariaLabel,
  title,
  className,
  searchPlaceholder = "Search…",
  align = "start",
}: {
  value: string
  onValueChange: (value: string) => void
  options: FilterSelectOption[]
  /** Shown when nothing matches `value` — e.g. "All Agents". */
  placeholder?: string
  disabled?: boolean
  ariaLabel?: string
  title?: string
  className?: string
  searchPlaceholder?: string
  align?: "start" | "end"
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  const selected = options.find((o) => o.value === value)
  const showSearch = options.length > SEARCH_THRESHOLD

  // Clear the query as it closes, not in an effect: a stale query would
  // silently hide options the next time it opens.
  const handleOpenChange = (next: boolean) => {
    if (disabled) return
    if (!next) setQuery("")
    setOpen(next)
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          title={title}
          className={cn(
            "group shrink-0 inline-flex items-center gap-2 max-w-[200px] pl-3.5 pr-3 py-2.5 rounded-2xl",
            "border border-[#e5e5e5] bg-white/80 text-sm text-[#0f2940] transition-colors",
            "hover:border-[#001f3f]/25 focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5",
            "data-[state=open]:border-[#001f3f] data-[state=open]:ring-4 data-[state=open]:ring-[#001f3f]/5",
            "disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer",
            className,
          )}
        >
          <span className={cn("flex-1 truncate text-left", !selected && "text-[#6b7280]")}>
            {selected?.label ?? placeholder ?? "Select…"}
          </span>
          <ChevronDown className="w-4 h-4 shrink-0 text-[#9ca3af] transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={6}
          // Never narrower than the trigger, never taller than the viewport.
          style={{
            minWidth: "var(--radix-popover-trigger-width)",
            maxHeight: "min(22rem, var(--radix-popover-content-available-height))",
          }}
          className="z-[140] w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#e8eaed] bg-white shadow-[0_18px_50px_-12px_rgba(0,20,40,0.35)]"
        >
          <Command
            // Items are keyed by their real value (a uuid for agents), because
            // two agents can share a display name — "Lito Bibon" appears twice
            // — and cmdk treats equal values as the same item. The label rides
            // along as a keyword so search still matches what's on screen and
            // never against a uuid the user can't see.
            filter={(itemValue, search, keywords) => {
              const label = keywords?.[0] ?? itemValue
              return label.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0
            }}
            className="flex flex-col max-h-[inherit]"
          >
            {showSearch && (
              <div className="relative shrink-0 border-b border-[#f0f2f5]">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9ca3af]" />
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder={searchPlaceholder}
                  className="w-full bg-transparent pl-9 pr-3 py-3 text-sm text-[#0f2940] placeholder:text-[#9ca3af] focus:outline-none"
                />
              </div>
            )}

            <Command.List className="overflow-y-auto overscroll-contain p-1.5">
              <Command.Empty className="px-3.5 py-6 text-center text-sm text-[#9ca3af]">
                No matches
              </Command.Empty>

              {options.map((o) => {
                const isSelected = o.value === value
                return (
                  <Command.Item
                    key={o.value}
                    value={o.value}
                    keywords={[o.label]}
                    onSelect={() => { onValueChange(o.value); setOpen(false) }}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center gap-2 rounded-xl py-2.5 pl-3.5 pr-9 text-sm",
                      "text-[#0f2940] outline-none transition-colors",
                      "data-[selected=true]:bg-[#d6b357]/15 data-[selected=true]:text-[#001f3f]",
                      isSelected && "font-bold",
                    )}
                  >
                    <span className="flex-1 truncate">{o.label}</span>
                    {o.hint && <span className="text-xs text-[#9ca3af] shrink-0">{o.hint}</span>}
                    {isSelected && (
                      <Check className="absolute right-3 w-4 h-4 text-[#d6b357]" />
                    )}
                  </Command.Item>
                )
              })}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
