"use client"

import { useState } from "react"
import { X, ChevronDown, Edit3, CheckCircle, Loader2 } from "lucide-react"
import { PhoneCountrySelect } from "@/components/phone-country-select"
import { UserAvatar } from "@/components/user-avatar"
import { NATIONALITIES } from "@/lib/nationalities"
import { ROLE_OPTIONS, STATUS_OPTIONS, getUserDisplayName } from "@/lib/user-service"
import type { UserRecord } from "@/lib/user-service"

type ReferrerOption = { id: string; fullname: string; role: string }
type BannerType = "success" | "error"

const TIMEZONES = [
  { label: "Dubai (UTC +04:00)", value: "Asia/Dubai" },
  { label: "UTC (UTC +00:00)", value: "UTC" },
  { label: "London (UTC +00:00)", value: "Europe/London" },
  { label: "Manila (UTC +08:00)", value: "Asia/Manila" },
  { label: "Singapore (UTC +08:00)", value: "Asia/Singapore" },
  { label: "Karachi (UTC +05:00)", value: "Asia/Karachi" },
  { label: "New Delhi (UTC +05:30)", value: "Asia/Kolkata" },
  { label: "Riyadh (UTC +03:00)", value: "Asia/Riyadh" },
  { label: "Cairo (UTC +02:00)", value: "Africa/Cairo" },
  { label: "Paris (UTC +01:00)", value: "Europe/Paris" },
  { label: "New York (UTC -05:00)", value: "America/New_York" },
  { label: "Los Angeles (UTC -08:00)", value: "America/Los_Angeles" },
  { label: "Sydney (UTC +10:00)", value: "Australia/Sydney" },
  { label: "Tokyo (UTC +09:00)", value: "Asia/Tokyo" },
]

const fieldBase =
  "peer w-full h-12 rounded-xl border border-[#d0d5dd] bg-white text-sm text-[#111827] focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/10 transition-all disabled:bg-white disabled:text-[#111827] disabled:cursor-default"

const floatLabel =
  "pointer-events-none absolute left-3 -translate-y-1/2 bg-white px-1.5 transition-all duration-150 " +
  "top-0 text-[11px] text-[#374151] " +
  "peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-[#9ca3af] " +
  "peer-focus:top-0 peer-focus:text-[11px] peer-focus:text-[#001f3f] peer-focus:font-medium"

function FloatingInput({
  label, value, onChange, type = "text", disabled, inputMode,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  disabled?: boolean
  inputMode?: "text" | "tel"
}) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        disabled={disabled}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        placeholder=" "
        className={`${fieldBase} px-4`}
      />
      <label className={floatLabel}>{label}</label>
    </div>
  )
}

// Selects (and date) always keep the label floated — they always show content.
function FloatingSelect({
  label, value, onChange, children,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${fieldBase} px-4 pr-9 appearance-none cursor-pointer`}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
      <label className="pointer-events-none absolute left-3 top-0 -translate-y-1/2 bg-white px-1.5 text-[11px] font-medium text-[#374151]">{label}</label>
    </div>
  )
}

export function UserProfileModal({
  user, referrers, onClose, onSaved, onBanner,
}: {
  user: UserRecord
  referrers: ReferrerOption[]
  onClose: () => void
  onSaved: () => void
  onBanner: (type: BannerType, msg: string) => void
}) {
  const [readOnly, setReadOnly] = useState(true)
  const [busy, setBusy] = useState(false)

  const m = user.metadata ?? {}
  const s = (v: unknown) => (typeof v === "string" ? v : "")
  const [f, setF] = useState({
    fname: user.fname ?? "",
    mname: user.mname ?? "",
    lname: user.lname ?? "",
    birthday: user.birthday ?? "",
    gender: user.gender ?? "",
    nationality: s(m.nationality),
    timezone: user.timezone ?? "Asia/Dubai",
    phone_country_code: s(m.phone_country_code) || "+971",
    phone_number: s(m.phone_number),
    whatsapp_country_code: s(m.whatsapp_country_code) || "+971",
    whatsapp_number: s(m.whatsapp_number),
    license_number: s(m.license_number),
    role: (user.role ?? "member").toLowerCase(),
    status: (user.status ?? "active").toLowerCase(),
    invited_by: s(m.invited_by),
  })
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))

  const displayName = getUserDisplayName(user)

  const save = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fname: f.fname, mname: f.mname, lname: f.lname,
          birthday: f.birthday || null, gender: f.gender || null,
          timezone: f.timezone, role: f.role, status: f.status,
          invited_by: f.invited_by || null,
          phone_country_code: f.phone_country_code, phone_number: f.phone_number,
          whatsapp_country_code: f.whatsapp_country_code, whatsapp_number: f.whatsapp_number,
          nationality: f.nationality, license_number: f.license_number,
        }),
      })
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(d.error ?? "Couldn't save the profile.")
      }
      onBanner("success", "User updated.")
      onSaved()
      onClose()
    } catch (e) {
      onBanner("error", e instanceof Error ? e.message : "Couldn't save the profile.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={busy ? undefined : onClose} aria-hidden />

      <div role="dialog" aria-modal="true" className="relative w-full max-w-2xl my-8 bg-white rounded-2xl shadow-[0_30px_90px_-20px_rgba(0,10,30,0.6)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[#f0f2f5]">
          <UserAvatar name={displayName} imageUrl={user.profile_url} size={40} />
          <div className="min-w-0 flex-1">
            <h3 className="font-['Outfit'] text-lg font-bold text-[#0d1117] truncate">{displayName}</h3>
            <p className="text-xs text-[#9ca3af]">{readOnly ? "Viewing profile" : "Editing profile"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#f4f6f9] hover:bg-[#e8eaed] text-[#6b7280] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto max-h-[70vh] px-6 py-6">
          <fieldset disabled={readOnly || busy} className="contents">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FloatingInput label="First name" value={f.fname} onChange={(v) => set("fname", v)} />
                <FloatingInput label="Middle name" value={f.mname} onChange={(v) => set("mname", v)} />
                <FloatingInput label="Last name" value={f.lname} onChange={(v) => set("lname", v)} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FloatingInput label="Birthday" type="date" value={f.birthday} onChange={(v) => set("birthday", v)} />
                <FloatingSelect label="Gender" value={f.gender} onChange={(v) => set("gender", v)}>
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </FloatingSelect>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FloatingSelect label="Nationality" value={f.nationality} onChange={(v) => set("nationality", v)}>
                  <option value="">Select nationality</option>
                  {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
                </FloatingSelect>
                <FloatingSelect label="Timezone" value={f.timezone} onChange={(v) => set("timezone", v)}>
                  {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                </FloatingSelect>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex gap-2">
                  <PhoneCountrySelect value={f.phone_country_code} onChange={(v) => set("phone_country_code", v)} ariaLabel="Phone country code" className="shrink-0 h-12 px-3 rounded-xl" />
                  <div className="flex-1"><FloatingInput label="Phone" value={f.phone_number} onChange={(v) => set("phone_number", v)} inputMode="tel" /></div>
                </div>
                <div className="flex gap-2">
                  <PhoneCountrySelect value={f.whatsapp_country_code} onChange={(v) => set("whatsapp_country_code", v)} ariaLabel="WhatsApp country code" className="shrink-0 h-12 px-3 rounded-xl" />
                  <div className="flex-1"><FloatingInput label="WhatsApp" value={f.whatsapp_number} onChange={(v) => set("whatsapp_number", v)} inputMode="tel" /></div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FloatingInput label="License number" value={f.license_number} onChange={(v) => set("license_number", v)} />
                <FloatingSelect label="Role" value={f.role} onChange={(v) => set("role", v)}>
                  {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </FloatingSelect>
                <FloatingSelect label="Status" value={f.status} onChange={(v) => set("status", v)}>
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </FloatingSelect>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Email is not editable here (identity/login) — always read-only. */}
                <FloatingInput label="Email" value={user.email ?? ""} onChange={() => {}} disabled />
                <FloatingSelect
                  label="Referred by"
                  value={referrers.some((r) => r.id === f.invited_by) ? f.invited_by : ""}
                  onChange={(v) => set("invited_by", v)}
                >
                  <option value="">— None —</option>
                  {referrers.filter((r) => r.id !== user.id).map((r) => (
                    <option key={r.id} value={r.id}>{r.fullname}</option>
                  ))}
                </FloatingSelect>
              </div>
            </div>
          </fieldset>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-[#f0f2f5]">
          {/* Edit Profile — left. Colored while viewing, white while editing (click to stop editing). */}
          <button
            type="button"
            onClick={() => setReadOnly((v) => !v)}
            disabled={busy}
            className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-full font-semibold text-sm transition-all duration-300 disabled:opacity-70 ${
              readOnly
                ? "bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white shadow-md hover:translate-y-[-1px] hover:shadow-lg"
                : "bg-white text-[#4b5563] border border-[#e5e5e5] hover:border-[#001f3f]"
            }`}
          >
            {readOnly ? <Edit3 className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {readOnly ? "Edit Profile" : "Cancel"}
          </button>
          {/* Save Changes — right. White & disabled while viewing, colored while editing. */}
          <button
            type="button"
            onClick={() => void save()}
            disabled={readOnly || busy}
            className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-full font-semibold text-sm transition-all duration-300 ${
              readOnly
                ? "bg-white text-[#9ca3af] border border-[#e5e5e5] cursor-not-allowed"
                : "bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white shadow-md hover:translate-y-[-1px] hover:shadow-lg disabled:opacity-70"
            }`}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {busy ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  )
}
