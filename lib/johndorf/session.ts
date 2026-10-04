import "server-only"
import { createHash, createHmac, hkdfSync, timingSafeEqual } from "node:crypto"

/**
 * The Johndorf presentation's own sign-in (boss, 2026-10-04) — fhiglobal.ae/johndorf.
 * Nothing to do with FHI accounts: one fixed login, and a signed cookie that
 * only the /johndorf pages read. It never touches Supabase auth.
 *
 * The login defaults to what was asked for (johndorf / 12345) and can be
 * changed on Vercel (JOHNDORF_USERNAME / JOHNDORF_PASSWORD) without a code
 * change. It's deliberately simple and this repo is public, so nothing real
 * may sit behind it.
 */

export const JD_COOKIE = "jd_session"
export const JD_SESSION_SECONDS = 12 * 60 * 60

const username = () => (process.env.JOHNDORF_USERNAME || "johndorf").trim().toLowerCase()
const password = () => process.env.JOHNDORF_PASSWORD || "12345"

function key(): Buffer {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set")
  return Buffer.from(hkdfSync("sha256", secret, "fhi-global", "johndorf-demo-session/v1", 32))
}

// A changed password signs everyone out: its fingerprint is part of what's signed.
const payload = (exp: string) => `johndorf|${exp}|${createHash("sha256").update(password()).digest("hex").slice(0, 16)}`
const sign = (exp: string) => createHmac("sha256", key()).update(payload(exp)).digest("base64url")

function same(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function checkJohndorfLogin(user: string, pass: string): boolean {
  return same(user.trim().toLowerCase(), username()) && same(pass, password())
}

/** A fresh cookie value: "<expiry>.<signature>". */
export function newJohndorfSession(): string {
  const exp = String(Math.floor(Date.now() / 1000) + JD_SESSION_SECONDS)
  return `${exp}.${sign(exp)}`
}

export function isJohndorfSession(value: string | undefined): boolean {
  if (!value) return false
  const [exp, sig] = value.split(".")
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) * 1000 < Date.now()) return false
  return same(sig, sign(exp))
}
