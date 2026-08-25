"use client"

import type { AnchorHTMLAttributes, ReactNode } from "react"
import { gaEvent } from "@/lib/ga"

/**
 * An <a> that reports a GA4 lead event on click — used for the WhatsApp /
 * Call / Email actions so SEO success can be measured in leads, not visits.
 * Renders a plain anchor; tracking failure can never block the navigation.
 */
export function LeadLink({
  event,
  params,
  children,
  ...anchor
}: {
  event: string
  params?: Record<string, unknown>
  children: ReactNode
} & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a {...anchor} onClick={() => gaEvent(event, params)}>
      {children}
    </a>
  )
}
