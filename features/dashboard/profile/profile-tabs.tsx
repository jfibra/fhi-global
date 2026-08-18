"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { isDeveloperRole } from "@/lib/app-roles"
import type { DashboardProfile } from "./profile-form"
import { ChangePasswordSection } from "./change-password-section"
import { PhoneCountrySelect } from "@/components/phone-country-select"
import { NATIONALITIES } from "@/lib/nationalities"

// ─── Timezone options ──────────────────────────────────────────────────────────
const TIMEZONES = [
  { label: "UTC (UTC +00:00)", value: "UTC" },
  { label: "London (UTC +00:00)", value: "Europe/London" },
  { label: "Paris (UTC +01:00)", value: "Europe/Paris" },
  { label: "Cairo (UTC +02:00)", value: "Africa/Cairo" },
  { label: "Nairobi (UTC +03:00)", value: "Africa/Nairobi" },
  { label: "Dubai (UTC +04:00)", value: "Asia/Dubai" },
  { label: "Karachi (UTC +05:00)", value: "Asia/Karachi" },
  { label: "Colombo (UTC +05:30)", value: "Asia/Colombo" },
  { label: "Dhaka (UTC +06:00)", value: "Asia/Dhaka" },
  { label: "Bangkok (UTC +07:00)", value: "Asia/Bangkok" },
  { label: "Singapore (UTC +08:00)", value: "Asia/Singapore" },
  { label: "Manila (UTC +08:00)", value: "Asia/Manila" },
  { label: "Hong Kong (UTC +08:00)", value: "Asia/Hong_Kong" },
  { label: "Tokyo (UTC +09:00)", value: "Asia/Tokyo" },
  { label: "Seoul (UTC +09:00)", value: "Asia/Seoul" },
  { label: "Sydney (UTC +10:00)", value: "Australia/Sydney" },
  { label: "Auckland (UTC +12:00)", value: "Pacific/Auckland" },
  { label: "Azores (UTC -01:00)", value: "Atlantic/Azores" },
  { label: "New York (UTC -05:00)", value: "America/New_York" },
  { label: "Chicago (UTC -06:00)", value: "America/Chicago" },
  { label: "Denver (UTC -07:00)", value: "America/Denver" },
  { label: "Los Angeles (UTC -08:00)", value: "America/Los_Angeles" },
  { label: "Anchorage (UTC -09:00)", value: "America/Anchorage" },
  { label: "Honolulu (UTC -10:00)", value: "Pacific/Honolulu" },
]

// ─── Phone input sub-component ────────────────────────────────────────────────
function PhoneField({
  label,
  countryCode,
  number,
  onCountryChange,
  onNumberChange,
}: {
  label: string
  countryCode: string
  number: string
  onCountryChange: (v: string) => void
  onNumberChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">{label}</label>
      {/* One combined control: shared outer border, dial code divided from the
          number by a single inner rule. */}
      <div className="flex border border-[#e5e7eb] bg-white transition-colors focus-within:border-[#001f3f]">
        <PhoneCountrySelect
          value={countryCode}
          onChange={onCountryChange}
          ariaLabel={`${label} country calling code`}
          className="px-3 py-2.5 rounded-none border-0 border-r border-[#e5e7eb] focus:ring-0"
          style={{ minWidth: 90 }}
        />
        <input
          type="tel"
          value={number}
          onChange={(e) => onNumberChange(e.target.value.replace(/\D/g, ""))}
          placeholder="9123456789"
          className="flex-1 min-w-0 px-4 py-2.5 rounded-none border-0 bg-transparent focus:outline-none text-sm"
        />
      </div>
    </div>
  )
}

// ─── Metadata helpers ──────────────────────────────────────────────────────────
type MetadataShape = {
  phone_country_code?: string
  phone_number?: string
  whatsapp_country_code?: string
  whatsapp_number?: string
  bio?: string
  facebook?: string
  linkedin?: string
  license_number?: string
  nationality?: string
}

function toMetadata(metadata: Record<string, unknown> | null): MetadataShape {
  if (!metadata || typeof metadata !== "object") return {}
  const s = (k: string) => (typeof metadata[k] === "string" ? (metadata[k] as string) : "")
  return {
    phone_country_code:    s("phone_country_code") || "+971",
    phone_number:          s("phone_number"),
    whatsapp_country_code: s("whatsapp_country_code") || "+971",
    whatsapp_number:       s("whatsapp_number"),
    bio:                   s("bio"),
    facebook:              s("facebook"),
    linkedin:              s("linkedin"),
    license_number:        s("license_number"),
    nationality:           s("nationality"),
  }
}

function toISOStringDateOnly(input: string) {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().split("T")[0]
}

export function ProfileTabs({
  profile,
  onProfileChange,
  onSuccess,
  onError,
}: {
  profile: DashboardProfile
  onProfileChange: (next: DashboardProfile) => void
  onSuccess: (message: string) => void
  onError: (message: string) => void
}) {
  const isDeveloper = isDeveloperRole(profile.role)
  const [busySection, setBusySection] = useState<"profile" | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Bio auto-grow: expand to fit the text up to this cap; past it the user
  // drags the resize handle. Only grows — never shrinks a manual resize.
  const BIO_AUTO_MAX = 220
  const bioRef = useRef<HTMLTextAreaElement>(null)
  const autoGrowBio = () => {
    const el = bioRef.current
    if (!el) return
    const fit = Math.min(el.scrollHeight + 2, BIO_AUTO_MAX)
    if (fit > el.offsetHeight) el.style.height = `${fit}px`
  }
  // Fit any pre-existing multi-line bio on first render.
  useEffect(() => { autoGrowBio() }, [])

  const [profileInfo, setProfileInfo] = useState(() => ({
    fname: profile.fname ?? "",
    mname: profile.mname ?? "",
    lname: profile.lname ?? "",
    timezone: profile.timezone ?? "UTC",
    birthday: profile.birthday ?? "",
    gender: profile.gender ?? "",
    ...toMetadata(profile.metadata),
  }))

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return
      event.preventDefault()
      event.returnValue = "You have unsaved changes."
    }

    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [hasUnsavedChanges])

  const handleProfileFieldChange = (key: keyof typeof profileInfo, value: string) => {
    setHasUnsavedChanges(true)
    setProfileInfo((prev) => ({ ...prev, [key]: value }))
  }

  const logActivity = async (action: string, changes: Record<string, unknown>) => {
    try {
      const supabase = createClient()
      await supabase.from("profile_activity_logs").insert({
        user_id: profile.id,
        action,
        changes,
        created_at: new Date().toISOString(),
      })
    } catch {
      // optional table; ignore errors
    }
  }

  const handleSaveProfileInfo = async () => {
    if (!profileInfo.fname.trim() || !profileInfo.lname.trim()) {
      onError("First name and last name are required.")
      return
    }

    if (profileInfo.birthday && !toISOStringDateOnly(profileInfo.birthday)) {
      onError("Birthday must be a valid date.")
      return
    }

    const previous = profile

    // Auto-generate fullname
    const fullname = [profileInfo.fname, profileInfo.mname, profileInfo.lname]
      .map((p) => p.trim())
      .filter(Boolean)
      .join(" ")

    const nextMetadata = {
      ...(profile.metadata ?? {}),
      phone_country_code:    profileInfo.phone_country_code?.trim() || null,
      phone_number:          profileInfo.phone_number?.trim() || null,
      whatsapp_country_code: profileInfo.whatsapp_country_code?.trim() || null,
      whatsapp_number:       profileInfo.whatsapp_number?.trim() || null,
      bio:                   profileInfo.bio?.trim() || null,
      facebook:              profileInfo.facebook?.trim() || null,
      linkedin:              profileInfo.linkedin?.trim() || null,
      license_number:        profileInfo.license_number?.trim() || null,
      nationality:           profileInfo.nationality?.trim() || null,
    }

    const payload = {
      fname:    profileInfo.fname.trim(),
      mname:    profileInfo.mname.trim() || null,
      lname:    profileInfo.lname.trim(),
      fullname,
      timezone: profileInfo.timezone.trim() || "UTC",
      birthday: profileInfo.birthday ? toISOStringDateOnly(profileInfo.birthday) : null,
      gender:   profileInfo.gender.trim() || null,
      metadata: nextMetadata,
    }

    const optimistic = { ...profile, ...payload }
    onProfileChange(optimistic)
    setBusySection("profile")

    const supabase = createClient()
    // The browser client has no Database generic, so the chain is untyped —
    // cast the row instead of passing a type argument (TS2347).
    const { data, error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", profile.id)
      .select("id, role, fname, mname, lname, fullname, birthday, gender, profile_url, status, timezone, metadata, joined_at, updated_at, is_deleted, deleted_at")
      .single()

    setBusySection(null)

    if (error || !data) {
      onProfileChange(previous)
      onError(error?.message || "Failed to update profile info.")
      return
    }

    onProfileChange(data as DashboardProfile)
    setHasUnsavedChanges(false)
    onSuccess("Profile information updated.")
    await logActivity("profile_info_update", payload)
  }

  return (
    <section className="bg-white border border-[#e5e7eb] overflow-hidden">
      <div className="p-6">

        <div className="space-y-5">

            {/* Name row: 3 columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">First Name</label>
                <input
                  className="w-full px-5 py-2.5 border border-[#e5e7eb] bg-white transition-colors focus:outline-none focus:border-[#001f3f] text-sm"
                  value={profileInfo.fname}
                  onChange={(e) => handleProfileFieldChange("fname", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">Middle Name</label>
                <input
                  className="w-full px-5 py-2.5 border border-[#e5e7eb] bg-white transition-colors focus:outline-none focus:border-[#001f3f] text-sm"
                  value={profileInfo.mname}
                  onChange={(e) => handleProfileFieldChange("mname", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">Last Name</label>
                <input
                  className="w-full px-5 py-2.5 border border-[#e5e7eb] bg-white transition-colors focus:outline-none focus:border-[#001f3f] text-sm"
                  value={profileInfo.lname}
                  onChange={(e) => handleProfileFieldChange("lname", e.target.value)}
                />
              </div>
            </div>

            {/* Birthday, Gender, Nationality, Timezone */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">Birthday</label>
                <input
                  type="date"
                  className="w-full px-5 py-2.5 border border-[#e5e7eb] bg-white transition-colors focus:outline-none focus:border-[#001f3f] text-sm"
                  value={profileInfo.birthday ?? ""}
                  onChange={(e) => handleProfileFieldChange("birthday", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">Gender</label>
                <div className="relative">
                  <select
                    className="w-full px-5 py-2.5 border border-[#e5e7eb] bg-white transition-colors focus:outline-none focus:border-[#001f3f] text-sm appearance-none cursor-pointer"
                    value={profileInfo.gender}
                    onChange={(e) => handleProfileFieldChange("gender", e.target.value)}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">Nationality</label>
                <div className="relative">
                  <select
                    className="w-full px-5 py-2.5 border border-[#e5e7eb] bg-white transition-colors focus:outline-none focus:border-[#001f3f] text-sm appearance-none cursor-pointer"
                    value={profileInfo.nationality ?? ""}
                    onChange={(e) => handleProfileFieldChange("nationality", e.target.value)}
                  >
                    <option value="">Select nationality</option>
                    {NATIONALITIES.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">Timezone</label>
                <div className="relative">
                  <select
                    className="w-full px-5 py-2.5 border border-[#e5e7eb] bg-white transition-colors focus:outline-none focus:border-[#001f3f] text-sm appearance-none cursor-pointer"
                    value={profileInfo.timezone}
                    onChange={(e) => handleProfileFieldChange("timezone", e.target.value)}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Phone + WhatsApp */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PhoneField
                label="Phone"
                countryCode={profileInfo.phone_country_code ?? "+971"}
                number={profileInfo.phone_number ?? ""}
                onCountryChange={(v) => handleProfileFieldChange("phone_country_code", v)}
                onNumberChange={(v) => handleProfileFieldChange("phone_number", v)}
              />
              <PhoneField
                label="WhatsApp"
                countryCode={profileInfo.whatsapp_country_code ?? "+971"}
                number={profileInfo.whatsapp_number ?? ""}
                onCountryChange={(v) => handleProfileFieldChange("whatsapp_country_code", v)}
                onNumberChange={(v) => handleProfileFieldChange("whatsapp_number", v)}
              />
            </div>

            {/* LinkedIn + Facebook */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">LinkedIn</label>
                <input
                  className="w-full px-5 py-2.5 border border-[#e5e7eb] bg-white transition-colors focus:outline-none focus:border-[#001f3f] text-sm"
                  value={profileInfo.linkedin ?? ""}
                  onChange={(e) => handleProfileFieldChange("linkedin", e.target.value)}
                  placeholder="linkedin.com/in/yourname"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">Facebook</label>
                <input
                  className="w-full px-5 py-2.5 border border-[#e5e7eb] bg-white transition-colors focus:outline-none focus:border-[#001f3f] text-sm"
                  value={profileInfo.facebook ?? ""}
                  onChange={(e) => handleProfileFieldChange("facebook", e.target.value)}
                  placeholder="facebook.com/yourname"
                />
              </div>
            </div>

            {/* License Number */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">License Number</label>
              <input
                className="w-full px-5 py-2.5 border border-[#e5e7eb] bg-white transition-colors focus:outline-none focus:border-[#001f3f] text-sm"
                value={profileInfo.license_number ?? ""}
                onChange={(e) => handleProfileFieldChange("license_number", e.target.value)}
              />
            </div>

            {/* Bio — starts one input tall, auto-grows with the text up to
                BIO_AUTO_MAX, and stays manually resizable beyond that (auto-
                grow only ever expands, so it never fights a dragged height). */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">Bio</label>
              <textarea
                ref={bioRef}
                rows={1}
                className="w-full px-5 py-2.5 border border-[#e5e7eb] bg-white transition-colors focus:outline-none focus:border-[#001f3f] text-sm resize-y h-[84px] min-h-[42px]"
                value={profileInfo.bio ?? ""}
                onChange={(e) => {
                  handleProfileFieldChange("bio", e.target.value)
                  autoGrowBio()
                }}
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => void handleSaveProfileInfo()}
                disabled={busySection === "profile"}
                className="bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] text-white px-7 py-3 font-semibold text-sm transition-all hover:brightness-110 disabled:opacity-60 flex items-center gap-2"
              >
                {busySection === "profile" ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                ) : "Save Profile Info"}
              </button>
            </div>
            {/* Change password — developer accounts sign in with a password they can rotate.
                (Email changes live in the sidebar modal; developer emails are the
                username bridge and can't be changed.) */}
            {isDeveloper && (
              <div className="pt-8 border-t border-[#f0f0f0]">
                <ChangePasswordSection onSuccess={onSuccess} onError={onError} />
              </div>
            )}
          </div>

      </div>
    </section>
  )
}
