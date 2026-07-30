import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import {
  canAccessSalesReportsArea,
  isAdminStaffRole,
  isSalesPipelineRole,
  isSecretaryLikeRole,
  normalizeAppRole,
} from "@/lib/app-roles"

/**
 * Persist a proof-of-transaction attachment for a sale.
 *
 * The S3 upload happens first via /api/upload/sale-file (any sales-area role);
 * this route records the resulting file against the sale. It runs on the
 * SERVICE-ROLE client and is the authoritative authorization check — proof is
 * mandatory, so the sale's own agent must be able to attach it even while the
 * sale is still `pending` (the browser client + RLS deliberately block agents
 * from touching a submitted sale, which is why legacy sales ended up with no
 * proof at all). Rules enforced here:
 *   · admin staff              → always
 *   · sales-pipeline owner      → their own sale, any validation status
 *   · secretary-like            → only while under_review / invalid_sale
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const REVIEW_STATUSES = ["under_review", "invalid_sale"]

const bodySchema = z.object({
  saleId: z.string().min(1).max(100),
  file_name: z.string().min(1).max(500),
  file_url: z.string().min(1).max(2000),
  file_type: z.string().max(50).nullable().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    const role = normalizeAppRole(profile?.role)
    if (!profile || !canAccessSalesReportsArea(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const parsed = bodySchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }
    const { saleId, file_name, file_url, file_type } = parsed.data

    if (!UUID_RE.test(saleId)) {
      return NextResponse.json({ error: "Invalid sale id" }, { status: 400 })
    }

    // Never persist an arbitrary URL — the file must live in our own S3 bucket,
    // which /api/upload/sale-file guarantees for the URL it returns.
    const publicBase = process.env.S3_PUBLIC_URL
    if (!publicBase || !file_url.startsWith(publicBase)) {
      return NextResponse.json({ error: "Invalid file URL" }, { status: 400 })
    }

    const admin = createAdminSupabase()

    const { data: sale, error: saleError } = await admin
      .from("sales_reports")
      .select("id, agent_id, validation_status")
      .eq("id", saleId)
      .single()

    if (saleError || !sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 })
    }

    const isOwner = String(sale.agent_id) === user.id
    const status = String(sale.validation_status)
    const allowed =
      isAdminStaffRole(role) ||
      (isSalesPipelineRole(role) && isOwner) ||
      (isSecretaryLikeRole(role) && REVIEW_STATUSES.includes(status))

    if (!allowed) {
      return NextResponse.json(
        { error: "You are not allowed to attach files to this sale" },
        { status: 403 },
      )
    }

    const { data: inserted, error: insertError } = await admin
      .from("sales_attachments")
      .insert({
        sales_report_id: saleId,
        file_name,
        file_url,
        file_type: file_type ?? null,
        uploaded_by: user.id,
      })
      .select("id, sales_report_id, file_name, file_url, file_type, uploaded_by, uploaded_at")
      .single()

    if (insertError || !inserted) {
      return NextResponse.json(
        { error: insertError?.message ?? "Failed to save attachment" },
        { status: 500 },
      )
    }

    // Activity log is best-effort — a logging hiccup must not fail the upload.
    await admin.from("sales_activity_logs").insert({
      sales_report_id: saleId,
      action_type: "attachment_uploaded",
      field_name: "attachment",
      new_value: { file_name, file_type: file_type ?? null, file_url },
      performed_by: user.id,
      performed_role: role,
    })

    return NextResponse.json({ attachment: inserted })
  } catch (err) {
    console.error("[sales-attachments]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
