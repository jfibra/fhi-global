/**
 * The four things a recruit needs before they can sell — shared by the report
 * data (server), the PDF and the on-screen report (client), so the definition
 * of "finished all the requirements" is written once.
 *
 * Who does what (checked in the code, 2026-11-05): a recruit registers through
 * a member's invite link (Invite → Team) or the separate Global Partner link
 * (Invite → Global Partners), and only the recruiter who owns that link — the
 * direct inviter, e.g. the team leader — can press Approve and set the role
 * (POST /api/invite/recruits/[id]/approve and PATCH …/role; admins can override
 * and can also activate in Accounts & Invites → Recruitment). The Team link
 * registers everyone as Member, which cannot sell; the Global Partner link
 * registers a Global Partner (a selling role) who still needs Approve. Approved
 * + selling role are what the database checks before a sale can be recorded
 * (can_encode_sales, migration 055); profile and photo are what the dashboard
 * itself forces on first sign-in (isProfileMissingMinimumFields,
 * ProfilePhotoGate).
 */

export type Requirement = "approved" | "profile" | "photo" | "selling_role"

export const REQUIREMENT_LABELS: Record<Requirement, string> = {
  approved: "Account approved",
  profile: "Profile completed",
  photo: "Profile photo",
  selling_role: "Selling role",
}

export const REQUIREMENT_HINTS: Record<Requirement, string> = {
  approved: "the person whose invite link they used has pressed Approve",
  profile: "name, birthday, gender, nationality, phone and WhatsApp saved",
  photo: "a profile photo is uploaded (a Google picture doesn't count)",
  selling_role: "role is Agent, Unit Manager or Team Leader (Global Partners get theirs from the Global Partner link)",
}

/** Who has to act on each requirement, and where. "recruiter" = the direct inviter; "recruit" = the new person themselves. */
export type RequirementOwner = { who: "recruiter" | "recruit"; whoLabel: string; where: string }
export const REQUIREMENT_OWNERS: Record<Requirement, RequirementOwner> = {
  approved: { who: "recruiter", whoLabel: "The recruiter", where: "Invite → Team (or Global Partners) → Approve" },
  profile: { who: "recruit", whoLabel: "The recruit", where: "On their first sign-in" },
  photo: { who: "recruit", whoLabel: "The recruit", where: "On their first sign-in" },
  selling_role: { who: "recruiter", whoLabel: "The recruiter", where: "Invite → Team → the role dropdown → Agent" },
}

/** The sentence under the requirements box, on screen and in the PDF. */
export const REQUIREMENT_NOTE =
  "Approval and the selling role are the recruiter's two clicks on their Invite page, and they are what the system checks before a sale can be recorded. The Team invite link registers everyone as Member, which cannot sell, so the role has to be changed to Agent. The profile and photo are the recruit's own first steps. Admins can also activate an account in Accounts & Invites → Recruitment."

export const REQUIREMENT_KEYS: readonly Requirement[] = ["approved", "profile", "photo", "selling_role"]
