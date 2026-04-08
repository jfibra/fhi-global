"use client"

import Image from "next/image"
import { useState } from "react"
import { CalendarDays, Mail, ShieldCheck, Clock3, BadgeCheck, Camera } from "lucide-react"
import { ProfileAvatarUpload } from "@/components/profile-avatar-upload"
import type { DashboardProfile } from "./profile-form"

function formatDate(dateValue: string | null) {
  if (!dateValue) return "—"
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString()
}

function roleLabel(role: string | null) {
  if (!role) return "Member"
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function ProfileSidebar({
  profile,
  email,
  completion,
  avatarBusy,
  onAvatarBusyChange,
  onAvatarUploaded,
  onAvatarRemoved,
  onError,
}: {
  profile: DashboardProfile
  email: string
  completion: number
  avatarBusy: boolean
  onAvatarBusyChange: (busy: boolean) => void
  onAvatarUploaded: (url: string) => void
  onAvatarRemoved: () => void
  onError: (message: string) => void
}) {
  const displayName = profile.fullname || [profile.fname, profile.lname].filter(Boolean).join(" ") || "User"
  const [uploaderOpen, setUploaderOpen] = useState(false)

  return (
    <>
    <aside className="bg-white/60 backdrop-blur-2xl rounded-[32px] border border-white/60 p-6 shadow-xl shadow-black/5 h-fit">
      {/* Avatar */}
      <div className="flex flex-col items-center text-center">
        <div className="relative w-28 h-28">
          <div className="relative w-full h-full rounded-full overflow-hidden bg-[#f3f4f6] ring-4 ring-white shadow-lg shadow-[#001f3f]/10">
            {profile.profile_url ? (
              <Image src={profile.profile_url} alt={displayName} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold bg-gradient-to-br from-[#001f3f] to-[#d6b357] text-white">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setUploaderOpen(true)}
            disabled={avatarBusy}
            className="absolute bottom-0 right-0 w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-br from-[#001f3f] to-[#d6b357] text-white shadow-lg border-2 border-white transition-all hover:scale-110 disabled:opacity-60 disabled:cursor-not-allowed"
            title="Change profile photo"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>

        <h3 className="mt-4 font-['Outfit'] text-xl font-bold text-[#0d1117]">{displayName}</h3>

        <div className="mt-2 inline-flex items-center px-3 py-1 bg-gradient-to-r from-[#001f3f] to-[#d6b357] rounded-full">
          <span className="text-xs font-semibold text-white tracking-wide">{roleLabel(profile.role)}</span>
        </div>
      </div>

      {/* Completion bar */}
      <div className="mt-6">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-[#6b7280] font-bold uppercase tracking-wider">Profile Completion</span>
          <span className="font-bold text-[#001f3f]">{completion}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-[#eef2f7] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#001f3f] to-[#d6b357] transition-all duration-500"
            style={{ width: `${completion}%` }}
          />
        </div>
      </div>

      {/* Info items */}
      <div className="mt-6 space-y-3">
        {[
          { icon: Mail, label: email || "—" },
          { icon: ShieldCheck, label: roleLabel(profile.role) },
          { icon: CalendarDays, label: `Joined ${formatDate(profile.joined_at)}` },
          { icon: Clock3, label: profile.timezone || "UTC" },
          { icon: BadgeCheck, label: profile.status || "active" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-3 text-sm text-[#4b5563]">
            <div className="w-8 h-8 rounded-xl bg-white shadow-sm shadow-black/5 flex items-center justify-center flex-shrink-0 border border-[#f0f0f0]">
              <Icon className="w-4 h-4 text-[#001f3f]" />
            </div>
            <span className="truncate">{label}</span>
          </div>
        ))}
      </div>

    </aside>

    <ProfileAvatarUpload
      userId={profile.id}
      displayName={displayName}
      currentUrl={profile.profile_url}
      busy={avatarBusy}
      open={uploaderOpen}
      onBusyChange={onAvatarBusyChange}
      onUploaded={onAvatarUploaded}
      onRemoved={onAvatarRemoved}
      onClose={() => setUploaderOpen(false)}
      onError={onError}
    />
    </>
  )
}
