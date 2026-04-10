"use client"

import { useState } from "react"
import { Globe, EyeOff, Star, Gem, CheckCircle2, Store, Tag } from "lucide-react"
import {
  PROJECT_LISTING_TYPE_LABELS,
  type Project,
  type ProjectFormData,
  type ProjectListingType,
} from "@/lib/project-service"

interface Props {
  project: Project
  onSave: (fields: Partial<ProjectFormData>) => Promise<void>
  onPublishToggle: () => void
  showToast: (variant: "success" | "error", message: string) => void
  /** Developer portal: projects are primary sale only; rent/resale is agent-led. */
  listingVisibilityMode?: "full" | "developer_primary_sale"
}

export function ProjectSettingsTab({
  project,
  onSave,
  onPublishToggle,
  listingVisibilityMode = "full",
}: Props) {
  const [saving, setSaving] = useState<string | null>(null)

  const toggle = async (key: keyof Project, label: string) => {
    setSaving(key as string)
    await onSave({ [key]: !project[key] })
    setSaving(null)
  }

  const Toggle = ({
    fieldKey,
    label,
    description,
    icon: Icon,
    value,
    accent = "#001f3f",
  }: {
    fieldKey: keyof Project
    label: string
    description: string
    icon: React.ElementType
    value: boolean
    accent?: string
  }) => (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-[#f0f0f0] last:border-0">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${value ? "bg-[#001f3f]/10 text-[#001f3f]" : "bg-[#f3f4f6] text-[#9ca3af]"}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#111827]">{label}</p>
          <p className="text-xs text-[#6b7280] mt-0.5">{description}</p>
        </div>
      </div>
      <button
        type="button"
        disabled={saving === (fieldKey as string)}
        onClick={() => {
          if (fieldKey === "is_published") { onPublishToggle(); return }
          void toggle(fieldKey, label)
        }}
        className={`relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0 focus:outline-none ${
          value ? "bg-[#001f3f]" : "bg-[#e5e7eb]"
        } ${saving === (fieldKey as string) ? "opacity-50 cursor-not-allowed" : ""}`}
        style={value ? { backgroundColor: accent } : {}}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${value ? "translate-x-6" : ""}`} />
      </button>
    </div>
  )

  return (
    <div className="max-w-2xl space-y-5">
      <h3 className="font-['Outfit'] text-lg font-bold text-[#001f3f]">Project Settings</h3>

      <div className="bg-white rounded-2xl border border-[#f0f0f0] p-5 space-y-0">
        <div className="flex items-start gap-3 py-4 border-b border-[#f0f0f0]">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#001f3f]/10 text-[#001f3f]">
            <Tag className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#111827]">Buy / Rent visibility</p>
            {listingVisibilityMode === "developer_primary_sale" ? (
              <>
                <p className="text-xs text-[#6b7280] mt-0.5 mb-2">
                  Developer projects are published as <strong>for sale</strong>. Rentals and resales are handled by agents in the Buy/Rent workspace after clients purchase.
                </p>
                <p className="text-xs text-[#374151] font-medium">
                  Current listing mode:{" "}
                  <span className="text-[#001f3f]">{PROJECT_LISTING_TYPE_LABELS[project.listing_type]}</span>
                  {project.listing_type !== "sale" && (
                    <span className="block mt-1 font-normal text-[#6b7280]">
                      Set by an administrator. Contact support if this should change.
                    </span>
                  )}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-[#6b7280] mt-0.5 mb-2">
                  Controls whether this project appears in the agent Buy listing, Rent listing, or both.
                </p>
                <select
                  value={project.listing_type}
                  disabled={saving === "listing_type"}
                  onChange={(e) => {
                    const listing_type = e.target.value as ProjectListingType
                    void (async () => {
                      setSaving("listing_type")
                      await onSave({ listing_type })
                      setSaving(null)
                    })()
                  }}
                  className="w-full max-w-sm border border-[#e5e5e5] rounded-xl px-3 py-2 text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f] disabled:opacity-50"
                >
                  {(Object.keys(PROJECT_LISTING_TYPE_LABELS) as ProjectListingType[]).map((k) => (
                    <option key={k} value={k}>{PROJECT_LISTING_TYPE_LABELS[k]}</option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>
        <Toggle
          fieldKey="is_published"
          label="Published"
          description="Make this project visible to the public"
          icon={project.is_published ? Globe : EyeOff}
          value={project.is_published}
          accent="#16a34a"
        />
        <Toggle
          fieldKey="is_active"
          label="Active"
          description="Internal active status — affects listing visibility"
          icon={CheckCircle2}
          value={project.is_active}
          accent="#2563eb"
        />
        <Toggle
          fieldKey="is_featured"
          label="Featured"
          description="Show in featured projects carousel or highlights"
          icon={Star}
          value={project.is_featured}
          accent="#d6b357"
        />
        <Toggle
          fieldKey="is_premium"
          label="Premium"
          description="Mark as premium listing (may affect display priority)"
          icon={Gem}
          value={project.is_premium}
          accent="#7c3aed"
        />
        <Toggle
          fieldKey="direct_from_developer"
          label="Direct From Developer"
          description="Project sold directly by developer without agents"
          icon={Store}
          value={project.direct_from_developer}
        />
        <Toggle
          fieldKey="freehold"
          label="Freehold"
          description="Property can be owned outright by foreign nationals"
          icon={CheckCircle2}
          value={project.freehold}
          accent="#0891b2"
        />
        <Toggle
          fieldKey="installment_available"
          label="Installment Available"
          description="Payment via installment plans is available"
          icon={CheckCircle2}
          value={project.installment_available}
        />
      </div>
    </div>
  )
}
