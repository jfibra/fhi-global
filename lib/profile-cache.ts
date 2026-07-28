import type { NextRequest, NextResponse } from "next/server"
import type { AppProfile } from "@/lib/auth"

// Short-lived signed cache of the caller's profile, used by proxy.ts to skip a
// measured 0.26–0.67s `profiles` query on every matched request — including every
// <Link> prefetch, which is where most of them came from.
//
// The payload carries role/status, so it is HMAC-signed and bound to a user id
// the caller must already have authenticated as. proxy.ts still verifies the JWT
// on every request; this caches the profile lookup only. Cost: a role change or
// deactivation takes up to TTL seconds to take effect.

export const PROFILE_COOKIE = "fhi-profile"
const TTL = 60
const MAX_BYTES = 3_500

type Payload = { u: string; e: number; p: AppProfile }

const enc = new TextEncoder()
const secret = () => process.env.PROFILE_CACHE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || null

const b64u = (b: Uint8Array) =>
  btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

function unb64u(v: string): Uint8Array | null {
  try {
    const p = v.replace(/-/g, "+").replace(/_/g, "/")
    const s = atob(p + "=".repeat((4 - (p.length % 4)) % 4))
    return Uint8Array.from(s, (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}

const key = (s: string) =>
  crypto.subtle.importKey("raw", enc.encode(s), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"])

/** Cached profile for `userId`, or null on any doubt — callers fall back to the query. */
export async function readCachedProfile(req: NextRequest, userId: string): Promise<AppProfile | null> {
  const s = secret()
  const cookie = req.cookies.get(PROFILE_COOKIE)?.value
  if (!s || !cookie) return null

  const dot = cookie.lastIndexOf(".")
  const sig = dot > 0 ? unb64u(cookie.slice(dot + 1)) : null
  if (!sig) return null

  try {
    const body = cookie.slice(0, dot)
    const ok = await crypto.subtle.verify("HMAC", await key(s), sig as BufferSource, enc.encode(body))
    if (!ok) return null

    const raw = unb64u(body)
    if (!raw) return null
    const { u, e, p } = JSON.parse(new TextDecoder().decode(raw)) as Payload

    // Bound to the authenticated caller and expiring; a lifted cookie is useless.
    if (u !== userId || !(e > Date.now()) || p?.id !== userId) return null
    return p
  } catch {
    return null
  }
}

/** Best-effort — no secret, oversized, or any error means simply no cache. */
export async function writeCachedProfile(res: NextResponse, userId: string, profile: AppProfile) {
  const s = secret()
  if (!s) return
  try {
    const body = b64u(enc.encode(JSON.stringify({ u: userId, e: Date.now() + TTL * 1000, p: profile })))
    const sig = await crypto.subtle.sign("HMAC", await key(s), enc.encode(body))
    const value = `${body}.${b64u(new Uint8Array(sig))}`
    if (value.length > MAX_BYTES) return

    res.cookies.set(PROFILE_COOKIE, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: TTL,
    })
  } catch {
    /* never fail a request over caching */
  }
}
