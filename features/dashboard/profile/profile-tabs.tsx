"use client"

import { useEffect, useMemo, useState } from "react"
import { Eye, EyeOff, Phone, MessageCircle, Lock, Check, X, ChevronDown } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { DashboardProfile } from "./profile-form"
import { BankAccountsTab } from "./bank-accounts-tab"
import { PhoneCountrySelect } from "@/components/phone-country-select"
import { NATIONALITIES } from "@/lib/nationalities"

type TabKey = "profile" | "account" | "bank_accounts"

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "profile",       label: "Profile Info" },
  { key: "account",       label: "Account Settings" },
  { key: "bank_accounts", label: "Bank Accounts" },
]

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
  icon: Icon,
  countryCode,
  number,
  onCountryChange,
  onNumberChange,
}: {
  label: string
  icon: React.ElementType
  countryCode: string
  number: string
  onCountryChange: (v: string) => void
  onNumberChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 ml-1">
        <Icon className="w-3.5 h-3.5 text-[#6b7280]" />
        <label className="text-xs font-bold uppercase tracking-wider text-[#374151]">{label}</label>
      </div>
      <div className="flex gap-2">
        <PhoneCountrySelect
          value={countryCode}
          onChange={onCountryChange}
          ariaLabel={`${label} country calling code`}
          className="px-3 py-3.5"
          style={{ minWidth: 90 }}
        />
        <input
          type="tel"
          value={number}
          onChange={(e) => onNumberChange(e.target.value.replace(/\D/g, ""))}
          placeholder="9123456789"
          className="flex-1 px-5 py-3.5 rounded-2xl border border-[#e5e5e5] bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm"
        />
      </div>
    </div>
  )
}

// ─── Password strength ─────────────────────────────────────────────────────────
type PwdStrength = { score: number; label: string; color: string }

const PWD_RULES = [
  { key: "length",    label: "Minimum 10 characters",          test: (p: string) => p.length >= 10 },
  { key: "upper",     label: "At least one uppercase letter",   test: (p: string) => /[A-Z]/.test(p) },
  { key: "lower",     label: "At least one lowercase letter",   test: (p: string) => /[a-z]/.test(p) },
  { key: "number",    label: "At least one number",             test: (p: string) => /[0-9]/.test(p) },
  { key: "special",   label: "At least one special character",  test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

function getStrength(password: string): PwdStrength {
  const score = PWD_RULES.filter((r) => r.test(password)).length
  if (score <= 1) return { score, label: "Weak",   color: "#ef4444" }
  if (score <= 2) return { score, label: "Fair",   color: "#f59e0b" }
  if (score <= 3) return { score, label: "Good",   color: "#3b82f6" }
  return           { score, label: "Strong", color: "#10b981" }
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
  email,
  onProfileChange,
  onSuccess,
  onError,
}: {
  profile: DashboardProfile
  email: string
  onProfileChange: (next: DashboardProfile) => void
  onSuccess: (message: string) => void
  onError: (message: string) => void
}) {
  const userId = profile.id
  const [activeTab, setActiveTab] = useState<TabKey>("profile")
  const [busySection, setBusySection] = useState<"profile" | "password" | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const [profileInfo, setProfileInfo] = useState(() => ({
    fname: profile.fname ?? "",
    mname: profile.mname ?? "",
    lname: profile.lname ?? "",
    timezone: profile.timezone ?? "UTC",
    birthday: profile.birthday ?? "",
    gender: profile.gender ?? "",
    ...toMetadata(profile.metadata),
  }))

  const [securityForm, setSecurityForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [showPwd, setShowPwd] = useState({ current: false, new: false, confirm: false })
  const pwdStrength = useMemo(() => getStrength(securityForm.newPassword), [securityForm.newPassword])

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return
      event.preventDefault()
      event.returnValue = "You have unsaved changes."
    }

    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [hasUnsavedChanges])

  const joinedDate = useMemo(() => {
    if (!profile.joined_at) return "—"
    const date = new Date(profile.joined_at)
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString()
  }, [profile.joined_at])

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
    const { data, error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", profile.id)
      .select("id, role, fname, mname, lname, fullname, birthday, gender, profile_url, status, timezone, metadata, joined_at, updated_at, is_deleted, deleted_at")
      .single<DashboardProfile>()

    setBusySection(null)

    if (error || !data) {
      onProfileChange(previous)
      onError(error?.message || "Failed to update profile info.")
      return
    }

    onProfileChange(data)
    setHasUnsavedChanges(false)
    onSuccess("Profile information updated.")
    await logActivity("profile_info_update", payload)
  }

  const handleChangePassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = securityForm

    if (!currentPassword || !newPassword || !confirmPassword) {
      onError("Please complete all password fields.")
      return
    }

    const failedRules = PWD_RULES.filter((r) => !r.test(newPassword))
    if (failedRules.length > 0) {
      onError(`Password must meet all requirements: ${failedRules.map((r) => r.label).join(", ")}.`)
      return
    }

    if (newPassword !== confirmPassword) {
      onError("New password and confirm password do not match.")
      return
    }

    if (!email) {
      onError("Email not available for password validation.")
      return
    }

    setBusySection("password")
    const supabase = createClient()

    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
    if (verifyError) {
      setBusySection(null)
      onError("Current password is incorrect.")
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setBusySection(null)

    if (updateError) {
      onError(updateError.message || "Failed to update password.")
      return
    }

    setSecurityForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
    onSuccess("Password changed successfully.")
    await logActivity("password_update", { updated: true })
  }

  return (
    <section className="bg-white/60 backdrop-blur-2xl rounded-[24px] border border-white/60 shadow-xl shadow-black/5 overflow-hidden">
      {/* ── Tab Bar ── */}
      <div className="border-b border-[#f0f0f0] px-6 pt-5">
        <div className="flex flex-wrap gap-2 pb-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`px-5 py-2 text-sm font-semibold rounded-full transition-all duration-200 ${
                activeTab === tab.key
                  ? "bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white shadow-md"
                  : "text-[#6b7280] hover:text-[#001f3f] hover:bg-[#f8fafc]"
              }`}
              onClick={() => setActiveTab(tab.key)}
              aria-selected={activeTab === tab.key}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 md:p-8">

        {/* ── Profile Info Tab ── */}
        {activeTab === "profile" && (
          <div className="space-y-5">

            {/* Name row: 3 columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">First Name *</label>
                <input
                  className="w-full px-5 py-3.5 rounded-2xl border border-[#e5e5e5] bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm"
                  value={profileInfo.fname}
                  onChange={(e) => handleProfileFieldChange("fname", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">Middle Name</label>
                <input
                  className="w-full px-5 py-3.5 rounded-2xl border border-[#e5e5e5] bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm"
                  value={profileInfo.mname}
                  onChange={(e) => handleProfileFieldChange("mname", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">Last Name *</label>
                <input
                  className="w-full px-5 py-3.5 rounded-2xl border border-[#e5e5e5] bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm"
                  value={profileInfo.lname}
                  onChange={(e) => handleProfileFieldChange("lname", e.target.value)}
                />
              </div>
            </div>

            {/* Full name preview (read-only) */}
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#f8fafc] border border-[#f0f0f0] text-sm text-[#6b7280]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">Full name preview</span>
              <span className="font-medium text-[#374151]">
                {[profileInfo.fname, profileInfo.mname, profileInfo.lname].map(p => p.trim()).filter(Boolean).join(" ") || "—"}
              </span>
            </div>

            {/* Birthday, Gender, Nationality, Timezone */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">Birthday</label>
                <input
                  type="date"
                  className="w-full px-5 py-3.5 rounded-2xl border border-[#e5e5e5] bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm"
                  value={profileInfo.birthday ?? ""}
                  onChange={(e) => handleProfileFieldChange("birthday", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">Gender</label>
                <div className="relative">
                  <select
                    className="w-full px-5 py-3.5 rounded-2xl border border-[#e5e5e5] bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm appearance-none cursor-pointer"
                    value={profileInfo.gender}
                    onChange={(e) => handleProfileFieldChange("gender", e.target.value)}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">Nationality</label>
                <div className="relative">
                  <select
                    className="w-full px-5 py-3.5 rounded-2xl border border-[#e5e5e5] bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm appearance-none cursor-pointer"
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
                    className="w-full px-5 py-3.5 rounded-2xl border border-[#e5e5e5] bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm appearance-none cursor-pointer"
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
                icon={Phone}
                countryCode={profileInfo.phone_country_code ?? "+971"}
                number={profileInfo.phone_number ?? ""}
                onCountryChange={(v) => handleProfileFieldChange("phone_country_code", v)}
                onNumberChange={(v) => handleProfileFieldChange("phone_number", v)}
              />
              <PhoneField
                label="WhatsApp"
                icon={MessageCircle}
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
                  className="w-full px-5 py-3.5 rounded-2xl border border-[#e5e5e5] bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm"
                  value={profileInfo.linkedin ?? ""}
                  onChange={(e) => handleProfileFieldChange("linkedin", e.target.value)}
                  placeholder="linkedin.com/in/yourname"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">Facebook</label>
                <input
                  className="w-full px-5 py-3.5 rounded-2xl border border-[#e5e5e5] bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm"
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
                className="w-full px-5 py-3.5 rounded-2xl border border-[#e5e5e5] bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm"
                value={profileInfo.license_number ?? ""}
                onChange={(e) => handleProfileFieldChange("license_number", e.target.value)}
              />
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">Bio</label>
              <textarea
                className="w-full px-5 py-4 rounded-2xl border border-[#e5e5e5] bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm resize-none min-h-[100px]"
                value={profileInfo.bio ?? ""}
                onChange={(e) => handleProfileFieldChange("bio", e.target.value)}
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => void handleSaveProfileInfo()}
                disabled={busySection === "profile"}
                className="bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-7 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-lg shadow-md disabled:opacity-60 disabled:translate-y-0 flex items-center gap-2"
              >
                {busySection === "profile" ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                ) : "Save Profile Info"}
              </button>
            </div>
          </div>
        )}

        {/* ── Account Settings Tab ── */}
        {activeTab === "account" && (
          <div className="space-y-8 max-w-2xl">
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-[#0d1117] font-['Outfit']">Account Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">Email</label>
                  <input className="w-full px-5 py-3.5 rounded-2xl border border-[#f0f0f0] bg-[#f8fafc] text-[#6b7280] text-sm cursor-not-allowed" value={email} readOnly />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">Role</label>
                  <input className="w-full px-5 py-3.5 rounded-2xl border border-[#f0f0f0] bg-[#f8fafc] text-[#6b7280] text-sm cursor-not-allowed" value={profile.role ?? "member"} readOnly />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">Joined Date</label>
                  <input className="w-full px-5 py-3.5 rounded-2xl border border-[#f0f0f0] bg-[#f8fafc] text-[#6b7280] text-sm cursor-not-allowed" value={joinedDate} readOnly />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-[#f0f0f0]">
              <h3 className="text-lg font-bold text-[#0d1117] font-['Outfit']">Change Password</h3>
              <div className="space-y-5">
                {/* Current password */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 ml-1">
                    <Lock className="w-3.5 h-3.5 text-[#6b7280]" />
                    <label className="text-xs font-bold uppercase tracking-wider text-[#374151]">Current Password</label>
                  </div>
                  <div className="relative">
                    <input
                      type={showPwd.current ? "text" : "password"}
                      className="w-full px-5 py-3.5 pr-12 rounded-2xl border border-[#e5e5e5] bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm"
                      value={securityForm.currentPassword}
                      onChange={(e) => setSecurityForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((p) => ({ ...p, current: !p.current }))}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#374151] transition-colors"
                    >
                      {showPwd.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* New password + strength */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 ml-1">
                    <Lock className="w-3.5 h-3.5 text-[#6b7280]" />
                    <label className="text-xs font-bold uppercase tracking-wider text-[#374151]">New Password</label>
                  </div>
                  <div className="relative">
                    <input
                      type={showPwd.new ? "text" : "password"}
                      className="w-full px-5 py-3.5 pr-12 rounded-2xl border border-[#e5e5e5] bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm"
                      value={securityForm.newPassword}
                      onChange={(e) => setSecurityForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((p) => ({ ...p, new: !p.new }))}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#374151] transition-colors"
                    >
                      {showPwd.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Strength bar */}
                  {securityForm.newPassword && (
                    <div className="space-y-2 mt-2">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 rounded-full bg-[#e5e5e5] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${(pwdStrength.score / PWD_RULES.length) * 100}%`,
                              backgroundColor: pwdStrength.color,
                            }}
                          />
                        </div>
                        <span className="text-xs font-bold" style={{ color: pwdStrength.color }}>
                          {pwdStrength.label}
                        </span>
                      </div>

                      {/* Rule checklist */}
                      <div className="grid grid-cols-1 gap-1.5 pt-1">
                        {PWD_RULES.map((rule) => {
                          const passed = rule.test(securityForm.newPassword)
                          return (
                            <div key={rule.key} className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${passed ? "bg-green-500" : "bg-[#e5e5e5]"}`}>
                                {passed
                                  ? <Check className="w-2.5 h-2.5 text-white" />
                                  : <X className="w-2.5 h-2.5 text-[#9ca3af]" />}
                              </div>
                              <span className={`text-xs transition-colors ${passed ? "text-green-600 font-medium" : "text-[#9ca3af]"}`}>
                                {rule.label}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 ml-1">
                    <Lock className="w-3.5 h-3.5 text-[#6b7280]" />
                    <label className="text-xs font-bold uppercase tracking-wider text-[#374151]">Confirm Password</label>
                  </div>
                  <div className="relative">
                    <input
                      type={showPwd.confirm ? "text" : "password"}
                      className="w-full px-5 py-3.5 pr-12 rounded-2xl border border-[#e5e5e5] bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm"
                      value={securityForm.confirmPassword}
                      onChange={(e) => setSecurityForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((p) => ({ ...p, confirm: !p.confirm }))}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#374151] transition-colors"
                    >
                      {showPwd.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {securityForm.confirmPassword && securityForm.newPassword !== securityForm.confirmPassword && (
                    <p className="text-xs text-rose-500 ml-1 flex items-center gap-1">
                      <X className="w-3 h-3" /> Passwords do not match
                    </p>
                  )}
                  {securityForm.confirmPassword && securityForm.newPassword === securityForm.confirmPassword && securityForm.newPassword && (
                    <p className="text-xs text-green-600 ml-1 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Passwords match
                    </p>
                  )}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => void handleChangePassword()}
                    disabled={busySection === "password"}
                    className="bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-7 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-lg shadow-md disabled:opacity-60 disabled:translate-y-0 flex items-center gap-2"
                  >
                    {busySection === "password" ? (
                      <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Updating…</>
                    ) : "Change Password"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Bank Accounts Tab ── */}
        {activeTab === "bank_accounts" && (
          <BankAccountsTab userId={userId} />
        )}

      </div>
    </section>
  )
}
