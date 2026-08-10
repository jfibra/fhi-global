"use client"

import { useEffect, useState } from "react"
import {
  Building2,
  CalendarDays,
  Crosshair,
  DollarSign,
  Loader2,
  MapPin,
  Phone,
  Save,
  Sparkles,
} from "lucide-react"
import type { Project, Developer, ProjectFormData } from "@/lib/project-service"
import { generateProjectSlug } from "@/lib/project-service"

// ─── Inner tab definitions ────────────────────────────────────────────────────

type InnerTab = "basic" | "location" | "pricing" | "dates" | "building" | "contact"

interface TabDef {
  id: InnerTab
  label: string
  icon: React.ElementType
}

const INNER_TABS: TabDef[] = [
  { id: "basic",    label: "Basic Info",      icon: Building2 },
  { id: "location", label: "Location",        icon: MapPin },
  { id: "pricing",  label: "Pricing",         icon: DollarSign },
  { id: "dates",    label: "Dates & Delivery",icon: CalendarDays },
  { id: "building", label: "Building Details",icon: Building2 },
  { id: "contact",  label: "Sales Contact",   icon: Phone },
]

// ─── Read-only formatters ─────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pre_launch: "Pre-Launch",
  launch: "Launch",
  under_construction: "Under Construction",
  completed: "Completed",
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—"
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}
const fmtNum = (v: number | null | undefined): string => (v == null ? "—" : Number(v).toLocaleString())
const fmtPct = (v: number | null | undefined): string => (v == null ? "—" : `${v}%`)

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  project: Project
  developers: Developer[]
  onSave: (fields: Partial<ProjectFormData>) => Promise<void>
  showToast: (variant: "success" | "error", message: string) => void
  readOnly?: boolean
}

export function ProjectOverviewTab({ project, developers, onSave, showToast, readOnly = false }: Props) {
  const [form, setForm]         = useState<Partial<ProjectFormData>>({})
  // Coordinate lookup: geocodes whatever address parts are already typed.
  // Storing the result is what spares the public project page a per-visitor
  // geocode, and it pins the map exactly rather than approximately.
  const [geoBusy, setGeoBusy]   = useState(false)
  const [geoNote, setGeoNote]   = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving]     = useState(false)
  const [active, setActive]     = useState<InnerTab>("basic")
  const [aiLoading, setAiLoading] = useState<"description" | "about_project" | null>(null)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [aiTarget, setAiTarget] = useState<"description" | "about_project">("description")
  const [aiPrompt, setAiPrompt] = useState("")

  useEffect(() => {
    setForm({
      name:                      project.name,
      slug:                      project.slug,
      description:               project.description ?? "",
      about_project:             project.about_project ?? "",
      status:                    project.status,
      developer_id:              project.developer_id ?? "",
      location:                  project.location ?? "",
      region:                    project.region ?? "",
      community:                 project.community ?? "",
      sub_community:             project.sub_community ?? "",
      city:                      project.city ?? "",
      country:                   project.country ?? "",
      latitude:                  project.latitude ?? "",
      longitude:                 project.longitude ?? "",
      launch_price_from:         project.launch_price_from ?? undefined,
      launch_price_to:           project.launch_price_to ?? undefined,
      currency:                  project.currency ?? "AED",
      government_fee_percentage: project.government_fee_percentage ?? undefined,
      down_payment_percentage:   project.down_payment_percentage ?? undefined,
      payment_plan_details:      project.payment_plan_details ?? "",
      installment_available:     project.installment_available,
      booking_date:              project.booking_date ?? "",
      construction_start_date:   project.construction_start_date ?? "",
      expected_completion_date:  project.expected_completion_date ?? "",
      delivery_date:             project.delivery_date ?? "",
      delivery_quarter:          project.delivery_quarter ?? "",
      number_of_buildings:       project.number_of_buildings ?? undefined,
      total_units:               project.total_units ?? undefined,
      floors:                    project.floors ?? undefined,
      video_url:                 project.video_url ?? "",
      expected_roi:              project.expected_roi ?? undefined,
      rental_yield:              project.rental_yield ?? undefined,
      freehold:                  project.freehold,
      ownership_type:            project.ownership_type ?? "",
      sales_contact_phone:       project.sales_contact_phone ?? "",
      sales_contact_email:       project.sales_contact_email ?? "",
    })
  }, [project])

  const set = (key: keyof typeof form, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }))

  const handleNameChange = (v: string) => {
    set("name", v)
    if (!form.slug || form.slug === generateProjectSlug(project.name)) {
      set("slug", generateProjectSlug(v))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await onSave(form)
    setSaving(false)
    showToast("success", "Changes saved")
  }

  // ─── Shared field helpers ─────────────────────────────────────────────────

  /**
   * Geocode whatever address parts are filled in. This runs in the browser on
   * purpose: the Maps key is HTTP-referrer restricted, and Google rejects such
   * keys on the server-side REST API — the same reason the public project map
   * geocodes client-side.
   */
  const findCoordinates = async () => {
    const parts = [form.location, form.sub_community, form.community, form.city, form.country]
      .map((v) => String(v ?? "").trim())
      .filter(Boolean)
    // Deduplicate: "Dubai, Dubai" geocodes worse than "Dubai".
    const query = [...new Set(parts)].join(", ")
    if (query.length < 3) {
      setGeoNote({ ok: false, text: "Fill in the address or city first." })
      return
    }

    setGeoBusy(true)
    setGeoNote(null)
    try {
      // Load the Maps script once per dashboard session.
      if (!window.google?.maps?.Geocoder) {
        const res = await fetch("/api/admin/maps-key", { cache: "no-store" })
        const json = (await res.json()) as { key?: string; error?: string }
        if (!res.ok || !json.key) throw new Error(json.error ?? "Maps is not configured.")
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector<HTMLScriptElement>("script[data-fhi-maps]")
          if (existing) {
            existing.addEventListener("load", () => resolve(), { once: true })
            existing.addEventListener("error", () => reject(new Error("Maps failed to load.")), { once: true })
            return
          }
          const el = document.createElement("script")
          el.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(json.key!)}`
          el.async = true
          el.dataset.fhiMaps = "1"
          el.onload = () => resolve()
          el.onerror = () => reject(new Error("Maps failed to load."))
          document.head.appendChild(el)
        })
      }

      const geocoder = new window.google.maps.Geocoder()
      const { results } = await geocoder.geocode({
        address: query,
        componentRestrictions: { country: "AE" },
      })
      const hit = results?.[0]
      const loc = hit?.geometry?.location
      if (!loc) {
        setGeoNote({ ok: false, text: "No match — try adding the community or city." })
        return
      }
      setForm((f) => ({
        ...f,
        latitude: loc.lat().toFixed(6),
        longitude: loc.lng().toFixed(6),
      }))
      setGeoNote({ ok: true, text: `Matched: ${hit?.formatted_address ?? query}` })
    } catch (err) {
      setGeoNote({ ok: false, text: (err as Error).message || "Lookup failed." })
    } finally {
      setGeoBusy(false)
    }
  }

  const field = (label: string, content: React.ReactNode, action?: React.ReactNode) => (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label className="block text-xs font-semibold text-[#6b7280]">{label}</label>
        {action}
      </div>
      {content}
    </div>
  )

  const cls = "w-full border border-[#e5e5e5] rounded-xl px-3 py-2.5 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f] transition-all"

  const inp = (
    key: keyof typeof form,
    placeholder = "",
    type: "text" | "number" | "email" | "tel" | "date" | "url" = "text",
  ) => (
    <input
      type={type}
      value={(form[key] as string | number | undefined) ?? ""}
      onChange={(e) =>
        set(key, type === "number" ? (e.target.value === "" ? undefined : Number(e.target.value)) : e.target.value)
      }
      placeholder={placeholder}
      className={cls}
    />
  )

  const area = (key: keyof typeof form, placeholder = "", rows = 3) => (
    <textarea
      value={(form[key] as string | undefined) ?? ""}
      onChange={(e) => set(key, e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`${cls} resize-none`}
    />
  )

  const sel = (key: keyof typeof form, children: React.ReactNode, nullable?: boolean) => (
    <select
      value={(form[key] as string) ?? ""}
      onChange={(e) => set(key, nullable ? e.target.value || null : e.target.value)}
      className={`${cls} bg-white`}
    >
      {children}
    </select>
  )

  const check = (key: keyof typeof form, label: string, id: string) => (
    <label htmlFor={id} className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        id={id}
        checked={Boolean(form[key])}
        onChange={(e) => set(key, e.target.checked)}
        className="w-4 h-4 rounded accent-[#001f3f]"
      />
      <span className="text-sm text-[#374151]">{label}</span>
    </label>
  )

  const openAiModal = (target: "description" | "about_project") => {
    if (aiLoading) return
    setAiTarget(target)
    setAiPrompt("")
    setAiModalOpen(true)
  }

  const generateAiCopy = async (target: "description" | "about_project", customPrompt: string) => {
    if (aiLoading) return
    const projectName = String(form.name ?? "").trim()
    if (!projectName) {
      showToast("error", "Enter project name first")
      return
    }

    const developerName =
      developers.find((d) => d.id === form.developer_id)?.name ??
      developers.find((d) => String(d.id) === String(form.developer_id ?? ""))?.name ??
      ""

    setAiLoading(target)
    try {
      const res = await fetch("/api/ai/project-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          name: projectName,
          status: form.status ?? "",
          location: form.location ?? "",
          city: form.city ?? "",
          country: form.country ?? "",
          developerName,
          customPrompt: customPrompt.trim(),
        }),
      })
      const json = await res.json() as { text?: string; error?: string }
      if (!res.ok || !json.text) {
        showToast("error", json.error ?? "Failed to generate content")
        return
      }
      set(target, json.text.trim())
      showToast("success", target === "description" ? "Description generated" : "About project generated")
    } catch {
      showToast("error", "Failed to generate content")
    } finally {
      setAiLoading(null)
    }
  }

  const handleAiGenerateFromModal = async () => {
    const prompt = aiPrompt.trim()
    if (!prompt) {
      showToast("error", "Add your prompt first")
      return
    }
    const target = aiTarget
    setAiModalOpen(false)
    await generateAiCopy(target, prompt)
  }

  // ─── Tab panels ───────────────────────────────────────────────────────────

  const panels: Record<InnerTab, React.ReactNode> = {
    basic: (
      <div className="grid grid-cols-2 gap-4">
        {field("Project Name *",
          <input type="text" value={form.name ?? ""} onChange={(e) => handleNameChange(e.target.value)} required className={cls} />,
        )}
        {field("Slug", inp("slug", "auto-generated"))}
        {field("Developer",
          sel("developer_id",
            <>
              <option value="">— None —</option>
              {developers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </>,
            true,
          ),
        )}
        {field("Status",
          sel("status",
            <>
              <option value="pre_launch">Pre-Launch</option>
              <option value="launch">Launch</option>
              <option value="under_construction">Under Construction</option>
              <option value="completed">Completed</option>
            </>,
          ),
        )}
        <div className="col-span-2">
          {field(
            "Short Description",
            area("description", "Short description visible in listings…", 2),
            !readOnly && (
              <button
                type="button"
                onClick={() => openAiModal("description")}
                disabled={Boolean(aiLoading)}
                className="inline-flex items-center gap-1 rounded-full border border-[#d6b357]/40 bg-[#fff8e1] px-2.5 py-1 text-[11px] font-semibold text-[#0f2940] hover:bg-[#fff3cc] disabled:opacity-50"
              >
                <Sparkles className="h-3 w-3 text-[#d6b357]" />
                {aiLoading === "description" ? "Generating…" : "AI Generate"}
              </button>
            ),
          )}
        </div>
        <div className="col-span-2">
          {field(
            "About Project",
            area("about_project", "Detailed about section shown on the project page…", 5),
            !readOnly && (
              <button
                type="button"
                onClick={() => openAiModal("about_project")}
                disabled={Boolean(aiLoading)}
                className="inline-flex items-center gap-1 rounded-full border border-[#d6b357]/40 bg-[#fff8e1] px-2.5 py-1 text-[11px] font-semibold text-[#0f2940] hover:bg-[#fff3cc] disabled:opacity-50"
              >
                <Sparkles className="h-3 w-3 text-[#d6b357]" />
                {aiLoading === "about_project" ? "Generating…" : "AI Generate"}
              </button>
            ),
          )}
        </div>
      </div>
    ),

    location: (
      <div className="grid grid-cols-3 gap-4">
        {field("Location / Address", inp("location", "e.g. Downtown Dubai"))}
        {field("City",          inp("city",          "e.g. Dubai"))}
        {field("Country",       inp("country",       "e.g. UAE"))}
        {field("Region",        inp("region",        "e.g. MENA"))}
        {field("Community",     inp("community",     "e.g. Business Bay"))}
        {field("Sub-Community", inp("sub_community", ""))}
        <div className="col-span-3 border-t border-[#f0f0f0] pt-4">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <p className="text-xs font-semibold text-[#6b7280]">Coordinates</p>
            {!readOnly && (
              <button
                type="button"
                onClick={() => void findCoordinates()}
                disabled={geoBusy}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#d6b357]/40 bg-[#fff8e1] px-2.5 py-1 text-[11px] font-semibold text-[#0f2940] hover:bg-[#fff3cc] disabled:opacity-50"
              >
                {geoBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crosshair className="h-3 w-3 text-[#d6b357]" />}
                {geoBusy ? "Finding…" : "Find from address"}
              </button>
            )}
            {form.latitude && form.longitude && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${form.latitude},${form.longitude}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-[#0f2940] underline hover:text-[#d6b357]"
              >
                Check this pin on Google Maps
              </a>
            )}
          </div>
          <p className="text-[11px] text-[#9ca3af] mb-3">
            Filling these pins the project map exactly and skips an address lookup for every
            visitor. Leave them blank and the public page falls back to searching the address.
          </p>
          {geoNote && (
            <p className={`mb-3 text-[11px] font-semibold ${geoNote.ok ? "text-emerald-600" : "text-rose-600"}`}>
              {geoNote.text}
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            {field("Latitude",  inp("latitude",  "e.g. 25.2048"))}
            {field("Longitude", inp("longitude", "e.g. 55.2708"))}
          </div>
        </div>
      </div>
    ),

    pricing: (
      <div className="grid grid-cols-3 gap-4">
        {field("Currency",           inp("currency",                   "AED"))}
        {field("Launch Price From",  inp("launch_price_from",          "0", "number"))}
        {field("Launch Price To",    inp("launch_price_to",            "0", "number"))}
        {field("Gov. Fee %",         inp("government_fee_percentage",  "0", "number"))}
        {field("Down Payment %",     inp("down_payment_percentage",    "0", "number"))}
        {field("Expected ROI %",     inp("expected_roi",               "0", "number"))}
        {field("Rental Yield %",     inp("rental_yield",               "0", "number"))}
        {field("Ownership Type",     inp("ownership_type",             "e.g. Freehold, Leasehold"))}
        <div className="col-span-3">{field("Payment Plan Details", area("payment_plan_details", "Describe installment schedule or milestones…", 3))}</div>
        <div className="col-span-3 flex items-center gap-6">
          {check("installment_available", "Installment Available", "installment")}
          {check("freehold",              "Freehold",              "freehold")}
        </div>
      </div>
    ),

    dates: (
      <div className="grid grid-cols-3 gap-4">
        {field("Booking Date",        inp("booking_date",             "", "date"))}
        {field("Construction Start",  inp("construction_start_date",  "", "date"))}
        {field("Expected Completion", inp("expected_completion_date", "", "date"))}
        {field("Delivery Date",       inp("delivery_date",            "", "date"))}
        {field("Delivery Quarter",    inp("delivery_quarter",         "e.g. Q4 2025"))}
      </div>
    ),

    building: (
      <div className="grid grid-cols-3 gap-4">
        {field("No. of Buildings", inp("number_of_buildings", "0", "number"))}
        {field("Total Units",      inp("total_units",         "0", "number"))}
        {field("Floors",           inp("floors",              "0", "number"))}
        <div className="col-span-3">{field("Video URL", inp("video_url", "https://youtube.com/…", "url"))}</div>
      </div>
    ),

    contact: (
      <div className="grid grid-cols-2 gap-4">
        {field("Sales Phone", inp("sales_contact_phone", "+971…",    "tel"))}
        {field("Sales Email", inp("sales_contact_email", "sales@…",  "email"))}
      </div>
    ),
  }

  // ─── Read-only display panels (agents/members) ─────────────────────────────
  const roRow = (label: string, value: React.ReactNode) => {
    const empty = value == null || value === "" || value === "—"
    return (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">{label}</p>
        <div className={`mt-1 text-sm break-words ${empty ? "text-[#c4c9d0]" : "text-[#111827]"}`}>{empty ? "—" : value}</div>
      </div>
    )
  }
  const roText = (label: string, value: string | null | undefined) => (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">{label}</p>
      <p className={`mt-1 text-sm leading-relaxed whitespace-pre-wrap ${value?.trim() ? "text-[#374151]" : "text-[#c4c9d0]"}`}>
        {value?.trim() ? value : "Not provided"}
      </p>
    </div>
  )
  const money = (v: number | null | undefined) => (v == null ? "—" : `${project.currency ?? "AED"} ${Number(v).toLocaleString()}`)

  const readonlyPanels: Record<InnerTab, React.ReactNode> = {
    basic: (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          {roRow("Project Name", project.name)}
          {roRow("Slug", project.slug)}
          {roRow("Developer", project.developers?.name ?? "—")}
          {roRow("Status", STATUS_LABELS[project.status] ?? project.status)}
        </div>
        {roText("Short Description", project.description)}
        {roText("About Project", project.about_project)}
      </div>
    ),
    location: (
      <div className="grid grid-cols-3 gap-x-6 gap-y-5">
        {roRow("Location / Address", project.location)}
        {roRow("City", project.city)}
        {roRow("Country", project.country)}
        {roRow("Region", project.region)}
        {roRow("Community", project.community)}
        {roRow("Sub-Community", project.sub_community)}
        {roRow("Latitude", project.latitude)}
        {roRow("Longitude", project.longitude)}
      </div>
    ),
    pricing: (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-x-6 gap-y-5">
          {roRow("Currency", project.currency ?? "AED")}
          {roRow("Launch Price From", money(project.launch_price_from))}
          {roRow("Launch Price To", money(project.launch_price_to))}
          {roRow("Gov. Fee", fmtPct(project.government_fee_percentage))}
          {roRow("Down Payment", fmtPct(project.down_payment_percentage))}
          {roRow("Expected ROI", fmtPct(project.expected_roi))}
          {roRow("Rental Yield", fmtPct(project.rental_yield))}
          {roRow("Ownership Type", project.ownership_type)}
          {roRow("Installment Available", project.installment_available ? "Yes" : "No")}
          {roRow("Freehold", project.freehold ? "Yes" : "No")}
        </div>
        {roText("Payment Plan Details", project.payment_plan_details)}
      </div>
    ),
    dates: (
      <div className="grid grid-cols-3 gap-x-6 gap-y-5">
        {roRow("Booking Date", fmtDate(project.booking_date))}
        {roRow("Construction Start", fmtDate(project.construction_start_date))}
        {roRow("Expected Completion", fmtDate(project.expected_completion_date))}
        {roRow("Delivery Date", fmtDate(project.delivery_date))}
        {roRow("Delivery Quarter", project.delivery_quarter)}
      </div>
    ),
    building: (
      <div className="grid grid-cols-3 gap-x-6 gap-y-5">
        {roRow("No. of Buildings", fmtNum(project.number_of_buildings))}
        {roRow("Total Units", fmtNum(project.total_units))}
        {roRow("Floors", fmtNum(project.floors))}
        <div className="col-span-3">
          {roRow(
            "Video URL",
            project.video_url ? (
              <a href={project.video_url} target="_blank" rel="noreferrer" className="text-[#001f3f] hover:underline break-all">
                {project.video_url}
              </a>
            ) : "—",
          )}
        </div>
      </div>
    ),
    contact: (
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        {roRow(
          "Sales Phone",
          project.sales_contact_phone ? (
            <a href={`tel:${project.sales_contact_phone}`} className="text-[#001f3f] hover:underline">{project.sales_contact_phone}</a>
          ) : "—",
        )}
        {roRow(
          "Sales Email",
          project.sales_contact_email ? (
            <a href={`mailto:${project.sales_contact_email}`} className="text-[#001f3f] hover:underline">{project.sales_contact_email}</a>
          ) : "—",
        )}
      </div>
    ),
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-0">
      {/* Inner tab strip */}
      <div className="flex flex-wrap gap-1 mb-5 bg-[#f3f4f6] rounded-2xl p-1.5">
        {INNER_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActive(id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              active === id
                ? "bg-[#001f3f] text-white shadow-sm"
                : "text-[#6b7280] hover:text-[#111827] hover:bg-white/70"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Panel — read-only display for agents/members, edit form for admins. */}
      <div className="bg-white rounded-2xl border border-[#f0f0f0] p-6">
        {readOnly ? readonlyPanels[active] : panels[active]}
      </div>

      {aiModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close AI prompt"
            onClick={() => setAiModalOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-2xl">
            <h3 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">AI Generate</h3>
            <p className="mt-1 text-sm text-[#6b7280]">
              Tell AI what you want for {aiTarget === "description" ? "Short Description" : "About Project"}.
            </p>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              rows={5}
              placeholder="Example: Focus on luxury waterfront lifestyle, family amenities, and strong investment value."
              className="mt-4 w-full resize-none rounded-xl border border-[#e5e5e5] px-3 py-2.5 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f]"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAiModalOpen(false)}
                className="rounded-full border border-[#d1d5db] px-4 py-2 text-sm font-semibold text-[#374151] hover:bg-[#f9fafb]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleAiGenerateFromModal()}
                className="inline-flex items-center gap-1 rounded-full bg-[#001f3f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#001f3f]/90"
              >
                <Sparkles className="h-4 w-4" />
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save */}
      {!readOnly && (
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#001f3f]/90 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}
    </form>
  )
}
