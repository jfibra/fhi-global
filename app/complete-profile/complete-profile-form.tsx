"use client"

import { useActionState, useState } from "react"
import { Camera, ChevronDown, ArrowRight, AlertCircle } from "lucide-react"
import { PhoneCountrySelect } from "@/components/phone-country-select"
import { ProfileAvatarUpload } from "@/components/profile-avatar-upload"
import { NATIONALITIES } from "@/lib/nationalities"
import { completeProfileAction, type CompleteProfileState } from "./actions"

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

export type CompleteProfileInitial = {
  fname: string; mname: string; lname: string
  birthday: string; gender: string; nationality: string; timezone: string
  phone_country_code: string; phone_number: string
  whatsapp_country_code: string; whatsapp_number: string
  linkedin: string; facebook: string; license_number: string; bio: string
}

const initialState: CompleteProfileState = {}

const fieldBase =
  "peer w-full h-14 rounded-xl border border-[#d0d5dd] bg-white text-base text-[#111827] focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/10 transition-all"

// Floating label: centered as a placeholder when empty/blurred, snaps onto the
// top border (small, accented) on focus or when filled.
const floatLabel =
  "pointer-events-none absolute left-3 -translate-y-1/2 bg-white px-1.5 transition-all duration-150 " +
  "top-0 text-xs text-[#374151] " +
  "peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-base peer-placeholder-shown:text-[#9ca3af] " +
  "peer-focus:top-0 peer-focus:text-xs peer-focus:text-[#001f3f] peer-focus:font-medium"

function FloatingInput({
  name, label, type = "text", defaultValue, required, inputMode, className = "",
}: {
  name: string; label: string; type?: string; defaultValue?: string
  required?: boolean; inputMode?: "text" | "tel" | "email"; className?: string
}) {
  return (
    <div className="relative">
      <input
        id={name}
        name={name}
        type={type}
        inputMode={inputMode}
        defaultValue={defaultValue}
        required={required}
        placeholder=" "
        className={`${fieldBase} px-4 ${className}`}
      />
      <label htmlFor={name} className={floatLabel}>{label}{required ? " *" : ""}</label>
    </div>
  )
}

// Select / date always keep the label floated (they always show content).
function FloatingSelect({
  name, label, defaultValue, required, children,
}: {
  name: string; label: string; defaultValue?: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div className="relative">
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        required={required}
        className={`${fieldBase} px-4 pr-10 appearance-none cursor-pointer`}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
      <label htmlFor={name} className="pointer-events-none absolute left-3 -top-0 -translate-y-1/2 bg-white px-1.5 text-xs font-medium text-[#374151]">
        {label}{required ? " *" : ""}
      </label>
    </div>
  )
}

export function CompleteProfileForm({
  initial,
  userId,
  displayName,
  initialAvatarUrl,
}: {
  initial: CompleteProfileInitial
  userId: string
  displayName: string
  initialAvatarUrl: string
}) {
  const [state, formAction, pending] = useActionState(completeProfileAction, initialState)
  const [phoneCode, setPhoneCode] = useState(initial.phone_country_code || "+971")
  const [waCode, setWaCode] = useState(initial.whatsapp_country_code || "+971")

  // Optional photo. The cropper (the same one Profile settings uses) uploads to
  // /api/upload/avatar and hands back the URL; the server action persists it as
  // profile_url. Not required here: the ProfilePhotoGate modal in the dashboard
  // shell enforces the photo for every role, so this form stays about the
  // written details and never blocks on an upload.
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState("")

  return (
    <div className="min-h-screen bg-white py-10 px-4">
      <div className="mx-auto w-full max-w-4xl">
        <form action={formAction} className="space-y-5">
          {/* Photo — a profile-style circle with the camera badge on the rim;
              the whole thing opens the same cropper the Profile settings page
              uses. Adding it here is a head start on the dashboard's photo
              gate, not a requirement of this form. */}
          <input type="hidden" name="profile_url" value={avatarUrl} />
          <div className="flex flex-col items-center gap-2 pb-1">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              disabled={avatarBusy}
              aria-label={avatarUrl ? "Change your photo" : "Add your photo"}
              className="relative shrink-0 focus-visible:outline-none group"
            >
              <span className="block w-28 h-28 rounded-full overflow-hidden bg-[#f4f6f9] ring-4 ring-white shadow-[0_2px_12px_rgba(0,31,63,0.12)] flex items-center justify-center transition-shadow group-focus-visible:ring-[#001f3f]/25">
                {avatarBusy ? (
                  <span className="w-7 h-7 m-auto border-2 border-[#001f3f]/20 border-t-[#001f3f] rounded-full animate-spin" />
                ) : avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Your profile photo" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-9 h-9 m-auto text-[#c3c9d2]" />
                )}
              </span>
              {/* The camera badge, sitting on the rim like the reference. */}
              <span className="absolute bottom-0.5 right-0.5 w-9 h-9 rounded-full bg-[#001f3f] border-[3px] border-white flex items-center justify-center group-hover:bg-[#002952] transition-colors">
                <Camera className="w-4 h-4 text-white" />
              </span>
            </button>
            <p className="text-sm font-bold text-[#111827]">Profile Picture</p>
            {avatarError && <p className="text-xs text-rose-600 text-center">{avatarError}</p>}
          </div>

          {/* Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FloatingInput name="fname" label="First name" defaultValue={initial.fname} required />
            <FloatingInput name="mname" label="Middle name" defaultValue={initial.mname} />
            <FloatingInput name="lname" label="Last name" defaultValue={initial.lname} required />
          </div>

          {/* Birthday / Gender */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              <input
                id="birthday" name="birthday" type="date" defaultValue={initial.birthday} required
                className={`${fieldBase} px-4`}
              />
              <label htmlFor="birthday" className="pointer-events-none absolute left-3 -top-0 -translate-y-1/2 bg-white px-1.5 text-xs font-medium text-[#374151]">
                Birthday *
              </label>
            </div>
            <FloatingSelect name="gender" label="Gender" defaultValue={initial.gender} required>
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </FloatingSelect>
          </div>

          {/* Nationality / Timezone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FloatingSelect name="nationality" label="Nationality" defaultValue={initial.nationality} required>
              <option value="">Select nationality</option>
              {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
            </FloatingSelect>
            <FloatingSelect name="timezone" label="Timezone" defaultValue={initial.timezone && initial.timezone !== "UTC" ? initial.timezone : "Asia/Dubai"} required>
              {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
            </FloatingSelect>
          </div>

          {/* Phone / WhatsApp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex gap-2 items-stretch">
              <input type="hidden" name="phone_country_code" value={phoneCode} />
              <PhoneCountrySelect value={phoneCode} onChange={setPhoneCode} ariaLabel="Phone country code" className="shrink-0 h-14 px-4 rounded-xl" />
              <div className="flex-1">
                <FloatingInput name="phone_number" label="Phone" defaultValue={initial.phone_number} required inputMode="tel" />
              </div>
            </div>
            <div className="flex gap-2 items-stretch">
              <input type="hidden" name="whatsapp_country_code" value={waCode} />
              <PhoneCountrySelect value={waCode} onChange={setWaCode} ariaLabel="WhatsApp country code" className="shrink-0 h-14 px-4 rounded-xl" />
              <div className="flex-1">
                <FloatingInput name="whatsapp_number" label="WhatsApp" defaultValue={initial.whatsapp_number} required inputMode="tel" />
              </div>
            </div>
          </div>

          {/* Optional */}
          <div className="pt-2 border-t border-[#f0f2f5] space-y-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">Optional</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FloatingInput name="linkedin" label="LinkedIn" defaultValue={initial.linkedin} />
              <FloatingInput name="facebook" label="Facebook" defaultValue={initial.facebook} />
            </div>
            <FloatingInput name="license_number" label="License number" defaultValue={initial.license_number} />
            <div className="relative">
              <textarea
                id="bio" name="bio" defaultValue={initial.bio} rows={3} placeholder=" "
                className="peer w-full rounded-xl border border-[#d0d5dd] bg-white px-4 py-3.5 text-base text-[#111827] focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/10 transition-all resize-none"
              />
              <label htmlFor="bio" className="pointer-events-none absolute left-3 top-0 -translate-y-1/2 bg-white px-1.5 text-xs text-[#374151] transition-all peer-placeholder-shown:top-7 peer-placeholder-shown:text-base peer-placeholder-shown:text-[#9ca3af] peer-focus:top-0 peer-focus:text-xs peer-focus:text-[#001f3f] peer-focus:font-medium">
                Bio
              </label>
            </div>
          </div>

          {state.error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-700">{state.error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full flex items-center justify-center gap-2 px-7 h-14 bg-[#001f3f] hover:bg-[#002952] text-white text-base font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_14px_-2px_rgba(0,31,63,0.40)] hover:-translate-y-0.5 transition-all duration-200"
          >
            {pending ? (
              <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
            ) : (
              <>Save and continue <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>

        <ProfileAvatarUpload
          userId={userId}
          displayName={displayName}
          currentUrl={avatarUrl || null}
          busy={avatarBusy}
          open={pickerOpen}
          onBusyChange={setAvatarBusy}
          onUploaded={(url) => {
            setAvatarUrl(url)
            setAvatarError("")
          }}
          onRemoved={() => setAvatarUrl("")}
          onClose={() => setPickerOpen(false)}
          onError={setAvatarError}
        />
      </div>
    </div>
  )
}
