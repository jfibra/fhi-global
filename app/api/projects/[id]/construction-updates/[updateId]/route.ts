import { NextRequest, NextResponse } from "next/server"
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { guardProjectManage } from "@/lib/project-access"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

export const runtime = "nodejs"

const STORAGE_BUCKET = "construction-updates"

const s3 = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

// The S3 object key from a public S3 URL (`${S3_PUBLIC_URL}/FHI_GLOBAL/...`).
function s3KeyFromUrl(url: string): string | null {
  const base = (process.env.S3_PUBLIC_URL ?? "").replace(/\/+$/, "")
  if (!base || !url.startsWith(base + "/")) return null
  try { return decodeURIComponent(url.slice(base.length + 1)) } catch { return url.slice(base.length + 1) }
}

// The in-bucket path from a Supabase Storage public URL (legacy/fallback files).
function supabasePathFromUrl(url: string): string | null {
  const marker = `/${STORAGE_BUCKET}/`
  const i = url.indexOf(marker)
  if (i === -1) return null
  try { return decodeURIComponent(url.slice(i + marker.length)) } catch { return url.slice(i + marker.length) }
}

// Best-effort: remove the stored file from wherever it lives (S3 for current
// uploads, Supabase for legacy/fallback ones). Never throws.
async function removeStoredFile(admin: ReturnType<typeof createAdminSupabase>, fileUrl: string): Promise<void> {
  const s3Key = s3KeyFromUrl(fileUrl)
  if (s3Key) {
    try { await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME!, Key: s3Key })) } catch { /* ignore */ }
    return
  }
  const supaPath = supabasePathFromUrl(fileUrl)
  if (supaPath) {
    try { await admin.storage.from(STORAGE_BUCKET).remove([supaPath]) } catch { /* ignore */ }
  }
}

// DELETE — remove one construction update from a project (row + stored file).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; updateId: string }> }) {
  const { id, updateId } = await params
  const projectId = Number(id)
  if (!Number.isInteger(projectId)) return NextResponse.json({ error: "Invalid project." }, { status: 400 })

  const admin = createAdminSupabase()
  const guard = await guardProjectManage(admin, projectId)
  if (!guard.ok) return guard.response

  const { data: existing } = await admin
    .from("construction_updates")
    .select("id, title, file_url")
    .eq("id", updateId)
    .eq("project_id", projectId)
    .maybeSingle<{ id: string; title: string; file_url: string }>()
  if (!existing) return NextResponse.json({ error: "Construction update not found." }, { status: 404 })

  const { error } = await admin.from("construction_updates").delete().eq("id", updateId).eq("project_id", projectId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Best-effort: also remove the stored file (S3 or legacy Supabase) so storage
  // doesn't accumulate orphans. Never fail the delete on a storage hiccup.
  await removeStoredFile(admin, existing.file_url)

  await logAuditEvent({
    category: "projects",
    event: "deleted",
    source: "dashboard",
    actor: { id: guard.context.userId, name: guard.context.profile.fullname, role: guard.context.profile.role },
    subjectType: "construction_updates",
    subjectId: updateId,
    subjectLabel: existing.title,
    description: `Removed construction update "${existing.title}" from project #${projectId}`,
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ ok: true })
}
