"use client"

import { useEffect } from "react"
import { captureUtm } from "@/lib/utm"

/**
 * Remembers the campaign (utm_*) a visitor landed with, so a lead form on any
 * later page can report it. Mounted once in the root layout, which persists
 * across client navigations — it runs on the page the visitor arrived on.
 * Renders nothing.
 */
export function UtmCapture() {
  useEffect(() => {
    captureUtm()
  }, [])
  return null
}
