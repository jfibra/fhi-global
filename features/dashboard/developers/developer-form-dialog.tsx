"use client"

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import {
  X, Check, Building2, Globe, Phone, Mail, MapPin,
  Star, Landmark, Plus, Pencil, CalendarPlus, CalendarClock,
  ImageIcon, Upload, Trash2,
} from "lucide-react"
import {
  type Developer,
  type DeveloperFormData,
  generateSlug,
  createDeveloper,
  updateDeveloper,
  updateDeveloperLogoUrl,
} from "@/lib/developer-service"
import { formatDateTime, relativeTime } from "@/lib/utils"
import { DeveloperLogoUpload } from "./developer-logo-upload"

// ─── Portal ────────────────────────────────────────────────────────────────────
function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

const EMPTY_FORM: DeveloperFormData = {
  name:        "",
  slug:        "",
  description: "",
  website_url: "",
  phone:       "",
  email:       "",
  address:     "",
  rating:      null,
  is_verified: false,
  is_active:   true,
}

function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <label className="text-xs font-bold uppercase tracking-wider text-[#374151] ml-1 mb-2 block">
      {text}{required && " *"}
    </label>
  )
}

interface Props {
  open: boolean
  editDeveloper: Developer | null
  onClose: () => void
  onSaved: (dev: Developer, isEdit: boolean) => void
  onError: (msg: string) => void
}

export function DeveloperFormDialog({ open, editDeveloper, onClose, onSaved, onError }: Props) {
  const [form, setForm]   = useState<DeveloperFormData>(EMPTY_FORM)
  const [busy, setBusy]   = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof DeveloperFormData, string>>>({})
  const [slugManual, setSlugManual] = useState(false)
  // Add mode only: cropped logo held locally; uploaded to S3 when the developer is created.
  const [pendingLogo, setPendingLogo] = useState<{ blob: Blob; preview: string } | null>(null)
  const [showLogoPicker, setShowLogoPicker] = useState(false)

  const discardPendingLogo = useCallback(() => {
    setPendingLogo((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview)
      return null
    })
  }, [])

  useEffect(() => {
    if (!open) return
    setErrors({})
    setSlugManual(false)
    discardPendingLogo()
    setShowLogoPicker(false)
    if (editDeveloper) {
      setForm({
        name:        editDeveloper.name,
        slug:        editDeveloper.slug,
        description: editDeveloper.description ?? "",
        website_url: editDeveloper.website_url ?? "",
        phone:       editDeveloper.phone ?? "",
        email:       editDeveloper.email ?? "",
        address:     editDeveloper.address ?? "",
        rating:      editDeveloper.rating ?? null,
        is_verified: editDeveloper.is_verified,
        is_active:   editDeveloper.is_active,
      })
    } else {
      setForm(EMPTY_FORM)
    }
  }, [open, editDeveloper, discardPendingLogo])

  const set = <K extends keyof DeveloperFormData>(key: K, value: DeveloperFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleNameChange = (val: string) => {
    set("name", val)
    if (!slugManual) set("slug", generateSlug(val))
  }

  const validate = () => {
    const e: Partial<Record<keyof DeveloperFormData, string>> = {}
    if (!form.name.trim()) e.name = "Name is required."
    if (!form.slug.trim()) e.slug = "Slug is required."
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setBusy(true)
    try {
      if (editDeveloper) {
        const { data, error } = await updateDeveloper(editDeveloper.id, form)
        if (error || !data) { onError(error ?? "Failed to update."); return }
        onSaved(data, true)
      } else {
        const { data, error } = await createDeveloper(form)
        if (error || !data) { onError(error ?? "Failed to create."); return }

        // Upload the pending cropped logo now that the developer exists.
        let saved = data
        if (pendingLogo) {
          try {
            const fd = new FormData()
            fd.append("file", pendingLogo.blob, "logo.png")
            fd.append("developerSlug", form.slug.trim())
            const res = await fetch("/api/upload/developer", { method: "POST", body: fd })
            const json = (await res.json()) as { url?: string; error?: string }
            if (!res.ok || !json.url) {
              onError(json.error ?? "Developer created, but the logo upload failed. Use Upload Logo to retry.")
            } else {
              const { error: logoError } = await updateDeveloperLogoUrl(data.id, json.url)
              if (logoError) {
                onError(`Developer created, but saving the logo failed: ${logoError}`)
              } else {
                saved = { ...data, logo_url: json.url }
              }
            }
          } catch {
            onError("Developer created, but the logo upload failed. Use Upload Logo to retry.")
          }
        }
        onSaved(saved, false)
      }
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  const inp = "w-full px-5 py-3.5 rounded-2xl border bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm"

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />

        <div className="relative w-full sm:max-w-[min(1200px,calc(100%-3rem))] max-h-[95dvh] flex flex-col bg-white/90 backdrop-blur-2xl rounded-t-[32px] sm:rounded-[32px] border border-white/60 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#f0f0f0] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#001f3f] to-[#d6b357] flex items-center justify-center">
                {editDeveloper ? <Pencil className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
              </div>
              <div>
                <h3 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">
                  {editDeveloper ? "Edit Developer" : "Add Developer"}
                </h3>
                <p className="text-xs text-[#6b7280]">Real estate developer profile</p>
              </div>
            </div>
            <button type="button" onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-[#e5e5e5] text-[#6b7280] hover:text-[#0d1117] hover:border-[#0d1117] transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
            {/* Name + Slug */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel text="Developer Name" required />
                <input className={`${inp} ${errors.name ? "border-rose-400" : "border-[#e5e5e5]"}`}
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Ayala Land" />
                {errors.name && <p className="text-xs text-rose-500 mt-1 ml-1">{errors.name}</p>}
              </div>
              <div>
                <FieldLabel text="Slug" required />
                <input className={`${inp} font-mono ${errors.slug ? "border-rose-400" : "border-[#e5e5e5]"}`}
                  value={form.slug}
                  onChange={(e) => { setSlugManual(true); set("slug", e.target.value) }}
                  placeholder="e.g. ayala-land" />
                {errors.slug && <p className="text-xs text-rose-500 mt-1 ml-1">{errors.slug}</p>}
              </div>
            </div>

            {/* Logo (add mode only — edit uses the standalone Upload Logo dialog) */}
            {!editDeveloper && (
              <div>
                <FieldLabel text="Logo" />
                <div className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-[#e5e5e5] px-5 py-4">
                  <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-[#e5e5e5] bg-white flex items-center justify-center flex-shrink-0">
                    {pendingLogo ? (
                      // local blob preview — next/image can't optimize blob: URLs
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pendingLogo.preview} alt="Logo preview" className="absolute inset-0 w-full h-full object-contain p-1.5" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-[#c3c9d2]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#374151]">
                      {pendingLogo ? "Logo ready" : "No logo yet"}
                    </p>
                    <p className="text-xs text-[#6b7280]">
                      {pendingLogo
                        ? "Uploads to S3 when you add the developer."
                        : "PNG, JPG, WEBP, SVG • Max 10 MB • crop before saving"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button type="button" onClick={() => setShowLogoPicker(true)} disabled={busy}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border border-[#e5e5e5] text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] transition-all disabled:opacity-50">
                      <Upload className="w-3.5 h-3.5" /> {pendingLogo ? "Change" : "Upload Logo"}
                    </button>
                    {pendingLogo && (
                      <button type="button" onClick={discardPendingLogo} disabled={busy} aria-label="Remove logo"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-rose-200 text-rose-500 hover:bg-rose-50 transition-all disabled:opacity-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <FieldLabel text="Description" />
              <textarea className={`${inp} resize-none border-[#e5e5e5]`} rows={3}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Brief description of the developer…" />
            </div>

            {/* Website + Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel text="Website URL" />
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
                  <input className={`${inp} border-[#e5e5e5] pl-11`}
                    value={form.website_url}
                    onChange={(e) => set("website_url", e.target.value)}
                    placeholder="https://example.com" />
                </div>
              </div>
              <div>
                <FieldLabel text="Phone" />
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
                  <input className={`${inp} border-[#e5e5e5] pl-11`}
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="+971 4 xxx xxxx"
                    inputMode="tel" />
                </div>
              </div>
            </div>

            {/* Email + Address */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel text="Email" />
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
                  <input className={`${inp} border-[#e5e5e5] pl-11`}
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="info@developer.com"
                    inputMode="email" />
                </div>
              </div>
              <div>
                <FieldLabel text="Address" />
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
                  <input className={`${inp} border-[#e5e5e5] pl-11`}
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                    placeholder="Dubai, UAE" />
                </div>
              </div>
            </div>

            {/* Rating */}
            <div className="max-w-[180px]">
              <FieldLabel text="Rating (0–5)" />
              <div className="relative">
                <Star className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
                <input className={`${inp} border-[#e5e5e5] pl-11`}
                  type="number" min="0" max="5" step="0.1"
                  value={form.rating ?? ""}
                  onChange={(e) => set("rating", e.target.value === "" ? null : parseFloat(e.target.value))}
                  placeholder="4.5" />
              </div>
            </div>

            {/* Toggles */}
            <div className="flex flex-wrap gap-6">
              {([
                { key: "is_verified" as const, label: "Verified Developer", desc: "Mark as officially verified" },
                { key: "is_active"   as const, label: "Active",             desc: "Visible in listings" },
              ] as const).map(({ key, label, desc }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    role="checkbox" aria-checked={form[key] as boolean}
                    onClick={() => set(key, !(form[key] as boolean))}
                    className={`relative w-11 h-6 rounded-full transition-all flex-shrink-0 cursor-pointer ${
                      form[key] ? "bg-gradient-to-r from-[#001f3f] to-[#d6b357]" : "bg-[#e5e5e5]"
                    }`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                      form[key] ? "translate-x-5" : "translate-x-0.5"
                    }`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#374151]">{label}</p>
                    <p className="text-xs text-[#6b7280]">{desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Record info (edit only) — read-only audit timestamps */}
            {editDeveloper && (
              <div className="rounded-2xl border border-[#eef0f2] bg-[#f9fafb] px-5 py-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mb-3">Record Info</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-2.5">
                    <CalendarPlus className="w-4 h-4 text-[#9ca3af] mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-[#9ca3af]">Date added</p>
                      <p className="text-sm font-semibold text-[#374151]">{formatDateTime(editDeveloper.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CalendarClock className="w-4 h-4 text-[#9ca3af] mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-[#9ca3af]">Last updated</p>
                      <p className="text-sm font-semibold text-[#374151]">
                        {formatDateTime(editDeveloper.updated_at)}
                        <span className="font-normal text-[#9ca3af]"> · {relativeTime(editDeveloper.updated_at)}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#f0f0f0] flex-shrink-0">
            <button type="button" onClick={onClose}
              className="px-6 py-3 rounded-full border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] transition-all">
              Cancel
            </button>
            <button type="button" onClick={() => void handleSubmit()} disabled={busy}
              className="bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-7 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-lg shadow-md disabled:opacity-60 disabled:translate-y-0 flex items-center gap-2">
              {busy
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                : editDeveloper
                  ? <><Check className="w-4 h-4" /> Save Changes</>
                  : <><Plus className="w-4 h-4" /> Add Developer</>
              }
            </button>
          </div>
        </div>
      </div>

      {/* Logo picker/cropper (deferred mode — upload happens on Add Developer) */}
      {!editDeveloper && (
        <DeveloperLogoUpload
          open={showLogoPicker}
          developerSlug={form.slug.trim() || generateSlug(form.name) || "new-developer"}
          developerName={form.name.trim() || "New Developer"}
          currentLogoUrl={pendingLogo?.preview ?? null}
          onClose={() => setShowLogoPicker(false)}
          onCropped={(blob, previewUrl) => {
            discardPendingLogo()
            setPendingLogo({ blob, preview: previewUrl })
            setShowLogoPicker(false)
          }}
          onRemoved={() => {
            discardPendingLogo()
            setShowLogoPicker(false)
          }}
          onError={onError}
        />
      )}
    </Portal>
  )
}
