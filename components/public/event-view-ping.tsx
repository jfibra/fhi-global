"use client"

import { useEffect } from "react"

/**
 * Counts a visit to the event page (and whether it came from a QR scan via
 * ?src=qr). Renders nothing. sessionStorage keeps refreshes in the same tab
 * from inflating the numbers.
 */
export function EventViewPing({ eventId }: { eventId: string }) {
  useEffect(() => {
    const key = `event-visit-${eventId}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, "1")
    } catch {
      // private mode without storage — still count the visit
    }
    const fromQr = new URLSearchParams(window.location.search).get("src") === "qr"
    void fetch("/api/events/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, fromQr }),
      keepalive: true,
    }).catch(() => {})
  }, [eventId])

  return null
}
