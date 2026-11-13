"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { ExternalLink, Pencil, Trash2, X } from "lucide-react"
import {
  ENTRY_AUDIENCES,
  ENTRY_AUDIENCE_LABELS,
  ENTRY_KINDS,
  ENTRY_KIND_LABELS,
  LAYER_LABELS,
  type CalendarEntry,
  type CalendarEntryInput,
  type CalendarItem,
} from "@/lib/calendar/types"
import { Chip } from "./views"
import { colourOf, longDayLabel } from "./ui"

/**
 * The admin Calendar's slide-overs: one item's detail, one day's list, and the
 * Add / Edit entry form (migration 090). Same shell as My Team's member panel.
 */

function Panel({ title, eyebrow, onClose, children, footer, wide = false }: { title: string; eyebrow?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeRef.current?.focus()
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default bg-[#0d1117]/45 backdrop-blur-[2px] animate-in fade-in duration-200" />
      <aside className={`relative flex h-full w-full flex-col bg-[#f4f6f9] shadow-2xl animate-in slide-in-from-right duration-200 ${wide ? "max-w-[520px]" : "max-w-[440px]"}`}>
        <header className="bg-[#001f3f] px-5 pb-4 pt-4 text-white">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {eyebrow ? <div className="mb-1.5 flex flex-wrap items-center gap-1.5">{eyebrow}</div> : null}
              <h2 className="font-['Outfit'] text-[20px] font-bold leading-[26px]">{title}</h2>
            </div>
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <footer className="border-t border-[#e8eaed] bg-white px-5 py-3">{footer}</footer> : null}
      </aside>
    </div>
  )
}

const Tag = ({ children, gold = false }: { children: ReactNode; gold?: boolean }) => (
  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold tracking-[0.1em] ${gold ? "bg-[#d6b357]/25 text-[#d6b357]" : "bg-white/15 text-[#e2e8f0]"}`}>{children}</span>
)

export function DetailSheet({ item, base, onClose, onEdit }: { item: CalendarItem; base: string; onClose: () => void; onEdit: (entry: CalendarEntry) => void }) {
  return (
    <Panel
      title={item.title}
      onClose={onClose}
      eyebrow={
        <>
          <Tag>{LAYER_LABELS[item.layer].toUpperCase()}</Tag>
          {item.dayOf ? <Tag gold>DAY {item.dayOf.day} OF {item.dayOf.of}</Tag> : null}
          {item.tone === "warn" ? <Tag gold>NEEDS A LOOK</Tag> : null}
        </>
      }
      footer={
        item.links.length || item.entry ? (
          <div className="flex flex-wrap gap-2">
            {item.entry ? (
              <button type="button" onClick={() => onEdit(item.entry as CalendarEntry)} className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#001f3f] px-3.5 py-2 text-[14px] font-semibold text-white hover:bg-[#002b57]">
                <Pencil className="h-4 w-4" /> Edit entry
              </button>
            ) : null}
            {item.links.map((l) => {
              const href = l.dash ? `${base}${l.dash}` : l.url ?? "#"
              const external = !!l.url && /^https?:\/\//.test(l.url)
              return (
                <a
                  key={l.label}
                  href={href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[14px] font-semibold ${item.entry ? "border border-[#e8eaed] bg-white text-[#001f3f] hover:bg-[#f4f6f9]" : "bg-[#001f3f] text-white hover:bg-[#002b57]"}`}
                >
                  {l.label}
                  {l.url ? <ExternalLink className="h-3.5 w-3.5" /> : null}
                </a>
              )
            })}
          </div>
        ) : null
      }
    >
      <p className="mb-3 text-[14px] text-[#6b7280]">{longDayLabel(item.date)}{item.timeLabel ? ` · ${item.timeLabel}` : item.time ? ` · ${item.time}` : ""}</p>
      <dl className="flex flex-col gap-2.5 rounded-2xl border border-[#e8eaed] bg-white p-4">
        {item.details.map((d, i) => (
          <div key={`${d.label}-${i}`} className="flex gap-3">
            <dt className="w-[96px] shrink-0 text-[13px] text-[#6b7280]">{d.label}</dt>
            <dd className="min-w-0 whitespace-pre-line text-[14px] font-medium text-[#111827]">{d.value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}

export function DaySheet({ day, items, onClose, onItem, onAdd }: { day: string; items: CalendarItem[]; onClose: () => void; onItem: (item: CalendarItem) => void; onAdd: (() => void) | null }) {
  return (
    <Panel
      title={longDayLabel(day)}
      onClose={onClose}
      eyebrow={<Tag>{items.length ? `${items.length} ITEM${items.length === 1 ? "" : "S"}` : "NOTHING YET"}</Tag>}
      footer={
        onAdd ? (
          <button type="button" onClick={onAdd} className="rounded-[10px] bg-[#d6b357] px-3.5 py-2 font-['Outfit'] text-[14px] font-bold text-[#001428] hover:bg-[#c9a449]">
            Add entry on this day
          </button>
        ) : null
      }
    >
      {items.length ? (
        <div className="flex flex-col gap-2">
          {items.map((it) => (
            <div key={it.id} className="rounded-xl border border-[#e8eaed] bg-white p-2">
              <Chip item={it} onClick={() => onItem(it)} full />
              {it.subtitle ? <p className="mt-1 px-1.5 text-[13px] text-[#6b7280]">{it.subtitle}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[14px] text-[#6b7280]">Nothing on this day for the layers switched on.</p>
      )}
    </Panel>
  )
}

// ─── Add / Edit entry ────────────────────────────────────────────────────────

export type TeamOption = { id: string; name: string }

type FormState = {
  title: string
  kind: CalendarEntryInput["kind"]
  starts_on: string
  ends_on: string
  multiDay: boolean
  all_day: boolean
  start_time: string
  end_time: string
  place: string
  link: string
  notes: string
  audience: CalendarEntryInput["audience"]
  team_id: string
  notify_morning: boolean
}

const blank = (day: string): FormState => ({
  title: "",
  kind: "meeting",
  starts_on: day,
  ends_on: day,
  multiDay: false,
  all_day: false,
  start_time: "10:00",
  end_time: "",
  place: "",
  link: "",
  notes: "",
  audience: "admins",
  team_id: "",
  notify_morning: false,
})

const fromEntry = (e: CalendarEntry): FormState => ({
  title: e.title,
  kind: e.kind,
  starts_on: e.starts_on,
  ends_on: e.ends_on,
  multiDay: e.ends_on !== e.starts_on,
  all_day: e.all_day,
  start_time: e.start_time ?? "10:00",
  end_time: e.end_time ?? "",
  place: e.place ?? "",
  link: e.link ?? "",
  notes: e.notes ?? "",
  audience: e.audience,
  team_id: e.team_id ?? "",
  notify_morning: e.notify_morning,
})

const field = "w-full rounded-[10px] border border-[#d1d5db] bg-white px-3 py-2.5 text-[15px] text-[#111827] outline-none focus:border-[#001f3f] focus:ring-2 focus:ring-[#001f3f]/15"
const label = "text-[13px] font-semibold text-[#374151]"

export function EntrySheet({
  entry,
  day,
  teams,
  onClose,
  onSaved,
  onDeleted,
}: {
  entry: CalendarEntry | null
  day: string
  teams: TeamOption[]
  onClose: () => void
  onSaved: (entry: CalendarEntry) => void
  onDeleted: (id: string) => void
}) {
  const [f, setF] = useState<FormState>(() => (entry ? fromEntry(entry) : blank(day)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }))

  const payload = (): CalendarEntryInput => ({
    title: f.title.trim(),
    kind: f.kind,
    starts_on: f.starts_on,
    ends_on: f.multiDay && f.ends_on ? f.ends_on : f.starts_on,
    start_time: f.all_day ? null : f.start_time || null,
    end_time: f.all_day ? null : f.end_time || null,
    all_day: f.all_day,
    place: f.place.trim() || null,
    link: f.link.trim() || null,
    notes: f.notes.trim() || null,
    audience: f.audience,
    team_id: f.audience === "team" ? f.team_id || null : null,
    notify_morning: f.notify_morning,
  })

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(entry ? `/api/admin/calendar/entries/${entry.id}` : "/api/admin/calendar/entries", {
        method: entry ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload()),
      })
      const json = (await res.json().catch(() => ({}))) as { entry?: CalendarEntry; error?: string }
      if (!res.ok || !json.entry) throw new Error(json.error ?? `Request failed (${res.status}).`)
      onSaved(json.entry)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!entry) return
    if (!window.confirm(`Remove "${entry.title}" from the calendar?`)) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/calendar/entries/${entry.id}`, { method: "DELETE" })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error ?? `Request failed (${res.status}).`)
      onDeleted(entry.id)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Panel
      title={entry ? "Edit entry" : "Add entry"}
      onClose={onClose}
      wide
      eyebrow={<Tag>{entry ? "COMPANY ENTRY" : "ONLY ADMINS SEE THIS"}</Tag>}
      footer={
        <div className="flex items-center gap-2">
          <button type="button" onClick={save} disabled={busy} className="flex-1 rounded-[10px] bg-[#d6b357] px-3.5 py-2.5 font-['Outfit'] text-[15px] font-bold text-[#001428] hover:bg-[#c9a449] disabled:opacity-60">
            {busy ? "Saving…" : entry ? "Save changes" : "Save entry"}
          </button>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-[10px] border border-[#e8eaed] bg-white px-3.5 py-2.5 text-[15px] font-semibold text-[#374151] hover:bg-[#f4f6f9]">
            Cancel
          </button>
          {entry ? (
            <button type="button" onClick={remove} disabled={busy} aria-label="Remove entry" title="Remove entry" className="ml-auto flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#fecdd3] bg-white text-[#be123c] hover:bg-[#fff1f2]">
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        {error ? <p className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-3 py-2 text-[14px] text-[#be123c]">{error}</p> : null}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ce-title" className={label}>Title</label>
          <input id="ce-title" type="text" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Sales meeting" maxLength={140} className={field} autoFocus />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ce-kind" className={label}>Kind</label>
          <select id="ce-kind" value={f.kind} onChange={(e) => set("kind", e.target.value as FormState["kind"])} className={field}>
            {ENTRY_KINDS.map((k) => (
              <option key={k} value={k}>{ENTRY_KIND_LABELS[k]}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ce-date" className={label}>{f.multiDay ? "First day" : "Date"}</label>
            <input id="ce-date" type="date" value={f.starts_on} onChange={(e) => set("starts_on", e.target.value)} className={field} required />
          </div>
          {f.multiDay ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ce-end" className={label}>Last day</label>
              <input id="ce-end" type="date" value={f.ends_on} min={f.starts_on} onChange={(e) => set("ends_on", e.target.value)} className={field} />
            </div>
          ) : (
            <div className="flex items-end">
              <button type="button" onClick={() => { set("multiDay", true); set("ends_on", f.ends_on > f.starts_on ? f.ends_on : f.starts_on) }} className="pb-2.5 text-[14px] font-semibold text-[#0369a1] hover:underline">
                More than one day
              </button>
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-[14px] text-[#374151]">
          <input type="checkbox" checked={f.all_day} onChange={(e) => set("all_day", e.target.checked)} className="h-4 w-4 accent-[#001f3f]" />
          All day
        </label>
        {!f.all_day ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ce-start" className={label}>Starts</label>
              <input id="ce-start" type="time" value={f.start_time} onChange={(e) => set("start_time", e.target.value)} className={field} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ce-endtime" className={label}>Ends <span className="font-normal text-[#9ca3af]">(optional)</span></label>
              <input id="ce-endtime" type="time" value={f.end_time} onChange={(e) => set("end_time", e.target.value)} className={field} />
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ce-place" className={label}>Place <span className="font-normal text-[#9ca3af]">(optional)</span></label>
          <input id="ce-place" type="text" value={f.place} onChange={(e) => set("place", e.target.value)} placeholder="Business Bay office, meeting room 2" maxLength={200} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ce-link" className={label}>Link <span className="font-normal text-[#9ca3af]">(optional)</span></label>
          <input id="ce-link" type="text" value={f.link} onChange={(e) => set("link", e.target.value)} placeholder="Zoom, Google Meet or a document" maxLength={500} className={field} />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className={`${label} mb-1.5`}>Who it is for</legend>
          {ENTRY_AUDIENCES.map((a) => (
            <label key={a} className="flex items-center gap-2 text-[14px] text-[#374151]">
              <input type="radio" name="audience" value={a} checked={f.audience === a} onChange={() => set("audience", a)} className="h-4 w-4 accent-[#001f3f]" />
              {ENTRY_AUDIENCE_LABELS[a]}
              {a === "leaders" ? <span className="text-[12px] text-[#9ca3af]">team leaders and unit managers</span> : null}
            </label>
          ))}
          {f.audience === "team" ? (
            <select aria-label="Team" value={f.team_id} onChange={(e) => set("team_id", e.target.value)} className={`${field} mt-1`}>
              <option value="">Pick the team…</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          ) : null}
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ce-notes" className={label}>Notes <span className="font-normal text-[#9ca3af]">(optional)</span></label>
          <textarea id="ce-notes" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} maxLength={2000} className={`${field} resize-y`} />
        </div>
        <label className="flex items-start gap-2 text-[14px] text-[#374151]">
          <input type="checkbox" checked={f.notify_morning} onChange={(e) => set("notify_morning", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#001f3f]" />
          <span>
            Email the people it is for on the morning
            <span className="block text-[12px] text-[#9ca3af]">At 09:00 Dubai on the first day, once.{entry?.notified_on ? ` Already sent on ${entry.notified_on}.` : ""}</span>
          </span>
        </label>
      </form>
    </Panel>
  )
}

export { colourOf }
