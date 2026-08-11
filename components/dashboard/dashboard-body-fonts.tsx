"use client"

import { useEffect } from "react"

/**
 * Stamps the dashboard font-variable classes onto <body>. The fonts load from
 * app/(users)/layout.tsx (so public pages never pay for them), but CSS custom
 * properties on the layout's wrapper div don't reach content portaled to
 * document.body — the Poster Studio (StudioModal) portals there and its
 * Urbanist/Great Vibes lookups would silently fall back to Geist.
 */
export function DashboardBodyFonts({ classNames }: { classNames: string }) {
  useEffect(() => {
    const classes = classNames.split(" ").filter(Boolean)
    document.body.classList.add(...classes)
    return () => document.body.classList.remove(...classes)
  }, [classNames])
  return null
}
