"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { CalendarRange, ChevronLeft, ChevronRight, Plus, RefreshCw } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { isAdminStaffRole } from "@/lib/app-roles"
import { getDashboardRouteByRole } from "@/lib/auth"
import { fetchTeams } from "@/lib/team-service"
import { CALENDAR_LAYERS, DEFAULT_LAYERS, LAYER_LABELS, type CalendarEntry, type CalendarItem, type CalendarLayer } from "@/lib/calendar/types"
import type { CalendarFeed } from "@/lib/calendar/items"
import { DaySheet, DetailSheet, EntrySheet, type TeamOption } from "./sheets"
import { AgendaView, MonthView, WeekView } from "./views"
import { LAYER_COLOURS, dubaiToday, layersServerSnapshot, layersSnapshot, mondayOf, monthGrid, monthLabel, monthStart, nextMonthStart, parseLayers, prevMonthStart, shiftDay, storeLayers, subscribeLayers, weekLabel } from "./ui"

/**
 * Calendar — everything with a date on the admin side, in one place (boss via
 * Juliecor, 2026-11-13): events, project milestones, deals, birthdays,
 * owner-document expiries, company entries, UAE holidays and the automatic
 * emails, as layers over a month grid, a week list or a "coming up" list.
 * The blocks come from GET /api/admin/calendar (lib/calendar/items.ts); the
 * only thing admins type in here is a company entry (migration 090). Admin
 * staff only ("calendar" in SUB_PATH_ROLES).
 */

type View = "month" | "week" | "agenda"
type Feed = CalendarFeed & { today: string }

const AGENDA_DAYS = 30

export default function CalendarPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))
  const base = getDashboardRouteByRole(role)

  const [today, setToday] = useState(() => dubaiToday())
  const [view, setView] = useState<View>("month")
  /** The month (its first day) or the week (its Monday) in view. */
  const [anchor, setAnchor] = useState(() => monthStart(dubaiToday()))
  // Which layers are on — remembered per browser (ui.ts store), defaults on the server.
  const layersRaw = useSyncExternalStore(subscribeLayers, layersSnapshot, layersServerSnapshot)
  const layers = useMemo(() => parseLayers(layersRaw, DEFAULT_LAYERS).filter((l) => (CALENDAR_LAYERS as readonly string[]).includes(l)), [layersRaw])
  const [feed, setFeed] = useState<Feed | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<CalendarItem | null>(null)
  const [dayOpen, setDayOpen] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ entry: CalendarEntry | null; day: string } | null>(null)
  const [teams, setTeams] = useState<TeamOption[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const cache = useRef(new Map<string, Feed>())

  // The span the current view needs.
  const span = useMemo(() => {
    if (view === "month") {
      const rows = monthGrid(anchor)
      return { from: rows[0][0], to: rows[rows.length - 1][6] }
    }
    if (view === "week") return { from: anchor, to: shiftDay(anchor, 6) }
    return { from: today, to: shiftDay(today, AGENDA_DAYS - 1) }
  }, [view, anchor, today])

  const load = useCallback(
    async (from: string, to: string, fresh = false) => {
      const key = `${from}:${to}`
      const hit = fresh ? null : cache.current.get(key)
      if (hit) {
        setFeed(hit)
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/calendar?from=${from}&to=${to}`, { cache: "no-store" })
        const json = (await res.json().catch(() => ({}))) as Partial<Feed> & { error?: string }
        if (!res.ok || !json.items) throw new Error(json.error ?? `Request failed (${res.status}).`)
        const data = json as Feed
        cache.current.set(key, data)
        setFeed(data)
        if (data.today) setToday(data.today)
        setError(null)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!allowed) return
    void load(span.from, span.to)
  }, [allowed, span.from, span.to, load])

  const refresh = useCallback(() => {
    cache.current.clear()
    void load(span.from, span.to, true)
  }, [load, span.from, span.to])

  const toggleLayer = (l: CalendarLayer) => storeLayers(layers.includes(l) ? layers.filter((x) => x !== l) : [...layers, l])

  const visible = useMemo(() => (feed?.items ?? []).filter((it) => layers.includes(it.layer)), [feed, layers])
  const counts = useMemo(() => {
    const m = new Map<CalendarLayer, number>()
    for (const it of feed?.items ?? []) m.set(it.layer, (m.get(it.layer) ?? 0) + 1)
    return m
  }, [feed])

  const go = (dir: -1 | 1) => {
    if (view === "month") setAnchor(dir === 1 ? nextMonthStart(anchor) : prevMonthStart(anchor))
    else if (view === "week") setAnchor(shiftDay(anchor, dir * 7))
  }
  const goToday = () => setAnchor(view === "week" ? mondayOf(today) : monthStart(today))
  const switchView = (v: View) => {
    setView(v)
    if (v === "week") setAnchor((a) => (view === "month" ? mondayOf(a >= monthStart(today) && a <= shiftDay(nextMonthStart(a), -1) && a.slice(0, 7) === today.slice(0, 7) ? today : a) : a))
    if (v === "month") setAnchor((a) => monthStart(a))
  }

  const openEditor = async (entry: CalendarEntry | null, day: string) => {
    setSelected(null)
    setDayOpen(null)
    setEditor({ entry, day })
    if (!teams.length) {
      const { data } = await fetchTeams().catch(() => ({ data: null }))
      setTeams(((data ?? []) as Array<{ id: string; name: string; is_active?: boolean | null }>).filter((t) => t.is_active !== false).map((t) => ({ id: t.id, name: t.name })).sort((a, b) => a.name.localeCompare(b.name)))
    }
  }

  const afterWrite = (message: string) => {
    setEditor(null)
    setNotice(message)
    window.setTimeout(() => setNotice(null), 4000)
    refresh()
  }

  const title = view === "month" ? monthLabel(anchor) : view === "week" ? weekLabel(anchor) : `Next ${AGENDA_DAYS} days`
  const entriesOff = feed ? !feed.entriesAvailable : false

  if (!allowed) return null

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      {/* Title row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="flex items-center gap-2 font-['Outfit'] text-2xl font-bold text-[#0d1117]">
            <CalendarRange className="h-6 w-6 text-[#b8913f]" aria-hidden="true" />
            Calendar
          </h1>
          <p className="text-[14px] text-[#6b7280]">Everything with a date, in one place. Switch layers on and off below.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
        <div role="group" aria-label="View" className="flex rounded-xl border border-[#e8eaed] bg-white p-[3px]">
          {(["month", "week", "agenda"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => switchView(v)}
              className={`rounded-[9px] px-3.5 py-2 text-[14px] font-semibold transition-colors ${view === v ? "bg-[#001f3f] text-white" : "text-[#374151] hover:bg-[#f4f6f9]"}`}
            >
              {v === "month" ? "Month" : v === "week" ? "Week" : "Coming up"}
            </button>
          ))}
        </div>
        <div className="flex items-center rounded-xl border border-[#e8eaed] bg-white p-[3px]">
          <button type="button" onClick={() => go(-1)} disabled={view === "agenda"} aria-label={view === "week" ? "Previous week" : "Previous month"} className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] hover:bg-[#f4f6f9] disabled:opacity-30">
            <ChevronLeft className="h-[18px] w-[18px] text-[#374151]" />
          </button>
          <span className="min-w-[150px] px-2 text-center font-['Outfit'] text-[17px] font-bold text-[#001f3f]">{title}</span>
          <button type="button" onClick={() => go(1)} disabled={view === "agenda"} aria-label={view === "week" ? "Next week" : "Next month"} className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] hover:bg-[#f4f6f9] disabled:opacity-30">
            <ChevronRight className="h-[18px] w-[18px] text-[#374151]" />
          </button>
          <button type="button" onClick={goToday} disabled={view === "agenda"} className="rounded-r-[9px] border-l border-[#e8eaed] px-3 py-[7px] text-[14px] font-semibold text-[#374151] hover:bg-[#f4f6f9] disabled:opacity-30">
            Today
          </button>
          <button type="button" onClick={refresh} aria-label="Refresh" title="Refresh" className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] hover:bg-[#f4f6f9]">
            <RefreshCw className={`h-4 w-4 text-[#374151] ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => void openEditor(null, today)}
          disabled={entriesOff}
          title={entriesOff ? "The calendar entries table is not set up yet (migration 090)." : undefined}
          className="inline-flex items-center gap-2 rounded-xl bg-[#d6b357] px-4 py-2.5 font-['Outfit'] text-[15px] font-bold text-[#001428] shadow-md transition-all hover:-translate-y-0.5 hover:bg-[#c9a449] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        >
          <Plus className="h-[18px] w-[18px]" strokeWidth={2.5} />
          Add entry
        </button>
        </div>
      </div>

      {/* Layers */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#e8eaed] bg-white px-3.5 py-2.5">
        <span className="mr-1 text-[11px] font-bold tracking-[0.12em] text-[#6b7280]">LAYERS</span>
        {CALENDAR_LAYERS.map((l) => {
          const on = layers.includes(l)
          const c = LAYER_COLOURS[l]
          return (
            <label
              key={l}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-semibold transition-opacity"
              style={{ background: on ? c.bg : "#f4f6f9", color: on ? c.text : "#6b7280", opacity: on ? 1 : 0.8 }}
            >
              <input type="checkbox" checked={on} onChange={() => toggleLayer(l)} className="h-3.5 w-3.5" style={{ accentColor: c.text }} />
              {LAYER_LABELS[l]}
              <span className="font-medium">{counts.get(l) ?? 0}</span>
            </label>
          )
        })}
      </div>

      {notice ? <p className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3.5 py-2 text-[14px] text-[#166534]">{notice}</p> : null}
      {error ? (
        <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-3.5 py-2 text-[14px] text-[#be123c]">
          Couldn&apos;t load the calendar: {error}{" "}
          <button type="button" onClick={refresh} className="font-semibold underline">Try again</button>
        </p>
      ) : null}
      {feed?.failed.length ? (
        <p className="rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3.5 py-2 text-[14px] text-[#92400e]">
          Some layers could not be read this time: {feed.failed.map((f) => `${LAYER_LABELS[f.layer]} (${f.error})`).join("; ")}.
        </p>
      ) : null}
      {entriesOff ? <p className="rounded-xl border border-[#e8eaed] bg-white px-3.5 py-2 text-[14px] text-[#6b7280]">Company entries are not switched on yet: migration 090 has to be applied before admins can add meetings and trainings here.</p> : null}

      {/* The view */}
      <div className={loading && !feed ? "min-h-[400px] animate-pulse rounded-2xl border border-[#e8eaed] bg-white" : loading ? "opacity-70 transition-opacity" : ""}>
        {feed ? (
          view === "month" ? (
            <MonthView month={anchor} items={visible} today={today} onItem={setSelected} onDay={setDayOpen} />
          ) : view === "week" ? (
            <WeekView monday={anchor} items={visible} today={today} onItem={setSelected} onDay={setDayOpen} />
          ) : (
            <AgendaView items={visible} today={today} days={AGENDA_DAYS} onItem={setSelected} onDay={setDayOpen} />
          )
        ) : null}
      </div>

      {feed && !loading && !visible.length && !error ? <p className="text-center text-[14px] text-[#6b7280]">Nothing to show for the layers switched on.</p> : null}

      {selected ? <DetailSheet item={selected} base={base} onClose={() => setSelected(null)} onEdit={(entry) => void openEditor(entry, entry.starts_on)} /> : null}
      {dayOpen && !selected ? (
        <DaySheet
          day={dayOpen}
          items={visible.filter((it) => it.date === dayOpen)}
          onClose={() => setDayOpen(null)}
          onItem={(it) => setSelected(it)}
          onAdd={entriesOff ? null : () => void openEditor(null, dayOpen)}
        />
      ) : null}
      {editor ? (
        <EntrySheet
          entry={editor.entry}
          day={editor.day}
          teams={teams}
          onClose={() => setEditor(null)}
          onSaved={(e) => afterWrite(editor.entry ? `Saved "${e.title}".` : `Added "${e.title}" to the calendar.`)}
          onDeleted={() => afterWrite("Entry removed.")}
        />
      ) : null}
    </div>
  )
}
