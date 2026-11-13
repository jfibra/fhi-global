"use client"

import type { CalendarItem } from "@/lib/calendar/types"
import { byDay, colourOf, dayLabel, dayNumber, longDayLabel, monthGrid, shiftDay, weekdayLong, weekdayShort, WEEKDAYS } from "./ui"

/**
 * The admin Calendar's three views. Each draws the items it is given (already
 * filtered to the layers switched on) and reports clicks up: an item for the
 * detail sheet, a day for the day sheet. No fetching here.
 */

type Common = {
  items: CalendarItem[]
  today: string
  onItem: (item: CalendarItem) => void
  onDay: (day: string) => void
}

/** One block in a cell or a row. */
export function Chip({ item, onClick, full = false }: { item: CalendarItem; onClick: () => void; full?: boolean }) {
  const c = colourOf(item)
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${item.title}${item.subtitle ? ` · ${item.subtitle}` : ""}`}
      className={`block w-full rounded-md px-1.5 py-[3px] text-left text-[12px] font-medium leading-4 transition-colors hover:brightness-95 ${full ? "" : "truncate"}`}
      style={{ background: c.bg, color: c.text }}
    >
      {item.time && !item.title.startsWith(item.time) ? <span className="font-semibold">{item.time} </span> : null}
      {item.title}
    </button>
  )
}

const MAX_CHIPS = 4

export function MonthView({ month, items, today, onItem, onDay }: Common & { month: string }) {
  const rows = monthGrid(month)
  const groups = byDay(items)
  const inMonth = (d: string) => d.slice(0, 7) === month.slice(0, 7)
  return (
    <section aria-label={`Month view`} className="overflow-hidden rounded-2xl border border-[#e8eaed] bg-white shadow-[0_2px_12px_-2px_rgba(0,31,63,0.06)]">
      <div className="grid grid-cols-7 border-b border-[#e8eaed] bg-[#f8fafc]">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-2.5 text-[11px] font-bold tracking-[0.08em] text-[#6b7280] sm:px-3 sm:text-[12px]">
            {w}
          </div>
        ))}
      </div>
      {rows.map((row, ri) => (
        <div key={row[0]} className={`grid grid-cols-7 ${ri < rows.length - 1 ? "border-b border-[#e8eaed]" : ""}`}>
          {row.map((day, ci) => {
            const list = groups.get(day) ?? []
            const isToday = day === today
            const muted = !inMonth(day)
            const shown = list.slice(0, MAX_CHIPS)
            const more = list.length - shown.length
            return (
              <div
                key={day}
                className={`flex min-h-[72px] flex-col gap-1 p-1 sm:min-h-[112px] sm:p-2 ${ci < 6 ? "border-r border-[#f0f2f5]" : ""} ${muted ? "bg-[#fafbfc]" : ""} ${isToday ? "bg-[#f0f7ff] shadow-[inset_0_0_0_2px_#001f3f]" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => onDay(day)}
                  aria-label={`${longDayLabel(day)}, ${list.length} item${list.length === 1 ? "" : "s"}`}
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-semibold transition-colors hover:bg-[#e8eaed] ${isToday ? "bg-[#001f3f] text-white hover:bg-[#001f3f]" : muted ? "text-[#9ca3af]" : "text-[#374151]"}`}
                >
                  {dayNumber(day)}
                </button>
                {/* Wide screens: chips. Phones: dots, the day opens the list. */}
                <div className="hidden flex-col gap-1 sm:flex">
                  {shown.map((it) => (
                    <Chip key={it.id} item={it} onClick={() => onItem(it)} />
                  ))}
                  {more > 0 ? (
                    <button type="button" onClick={() => onDay(day)} className="px-1 text-left text-[12px] font-semibold text-[#0369a1] hover:underline">
                      {more} more
                    </button>
                  ) : null}
                </div>
                {list.length ? (
                  <button type="button" onClick={() => onDay(day)} aria-label={`Open ${dayLabel(day)}`} className="flex flex-wrap gap-0.5 px-0.5 sm:hidden">
                    {list.slice(0, 6).map((it) => (
                      <span key={it.id} className="h-1.5 w-1.5 rounded-full" style={{ background: colourOf(it).dot }} />
                    ))}
                    {list.length > 6 ? <span className="text-[10px] font-semibold text-[#6b7280]">+{list.length - 6}</span> : null}
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      ))}
    </section>
  )
}

function Row({ item, onClick }: { item: CalendarItem; onClick: () => void }) {
  const c = colourOf(item)
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] px-3 py-2.5 text-left transition-[filter] hover:brightness-95"
      style={{ background: c.bg, color: c.text }}
    >
      <span className="w-[92px] shrink-0 text-[13px] font-bold">{item.timeLabel ?? item.time ?? "All day"}</span>
      <span className="min-w-0 flex-1 basis-[200px] text-[15px] font-semibold">{item.title}</span>
      {item.subtitle ? <span className="min-w-0 basis-full text-[13px] sm:basis-auto sm:flex-1">{item.subtitle}</span> : null}
    </button>
  )
}

export function WeekView({ monday, items, today, onItem, onDay }: Common & { monday: string }) {
  const groups = byDay(items)
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(monday, i))
  return (
    <section aria-label="Week view" className="overflow-hidden rounded-2xl border border-[#e8eaed] bg-white shadow-[0_2px_12px_-2px_rgba(0,31,63,0.06)]">
      {days.map((day, i) => {
        const list = groups.get(day) ?? []
        const isToday = day === today
        const weekend = i >= 5
        return (
          <div key={day} className={`flex gap-3 px-3 py-3.5 sm:gap-4 sm:px-[18px] ${i < 6 ? "border-b border-[#e8eaed]" : ""} ${weekend ? "bg-[#fafbfc]" : ""} ${isToday ? "bg-[#f0f7ff]" : ""}`}>
            <button type="button" onClick={() => onDay(day)} className="flex w-14 shrink-0 flex-col items-start sm:w-16" aria-label={`Open ${longDayLabel(day)}`}>
              <span className="text-[11px] font-bold tracking-[0.1em] text-[#6b7280]">{weekdayShort(day)}</span>
              <span className={`font-['Outfit'] text-[24px] font-bold leading-7 ${isToday ? "rounded-full bg-[#001f3f] px-2 text-white" : "text-[#001f3f]"}`}>{dayNumber(day)}</span>
            </button>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {list.length ? (
                list.map((it) => <Row key={it.id} item={it} onClick={() => onItem(it)} />)
              ) : (
                <div className="flex items-center rounded-[10px] border border-dashed border-[#d1d5db] px-3 py-2.5 text-[14px] text-[#6b7280]">Nothing scheduled.</div>
              )}
            </div>
          </div>
        )
      })}
    </section>
  )
}

export function AgendaView({ items, today, onItem, onDay, days }: Common & { days: number }) {
  const groups = byDay(items)
  const list = Array.from({ length: days }, (_, i) => shiftDay(today, i)).filter((d) => (groups.get(d) ?? []).length)
  if (!list.length) {
    return <div className="rounded-2xl border border-[#e8eaed] bg-white p-8 text-center text-[15px] text-[#6b7280]">Nothing in the next {days} days on the layers switched on.</div>
  }
  return (
    <div className="flex flex-col gap-4">
      {list.map((day) => (
        <section key={day} aria-label={longDayLabel(day)} className="flex flex-col gap-2">
          <button type="button" onClick={() => onDay(day)} className={`text-left text-[12px] font-bold tracking-[0.12em] ${day === today ? "text-[#001f3f]" : "text-[#6b7280]"}`}>
            {day === today ? "TODAY · " : ""}
            {weekdayShort(day)} {dayNumber(day)} {dayLabel(day).split(" ").pop()?.toUpperCase()}
            {day === shiftDay(today, 1) ? " · TOMORROW" : ""}
          </button>
          {(groups.get(day) ?? []).map((it) => {
            const c = colourOf(it)
            return (
              <button key={it.id} type="button" onClick={() => onItem(it)} className="flex items-center gap-3 rounded-[14px] border border-[#e8eaed] bg-white px-3.5 py-3 text-left transition-shadow hover:shadow-[0_4px_20px_-2px_rgba(0,31,63,0.10)]">
                <span className="h-11 w-2.5 shrink-0 rounded-full" style={{ background: c.dot }} aria-hidden="true" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold text-[#111827]">
                    {it.timeLabel && it.timeLabel !== "All day" ? <span className="text-[#6b7280]">{it.timeLabel} · </span> : null}
                    {it.title}
                  </span>
                  {it.subtitle ? <span className="text-[13px] text-[#6b7280]">{it.subtitle}</span> : null}
                </span>
              </button>
            )
          })}
        </section>
      ))}
    </div>
  )
}

export { weekdayLong }
