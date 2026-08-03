"use server"

import { redirect } from "next/navigation"
import { createClient, hasServerSupabaseEnv } from "@/lib/supabase/server"
import { getDashboardRouteByRole, isInactiveProfile } from "@/lib/auth"

export type CompleteProfileState = { error?: string }

/**
 * Saves the required profile info for an incomplete account, then sends the user
 * to their role dashboard. Required: photo, fname, lname, birthday, gender,
 * nationality, timezone, phone, whatsapp. Optional: mname, linkedin, facebook,
 * license, bio.
 *
 * The photo arrives as a URL: the form uploads it to /api/upload/avatar (which
 * authenticates and returns the S3 location) and posts the result here. Only an
 * https URL is accepted — profile_url lands in <img src> across the app.
 */
export async function completeProfileAction(
  _: CompleteProfileState,
  formData: FormData,
): Promise<CompleteProfileState> {
  if (!hasServerSupabaseEnv()) {
    return { error: "Supabase environment variables are not configured." }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const g = (k: string) => String(formData.get(k) ?? "").trim()

  const fname = g("fname")
  const mname = g("mname")
  const lname = g("lname")
  const birthday = g("birthday")
  const gender = g("gender")
  const nationality = g("nationality")
  const timezone = g("timezone")
  const phoneCode = g("phone_country_code") || "+971"
  const phoneNumber = g("phone_number")
  const waCode = g("whatsapp_country_code") || "+971"
  const waNumber = g("whatsapp_number")
  const linkedin = g("linkedin")
  const facebook = g("facebook")
  const license = g("license_number")
  const bio = g("bio")
  const profileUrl = g("profile_url")

  if (!fname || !lname || !birthday || !gender || !nationality || !timezone || !phoneNumber || !waNumber) {
    return { error: "Please fill in all required fields." }
  }
  // The photo is optional HERE — the ProfilePhotoGate modal in the dashboard
  // shell enforces it for every role, with the same "uploaded, not the copied
  // Google avatar" rule (isUploadedProfilePhoto). If one was provided on this
  // form it must at least be a real upload URL.
  if (profileUrl && !/^https:\/\//.test(profileUrl)) {
    return { error: "The profile photo didn't upload correctly — please try adding it again." }
  }

  const fullname = [fname, mname, lname].map((p) => p.trim()).filter(Boolean).join(" ")

  const { data: existing } = await supabase
    .from("profiles")
    .select("metadata, role, status, is_deleted")
    .eq("id", user.id)
    .single<{ metadata: Record<string, unknown> | null; role: string | null; status: string | null; is_deleted: boolean | null }>()

  const metadata = {
    ...(existing?.metadata ?? {}),
    phone_country_code: phoneCode,
    phone_number: phoneNumber,
    whatsapp_country_code: waCode,
    whatsapp_number: waNumber,
    nationality,
    linkedin: linkedin || null,
    facebook: facebook || null,
    license_number: license || null,
    bio: bio || null,
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      fname,
      mname: mname || null,
      lname,
      fullname,
      birthday,
      gender,
      timezone,
      // Only overwrite when the form actually uploaded one — writing "" here
      // would erase the Google avatar some profiles still display.
      ...(profileUrl ? { profile_url: profileUrl } : {}),
      metadata,
    })
    .eq("id", user.id)

  if (error) {
    return { error: error.message || "Couldn't save your profile. Please try again." }
  }

  // Profile is complete now — but a still-pending account waits for approval.
  const inactive = isInactiveProfile({
    status: existing?.status ?? null,
    is_deleted: existing?.is_deleted ?? null,
  })
  redirect(inactive ? "/account-inactive" : getDashboardRouteByRole(existing?.role ?? null))
}
