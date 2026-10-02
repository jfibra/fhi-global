import "server-only"

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto"
import type { createAdminSupabase } from "@/lib/admin-supabase"
import { DEFAULT_ACCOUNT_PASSWORD } from "@/lib/account-password"

// The Show button on Admin → Developers Login. Supabase Auth keeps only a
// one-way hash, so every password an admin sets for a developer account is also
// kept here, AES-256-GCM encrypted, in public.developer_login_secrets
// (migration 073 — service role only). Bound to the account (the profile id is
// the GCM associated data), so a copy can't be moved onto another row.
//
// The key is derived from SUPABASE_SERVICE_ROLE_KEY, so there is nothing extra
// to configure. Rotating that key makes the saved copies unreadable — the page
// then says so and an admin just sets a new password.
//
// Saved: Set new password (POST /api/admin/users/[id]/password, which the
// Account Directory's reset uses too), the Developers page's Create Account
// (POST /api/admin/developer-accounts) and the Directory's Add User for a
// developer (POST /api/admin/users). Forgotten: the developer's own change in
// Profile Settings (POST /api/account/password) — only they know that one.

type Admin = ReturnType<typeof createAdminSupabase>

const TABLE = "developer_login_secrets"

function key(): Buffer {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.")
  return Buffer.from(hkdfSync("sha256", base, "fhi-global", "developer-login-passwords/v1", 32))
}

function seal(password: string, profileId: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  cipher.setAAD(Buffer.from(profileId))
  const data = Buffer.concat([cipher.update(password, "utf8"), cipher.final()])
  return ["v1", iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64"))).join(".")
}

function open(sealed: string, profileId: string): string | null {
  try {
    const [version, iv, tag, data] = sealed.split(".")
    if (version !== "v1" || !iv || !tag || !data) return null
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"))
    decipher.setAAD(Buffer.from(profileId))
    decipher.setAuthTag(Buffer.from(tag, "base64"))
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8")
  } catch {
    return null
  }
}

/** Keep the password an admin just set. Best effort — false when it couldn't be saved. */
export async function saveDeveloperPassword(
  admin: Admin,
  profileId: string,
  password: string,
  by: { id: string | null; name: string | null },
): Promise<boolean> {
  // The shared master password is never written anywhere.
  if (!password || password === DEFAULT_ACCOUNT_PASSWORD) return false
  try {
    const { error } = await admin.from(TABLE).upsert({
      profile_id: profileId,
      ciphertext: seal(password, profileId),
      set_by: by.id,
      set_by_name: by.name ? by.name.replace(/\s+/g, " ").trim() : null,
      set_at: new Date().toISOString(),
    })
    return !error
  } catch {
    return false
  }
}

/** Drop the saved copy — the password changed in a way only its owner knows. */
export async function forgetDeveloperPassword(admin: Admin, profileId: string): Promise<void> {
  try {
    await admin.from(TABLE).delete().eq("profile_id", profileId)
  } catch {
    // best effort — a stale copy is caught by the change log on the list
  }
}

export type SavedPassword =
  | { status: "ok"; password: string; setAt: string; setBy: string | null }
  | { status: "none" }
  | { status: "unreadable" }

/** The saved password for one developer login, decrypted. */
export async function readDeveloperPassword(admin: Admin, profileId: string): Promise<SavedPassword> {
  const { data, error } = await admin.from(TABLE).select("ciphertext, set_at, set_by_name").eq("profile_id", profileId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return { status: "none" }
  const password = open(data.ciphertext as string, profileId)
  if (password === null) return { status: "unreadable" }
  return { status: "ok", password, setAt: data.set_at as string, setBy: (data.set_by_name as string | null) ?? null }
}

/**
 * When each of these logins' saved copy was made — for the list (never the
 * passwords). Best effort: if the table can't be read, the list still loads,
 * just without Show.
 */
export async function savedPasswordTimes(admin: Admin, profileIds: string[]): Promise<Map<string, string>> {
  if (!profileIds.length) return new Map()
  const { data, error } = await admin.from(TABLE).select("profile_id, set_at").in("profile_id", profileIds)
  if (error) return new Map()
  return new Map((data ?? []).map((r) => [r.profile_id as string, r.set_at as string]))
}
