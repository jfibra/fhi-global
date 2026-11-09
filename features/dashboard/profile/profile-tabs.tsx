"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { isDeveloperRole } from "@/lib/app-roles"
import type { DashboardProfile } from "./profile-form"
import { ChangePasswordSection } from "./change-password-section"
import { BrokerDetailsModal, fetchBroker } from "./broker-details-modal"
import { SearchSelect } from "./search-select"
import { BrnField, EMPTY_BRN_LOOKUP, isBrn, type BrnLookup } from "./brn-field"
import { PhoneCountrySelect } from "@/components/phone-country-select"
import { NATIONALITIES } from "@/lib/nationalities"
import { BRN_REQUIRED_PARAM, PROFILE_SAVED_EVENT, needsBrnAnswer, type ProfileSavedDetail } from "@/lib/brn-required"

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

/** Name suffixes offered on the profile (profiles.suffix, migration 086). */
const BRN_TOAST_ID = "brn-required"

const NAME_SUFFIXES = ["Jr.", "Sr.", "II", "III", "IV", "V"]

/**
 * Suffix: a plain input — type anything, or click it and pick a common
 * suffix from the list that opens under it (filtered as you type). Our own
 * list, not a <datalist>, so no browser adds a dropdown arrow.
 */
function SuffixInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const needle = value.trim().toLowerCase()
  const options = NAME_SUFFIXES.filter((s) => !needle || s.toLowerCase().startsWith(needle) && s.toLowerCase() !== needle)

  return (
    <div className="relative md:w-24">
      <input
        className="block w-full px-4 py-2.5 border border-[#e5e7eb] bg-white transition-colors focus:outline-none focus:border-[#001f3f] text-sm"
        value={value}
        onChange={(e) => {
          onChange(e.target.value.slice(0, 10))
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false) }}
        placeholder="Jr."
        maxLength={10}
        autoComplete="off"
        aria-label="Suffix"
        aria-expanded={open && options.length > 0}
        aria-controls="name-suffix-options"
        role="combobox"
      />
      {open && options.length > 0 && (
        <ul
          id="name-suffix-options"
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 border border-[#e5e7eb] bg-white py-1 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.2)]"
        >
          {options.map((sfx) => (
            <li
              key={sfx}
              role="option"
              aria-selected={value === sfx}
              // mousedown, not click: picks before the input's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(sfx)
                setOpen(false)
              }}
              className="cursor-pointer px-4 py-1.5 text-sm text-[#111827] hover:bg-[#f3f6fa]"
            >
              {sfx}
            </li>
          ))}
        </ul>
      )}
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
  /** "1" when the person ticked "I'm not a broker" (metadata.not_broker). */
  not_broker?: string
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
    not_broker:            metadata.not_broker === true ? "1" : "",
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
  const [brokerOpen, setBrokerOpen] = useState(false)
  const [brnLookup, setBrnLookup] = useState<BrnLookup>(EMPTY_BRN_LOOKUP)
  // Saved profile still owes a BRN answer → the notice above the field. The
  // dashboard gate sends people here with ?brn=required: scroll to the field.
  const brnRequired = needsBrnAnswer(profile.metadata)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get(BRN_REQUIRED_PARAM) !== "required") return
    const input = document.getElementById("rera-brn")
    input?.scrollIntoView({ block: "center", behavior: "smooth" })
    input?.focus({ preventScroll: true })
  }, [])
  // …and a snackbar (bottom right, like the rest of the dashboard) saying why they're here, until it's answered.
  useEffect(() => {
    if (!brnRequired) {
      toast.dismiss(BRN_TOAST_ID)
      return
    }
    toast.error("Please provide your BRN", {
      id: BRN_TOAST_ID,
      duration: 10000,
    })
  }, [brnRequired])

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
    suffix: profile.suffix ?? "",
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

  // The broker found for the BRN currently in the field (stale results don't count).
  const foundBroker =
    brnLookup.state.kind === "ok" && brnLookup.brn === (profileInfo.license_number ?? "").trim() ? brnLookup.state : undefined

  const handleSaveProfileInfo = async () => {
    if (!profileInfo.fname.trim() || !profileInfo.lname.trim()) {
      onError("First name and last name are required.")
      return
    }

    if (profileInfo.birthday && !toISOStringDateOnly(profileInfo.birthday)) {
      onError("Birthday must be a valid date.")
      return
    }

    // Every account answers the BRN (lib/brn-required.ts): a real broker in the
    // DLD register, or "I'm not a broker". Not searched yet → check it now.
    const brn = profileInfo.not_broker === "1" ? "" : (profileInfo.license_number ?? "").trim()
    if (!brn && profileInfo.not_broker !== "1") {
      onError("Enter your BRN (Broker Registration Number), or tick “I'm not a broker”.")
      document.getElementById("rera-brn")?.focus()
      return
    }
    if (brn) {
      if (!isBrn(brn)) {
        onError("BRN must be numbers only — or leave it empty if you're not a broker.")
        return
      }
      let check = brnLookup.brn === brn ? brnLookup.state : null
      if (check?.kind !== "ok") {
        setBusySection("profile")
        setBrnLookup({ brn, state: { kind: "loading" } })
        check = await fetchBroker(brn, false)
        setBrnLookup({ brn, state: check })
        setBusySection(null)
      }
      if (check.kind !== "ok") {
        const savedBrn = String(profile.metadata?.license_number ?? "").trim()
        const dldDown = check.kind === "error" && !check.notFound
        // DLD unreachable and the BRN wasn't changed: don't block the rest of the profile.
        if (!(dldDown && brn === savedBrn)) {
          onError(
            dldDown
              ? "Couldn't check your BRN with the Dubai Land Department right now. Try again in a moment, or clear the BRN to save the rest."
              : `BRN ${brn} isn't in the Dubai Land Department register. Fix it, or tick “I'm not a broker”.`,
          )
          return
        }
      }
    }

    const previous = profile

    // Auto-generate fullname
    // Suffix (Jr., Sr., III …) ends the full name: "Juan Dela Cruz Jr."
    const fullname = [profileInfo.fname, profileInfo.mname, profileInfo.lname, profileInfo.suffix]
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
      // "I'm not a broker" saves no BRN and records the choice.
      license_number:        profileInfo.not_broker === "1" ? null : profileInfo.license_number?.trim() || null,
      not_broker:            profileInfo.not_broker === "1" ? true : null,
      nationality:           profileInfo.nationality?.trim() || null,
    }

    const payload = {
      fname:    profileInfo.fname.trim(),
      mname:    profileInfo.mname.trim() || null,
      lname:    profileInfo.lname.trim(),
      suffix:   profileInfo.suffix.trim() || null,
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
      .select("id, role, fname, mname, lname, suffix, fullname, birthday, gender, profile_url, status, timezone, metadata, joined_at, updated_at, is_deleted, deleted_at")
      .single()

    setBusySection(null)

    if (error || !data) {
      onProfileChange(previous)
      onError(error?.message || "Failed to update profile info.")
      return
    }

    onProfileChange(data as DashboardProfile)
    // The dashboard gate redirects here until the BRN is answered — tell it.
    window.dispatchEvent(
      new CustomEvent<ProfileSavedDetail>(PROFILE_SAVED_EVENT, {
        detail: { metadata: (data as DashboardProfile).metadata ?? null },
      }),
    )
    setHasUnsavedChanges(false)
    onSuccess("Profile information updated.")
    await logActivity("profile_info_update", payload)
  }

  return (
    <section className="bg-white border border-[#e5e7eb] overflow-hidden">
      <div className="p-6">

        <div className="space-y-5">

            {/* Name row: first / middle / last + a narrow suffix */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-4">
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
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">Suffix</label>
                <SuffixInput
                  value={profileInfo.suffix ?? ""}
                  onChange={(v) => handleProfileFieldChange("suffix", v)}
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
                <SearchSelect
                  value={profileInfo.nationality ?? ""}
                  onChange={(v) => handleProfileFieldChange("nationality", v)}
                  options={NATIONALITIES}
                  placeholder="Search or select nationality"
                  ariaLabel="Nationality"
                />
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

            {/* RERA BRN — stored as metadata.license_number. The label says what the number IS: a trade-licence
                number typed here would otherwise be read as a broker registration. Search checks it against the DLD
                register and shows licence end, ORN and brokerage (brn-field.tsx). */}
            <BrnField
              value={profileInfo.license_number ?? ""}
              onChange={(v) => handleProfileFieldChange("license_number", v)}
              lookup={brnLookup}
              onLookup={setBrnLookup}
              required={brnRequired}
              notBroker={profileInfo.not_broker === "1"}
              onNotBrokerChange={(next) => {
                handleProfileFieldChange("not_broker", next ? "1" : "")
                if (next) handleProfileFieldChange("license_number", "")
              }}
            />

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

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              {/* Save state, left of the buttons: unsaved edits vs everything saved. */}
              <p className="flex items-center gap-2 text-xs font-semibold" aria-live="polite">
                {hasUnsavedChanges ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-[#d97706]" aria-hidden />
                    <span className="text-[#92400e]">Unsaved changes — click Save Profile Info</span>
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-[#16a34a]" aria-hidden />
                    <span className="text-[#166534]">All changes saved</span>
                  </>
                )}
              </p>
              <div className="flex flex-wrap justify-end gap-3">
                {/* Enabled only once the BRN above was found; opens on that result, no second lookup. */}
                <button
                  type="button"
                  onClick={() => setBrokerOpen(true)}
                  disabled={!foundBroker}
                  title={foundBroker ? undefined : "Search a BRN that's in the DLD register first"}
                  className="border border-[#001f3f] text-[#001f3f] bg-white px-7 py-3 font-semibold text-sm transition-colors hover:bg-[#f3f6fa] disabled:cursor-not-allowed disabled:border-[#d1d5db] disabled:text-[#9ca3af] disabled:hover:bg-white"
                >
                  Open Broker Details
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveProfileInfo()}
                  disabled={busySection === "profile" || !hasUnsavedChanges}
                  className="bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] text-white px-7 py-3 font-semibold text-sm transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:brightness-100 flex items-center gap-2"
                >
                  {busySection === "profile" ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                  ) : "Save Profile Info"}
                </button>
              </div>
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
      {brokerOpen && foundBroker && (
        <BrokerDetailsModal brn={brnLookup.brn} initial={foundBroker} onClose={() => setBrokerOpen(false)} />
      )}
    </section>
  )
}
