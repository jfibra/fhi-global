"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { X, Loader2, ChevronDown } from "lucide-react"
import {
  type Team,
  type TeamFormData,
  generateTeamSlug,
} from "@/lib/team-service"

const TEAM_TYPES = ["Sales", "Marketing", "Operations", "Finance", "HR", "Technical", "Other"]

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: TeamFormData) => Promise<void>
  initialData?: Team | null
  teams: Team[]   // full list for parent selector
}

const empty: TeamFormData = {
  name:        "",
  slug:        "",
  description: "",
  team_type:   "",
  parent_id:   null,
  is_active:   true,
}

export function TeamFormDialog({ open, onClose, onSave, initialData, teams }: Props) {
  const [form,    setForm]    = useState<TeamFormData>(empty)
  const [saving,  setSaving]  = useState(false)
  const [errors,  setErrors]  = useState<Record<string, string>>({})
  const [mounted, setMounted] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (open) {
      if (initialData) {
        setForm({
          name:        initialData.name,
          slug:        initialData.slug,
          description: initialData.description ?? "",
          team_type:   initialData.team_type ?? "",
          parent_id:   initialData.parent_id,
          is_active:   initialData.is_active,
        })
      } else {
        setForm(empty)
      }
      setErrors({})
      setTimeout(() => nameRef.current?.focus(), 80)
    }
  }, [open, initialData])

  if (!mounted || !open) return null

  const field = (key: keyof TeamFormData, val: string | boolean | null) => {
    setForm(prev => {
      const next = { ...prev, [key]: val }
      if (key === "name" && typeof val === "string" && !initialData) {
        next.slug = generateTeamSlug(val)
      }
      return next
    })
    setErrors(prev => { const e = { ...prev }; delete e[key as string]; return e })
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim())  e.name = "Name is required"
    if (!form.slug.trim())  e.slug = "Slug is required"
    if (form.parent_id === initialData?.id) e.parent_id = "Team cannot be its own parent"
    return e
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  // Available parent options â€” exclude current team and its subteams
  const excluded = new Set<string>()
  if (initialData) {
    excluded.add(initialData.id)
    teams.forEach(t => { if (t.parent_id && excluded.has(t.parent_id)) excluded.add(t.id) })
  }
  const parentOptions = teams.filter(t => !excluded.has(t.id) && !t.parent_id)

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full bg-white rounded-2xl shadow-2xl border border-[#e8eaed] flex flex-col"
        style={{ maxWidth: "min(780px, calc(100% - 2rem))", maxHeight: "calc(100dvh - 3rem)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f2f5] shrink-0">
          <div>
            <h2 className="font-['Outfit'] text-base font-bold text-[#0d1117]">
              {initialData ? "Edit Team" : "Create Team"}
            </h2>
            <p className="text-xs text-[#9ca3af] mt-0.5">
              {initialData ? "Update team details." : "Add a new team or subteam to the platform."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#f4f6f9] hover:bg-[#e8eaed] text-[#6b7280] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Name */}
            <div className="sm:col-span-2">
              <Label text="Team Name" required />
              <input
                ref={nameRef}
                value={form.name}
                onChange={e => field("name", e.target.value)}
                placeholder="e.g. Sales Team"
                className={inputCls(!!errors.name)}
              />
              {errors.name && <Err msg={errors.name} />}
            </div>

            {/* Slug */}
            <div>
              <Label text="Slug" required />
              <input
                value={form.slug}
                onChange={e => field("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                placeholder="e.g. sales-team"
                className={inputCls(!!errors.slug)}
              />
              {errors.slug && <Err msg={errors.slug} />}
            </div>

            {/* Team Type */}
            <div>
              <Label text="Team Type" />
              <div className="relative">
                <select
                  value={form.team_type}
                  onChange={e => field("team_type", e.target.value)}
                  className={selectCls(false)}
                >
                  <option value="">â€” Select type â€”</option>
                  {TEAM_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
              </div>
            </div>

            {/* Parent Team */}
            <div className="sm:col-span-2">
              <Label text="Parent Team" />
              <div className="relative">
                <select
                  value={form.parent_id ?? ""}
                  onChange={e => field("parent_id", e.target.value || null)}
                  className={selectCls(!!errors.parent_id)}
                >
                  <option value="">â€” None (main team) â€”</option>
                  {parentOptions.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
              </div>
              {form.parent_id && (
                <p className="text-[11px] text-[#0ea5e9] mt-1">
                  This team will be created as a subteam.
                </p>
              )}
              {errors.parent_id && <Err msg={errors.parent_id} />}
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <Label text="Description" />
              <textarea
                rows={3}
                value={form.description}
                onChange={e => field("description", e.target.value)}
                placeholder="Describe the purpose of this teamâ€¦"
                className={`${inputCls(false)} resize-none`}
              />
            </div>

            {/* Active toggle */}
            <div className="sm:col-span-2 flex items-center gap-3 p-4 rounded-xl bg-[#fafbfc] border border-[#f0f2f5]">
              <button
                type="button"
                onClick={() => field("is_active", !form.is_active)}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                  form.is_active ? "bg-[#10b981]" : "bg-[#d1d5db]"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                    form.is_active ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <div>
                <p className="text-xs font-semibold text-[#0d1117]">
                  {form.is_active ? "Active" : "Inactive"}
                </p>
                <p className="text-[11px] text-[#9ca3af]">
                  {form.is_active
                    ? "Members can be added to this team."
                    : "Inactive teams do not accept new members."}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#f0f2f5] bg-[#fafbfc] rounded-b-2xl shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-[#6b7280] bg-white border border-[#e8eaed] hover:bg-[#f4f6f9] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-[#001f3f] hover:bg-[#002a56] disabled:opacity-50 flex items-center gap-2 transition-all"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {initialData ? "Save Changes" : "Create Team"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-[#374151] mb-1.5">
      {text} {required && <span className="text-rose-500">*</span>}
    </label>
  )
}

function Err({ msg }: { msg: string }) {
  return <p className="text-xs text-rose-500 mt-1">{msg}</p>
}

function inputCls(hasError: boolean) {
  return `w-full px-3 py-2.5 rounded-xl border text-sm transition-all outline-none font-sans
    ${hasError
      ? "border-rose-300 bg-rose-50 focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
      : "border-[#e8eaed] bg-white focus:border-[#001f3f] focus:ring-2 focus:ring-[#001f3f]/10"
    }
    placeholder:text-[#9ca3af] text-[#0d1117]`
}

function selectCls(hasError: boolean) {
  return `w-full appearance-none px-3 py-2.5 pr-10 rounded-xl border text-sm transition-all outline-none font-sans bg-white
    ${hasError
      ? "border-rose-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
      : "border-[#e8eaed] focus:border-[#001f3f] focus:ring-2 focus:ring-[#001f3f]/10"
    }
    text-[#0d1117]`
}
