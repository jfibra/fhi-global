import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { createClient, hasServerSupabaseEnv } from "@/lib/supabase/server"
import {
  type AppProfile,
  getDashboardRouteByRole,
  isInactiveProfile,
  isProfileMissingMinimumFields,
  isUploadedProfilePhoto,
} from "@/lib/auth"
import { CompleteProfileForm, type CompleteProfileInitial } from "./complete-profile-form"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Complete your profile | FHI Global",
  robots: { index: false, follow: false },
}

function str(v: unknown): string {
  return typeof v === "string" ? v : ""
}

export default async function CompleteProfilePage() {
  if (!hasServerSupabaseEnv()) redirect("/")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, status, is_deleted, fname, mname, lname, fullname, birthday, gender, timezone, profile_url, metadata")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/")

  // Already complete → dashboard if active, otherwise wait on /account-inactive.
  // Incomplete profiles (active OR inactive) stay here to finish the form.
  if (!isProfileMissingMinimumFields(profile as unknown as AppProfile)) {
    redirect(isInactiveProfile(profile as unknown as AppProfile) ? "/account-inactive" : getDashboardRouteByRole(profile.role))
  }

  const m = (profile.metadata ?? {}) as Record<string, unknown>
  const initial: CompleteProfileInitial = {
    fname: str(profile.fname),
    mname: str(profile.mname),
    lname: str(profile.lname),
    birthday: str(profile.birthday),
    gender: str(profile.gender),
    nationality: str(m.nationality),
    timezone: str(profile.timezone) || "Asia/Dubai",
    phone_country_code: str(m.phone_country_code) || "+971",
    phone_number: str(m.phone_number),
    whatsapp_country_code: str(m.whatsapp_country_code) || "+971",
    whatsapp_number: str(m.whatsapp_number),
    linkedin: str(m.linkedin),
    facebook: str(m.facebook),
    license_number: str(m.license_number),
    bio: str(m.bio),
  }

  return (
    <CompleteProfileForm
      initial={initial}
      userId={user.id}
      displayName={str(profile.fullname) || [str(profile.fname), str(profile.lname)].filter(Boolean).join(" ")}
      // Deliberately NOT the Google avatar (isUploadedProfilePhoto): the point
      // of the requirement is a photo the user uploads themselves.
      initialAvatarUrl={isUploadedProfilePhoto(profile.profile_url) ? str(profile.profile_url) : ""}
    />
  )
}
