"use client"

import { useEffect, useState } from "react"
import {
  Building2,
  CalendarDays,
  DollarSign,
  MapPin,
  Phone,
  Save,
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

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  project: Project
  developers: Developer[]
  onSave: (fields: Partial<ProjectFormData>) => Promise<void>
  showToast: (variant: "success" | "error", message: string) => void
}

export function ProjectOverviewTab({ project, developers, onSave, showToast }: Props) {
  const [form, setForm]         = useState<Partial<ProjectFormData>>({})
  const [saving, setSaving]     = useState(false)
  const [active, setActive]     = useState<InnerTab>("basic")

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

  const field = (label: string, content: React.ReactNode) => (
    <div>
      <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">{label}</label>
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
        <div className="col-span-2">{field("Short Description", area("description", "Short description visible in listings…", 2))}</div>
        <div className="col-span-2">{field("About Project", area("about_project", "Detailed about section shown on the project page…", 5))}</div>
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
          <p className="text-xs font-semibold text-[#6b7280] mb-3">Coordinates (optional)</p>
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

      {/* Panel */}
      <div className="bg-white rounded-2xl border border-[#f0f0f0] p-6">
        {panels[active]}
      </div>

      {/* Save */}
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
    </form>
  )
}
