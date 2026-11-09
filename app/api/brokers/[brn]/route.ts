import { NextResponse, type NextRequest } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { lookupBroker } from "@/lib/broker-lookup"
import type { BrokerLookupResponse } from "@/lib/brokers"

/**
 * GET /api/brokers/<brn>[?refresh=1 | ?cached=1] — one RERA broker by BRN.
 * `cached=1` answers from the table only (409 when the BRN was never looked up).
 *
 * The lookup itself (brokers table first, then the Dubai Land Department
 * register — a few gateway calls cold, ~3–4 s each) is lib/broker-lookup.ts,
 * also used by other server code that needs a BRN checked.
 *
 * Any active signed-in user: the register is public data, and the profile
 * page (every role) offers the button.
 */

export const runtime = "nodejs"
export const maxDuration = 60

export async function GET(req: NextRequest, ctx: { params: Promise<{ brn: string }> }) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response

  const { brn: raw } = await ctx.params
  const result = await lookupBroker(decodeURIComponent(raw).trim(), {
    refresh: req.nextUrl.searchParams.get("refresh") === "1",
    cachedOnly: req.nextUrl.searchParams.get("cached") === "1",
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ broker: result.broker, source: result.source } satisfies BrokerLookupResponse)
}
