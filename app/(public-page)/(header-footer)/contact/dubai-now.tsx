"use client"

import { useEffect, useState } from "react"

/**
 * The time in Dubai right now and whether the office is open, from the
 * published hours (Sunday to Thursday, 9:00 to 18:00 Gulf Standard Time).
 * Renders nothing until mounted so the server never prints a stale minute.
 */
const OPEN_DAYS = new Set([0, 1, 2, 3, 4]) // Sun–Thu
const OPEN_HOUR = 9
const CLOSE_HOUR = 18
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function dubaiParts(now: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dubai",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
  const parts = fmt.formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"))
  const hour12 = Number(get("hour"))
  const period = get("dayPeriod").toUpperCase()
  const hour24 = (hour12 % 12) + (period === "PM" ? 12 : 0)
  return { weekday, hour24, label: `${get("hour")}:${get("minute")} ${period}` }
}

export function DubaiNow({ className = "" }: { className?: string }) {
  const [state, setState] = useState<{ time: string; open: boolean; next: string } | null>(null)

  useEffect(() => {
    const tick = () => {
      const { weekday, hour24, label } = dubaiParts(new Date())
      const open = OPEN_DAYS.has(weekday) && hour24 >= OPEN_HOUR && hour24 < CLOSE_HOUR
      let next = ""
      if (!open) {
        // Next opening: today at 9 if it is an open day and still morning, else the next open day.
        let d = weekday
        const today = OPEN_DAYS.has(d) && hour24 < OPEN_HOUR
        if (!today) {
          do d = (d + 1) % 7
          while (!OPEN_DAYS.has(d))
        }
        next = today ? "opens 9:00 AM today" : `opens ${DAY_NAMES[d]} 9:00 AM`
      }
      setState({ time: label, open, next })
    }
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [])

  if (!state) return <span className={`inline-block h-5 w-56 ${className}`} aria-hidden="true" />

  return (
    <span className={`inline-flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
      <span className="inline-flex items-center gap-2">
        <span className={`relative inline-flex h-2 w-2 rounded-full ${state.open ? "bg-emerald-400" : "bg-white/40"}`} aria-hidden="true">
          {state.open && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />}
        </span>
        <span className="tabular-nums">{state.time} in Dubai</span>
      </span>
      <span className="text-white/45" aria-hidden="true">·</span>
      <span>{state.open ? "Office open until 6:00 PM" : `Office closed, ${state.next}`}</span>
    </span>
  )
}
