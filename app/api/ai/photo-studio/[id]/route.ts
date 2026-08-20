import { NextRequest, NextResponse } from "next/server"
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { requireActiveSession } from "@/lib/auth-guard"
import { isAdminStaffRole, normalizeAppRole } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"

/**
 * Delete one AI Photo Studio result — the record AND the files in S3, so a
 * deleted image is genuinely gone (its link stops working). Only the person
 * who generated it (or a super admin) may delete it.
 *
 * Chained edits complicate the file cleanup: another row may use this
 * result as ITS source (before image). Files still referenced by other rows
 * are kept; only orphaned ones are removed from the bucket.
 */

export const runtime = "nodejs"

const STUDIO_PREFIX = "fhi_global/ai-photo-studio/"

const s3 = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

/** S3 key for one of OUR studio URLs; null for anything else. */
function studioKey(url: string | null): string | null {
  if (!url) return null
  const base = (process.env.S3_PUBLIC_URL ?? "").replace(/\/+$/, "")
  if (!url.startsWith(`${base}/${STUDIO_PREFIX}`)) return null
  return url.slice(base.length + 1)
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  if (!isAdminStaffRole(session.context.profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const { id } = await context.params

  const admin = createAdminSupabase()
  const { data: row } = await admin
    .from("ai_photo_edits")
    .select("id, user_id, result_url, source_url")
    .eq("id", id)
    .maybeSingle<{ id: string; user_id: string; result_url: string; source_url: string | null }>()
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 })

  if (row.user_id !== session.context.userId && normalizeAppRole(session.context.profile.role) !== "super_admin") {
    return NextResponse.json({ error: "You can only delete your own results." }, { status: 403 })
  }

  const { error } = await admin.from("ai_photo_edits").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // File cleanup, reference-aware:
  //  - the result file goes unless another row chains off it as a source;
  //  - the source file goes only if it was THIS row's own upload (src-*) —
  //    a chained source belongs to the earlier row that produced it.
  const keys: string[] = []
  const resultKey = studioKey(row.result_url)
  if (resultKey) {
    const { count } = await admin
      .from("ai_photo_edits")
      .select("id", { count: "exact", head: true })
      .eq("source_url", row.result_url)
    if (!count) keys.push(resultKey)
  }
  const sourceKey = studioKey(row.source_url)
  if (sourceKey && sourceKey.startsWith(`${STUDIO_PREFIX}src-`)) keys.push(sourceKey)

  await Promise.all(
    keys.map((Key) =>
      s3
        .send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME!, Key }))
        .catch(() => {
          // The record is already gone — a failed object delete just leaves
          // an orphaned file, which is harmless.
        }),
    ),
  )

  return NextResponse.json({ ok: true })
}
