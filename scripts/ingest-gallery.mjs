// Ingest a homes.ph drive folder into the public gallery.
//
//   node scripts/ingest-gallery.mjs <eventSlug> <folderId> [albumSlug]
//   node scripts/ingest-gallery.mjs fhi-global-dubai-event 36a55e89-...
//
// What it does, per photo in the drive folder:
//   1. reads the original (they already live on our S3 bucket, so this is a
//      straight HTTPS GET of a few MB),
//   2. re-encodes with sharp into a web rendition (max 2000px, q78 mozjpeg,
//      ~85% smaller than the originals) and a 640px thumbnail for grids,
//   3. uploads both under FHI_GLOBAL/gallery/<albumSlug>/ with immutable
//      cache headers,
//   4. inserts a gallery_photos row (album auto-created on first run).
//
// Idempotent: source_url is UNIQUE — photos already ingested are skipped, so
// the script can be re-run after a crash or when new photos land in the drive.
// Requires .env/.env.local with DATABASE_URL and the S3_* variables.

import { readFileSync, existsSync } from "node:fs"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import sharp from "sharp"
import pg from "pg"

// ── env (mirror the migration runner: .env.local wins over .env) ─────────────
for (const file of [".env", ".env.local"]) {
  if (!existsSync(file)) continue
  for (const line of readFileSync(file, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
}

const [eventSlug, folderId, albumSlugArg] = process.argv.slice(2)
if (!eventSlug || !folderId) {
  console.error("usage: node scripts/ingest-gallery.mjs <eventSlug> <folderId> [albumSlug]")
  process.exit(1)
}
const albumSlug = albumSlugArg || eventSlug

const DRIVE = "https://drive.homes.ph/api/portal-api/public"
const WEB_MAX = 2000
const THUMB_MAX = 640
const CONCURRENCY = 4

// Section order in the album: the event story first, portraits last.
const SECTION_ORDER = ["Event and Developers Visit", "Awarding", "Profile Pictures"]

const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
})
const BUCKET = process.env.S3_BUCKET_NAME
const PUBLIC_BASE = (process.env.S3_PUBLIC_URL ?? "").replace(/\/+$/, "")

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "photo"

async function putObject(key, body) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: "image/jpeg",
    CacheControl: "public, max-age=31536000, immutable",
  }))
  return `${PUBLIC_BASE}/${key}`
}

async function main() {
  await db.connect()

  console.log(`Listing drive folder ${folderId} (${eventSlug})…`)
  const res = await fetch(`${DRIVE}/folders/${folderId}/photos?eventSlug=${encodeURIComponent(eventSlug)}`)
  if (!res.ok) throw new Error(`drive listing failed: HTTP ${res.status}`)
  const { folder, photos } = await res.json()
  if (!Array.isArray(photos) || photos.length === 0) throw new Error("drive folder has no photos")
  console.log(`Folder "${folder?.folder_name}" — ${photos.length} photos`)

  // Stable order: sections in story order, then by file name inside each.
  const sectionRank = (s) => {
    const i = SECTION_ORDER.indexOf(s ?? "")
    return i === -1 ? SECTION_ORDER.length : i
  }
  photos.sort((a, b) =>
    sectionRank(a.subfolder_name) - sectionRank(b.subfolder_name) ||
    String(a.original_file_name).localeCompare(String(b.original_file_name)),
  )

  // Album (created once; title/date only on insert so manual edits survive).
  const title = String(folder?.folder_name ?? albumSlug)
    .replace(/\s*\(.*\)\s*$/, "")
    .trim()
  const { rows: [album] } = await db.query(
    `INSERT INTO gallery_albums (slug, title, description, event_date)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (slug) DO UPDATE SET updated_at = now()
     RETURNING id, cover_url`,
    [albumSlug, title, `Official photos from ${title}.`,
     photos[0]?.created_at?.slice(0, 10) ?? null],
  )

  const { rows: existingRows } = await db.query(
    "SELECT source_url FROM gallery_photos WHERE album_id = $1", [album.id],
  )
  const existing = new Set(existingRows.map((r) => r.source_url))
  const pending = photos.filter((p) => p.image_url && !existing.has(p.image_url))
  console.log(`${existing.size} already ingested, ${pending.length} to do`)

  let done = 0, failed = 0
  const work = [...pending.entries()]

  async function worker() {
    for (;;) {
      const next = work.shift()
      if (!next) return
      const [, p] = next
      const sort = photos.indexOf(p)
      try {
        const orig = await fetch(p.image_url)
        if (!orig.ok) throw new Error(`GET ${orig.status}`)
        const buf = Buffer.from(await orig.arrayBuffer())

        const base = sharp(buf, { failOn: "none" }).rotate() // honor EXIF orientation
        const webBuf = await base.clone()
          .resize(WEB_MAX, WEB_MAX, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 78, progressive: true, mozjpeg: true })
          .toBuffer({ resolveWithObject: true })
        const thumbBuf = await base.clone()
          .resize(THUMB_MAX, THUMB_MAX, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 70, progressive: true, mozjpeg: true })
          .toBuffer()

        const name = slugify(String(p.original_file_name).replace(/\.[a-z0-9]+$/i, ""))
        const uid = String(p.id).slice(0, 8)
        const prefix = `FHI_GLOBAL/gallery/${albumSlug}`
        const webUrl = await putObject(`${prefix}/web/${uid}-${name}.jpg`, webBuf.data)
        const thumbUrl = await putObject(`${prefix}/thumb/${uid}-${name}.jpg`, thumbBuf)

        await db.query(
          `INSERT INTO gallery_photos
             (album_id, section, url, thumb_url, width, height, file_name, source_url, sort)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (source_url) DO NOTHING`,
          [album.id, p.subfolder_name ?? null, webUrl, thumbUrl,
           webBuf.info.width, webBuf.info.height,
           p.original_file_name ?? null, p.image_url, sort],
        )
        done++
        if (done % 10 === 0 || done === pending.length) {
          console.log(`  ${done}/${pending.length} done${failed ? ` (${failed} failed)` : ""}`)
        }
      } catch (err) {
        failed++
        console.error(`  FAILED ${p.original_file_name}: ${err.message}`)
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  // Cover: first photo of the album in sort order, unless one was set by hand.
  if (!album.cover_url) {
    await db.query(
      `UPDATE gallery_albums SET cover_url = (
         SELECT url FROM gallery_photos WHERE album_id = $1 ORDER BY sort LIMIT 1
       ), updated_at = now() WHERE id = $1`,
      [album.id],
    )
  }

  const { rows: [{ count }] } = await db.query(
    "SELECT count(*)::int AS count FROM gallery_photos WHERE album_id = $1", [album.id],
  )
  console.log(`Album "${title}" now holds ${count} photos. ${failed ? `${failed} FAILED — re-run to retry.` : "All good."}`)
  await db.end()
}

main().catch((err) => { console.error(err); process.exit(1) })
