"use client"

import { useEffect, useState } from "react"
import { COMPANY } from "@/lib/company"

/**
 * The time in Dubai right now and whether the office is open, from the
 * published hours in lib/company.ts (the same ones /contact prints and the
 * structured data states — this widget used to carry its own copy of them).
 * Hour granularity: the hours are whole hours. Renders nothing until mounted
 * so the server never prints a stale minute.
 */
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const OPEN_DAYS = new Set(COMPANY.hours.days.map((d) => DAY_NAMES.indexOf(d)).filter((i) => i >= 0))
const OPEN_HOUR = Number.parseInt(COMPANY.hours.opens, 10)
const CLOSE_HOUR = Number.parseInt(COMPANY.hours.closes, 10)
/** 9 → "9:00 AM", 18 → "6:00 PM" */
const hourLabel = (h24: number) => `${h24 % 12 || 12}:00 ${h24 < 12 ? "AM" : "PM"}`

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
        // Next opening: today at opening time if it is an open day and still before it, else the next open day.
        let d = weekday
        const today = OPEN_DAYS.has(d) && hour24 < OPEN_HOUR
        // Bounded to one week: with no open day configured (an empty or misspelt list in lib/company.ts) the
        // search would otherwise never end and freeze the page.
        for (let step = 0; !today && step < 7 && (step === 0 || !OPEN_DAYS.has(d)); step++) d = (d + 1) % 7
        next = OPEN_DAYS.size === 0 ? "check our opening hours" : today ? `opens ${hourLabel(OPEN_HOUR)} today` : `opens ${DAY_NAMES[d]} ${hourLabel(OPEN_HOUR)}`
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
      <span>{state.open ? `Office open until ${hourLabel(CLOSE_HOUR)}` : `Office closed, ${state.next}`}</span>
    </span>
  )
}
