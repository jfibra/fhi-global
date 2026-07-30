import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { isAdminStaffRole } from "@/lib/app-roles"
import { getDashboardRouteByRole } from "@/lib/auth"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { hasMailerConfig, sendSaleEncodedEmail, sendSaleStatusEmail, type SaleEmailDetails } from "@/lib/mailer"
import { SITE_URL } from "@/lib/seo"

/**
 * Email the sale's agent about a pipeline event. Fired by the client right
 * after the matching mutation succeeds:
 *  - "encoded"     → confirmation that their sale was recorded
 *  - "validation"  → an admin changed the validation status
 *  - "commission"  → an admin changed the commission status
 *
 * The payload carries only the event name — everything in the email (amounts,
 * client, statuses, recipient) is re-read from the database here, so a caller
 * can never put arbitrary content into an email. SMTP being unconfigured is a
 * silent skip (dev has no SMTP_*), matching the repo's feature-gated pattern.
 */

export const runtime = "nodejs"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EVENTS = ["encoded", "validation", "commission"] as const
type SaleEvent = (typeof EVENTS)[number]

const SALE_TYPE_LABELS: Record<string, string> = {
  project: "Project Sale",
  brokerage: "Brokerage Sale",
  rental: "Rental",
}

type SaleRow = {
  id: string
  sale_type: string
  agent_id: string
  contract_price: number
  reservation_date: string | null
  validation_status: string
  commission_status: string
  property_address: string | null
  property_type: string | null
  clients: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null
  projects: { name: string | null } | { name: string | null }[] | null
  developers: { name: string | null } | { name: string | null }[] | null
  profiles: { fullname: string | null; role: string | null } | { fullname: string | null; role: string | null }[] | null
}

function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response

  const { id } = await ctx.params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid sale id" }, { status: 400 })
  }

  const body = (await req.json().catch(() => ({}))) as { event?: unknown }
  const event = EVENTS.find((e) => e === body.event) as SaleEvent | undefined
  if (!event) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 })
  }

  // Status-change emails announce admin decisions, so only admin staff may
  // trigger them; the encode confirmation may also come from the agent who
  // just recorded their own sale. Non-admin permission for "encoded" needs the
  // row's agent_id, so that check happens after the lookup — but it answers
  // with the same 404 as a missing sale, so the route is never an existence
  // oracle for sale ids.
  const callerIsAdmin = isAdminStaffRole(session.context.profile.role)
  if (event !== "encoded" && !callerIsAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("sales_reports")
    .select(
      `id, sale_type, agent_id, contract_price, reservation_date, validation_status,
       commission_status, property_address, property_type,
       clients(first_name, last_name), projects(name), developers(name),
       profiles:agent_id(fullname, role)`,
    )
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("[sales/notify] lookup failed:", error.message)
    return NextResponse.json({ error: "Couldn't look up the sale" }, { status: 500 })
  }
  const sale = data as unknown as SaleRow | null
  if (!sale || (!callerIsAdmin && session.context.userId !== sale.agent_id)) {
    return NextResponse.json({ error: "Sale not found" }, { status: 404 })
  }

  if (!hasMailerConfig()) {
    return NextResponse.json({ ok: true, skipped: "smtp-not-configured" })
  }

  const authUser = await admin.auth.admin.getUserById(sale.agent_id).catch(() => null)
  const to = authUser?.data?.user?.email ?? null
  if (!to) {
    return NextResponse.json({ ok: true, skipped: "agent-has-no-email" })
  }

  const client = one(sale.clients)
  const agentProfile = one(sale.profiles)
  const clientName = client ? [client.first_name, client.last_name].filter(Boolean).join(" ") || null : null
  const details: SaleEmailDetails = {
    saleTypeLabel: SALE_TYPE_LABELS[sale.sale_type] ?? "Sale",
    clientName,
    propertyLabel: one(sale.projects)?.name ?? sale.property_address ?? sale.property_type ?? null,
    developerName: one(sale.developers)?.name ?? null,
    contractPrice: Number(sale.contract_price ?? 0),
    reservationDate: sale.reservation_date,
    dashboardUrl: `${SITE_URL}${getDashboardRouteByRole(agentProfile?.role)}/sales`,
  }

  try {
    if (event === "encoded") {
      await sendSaleEncodedEmail({
        to,
        agentName: agentProfile?.fullname ?? null,
        validationStatus: sale.validation_status,
        details,
      })
    } else {
      await sendSaleStatusEmail({
        to,
        agentName: agentProfile?.fullname ?? null,
        kind: event,
        status: event === "validation" ? sale.validation_status : sale.commission_status,
        details,
      })
    }
  } catch (e) {
    console.error("[sales/notify] send failed:", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "Couldn't send the email — check the SMTP settings" }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
