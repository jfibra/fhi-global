import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

/**
 * An event's cover photo when it does NOT come through the dashboard's upload
 * route (2026-11-27): the automatic poster (lib/events/poster.tsx) and the
 * photo a person adds from the event card in Claude (POST /api/events/cover).
 *
 * - storeEventImage: one file into the bucket, under the events prefix the
 *   dashboard already uses (FHI_GLOBAL/events/…).
 * - The upload ticket: the card runs in a frame inside Claude and has no FHI
 *   session, so the tool's answer hands it a signed, short-lived link bound to
 *   ONE event and ONE person. The route trusts nothing else: it re-reads the
 *   account and the event on every upload. Signed with CRON_SECRET, like the
 *   weekly note's stop link; without that secret no ticket is issued and the
 *   card simply has no Add photo button.
 * - normalizeCoverPhoto: whatever arrives is decoded and re-encoded by sharp
 *   (turned upright, at most 1920 px, WebP) — so only a real picture is ever
 *   stored, never the bytes that were sent.
 */

let client: S3Client | null = null
function s3(): S3Client | null {
  if (client) return client
  const region = process.env.S3_REGION
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  if (!region || !accessKeyId || !secretAccessKey) return null
  client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } })
  return client
}

/** Stores one picture and returns its public address; null when file storage is not configured. */
export async function storeEventImage(key: string, body: Buffer, contentType: string): Promise<string | null> {
  const bucket = process.env.S3_BUCKET_NAME
  const publicUrl = process.env.S3_PUBLIC_URL
  const store = s3()
  if (!bucket || !publicUrl || !store) return null
  // The name changes whenever the picture does, so it can be cached for good.
  await store.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }))
  return `${publicUrl.replace(/\/$/, "")}/${key}`
}

/* ───────────────────────── the upload ticket ───────────────────────── */

export type CoverTicket = { eventId: string; actorId: string; scope: "all" | "own"; expires: number }

/** Twelve hours: long enough for a chat left open, short enough for a link that sits in a conversation. */
export const COVER_TICKET_TTL_S = 12 * 60 * 60

const secret = () => process.env.CRON_SECRET?.trim() || ""
const sign = (payload: string) => createHmac("sha256", secret()).update(`event-cover:${payload}`).digest("base64url")

export function signCoverTicket(t: Omit<CoverTicket, "expires">, ttlSeconds = COVER_TICKET_TTL_S): { token: string; expires: number } | null {
  if (!secret()) return null
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds
  const payload = Buffer.from(JSON.stringify({ e: t.eventId, u: t.actorId, s: t.scope, x: expires }), "utf8").toString("base64url")
  return { token: `${payload}.${sign(payload)}`, expires }
}

/** The ticket's contents when the signature is ours and it has not expired; null otherwise. */
export function readCoverTicket(token: string | null | undefined): CoverTicket | null {
  if (!token || !secret()) return null
  const [payload, mac, ...rest] = token.split(".")
  if (!payload || !mac || rest.length) return null
  const expected = Buffer.from(sign(payload))
  const given = Buffer.from(mac)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const raw = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { e?: unknown; u?: unknown; s?: unknown; x?: unknown }
    if (typeof raw.e !== "string" || typeof raw.u !== "string" || (raw.s !== "all" && raw.s !== "own") || typeof raw.x !== "number") return null
    if (raw.x * 1000 < Date.now()) return null
    return { eventId: raw.e, actorId: raw.u, scope: raw.s, expires: raw.x }
  } catch {
    return null
  }
}

/* ───────────────────────── an uploaded photo ───────────────────────── */

export const COVER_MAX_BYTES = 4 * 1024 * 1024

/** The upload as a clean picture: upright, at most 1920 px on its long side, WebP. null when it is not a picture sharp can read. */
export async function normalizeCoverPhoto(input: Buffer): Promise<{ body: Buffer; contentType: string; ext: string } | null> {
  try {
    const { default: sharp } = await import("sharp")
    const body = await sharp(input, { limitInputPixels: 60_000_000, failOn: "error" })
      .rotate()
      .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer()
    return { body, contentType: "image/webp", ext: "webp" }
  } catch {
    return null
  }
}
