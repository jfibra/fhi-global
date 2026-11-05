/**
 * The four things a recruit needs before they can sell — shared by the report
 * data (server), the PDF and the on-screen dialog (client), so the definition
 * of "finished all the requirements" is written once. Approved + selling role
 * are what the database checks before a sale can be recorded
 * (can_encode_sales, migration 055); profile and photo are what the dashboard
 * itself forces (isProfileMissingMinimumFields, ProfilePhotoGate).
 */

export type Requirement = "approved" | "profile" | "photo" | "selling_role"

export const REQUIREMENT_LABELS: Record<Requirement, string> = {
  approved: "Account approved",
  profile: "Profile completed",
  photo: "Profile photo",
  selling_role: "Selling role",
}

export const REQUIREMENT_HINTS: Record<Requirement, string> = {
  approved: "an admin has activated the account",
  profile: "name, birthday, gender, nationality, phone and WhatsApp saved",
  photo: "a profile photo is on the account",
  selling_role: "role is Agent, Team Leader, Unit Manager or Global Partner",
}

export const REQUIREMENT_KEYS: readonly Requirement[] = ["approved", "profile", "photo", "selling_role"]
