"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

/** Radix items may not use empty-string values, so "" round-trips via a sentinel. */
const ANY = "__any__"

export type PillSelectOption = { label: string; value: string }

/**
 * Styled dropdown for the listing filter pills. Native <select> popups are
 * drawn by the OS and can't be themed, so this wraps Radix Select with the
 * site's navy/gold look while keeping a value/onValueChange contract identical
 * to the native controls (empty-string option values fully supported).
 */
export function PillSelect({
  value,
  onValueChange,
  options,
  disabled,
  className,
  ariaLabel,
  leftIcon,
}: {
  value: string
  onValueChange: (value: string) => void
  options: PillSelectOption[]
  disabled?: boolean
  className?: string
  ariaLabel?: string
  leftIcon?: React.ReactNode
}) {
  return (
    <SelectPrimitive.Root
      value={value === "" ? ANY : value}
      onValueChange={(v) => onValueChange(v === ANY ? "" : v)}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn(
          "group relative flex w-full items-center justify-between gap-2 rounded-full border border-[#d1d5db] bg-white py-2.5 text-sm text-[#0f2940] transition-colors",
          leftIcon ? "pl-11 pr-4" : "px-4",
          "focus:outline-none focus:ring-2 focus:ring-[#d6b357]/30 focus:border-[#d6b357] data-[state=open]:border-[#d6b357] disabled:opacity-60 disabled:cursor-not-allowed",
          className,
        )}
      >
        {leftIcon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 inline-flex" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        <span className="flex-1 truncate text-left">
          <SelectPrimitive.Value />
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-4 w-4 shrink-0 text-[#6b7280] transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-[80] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-[#e8eaed] bg-white shadow-[0_18px_50px_-12px_rgba(0,20,40,0.35)]"
        >
          <SelectPrimitive.Viewport className="p-1.5">
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value || ANY}
                value={o.value === "" ? ANY : o.value}
                className="relative flex cursor-pointer select-none items-center rounded-xl py-2.5 pl-3.5 pr-9 text-sm text-[#0f2940] outline-none transition-colors data-[highlighted]:bg-[#d6b357]/15 data-[highlighted]:text-[#001f3f] data-[state=checked]:font-bold"
              >
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-3 inline-flex items-center">
                  <Check className="h-4 w-4 text-[#d6b357]" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
