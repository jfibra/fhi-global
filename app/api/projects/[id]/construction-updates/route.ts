import { NextRequest, NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { guardProjectManage } from "@/lib/project-access"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

export const runtime = "nodejs"
// The server fetches the (up to 30 MB) file from Supabase and re-uploads it to
// S3, so give it room beyond the default serverless timeout.
export const maxDuration = 60

const SELECT = "id, project_id, title, file_url, file_type, created_at"

const STORAGE_BUCKET = "construction-updates"
const SUPABASE_PUBLIC_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/${STORAGE_BUCKET}/`

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg", jpeg: "image/jpeg",
  png: "image/png", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml",
}

const s3 = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

// The browser uploads the file to Supabase Storage (which has no request-body
// limit), then we move it to S3 SERVER-SIDE — no browser→S3 CORS needed — and
// delete the transient Supabase copy so that bucket never fills up. Only our own
// Supabase construction-updates URLs are fetched (prefix-checked → no SSRF).
// Returns the S3 public URL, or null on any failure (caller keeps the Supabase URL).
async function moveSupabaseFileToS3(admin: SupabaseClient, supabaseUrl: string): Promise<string | null> {
  if (!SUPABASE_PUBLIC_PREFIX || !supabaseUrl.startsWith(SUPABASE_PUBLIC_PREFIX)) return null
  try {
    const relPath = decodeURIComponent(supabaseUrl.slice(SUPABASE_PUBLIC_PREFIX.length)) // dev/proj/file.pdf
    const ext = relPath.split(".").pop()?.toLowerCase() ?? "bin"
    const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream"

    const res = await fetch(supabaseUrl)
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())

    const key = `FHI_GLOBAL/${STORAGE_BUCKET}/${relPath}`
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000",
      }),
    )

    // Best-effort: drop the transient Supabase copy now that it's on S3.
    try { await admin.storage.from(STORAGE_BUCKET).remove([relPath]) } catch { /* orphan is harmless */ }

    return `${process.env.S3_PUBLIC_URL}/${key}`
  } catch {
    return null
  }
}

// GET — list a project's construction updates (studio view; service-role so a
// developer sees their own unpublished project's updates too).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const projectId = Number(id)
  if (!Number.isInteger(projectId)) return NextResponse.json({ error: "Invalid project." }, { status: 400 })

  const admin = createAdminSupabase()
  const guard = await guardProjectManage(admin, projectId)
  if (!guard.ok) return guard.response

  const { data, error } = await admin
    .from("construction_updates")
    .select(SELECT)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ updates: data ?? [] })
}

// POST — add a construction update (the file is already uploaded to S3).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const projectId = Number(id)
  if (!Number.isInteger(projectId)) return NextResponse.json({ error: "Invalid project." }, { status: 400 })

  const admin = createAdminSupabase()
  const guard = await guardProjectManage(admin, projectId)
  if (!guard.ok) return guard.response

  const body = (await req.json()) as { title?: string; file_url?: string; file_type?: string }
  const title = String(body.title ?? "").trim()
  const fileUrl = String(body.file_url ?? "").trim()
  const fileType = String(body.file_type ?? "").trim()
  if (!title || !fileUrl) return NextResponse.json({ error: "Title and file are required." }, { status: 400 })
  if (fileType !== "pdf" && fileType !== "image") return NextResponse.json({ error: "Invalid file type." }, { status: 400 })

  // Relocate the just-uploaded Supabase file to S3 (server-side). On any failure
  // we fall back to the Supabase URL so the update still saves.
  const movedUrl = await moveSupabaseFileToS3(admin, fileUrl)
  const finalUrl = movedUrl ?? fileUrl

  const { data, error } = await admin
    .from("construction_updates")
    .insert({ project_id: projectId, title, file_url: finalUrl, file_type: fileType, uploaded_by: guard.context.userId })
    .select(SELECT)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    category: "projects",
    event: "created",
    source: "dashboard",
    actor: { id: guard.context.userId, name: guard.context.profile.fullname, role: guard.context.profile.role },
    subjectType: "construction_updates",
    subjectId: String(data.id),
    subjectLabel: title,
    description: `Added construction update "${title}" to project #${projectId}`,
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ update: data }, { status: 201 })
}
