"use client"

import { cn } from "@/lib/utils"

export function DeveloperPortalPageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description: string
  /** Kept for call-site compatibility; the in-page breadcrumb was removed in
   *  favor of the global dashboard breadcrumb (avoids a duplicate crumb). */
  segmentLabel?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0d1117]">
            {title}
          </h2>
          <p className="text-sm text-[#6b7280] mt-1 max-w-2xl leading-relaxed">
            {description}
          </p>
        </div>
        {actions ? <div className="shrink-0 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}
