import "server-only"

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto"

// A merchant's IBAN (migration 092 merchants.iban_sealed) is kept AES-256-GCM
// sealed, the developer-logins recipe (lib/developer-login-secrets.ts): the key
// is derived from SUPABASE_SERVICE_ROLE_KEY, so nothing extra is configured,
// and the merchant id is the associated data, so a sealed value can't be moved
// onto another merchant. Only an admin's "Show" (audited) and the statements
// ever open it; the pages get the last four digits.

function key(): Buffer {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.")
  return Buffer.from(hkdfSync("sha256", base, "fhi-global", "merchant-bank-details/v1", 32))
}

export function sealIban(iban: string, merchantId: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  cipher.setAAD(Buffer.from(merchantId))
  const data = Buffer.concat([cipher.update(iban, "utf8"), cipher.final()])
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(".")
}

export function openIban(sealed: string | null | undefined, merchantId: string): string | null {
  if (!sealed) return null
  try {
    const [version, iv, tag, data] = sealed.split(".")
    if (version !== "v1" || !iv || !tag || !data) return null
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"))
    decipher.setAAD(Buffer.from(merchantId))
    decipher.setAuthTag(Buffer.from(tag, "base64"))
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8")
  } catch {
    return null
  }
}

/** "AE07 0260 0010 1234 5678 901" → "AE070260001012345678901"; null when it doesn't look like an IBAN. */
export function normalizeIban(raw: string): string | null {
  const s = raw.replace(/\s+/g, "").toUpperCase()
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(s)) return null
  return s
}

export const ibanLast4 = (iban: string) => iban.slice(-4)
export const maskIban = (iban: string | null | undefined, last4: string | null | undefined) =>
  last4 ? `${(iban ?? "AE").slice(0, 2)}·· ${last4}` : null
