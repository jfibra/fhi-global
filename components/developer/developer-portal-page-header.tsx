"use client"

import Link from "next/link"
import { ChevronRight, LayoutDashboard } from "lucide-react"
import { cn } from "@/lib/utils"

const DEVELOPER_HOME = "/developer"

export function DeveloperPortalPageHeader({
  title,
  description,
  segmentLabel,
  actions,
  className,
}: {
  title: string
  description: string
  /** Shown in the breadcrumb after “Developer portal”. */
  segmentLabel: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <nav
        className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-[#9ca3af]"
        aria-label="Breadcrumb"
      >
        <Link
          href={DEVELOPER_HOME}
          className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1 -ml-2 text-[#6b7280] hover:text-[#001f3f] hover:bg-[#001f3f]/6 transition-colors"
        >
          <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
          Developer portal
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-[#d1d5db] shrink-0" aria-hidden />
        <span className="text-[#0d1117] font-semibold">{segmentLabel}</span>
      </nav>
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
