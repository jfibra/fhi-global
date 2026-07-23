"use client"

/**
 * Admin event manager: create/edit branded events (logo, photo, date, venue),
 * publish them to the public /events section, generate a branded flyer with
 * the registration QR baked in (links to /events/<id>), and view who registered.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  CalendarDays, ChevronLeft, ChevronRight, Eye, FileImage, FileText, ImagePlus, Loader2,
  MapPin, Pencil, Plus, RefreshCw, ScanLine, Search, Trash2, Trophy, Users, X,
} from "lucide-react"
import { EventFlyerModal } from "./event-flyer-modal"
import { EventRaffle } from "./event-raffle"
import { EVENT_BRANDS, eventBrand } from "@/lib/events/brands"

type AdminEvent = {
  id: string
  slug: string | null
  title: string
  description: string | null
  brand: string
  imageUrl: string | null
  eventDate: string | null
  venue: string | null
  status: string
  registrationOpen: boolean
  createdAt: string
  registrationCount: number
  viewCount: number
  qrScanCount: number
}

type Registration = {
  id: string
  fullName: string
  email: string
  whatsapp: string | null
  createdAt: string
}

type FormState = {
  title: string
  description: string
  brand: string
  imageUrl: string
  eventDate: string // datetime-local value
  venue: string
  status: string
  registrationOpen: boolean
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  brand: "fhiglobal",
  imageUrl: "",
  eventDate: "",
  venue: "",
  status: "draft",
  registrationOpen: true,
}

// Event times are always Dubai time (GST, UTC+4 — no DST), regardless of the
// admin's machine timezone: entered as Dubai wall time, stored as the matching
// UTC instant, displayed back as Dubai time.
const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000

function toDubaiInput(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const t = new Date(d.getTime() + DUBAI_OFFSET_MS)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`
}

function fromDubaiInput(value: string): string {
  // datetime-local gives "YYYY-MM-DDTHH:mm" (sometimes with seconds)
  const withSeconds = value.length === 16 ? `${value}:00` : value
  const d = new Date(`${withSeconds}+04:00`)
  return Number.isNaN(d.getTime()) ? "" : d.toISOString()
}

function eventDateLabel(iso: string | null): string {
  if (!iso) return "Date TBA"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "Date TBA"
  return d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Dubai" }) +
    " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" }) + " GST"
}

export function EventsClient() {
  const [events, setEvents] = useState<AdminEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create / edit modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AdminEvent | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Flyer generator modal (carries the registration QR)
  const [origin, setOrigin] = useState("")
  const [flyerEvent, setFlyerEvent] = useState<AdminEvent | null>(null)

  // Registrations modal
  const [regEvent, setRegEvent] = useState<AdminEvent | null>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [regsLoading, setRegsLoading] = useState(false)

  // Search + pagination over the registrations table
  const REG_PAGE_SIZE = 10
  const [regQuery, setRegQuery] = useState("")
  const [regPage, setRegPage] = useState(1)

  const filteredRegs = useMemo(() => {
    const q = regQuery.trim().toLowerCase()
    if (!q) return registrations
    return registrations.filter(
      (r) => r.fullName.toLowerCase().includes(q) || r.email.toLowerCase().includes(q),
    )
  }, [registrations, regQuery])

  const regTotalPages = Math.max(1, Math.ceil(filteredRegs.length / REG_PAGE_SIZE))
  const regSafePage = Math.min(regPage, regTotalPages)
  const regPageItems = filteredRegs.slice((regSafePage - 1) * REG_PAGE_SIZE, regSafePage * REG_PAGE_SIZE)

  // Raffle (full-screen, drawn from the open event's registrations)
  const [raffleOpen, setRaffleOpen] = useState(false)

  // Registration row being deleted (dummy/test sign-ups cleanup)
  const [deletingRegId, setDeletingRegId] = useState<string | null>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/events", { cache: "no-store" })
      if (!res.ok) throw new Error("failed")
      const data = (await res.json()) as { events?: AdminEvent[] }
      setEvents(data.events ?? [])
    } catch {
      setError("Couldn't load events — refresh to try again.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (e: AdminEvent) => {
    setEditing(e)
    setForm({
      title: e.title,
      description: e.description ?? "",
      brand: e.brand,
      imageUrl: e.imageUrl ?? "",
      eventDate: toDubaiInput(e.eventDate),
      venue: e.venue ?? "",
      status: e.status,
      registrationOpen: e.registrationOpen,
    })
    setFormError(null)
    setModalOpen(true)
  }

  const handleUpload = async (file: File | null) => {
    if (!file) return
    setUploading(true)
    setFormError(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload/event", { method: "POST", body: fd })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed")
      setForm((f) => ({ ...f, imageUrl: data.url as string }))
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!form.title.trim()) {
      setFormError("Title is required")
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        title: form.title,
        description: form.description,
        brand: form.brand,
        image_url: form.imageUrl,
        event_date: form.eventDate ? fromDubaiInput(form.eventDate) : "",
        venue: form.venue,
        status: form.status,
        registration_open: form.registrationOpen,
      }
      const res = editing
        ? await fetch(`/api/admin/events/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? "Save failed")
      }
      setModalOpen(false)
      await load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (e: AdminEvent) => {
    if (!window.confirm(`Delete "${e.title}"? Its registrations are kept but the event disappears everywhere.`)) return
    const res = await fetch(`/api/admin/events/${e.id}`, { method: "DELETE" })
    if (res.ok) setEvents((prev) => prev.filter((x) => x.id !== e.id))
  }

  const toggleStatus = async (e: AdminEvent) => {
    const status = e.status === "published" ? "draft" : "published"
    const res = await fetch(`/api/admin/events/${e.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: e.title,
        description: e.description ?? "",
        brand: e.brand,
        image_url: e.imageUrl ?? "",
        event_date: e.eventDate ?? "",
        venue: e.venue ?? "",
        status,
        registration_open: e.registrationOpen,
      }),
    })
    if (res.ok) setEvents((prev) => prev.map((x) => (x.id === e.id ? { ...x, status } : x)))
  }

  // Open/close registration without touching anything else on the event.
  const toggleRegistration = async (e: AdminEvent) => {
    const registrationOpen = !e.registrationOpen
    const res = await fetch(`/api/admin/events/${e.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: e.title,
        description: e.description ?? "",
        brand: e.brand,
        image_url: e.imageUrl ?? "",
        event_date: e.eventDate ?? "",
        venue: e.venue ?? "",
        status: e.status,
        registration_open: registrationOpen,
      }),
    })
    if (res.ok) {
      setEvents((prev) => prev.map((x) => (x.id === e.id ? { ...x, registrationOpen } : x)))
      setRegEvent((prev) => (prev && prev.id === e.id ? { ...prev, registrationOpen } : prev))
    }
  }

  // Attendee lists already loaded this session — reopening an event shows
  // them instantly while a fresh copy loads in the background.
  const regsCacheRef = useRef<Record<string, Registration[]>>({})
  // Which event's registrations the modal is currently showing (guards a slow
  // response for event A from overwriting event B's list).
  const regOpenIdRef = useRef<string | null>(null)

  const openRegistrations = async (e: AdminEvent) => {
    setRegEvent(e)
    setRegQuery("")
    setRegPage(1)
    regOpenIdRef.current = e.id

    const cached = regsCacheRef.current[e.id]
    if (cached) {
      setRegistrations(cached)
      setRegsLoading(false)
    } else {
      setRegistrations([])
      setRegsLoading(true)
    }

    try {
      const res = await fetch(`/api/admin/events/${e.id}/registrations`, { cache: "no-store" })
      const data = (await res.json()) as { registrations?: Registration[] }
      const fresh = data.registrations ?? []
      regsCacheRef.current[e.id] = fresh
      if (regOpenIdRef.current === e.id) setRegistrations(fresh)
    } catch {
      // keep whatever is shown (cached list or empty state)
    } finally {
      if (regOpenIdRef.current === e.id) setRegsLoading(false)
    }
  }

  const deleteRegistration = async (r: Registration) => {
    if (!regEvent) return
    if (!window.confirm(`Remove "${r.fullName}" from this event's registrations? They could register again later.`)) return
    setDeletingRegId(r.id)
    try {
      const res = await fetch(`/api/admin/events/${regEvent.id}/registrations`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId: r.id }),
      })
      if (!res.ok) throw new Error("failed")
      setRegistrations((prev) => prev.filter((x) => x.id !== r.id))
      // Keep the session cache and the "N registered" card count in sync.
      regsCacheRef.current[regEvent.id] = (regsCacheRef.current[regEvent.id] ?? []).filter((x) => x.id !== r.id)
      setEvents((prev) =>
        prev.map((e) =>
          e.id === regEvent.id ? { ...e, registrationCount: Math.max(0, e.registrationCount - 1) } : e,
        ),
      )
    } catch {
      // row stays; nothing worse to do here
    } finally {
      setDeletingRegId(null)
    }
  }

  // Branded print view of the attendee list — the browser's print dialog
  // offers "Save as PDF" (and direct printing for the venue check-in desk).
  const exportRegistrationsPdf = () => {
    if (!regEvent || filteredRegs.length === 0) return
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    const w = window.open("", "_blank", "width=900,height=700")
    if (!w) return
    const generated = new Date().toLocaleDateString("en-AE", { year: "numeric", month: "long", day: "numeric" })
    const body = filteredRegs
      .map(
        (r, i) => `<tr>
          <td class="n">${i + 1}</td>
          <td><strong>${esc(r.fullName)}</strong></td>
          <td>${esc(r.email)}</td>
          <td>${esc(r.whatsapp ?? "—")}</td>
          <td>${esc(new Date(r.createdAt).toLocaleDateString("en-AE", { month: "short", day: "numeric", year: "numeric" }))}</td>
        </tr>`,
      )
      .join("")
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Attendees — ${esc(regEvent.title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; padding: 32px; }
  .band { background: #001f3f; border-bottom: 4px solid #d6b357; border-radius: 12px 12px 0 0; padding: 22px 28px; }
  .band h1 { color: #ffffff; font-size: 22px; }
  .band .gold { color: #d6b357; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
  .meta { display: flex; flex-wrap: wrap; gap: 20px; padding: 14px 28px; background: #f6f8fb; border: 1px solid #e8eaed; border-top: 0; font-size: 12px; color: #4b5563; }
  .meta strong { color: #001f3f; }
  table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 12.5px; }
  th { background: #001f3f; color: #ffffff; text-align: left; padding: 9px 12px; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; }
  td { padding: 9px 12px; border-bottom: 1px solid #eef0f3; }
  tr:nth-child(even) td { background: #fafbfc; }
  .n { color: #9ca3af; width: 34px; }
  .foot { margin-top: 22px; text-align: center; font-size: 11px; color: #9ca3af; }
  .foot b { color: #b8913f; }
  @page { margin: 14mm; }
</style></head><body>
  <div class="band"><p class="gold">FHI Global · Event Attendees</p><h1>${esc(regEvent.title)}</h1></div>
  <div class="meta">
    <span>Event date: <strong>${esc(eventDateLabel(regEvent.eventDate))}</strong></span>
    ${regEvent.venue ? `<span>Venue: <strong>${esc(regEvent.venue)}</strong></span>` : ""}
    <span>Total registered: <strong>${filteredRegs.length}</strong></span>
    <span>Generated: <strong>${esc(generated)}</strong></span>
    ${regQuery.trim() ? `<span>Filter: <strong>“${esc(regQuery.trim())}”</strong></span>` : ""}
  </div>
  <table>
    <thead><tr><th>#</th><th>Name</th><th>Email</th><th>WhatsApp</th><th>Registered</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <p class="foot">Generated from the FHI Global dashboard · <b>fhiglobal.ae</b></p>
</body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 350)
  }

  const inputCls =
    "w-full px-4 py-3 rounded-xl border border-[#e5e5e5] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] transition-colors"
  const labelCls = "block text-xs font-bold uppercase tracking-wide text-[#6b7280] mb-1.5"

  // The dashboard shell (sidebar + header) is rendered once by
  // app/dashboard/layout.tsx — this page renders only its content.
  return (
    <>
      <div className="w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] flex items-center gap-2">
              <CalendarDays className="w-6 h-6 text-[#001f3f]" />
              Events
            </h1>
            <p className="text-sm text-[#6b7280] mt-1">
              Create branded events, generate a share-ready flyer with its registration QR, and see
              who signed up. Published events appear on the public Events page.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#001f3f] text-white text-sm font-bold hover:bg-[#00356b] transition-colors"
            >
              <Plus className="w-4 h-4" />
              New event
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-[#e8eaed] bg-white p-12 text-center text-sm text-[#9ca3af]">
            Loading events…
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-2xl border border-[#e8eaed] bg-white p-12 text-center">
            <p className="text-[#6b7280] mb-4">No events yet.</p>
            <button type="button" onClick={openCreate} className="text-sm font-semibold text-[#001f3f] hover:underline">
              Create your first event
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {events.map((e) => {
              const brand = eventBrand(e.brand)
              return (
                <div key={e.id} className="group relative bg-white rounded-2xl border border-[#e8eaed] overflow-hidden shadow-sm hover:shadow-lg transition-all">
                  <span className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#d6b357] via-[#f0d890] to-[#d6b357]/30 z-10" aria-hidden="true" />
                  {/* Whole poster shown (contained) over a blurred fill — faces never cropped */}
                  <div className="relative h-60 bg-[#0d1b2e] overflow-hidden">
                    {e.imageUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={e.imageUrl}
                          alt=""
                          aria-hidden="true"
                          className="absolute inset-0 h-full w-full object-cover blur-xl scale-110 opacity-50"
                        />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={e.imageUrl} alt={e.title} className="relative h-full w-full object-contain" />
                      </>
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-[#b8bfc9]">
                        <CalendarDays className="w-8 h-8" />
                      </div>
                    )}
                    <span className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold shadow ${
                          e.status === "published"
                            ? "bg-emerald-50 text-emerald-800"
                            : e.status === "draft"
                              ? "bg-amber-50 text-amber-800"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {e.status}
                      </span>
                      {!e.registrationOpen && (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold shadow bg-rose-50 text-rose-700">
                          Registration closed
                        </span>
                      )}
                    </span>
                    <span
                      className="absolute bottom-3 left-3 rounded-lg px-2 py-1.5 flex items-center shadow"
                      style={{ backgroundColor: brand.logoIsWhite ? "#001f3f" : "rgba(255,255,255,0.95)" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={brand.logo} alt={brand.name} className="h-5 w-auto object-contain" />
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-['Outfit'] font-bold text-[#111827] truncate">{e.title}</h3>
                    <p className="text-xs text-[#6b7280] mt-1">{eventDateLabel(e.eventDate)}</p>
                    {e.venue && (
                      <p className="text-xs text-[#6b7280] truncate mt-0.5 inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#d6b357]" /> {e.venue}
                      </p>
                    )}
                    {/* Visit stats: page views + how many arrived via QR scan */}
                    <div className="mt-2 flex items-center gap-3 text-xs text-[#6b7280]">
                      <span className="inline-flex items-center gap-1" title="Page visits">
                        <Eye className="w-3.5 h-3.5 text-[#001f3f]" />
                        <span className="font-bold text-[#111827]">{e.viewCount}</span> visits
                      </span>
                      <span className="inline-flex items-center gap-1" title="Visits from QR scans">
                        <ScanLine className="w-3.5 h-3.5 text-[#b8913f]" />
                        <span className="font-bold text-[#111827]">{e.qrScanCount}</span> QR scans
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-[#f0f0f0] pt-3">
                      <button
                        type="button"
                        onClick={() => void openRegistrations(e)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#001f3f]/5 text-[#001f3f] text-xs font-bold hover:bg-[#001f3f]/10 transition-colors"
                        title="View registrations"
                      >
                        <Users className="w-3.5 h-3.5" />
                        {e.registrationCount} registered
                      </button>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setFlyerEvent(e)}
                          className="p-2 rounded-lg text-[#b8913f] hover:bg-[#d6b357]/15"
                          aria-label="Generate flyer with registration QR"
                          title="Generate flyer (with registration QR)"
                        >
                          <FileImage className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleStatus(e)}
                          className={`px-2 rounded-lg text-[11px] font-bold ${
                            e.status === "published"
                              ? "text-amber-700 hover:bg-amber-50"
                              : "text-emerald-700 hover:bg-emerald-50"
                          }`}
                          title={e.status === "published" ? "Unpublish" : "Publish"}
                        >
                          {e.status === "published" ? "Unpublish" : "Publish"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(e)}
                          className="p-2 rounded-lg text-[#001f3f] hover:bg-[#001f3f]/10"
                          aria-label="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(e)}
                          className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Create / edit modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/45 backdrop-blur-sm" aria-label="Close" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl border border-[#e8eaed] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-5">
              <h2 className="font-['Outfit'] text-lg font-bold text-[#001f3f]">
                {editing ? "Edit event" : "New event"}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} className="p-2 -mr-2 -mt-2 rounded-lg text-[#6b7280] hover:bg-[#f5f5f5]" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Brand picker */}
              <div>
                <p className={labelCls}>Brand</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {EVENT_BRANDS.map((b) => (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, brand: b.key }))}
                      className={`rounded-xl border-2 p-2 transition-all ${
                        form.brand === b.key ? "border-[#001f3f] shadow-md" : "border-[#e5e5e5] hover:border-[#9ca3af]"
                      }`}
                      title={b.name}
                    >
                      <span
                        className="h-10 rounded-lg flex items-center justify-center px-1"
                        style={{ backgroundColor: b.logoIsWhite ? "#001f3f" : "#f6f7f9" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={b.logo} alt={b.name} className="max-h-7 max-w-full object-contain" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Event title *</label>
                <input className={inputCls} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="FHI Global Investor Night" maxLength={160} />
              </div>

              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What's happening, who should come, what to expect…"
                  maxLength={5000}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Date &amp; time (Dubai time, GST)</label>
                  <input type="datetime-local" className={inputCls} value={form.eventDate} onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Venue</label>
                  <input className={inputCls} value={form.venue} onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} placeholder="Rigga Business Center, Deira, Dubai" maxLength={300} />
                </div>
              </div>

              {/* Image */}
              <div>
                <p className={labelCls}>Event photo</p>
                <div className="flex items-center gap-3">
                  {form.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.imageUrl} alt="Event" className="h-20 w-32 rounded-xl object-cover border border-[#e5e5e5]" />
                  ) : (
                    <div className="h-20 w-32 rounded-xl border border-dashed border-[#d1d5db] flex items-center justify-center text-[#b8bfc9]">
                      <ImagePlus className="w-6 h-6" />
                    </div>
                  )}
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] transition-colors cursor-pointer">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                    {form.imageUrl ? "Replace photo" : "Upload photo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        void handleUpload(e.target.files?.[0] ?? null)
                        e.target.value = ""
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <div>
                  <p className={labelCls}>Status</p>
                  <div className="inline-flex rounded-xl border border-[#e5e5e5] overflow-hidden">
                    {["draft", "published"].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, status: s }))}
                        className={`px-4 py-2 text-sm font-bold capitalize transition-colors ${
                          form.status === s ? "bg-[#001f3f] text-white" : "bg-white text-[#374151] hover:bg-[#f3f4f6]"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className={labelCls}>Registration</p>
                  <div className="inline-flex rounded-xl border border-[#e5e5e5] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, registrationOpen: true }))}
                      className={`px-4 py-2 text-sm font-bold transition-colors ${
                        form.registrationOpen ? "bg-emerald-600 text-white" : "bg-white text-[#374151] hover:bg-[#f3f4f6]"
                      }`}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, registrationOpen: false }))}
                      className={`px-4 py-2 text-sm font-bold transition-colors ${
                        !form.registrationOpen ? "bg-rose-600 text-white" : "bg-white text-[#374151] hover:bg-[#f3f4f6]"
                      }`}
                    >
                      Closed
                    </button>
                  </div>
                  <p className="text-[11px] text-[#9ca3af] mt-1.5">
                    Also closes automatically the day after the event.
                  </p>
                </div>
              </div>

              {formError && (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#f0f0f0]">
                <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2.5 rounded-xl border border-[#e5e5e5] text-sm font-semibold text-[#374151]">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving || uploading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#001f3f] text-white text-sm font-bold hover:bg-[#00356b] transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editing ? "Save changes" : "Create event"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Flyer generator modal ── */}
      {flyerEvent && (
        <EventFlyerModal event={flyerEvent} origin={origin} onClose={() => setFlyerEvent(null)} />
      )}

      {/* ── Live raffle (full-screen, above the registrations modal) ── */}
      {raffleOpen && regEvent && (
        <EventRaffle
          eventId={regEvent.id}
          eventTitle={regEvent.title}
          entries={registrations.map((r) => ({ id: r.id, fullName: r.fullName, email: r.email }))}
          onClose={() => setRaffleOpen(false)}
        />
      )}

      {/* ── Registrations modal ── */}
      {regEvent && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/45 backdrop-blur-sm" aria-label="Close" onClick={() => setRegEvent(null)} />
          <div className="relative bg-white rounded-2xl border border-[#e8eaed] shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-4 gap-3">
              <div className="min-w-0">
                <h3 className="font-['Outfit'] font-bold text-[#001f3f] truncate">{regEvent.title}</h3>
                <p className="text-xs text-[#6b7280] mt-0.5">
                  {regsLoading ? "Loading…" : `${registrations.length} registration${registrations.length !== 1 ? "s" : ""}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void toggleRegistration(regEvent)}
                  title={regEvent.registrationOpen ? "Stop accepting new registrations" : "Accept registrations again"}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                    regEvent.registrationOpen
                      ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                      : "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  }`}
                >
                  {regEvent.registrationOpen ? "Close registration" : "Reopen registration"}
                </button>
                <button
                  type="button"
                  onClick={exportRegistrationsPdf}
                  disabled={regsLoading || filteredRegs.length === 0}
                  title="Download attendee list as PDF"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#001f3f]/15 bg-[#001f3f]/5 text-[#001f3f] text-xs font-bold hover:bg-[#001f3f]/10 transition-colors disabled:opacity-40"
                >
                  <FileText className="w-4 h-4" />
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => setRaffleOpen(true)}
                  disabled={regsLoading || registrations.length === 0}
                  title="Start a live raffle — pick a random winner"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#d6b357] to-[#b8913f] text-[#001428] text-xs font-bold shadow-sm hover:shadow-md transition-shadow disabled:opacity-40"
                >
                  <Trophy className="w-4 h-4" />
                  Raffle
                </button>
                <button type="button" onClick={() => setRegEvent(null)} className="p-2 -mr-2 -mt-2 rounded-lg text-[#6b7280] hover:bg-[#f5f5f5]" aria-label="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search — filters the table, the PDF export follows it */}
            {!regsLoading && registrations.length > 0 && (
              <div className="relative mb-4">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
                <input
                  value={regQuery}
                  onChange={(e) => {
                    setRegQuery(e.target.value)
                    setRegPage(1)
                  }}
                  placeholder="Search by name or email…"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#e5e5e5] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] transition-colors"
                />
              </div>
            )}

            {regsLoading ? (
              <p className="text-sm text-[#9ca3af] py-8 text-center flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading registrations…
              </p>
            ) : registrations.length === 0 ? (
              <p className="text-sm text-[#9ca3af] py-8 text-center">
                No one has registered yet — share the QR code to get sign-ups.
              </p>
            ) : filteredRegs.length === 0 ? (
              <p className="text-sm text-[#9ca3af] py-8 text-center">
                No registrations match <span className="font-semibold text-[#374151]">&ldquo;{regQuery.trim()}&rdquo;</span> — try another name or email.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#f0f0f0] text-left text-xs font-bold uppercase tracking-wide text-[#6b7280]">
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">WhatsApp</th>
                      <th className="px-3 py-2">Registered</th>
                      <th className="px-3 py-2" aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {regPageItems.map((r) => (
                      <tr key={r.id} className="border-b border-[#f7f7f7]">
                        <td className="px-3 py-2.5 font-semibold text-[#111827]">{r.fullName}</td>
                        <td className="px-3 py-2.5 text-[#374151]">
                          <a href={`mailto:${r.email}`} className="hover:text-[#001f3f] hover:underline">{r.email}</a>
                        </td>
                        <td className="px-3 py-2.5 text-[#374151]">
                          {r.whatsapp ? (
                            <a
                              href={`https://wa.me/${r.whatsapp.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-[#166534] hover:underline"
                            >
                              {r.whatsapp}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-[#6b7280]">
                          {new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => void deleteRegistration(r)}
                            disabled={deletingRegId === r.id}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                            aria-label={`Remove ${r.fullName}`}
                            title="Remove this registration"
                          >
                            {deletingRegId === r.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                {regTotalPages > 1 && (
                  <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-[#f0f2f5]">
                    <p className="text-xs text-[#9ca3af]">
                      Showing <span className="font-bold text-[#374151]">{(regSafePage - 1) * REG_PAGE_SIZE + 1}–{Math.min(regSafePage * REG_PAGE_SIZE, filteredRegs.length)}</span> of{" "}
                      <span className="font-bold text-[#374151]">{filteredRegs.length}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setRegPage(regSafePage - 1)}
                        disabled={regSafePage <= 1}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#e5e5e5] text-xs font-bold text-[#374151] hover:border-[#001f3f] transition-colors disabled:opacity-40"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Prev
                      </button>
                      <span className="text-xs font-bold text-[#001f3f] px-1">
                        Page {regSafePage} of {regTotalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setRegPage(regSafePage + 1)}
                        disabled={regSafePage >= regTotalPages}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#e5e5e5] text-xs font-bold text-[#374151] hover:border-[#001f3f] transition-colors disabled:opacity-40"
                      >
                        Next
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
