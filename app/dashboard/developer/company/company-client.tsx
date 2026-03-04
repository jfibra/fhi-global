"use client"

import { useCallback, useState } from "react"
import Image from "next/image"
import {
  Building2,
  Globe,
  Phone,
  Mail,
  MapPin,
  Camera,
  AlertCircle,
  Check,
  Save,
  ExternalLink,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard/shell"
import { getRoleColor } from "@/components/dashboard/sidebar-config"
import { roleToLabel } from "@/lib/auth"
import { DeveloperLogoUpload } from "@/app/dashboard/developers/developer-logo-upload"
import { updateDeveloperCompany, type DeveloperCompanyFormData } from "@/lib/developer-portal-service"
import type { Developer } from "@/lib/developer-service"

// â”€â”€â”€ Toast â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type ToastVariant = "success" | "error"
interface ToastMsg { id: number; variant: ToastVariant; message: string }

function ToastList({ toasts, remove }: { toasts: ToastMsg[]; remove: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold pointer-events-auto max-w-xs ${
            t.variant === "success"
              ? "bg-green-50 text-green-800 border border-green-100"
              : "bg-rose-50 text-rose-800 border border-rose-100"
          }`}
        >
          <span className="flex-1">{t.message}</span>
          <button type="button" onClick={() => remove(t.id)} className="opacity-60 hover:opacity-100 text-xs ml-2">âœ•</button>
        </div>
      ))}
    </div>
  )
}

// â”€â”€â”€ Slug generator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

// â”€â”€â”€ Field â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string
  icon?: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </label>
      {children}
    </div>
  )
}

// â”€â”€â”€ Input style â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const inputCls =
  "w-full rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 text-sm text-[#0d1117] placeholder-[#d1d5db] focus:outline-none focus:border-[#001f3f] focus:ring-2 focus:ring-[#001f3f]/10 transition-all"

const textareaCls =
  "w-full rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 text-sm text-[#0d1117] placeholder-[#d1d5db] focus:outline-none focus:border-[#001f3f] focus:ring-2 focus:ring-[#001f3f]/10 transition-all resize-none"

// â”€â”€â”€ No-developer placeholder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function NoDeveloperLinked() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center py-20">
      <div className="w-16 h-16 rounded-[28px] bg-indigo-50 flex items-center justify-center mb-5">
        <Building2 className="w-8 h-8 text-indigo-400" />
      </div>
      <h2 className="font-['Outfit'] text-xl font-bold text-[#0d1117] mb-2">No Developer Linked</h2>
      <p className="text-sm text-[#6b7280] max-w-sm">
        Your account hasn&apos;t been linked to a developer company yet. Please contact an administrator.
      </p>
    </div>
  )
}

// â”€â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function CompanyClient({
  userId,
  userName,
  developer: initialDeveloper,
}: {
  userId: string
  userName: string
  developer: Developer | null
}) {
  const [developer, setDeveloper] = useState<Developer | null>(initialDeveloper)
  const [saving, setSaving]       = useState(false)
  const [logoOpen, setLogoOpen]   = useState(false)
  const [toasts, setToasts]       = useState<ToastMsg[]>([])

  // Form state (synced from developer)
  const [form, setForm] = useState<DeveloperCompanyFormData>(() => ({
    name:        developer?.name        ?? "",
    slug:        developer?.slug        ?? "",
    description: developer?.description ?? "",
    website_url: developer?.website_url ?? "",
    phone:       developer?.phone       ?? "",
    email:       developer?.email       ?? "",
    address:     developer?.address     ?? "",
  }))

  const showToast = useCallback((variant: ToastVariant, message: string) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, variant, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: prev.slug === generateSlug(prev.name) ? generateSlug(name) : prev.slug,
    }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!developer) return

    if (!form.name.trim()) {
      showToast("error", "Developer name is required.")
      return
    }

    setSaving(true)
    const { data, error } = await updateDeveloperCompany(developer.id, form)
    setSaving(false)

    if (error) {
      showToast("error", error)
      return
    }

    if (data) setDeveloper(data)
    showToast("success", "Company information updated.")
  }

  return (
    <DashboardShell
      role="developer"
      roleLabel={roleToLabel("developer")}
      roleColor={getRoleColor("developer")}
      userName={userName}
    >
      {!developer ? (
        <NoDeveloperLinked />
      ) : (
        <form onSubmit={(e) => void handleSave(e)} className="space-y-8">
          {/* Header */}
          <div>
            <h2 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0d1117]">
              Company Information
            </h2>
            <p className="text-sm text-[#6b7280] mt-1">
              Manage your developer company profile. This information is visible on your listings.
            </p>
          </div>

          {/* Logo + identity card */}
          <div className="bg-white/70 backdrop-blur-xl rounded-[28px] border border-white/60 shadow-md shadow-black/5 p-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Logo */}
              <div className="relative shrink-0">
                <div className="w-24 h-24 rounded-[20px] border-2 border-[#e5e5e5] bg-[#f8fafc] overflow-hidden flex items-center justify-center">
                  {developer.logo_url ? (
                    <Image
                      src={developer.logo_url}
                      alt={developer.name}
                      width={96}
                      height={96}
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <Building2 className="w-10 h-10 text-[#d1d5db]" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setLogoOpen(true)}
                  className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-[#001f3f] text-white flex items-center justify-center shadow-lg hover:bg-indigo-700 transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Identity */}
              <div className="flex-1 text-center sm:text-left">
                <h3 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">{developer.name}</h3>
                <p className="text-sm text-[#9ca3af] font-mono mt-0.5">slug: {developer.slug}</p>
                <div className="flex items-center justify-center sm:justify-start gap-2 mt-2.5">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${developer.is_verified ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {developer.is_verified ? "âœ“ Verified" : "Unverified"}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${developer.is_active ? "bg-indigo-100 text-indigo-700" : "bg-rose-100 text-rose-700"}`}>
                    {developer.is_active ? "Active" : "Inactive"}
                  </span>
                  {(developer.rating ?? 0) > 0 && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                      â˜… {developer.rating}
                    </span>
                  )}
                </div>
              </div>

              {/* External link */}
              {developer.website_url && (
                <a
                  href={developer.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Visit Website
                </a>
              )}
            </div>
          </div>

          {/* Form fields */}
          <div className="bg-white/70 backdrop-blur-xl rounded-[28px] border border-white/60 shadow-md shadow-black/5 p-6 space-y-5">
            <h3 className="font-semibold text-[#0d1117] text-sm">Basic Information</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Company Name" icon={Building2}>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Ayala Land"
                  className={inputCls}
                  required
                />
              </Field>

              <Field label="Slug (URL)">
                <div className="relative">
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                    placeholder="e.g. ayala-land"
                    className={inputCls + " font-mono text-xs"}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#9ca3af]">
                    /developer/{form.slug || "slug"}
                  </span>
                </div>
              </Field>
            </div>

            <Field label="Description">
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Brief description of your company..."
                className={textareaCls}
              />
            </Field>
          </div>

          {/* Contact fields */}
          <div className="bg-white/70 backdrop-blur-xl rounded-[28px] border border-white/60 shadow-md shadow-black/5 p-6 space-y-5">
            <h3 className="font-semibold text-[#0d1117] text-sm">Contact Details</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Website URL" icon={Globe}>
                <input
                  type="url"
                  value={form.website_url}
                  onChange={(e) => setForm((p) => ({ ...p, website_url: e.target.value }))}
                  placeholder="https://www.company.com"
                  className={inputCls}
                />
              </Field>

              <Field label="Phone" icon={Phone}>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+63 2 1234 5678"
                  className={inputCls}
                />
              </Field>

              <Field label="Email" icon={Mail}>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="contact@company.com"
                  className={inputCls}
                />
              </Field>

              <Field label="Address" icon={MapPin}>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                  placeholder="123 Main St, City, Country"
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Verified status, rating, and active state are managed by administrators.
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-8 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-lg shadow-md disabled:opacity-50 disabled:translate-y-0 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Savingâ€¦
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Logo upload modal */}
      {developer && (
        <DeveloperLogoUpload
          open={logoOpen}
          developerId={developer.id}
          developerSlug={developer.slug}
          developerName={developer.name}
          currentLogoUrl={developer.logo_url}
          onClose={() => setLogoOpen(false)}
          onUploaded={(url) => {
            setDeveloper((prev) => prev ? { ...prev, logo_url: url } : prev)
            setLogoOpen(false)
            showToast("success", "Logo uploaded successfully.")
          }}
          onRemoved={() => {
            setDeveloper((prev) => prev ? { ...prev, logo_url: null } : prev)
            setLogoOpen(false)
            showToast("success", "Logo removed.")
          }}
          onError={(msg) => showToast("error", msg)}
        />
      )}

      <ToastList toasts={toasts} remove={removeToast} />
    </DashboardShell>
  )
}
