import "server-only"

import type { createAdminSupabase } from "@/lib/admin-supabase"
import { DEVELOPER_LOGIN_EMAIL_DOMAIN } from "@/lib/developer-accounts"

// Admin → Developers Login (GET /api/admin/developer-logins): every developer
// account's sign-in — the username (or the email, for accounts made through the
// regular sign-up), when the developer last used it and when its password was
// last set — plus the active developer companies with no login yet. Passwords
// are never readable: Supabase Auth keeps only a one-way hash, so the page sets
// a new one through POST /api/admin/users/[id]/password and shows it once.

type Admin = ReturnType<typeof createAdminSupabase>

export type DeveloperLogin = {
  id: string
  name: string
  status: string
  /** "username" signs in at /developers-login; "email" / "google" at /staff-login. */
  method: "username" | "email" | "google"
  /** What they type to sign in: the username, or their email. */
  login: string
  company: { id: string; name: string; logo: string | null } | null
  /** The developer's own last sign-in — admins' master-password visits don't count. */
  lastSignInAt: string | null
  /** Last time an admin opened the account with the master password. */
  adminVisitAt: string | null
  /** When the current password was set (the account's creation until anyone changes it)… */
  passwordSetAt: string | null
  /** …and by whom: the admin's name, or "the developer" (their own change, or their sign-up). */
  passwordSetBy: string | null
}

export type CompanyWithoutLogin = { id: string; name: string; logo: string | null }

type AuditRow = {
  category: string
  event: string
  actor_id: string | null
  actor_name: string | null
  subject_id: string | null
  description: string | null
  occurred_at: string
}

/** Stored names carry stray double spaces from registration ("John  Maizo"). */
const tidy = (s: string | null) => (s ? s.replace(/\s+/g, " ").trim() : null)

const CREATED = (l: AuditRow) =>
  (l.category === "user_management" && l.event === "created") ||
  (l.category === "auth" && l.event === "register") ||
  (l.category === "security" && l.event === "user_provisioned")

/** Service-role read across profiles, auth users and the audit log. */
export async function listDeveloperLogins(admin: Admin): Promise<{ accounts: DeveloperLogin[]; companiesWithoutLogin: CompanyWithoutLogin[] }> {
  const [profilesRes, companiesRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id, fullname, username, status, joined_at, metadata")
      .eq("role", "developer")
      .not("is_deleted", "is", true),
    admin.from("developers").select("id, name, logo_url, is_active").is("deleted_at", null).order("name"),
  ])
  if (profilesRes.error || companiesRes.error) throw new Error((profilesRes.error ?? companiesRes.error)?.message)

  const profiles = profilesRes.data ?? []
  const companies = companiesRes.data ?? []
  const ids = profiles.map((p) => p.id as string)

  // Sign-in method + email live on the auth user; creation, logins and
  // password changes in the audit log (logins by actor, the rest by subject).
  const [users, logsRes] = await Promise.all([
    Promise.all(ids.map((id) => admin.auth.admin.getUserById(id).then((r) => r.data.user ?? null, () => null))),
    ids.length
      ? admin
          .from("audit_logs")
          .select("category, event, actor_id, actor_name, subject_id, description, occurred_at")
          .or(`subject_id.in.(${ids.join(",")}),actor_id.in.(${ids.join(",")})`)
          .in("category", ["auth", "security", "user_management"])
          .order("occurred_at", { ascending: false })
          .limit(5000)
      : Promise.resolve({ data: [] as AuditRow[], error: null }),
  ])
  if (logsRes.error) throw new Error(logsRes.error.message)
  const logs = (logsRes.data ?? []) as AuditRow[]

  const companyById = new Map(companies.map((c) => [c.id as string, c]))
  const linked = new Set<string>()

  const accounts: DeveloperLogin[] = profiles.map((p, i) => {
    const user = users[i]
    const email = (user?.email ?? "").toLowerCase()
    const providers = ((user?.app_metadata?.providers as string[] | undefined) ?? [user?.app_metadata?.provider]).filter(Boolean)
    const method: DeveloperLogin["method"] =
      email.endsWith(`@${DEVELOPER_LOGIN_EMAIL_DOMAIN}`) || (!email && p.username)
        ? "username"
        : providers.length && !providers.includes("email")
          ? "google"
          : "email"

    const devId = (p.metadata as Record<string, unknown> | null)?.developer_id
    const company = typeof devId === "string" ? companyById.get(devId) : undefined
    if (company) linked.add(company.id as string)

    const mine = logs.filter((l) => l.subject_id === p.id || l.actor_id === p.id)
    const created = [...mine].reverse().find((l) => l.subject_id === p.id && CREATED(l))
    // An admin-made login carries the admin's password; a sign-up, the developer's own.
    const createdBy =
      created?.category === "user_management" ? tidy(created.actor_name) : method === "username" ? null : "the developer"
    const logins = mine.filter((l) => l.category === "auth" && l.event === "login" && l.actor_id === p.id)
    const own = logins.find((l) => !(l.description ?? "").toLowerCase().includes("master password"))
    const visit = logins.find((l) => (l.description ?? "").toLowerCase().includes("master password"))
    const pw = mine.find((l) => l.subject_id === p.id && l.category === "security" && (l.event === "password_reset" || l.event === "password_changed"))
    const createdAt = created?.occurred_at ?? (p.joined_at as string | null)

    return {
      id: p.id as string,
      name: tidy(p.fullname as string | null) || (company?.name as string) || "Developer",
      status: (p.status as string) ?? "pending",
      method,
      login: method === "username" ? ((p.username as string | null) ?? email.split("@")[0]) : email,
      company: company ? { id: company.id as string, name: company.name as string, logo: (company.logo_url as string | null) ?? null } : null,
      // Sign-ins from before the audit log existed only show on the auth user.
      lastSignInAt: own?.occurred_at ?? (logins.length ? null : user?.last_sign_in_at ?? null),
      adminVisitAt: visit?.occurred_at ?? null,
      passwordSetAt: pw?.occurred_at ?? (method === "google" ? null : createdAt),
      passwordSetBy: pw
        ? pw.event === "password_changed" ? "the developer" : tidy(pw.actor_name)
        : method === "google" ? null : createdBy,
    }
  })

  accounts.sort((a, b) => (a.company?.name ?? "~").localeCompare(b.company?.name ?? "~") || a.name.localeCompare(b.name))

  const companiesWithoutLogin: CompanyWithoutLogin[] = companies
    .filter((c) => c.is_active && !linked.has(c.id as string))
    .map((c) => ({ id: c.id as string, name: c.name as string, logo: (c.logo_url as string | null) ?? null }))

  return { accounts, companiesWithoutLogin }
}
