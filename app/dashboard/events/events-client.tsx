"use client"

/**
 * Admin event manager: create/edit branded events (logo, photo, date, venue),
 * publish them to the public /events section, generate a branded flyer with
 * the registration QR baked in (links to /events/<id>), and view who registered.
 */

import { useCallback, useEffect, useState } from "react"
import {
  CalendarDays, Eye, FileImage, ImagePlus, Loader2, MapPin, Pencil, Plus,
  RefreshCw, ScanLine, Trash2, Users, X,
} from "lucide-react"
import { EventFlyerModal } from "./event-flyer-modal"
import { EVENT_BRANDS, eventBrand } from "@/lib/events/brands"

type AdminEvent = {
  id: string
  title: string
  description: string | null
  brand: string
  imageUrl: string | null
  eventDate: string | null
  venue: string | null
  status: string
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
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  brand: "fhiglobal",
  imageUrl: "",
  eventDate: "",
  venue: "",
  status: "draft",
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
      }),
    })
    if (res.ok) setEvents((prev) => prev.map((x) => (x.id === e.id ? { ...x, status } : x)))
  }

  const openRegistrations = async (e: AdminEvent) => {
    setRegEvent(e)
    setRegsLoading(true)
    setRegistrations([])
    try {
      const res = await fetch(`/api/admin/events/${e.id}/registrations`, { cache: "no-store" })
      const data = (await res.json()) as { registrations?: Registration[] }
      setRegistrations(data.registrations ?? [])
    } catch {
      // list stays empty; modal shows the empty state
    } finally {
      setRegsLoading(false)
    }
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
                  <div className="relative h-40 bg-[#eef1f5]">
                    {e.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.imageUrl} alt={e.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-[#b8bfc9]">
                        <CalendarDays className="w-8 h-8" />
                      </div>
                    )}
                    <span
                      className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold shadow ${
                        e.status === "published"
                          ? "bg-emerald-50 text-emerald-800"
                          : e.status === "draft"
                            ? "bg-amber-50 text-amber-800"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {e.status}
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

      {/* ── Registrations modal ── */}
      {regEvent && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/45 backdrop-blur-sm" aria-label="Close" onClick={() => setRegEvent(null)} />
          <div className="relative bg-white rounded-2xl border border-[#e8eaed] shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-['Outfit'] font-bold text-[#001f3f]">{regEvent.title}</h3>
                <p className="text-xs text-[#6b7280] mt-0.5">
                  {regsLoading ? "Loading…" : `${registrations.length} registration${registrations.length !== 1 ? "s" : ""}`}
                </p>
              </div>
              <button type="button" onClick={() => setRegEvent(null)} className="p-2 -mr-2 -mt-2 rounded-lg text-[#6b7280] hover:bg-[#f5f5f5]" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            {regsLoading ? (
              <p className="text-sm text-[#9ca3af] py-8 text-center flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading registrations…
              </p>
            ) : registrations.length === 0 ? (
              <p className="text-sm text-[#9ca3af] py-8 text-center">
                No one has registered yet — share the QR code to get sign-ups.
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
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map((r) => (
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
