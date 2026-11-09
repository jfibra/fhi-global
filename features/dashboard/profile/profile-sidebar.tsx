"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { CalendarDays, Mail, ShieldCheck, Clock3, Camera, Users } from "lucide-react"
import { fetchMyActiveTeam } from "@/lib/team-service"
import { ProfileAvatarUpload } from "@/components/profile-avatar-upload"
import { ChangeEmailModal } from "./change-email-modal"
import { isDeveloperRole } from "@/lib/app-roles"
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
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  // Developer accounts sign in with a username bridged to a synthetic email —
  // changing it would break their login, so they don't get the button.
  const canChangeEmail = !isDeveloperRole(profile.role)

  const infoItems = [
    { icon: ShieldCheck, label: roleLabel(profile.role) },
    { icon: CalendarDays, label: `Joined ${formatDate(profile.joined_at)}` },
    { icon: Clock3, label: profile.timezone || "UTC" },
  ]

  return (
    <>
    <div className="h-fit space-y-6 xl:sticky xl:top-0">
    <aside className="bg-white border border-[#e5e7eb] p-6">
      {/* Avatar */}
      <div className="flex flex-col items-center text-center">
        <div className="relative w-28 h-28">
          <div className="relative w-full h-full rounded-full overflow-hidden bg-[#f3f4f6] ring-4 ring-[#f0f2f5]">
            {profile.profile_url ? (
              <Image src={profile.profile_url} alt={displayName} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold bg-[#001f3f] text-white">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setUploaderOpen(true)}
            disabled={avatarBusy}
            className="absolute bottom-0 right-0 w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] text-white border-2 border-white transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
            title="Change profile photo"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>

        <h3 className="mt-4 font-['Outfit'] text-xl font-bold text-[#0d1117]">{displayName}</h3>
      </div>

      {/* Completion bar */}
      <div className="mt-6">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-[#6b7280] font-bold uppercase tracking-wider">Profile Completion</span>
          <span className="font-bold text-[#001f3f]">{completion}%</span>
        </div>
        <div className="h-2.5 bg-[#eef2f7] overflow-hidden">
          <div
            className="h-full bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] transition-all duration-500"
            style={{ width: `${completion}%` }}
          />
        </div>
      </div>

      {/* Info items */}
      <div className="mt-6 space-y-3">
        {/* Email + change action */}
        <div className="flex items-center gap-3 text-sm text-[#4b5563]">
          <div className="w-8 h-8 bg-[#f8fafc] flex items-center justify-center flex-shrink-0 border border-[#f0f0f0]">
            <Mail className="w-4 h-4 text-[#001f3f]" />
          </div>
          <span className="truncate flex-1" title={email || undefined}>{email || "—"}</span>
          {canChangeEmail && (
            <button
              type="button"
              onClick={() => setEmailModalOpen(true)}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] hover:brightness-110 transition-all"
            >
              Change
            </button>
          )}
        </div>
        {infoItems.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-3 text-sm text-[#4b5563]">
            <div className="w-8 h-8 bg-[#f8fafc] flex items-center justify-center flex-shrink-0 border border-[#f0f0f0]">
              <Icon className="w-4 h-4 text-[#001f3f]" />
            </div>
            <span className="truncate">{label}</span>
          </div>
        ))}
      </div>

    </aside>

    <TeamCard userId={profile.id} />
    </div>

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

    {emailModalOpen && (
      <ChangeEmailModal currentEmail={email} onClose={() => setEmailModalOpen(false)} />
    )}
    </>
  )
}

type MyTeam = { name: string; logoUrl: string | null; roleInTeam: string | null }

/** The team the person is on now — logo left (square tile, logo scaled to fit whole), name right. */
function TeamCard({ userId }: { userId: string }) {
  const [team, setTeam] = useState<MyTeam | null | undefined>(undefined)

  useEffect(() => {
    let active = true
    void fetchMyActiveTeam(userId).then(({ data }) => { if (active) setTeam(data) })
    return () => { active = false }
  }, [userId])

  return (
    <section className="bg-white border border-[#e5e7eb] p-6">
      {team === undefined ? (
        <div className="flex items-center gap-4" aria-hidden>
          <div className="h-24 w-24 shrink-0 animate-pulse bg-[#f3f4f6]" />
          <div className="h-4 flex-1 animate-pulse bg-[#f3f4f6]" />
        </div>
      ) : team ? (
        // Logo | Team, 30 / 70: the logo as it is (no tile, border or padding — scaled to
        // fit its column, never cropped or stretched), a divider, then the team.
        <div className="flex items-center gap-4">
          <div className="flex w-[30%] shrink-0 items-center justify-center">
            {team.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- any uploaded host; next/image would need each in remotePatterns
              <img
                src={team.logoUrl}
                alt={`${team.name} logo`}
                loading="lazy"
                className="max-h-16 w-full object-contain"
              />
            ) : (
              <Users className="h-8 w-8 text-[#001f3f]" aria-hidden />
            )}
          </div>
          <span className="w-px self-stretch shrink-0 bg-[#e5e7eb]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af]">Team</p>
            <p className="truncate font-['Outfit'] text-base font-bold text-[#0d1117]" title={team.name}>{team.name}</p>
            {team.roleInTeam && <p className="truncate text-xs capitalize text-[#6b7280]">{team.roleInTeam}</p>}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <span className="flex h-24 w-24 shrink-0 items-center justify-center border border-dashed border-[#d1d5db] bg-[#f8fafc]" aria-hidden>
            <Users className="h-8 w-8 text-[#9ca3af]" />
          </span>
          <p className="text-sm text-[#6b7280]">Not on a team yet</p>
        </div>
      )}
    </section>
  )
}
