import "server-only"

import crypto from "node:crypto"

/**
 * Minimal Google Analytics Data API client — no SDK dependency. The service
 * account key ships as GA_SA_KEY_BASE64 (the JSON file, base64-encoded, so
 * the multiline private key survives env formats) and must be a Viewer on
 * the GA4 property (GA4_PROPERTY_ID). Feature is env-gated like the rest.
 */

type ServiceKey = { client_email: string; private_key: string }

function loadKey(): ServiceKey | null {
  const b64 = process.env.GA_SA_KEY_BASE64?.trim()
  if (!b64) return null
  try {
    const parsed = JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as ServiceKey
    return parsed.client_email && parsed.private_key ? parsed : null
  } catch {
    return null
  }
}

export function gaConfigured(): boolean {
  return Boolean(process.env.GA4_PROPERTY_ID?.trim() && loadKey())
}

// Access tokens live ~1h; cache per scope per server instance.
const tokenCache = new Map<string, { token: string; exp: number }>()

async function accessToken(scope: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const hit = tokenCache.get(scope)
  if (hit && hit.exp > now + 60) return hit.token
  const key = loadKey()
  if (!key) throw new Error("Google service account is not configured")

  const b64url = (buf: Buffer | string) => Buffer.from(buf).toString("base64url")
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claims = b64url(
    JSON.stringify({
      iss: key.client_email,
      scope,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  )
  const signer = crypto.createSign("RSA-SHA256")
  signer.update(`${header}.${claims}`)
  const jwt = `${header}.${claims}.${b64url(signer.sign(key.private_key))}`

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
    cache: "no-store",
  })
  const data = (await res.json().catch(() => null)) as { access_token?: string; error_description?: string } | null
  if (!res.ok || !data?.access_token) {
    throw new Error(`Google auth failed: ${data?.error_description ?? res.status}`)
  }
  tokenCache.set(scope, { token: data.access_token, exp: now + 3500 })
  return data.access_token
}

type GaReport = {
  rows?: Array<{ dimensionValues?: Array<{ value: string }>; metricValues?: Array<{ value: string }> }>
}

async function gaPost(method: "runReport" | "runRealtimeReport", body: Record<string, unknown>): Promise<GaReport> {
  const token = await accessToken("https://www.googleapis.com/auth/analytics.readonly")
  const property = process.env.GA4_PROPERTY_ID?.trim()
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${property}:${method}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  )
  const data = (await res.json().catch(() => null)) as (GaReport & { error?: { message?: string } }) | null
  if (!res.ok) throw new Error(`GA report failed: ${data?.error?.message ?? res.status}`)
  return data ?? {}
}

export const gaRunReport = (body: Record<string, unknown>) => gaPost("runReport", body)
export const gaRunRealtime = (body: Record<string, unknown>) => gaPost("runRealtimeReport", body)

// ─── Google Search Console (same service account, webmasters.readonly) ──────

/** The GSC property — ours is a domain property. */
const GSC_SITE = () => process.env.GSC_SITE?.trim() || "sc-domain:fhiglobal.ae"

export type GscRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }

/** Search analytics query — requires the service account to be added as a
 *  (Restricted) user on the Search Console property. */
export async function gscQuery(body: Record<string, unknown>): Promise<{ rows?: GscRow[] }> {
  const token = await accessToken("https://www.googleapis.com/auth/webmasters.readonly")
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE())}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  )
  const data = (await res.json().catch(() => null)) as ({ rows?: GscRow[] } & { error?: { message?: string } }) | null
  if (!res.ok) throw new Error(`Search Console query failed: ${data?.error?.message ?? res.status}`)
  return data ?? {}
}
