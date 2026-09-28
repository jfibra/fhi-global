import { NextResponse, type NextRequest } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import {
  DLD_GATEWAY,
  DLD_DATASETS,
  DLD_DEFAULT_TAKE,
  DLD_MAX_TAKE,
  allowedParamsFor,
  isDldCommand,
  isDldLookup,
  isValidSort,
  type DldLookupResponse,
  type DldOption,
  type DldQueryResponse,
  type DldRow,
} from "@/lib/dld-open-data"

/**
 * Server-side proxy for the Dubai Land Department open-data gateway, feeding
 * the admin "Real Estate Data" page.
 *
 * `command` is either one of the nine datasets (transactions, rents, …) or one
 * of the three lookups that fill dropdowns (carea-lookup, projects-lookup,
 * ejari-property-types). Anything else is a 404 — this is not a general
 * pass-through to the gateway.
 *
 * For datasets, only parameters declared in lib/dld-open-data.ts are forwarded
 * and every value is coerced to a bounded string, so the upstream never sees
 * arbitrary client input. Paging is capped at DLD_MAX_TAKE.
 *
 * The gateway is flaky: it sometimes answers with a Cloudflare HTML "Something
 * went wrong" page and a 500, or with an empty result for a query that works a
 * minute later. Those are surfaced as a 502 with a plain message so the page
 * can offer a retry rather than crash on non-JSON.
 */

export const runtime = "nodejs"

const UPSTREAM_TIMEOUT_MS = 45_000
const MAX_VALUE_LENGTH = 120

type GatewayEnvelope = {
  responseCode?: number
  validationErrorsList?: unknown[]
  response?: { result?: unknown } | null
}

async function callGateway(command: string, body: Record<string, string>): Promise<
  { ok: true; result: unknown[] } | { ok: false; status: number; message: string }
> {
  let res: Response
  try {
    res = await fetch(`${DLD_GATEWAY}/${command}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError"
    return {
      ok: false,
      status: 504,
      message: timedOut ? "Dubai Land Department did not respond in time." : "Could not reach Dubai Land Department.",
    }
  }

  const text = await res.text()
  let json: GatewayEnvelope | null = null
  try {
    json = JSON.parse(text) as GatewayEnvelope
  } catch {
    json = null
  }

  if (!res.ok || !json) {
    return {
      ok: false,
      status: 502,
      message: "Dubai Land Department returned an error. Try again in a moment.",
    }
  }

  if (Array.isArray(json.validationErrorsList) && json.validationErrorsList.length > 0) {
    return { ok: false, status: 422, message: "Dubai Land Department rejected the filters." }
  }

  const result = json.response?.result
  return { ok: true, result: Array.isArray(result) ? result : [] }
}

function clean(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value !== "string") return ""
  return value.trim().slice(0, MAX_VALUE_LENGTH)
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ command: string }> }) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const { command } = await ctx.params

  // ── Lookups: no filters, normalized to { value, label } ────────────────────
  if (isDldLookup(command)) {
    const upstream = await callGateway(command, {})
    if (!upstream.ok) return NextResponse.json({ error: upstream.message }, { status: upstream.status })

    const options: DldOption[] = []
    for (const item of upstream.result) {
      if (!item || typeof item !== "object") continue
      const rec = item as Record<string, unknown>
      // carea-lookup uses AREA_ID; the others use ID.
      const value = clean(rec.AREA_ID ?? rec.ID)
      const label = clean(rec.NAME_EN)
      if (value && label) options.push({ value, label })
    }
    options.sort((a, b) => a.label.localeCompare(b.label))
    return NextResponse.json({ options } satisfies DldLookupResponse, {
      headers: { "Cache-Control": "private, max-age=3600" },
    })
  }

  if (!isDldCommand(command)) {
    return NextResponse.json({ error: "Unknown dataset." }, { status: 404 })
  }

  const dataset = DLD_DATASETS[command]

  let incoming: Record<string, unknown>
  try {
    const parsed: unknown = await req.json()
    incoming = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    incoming = {}
  }

  // Every declared filter goes upstream, blank when not supplied — the gateway
  // expects the full parameter set for each command.
  const allowed = allowedParamsFor(dataset)
  const body: Record<string, string> = {}
  for (const param of allowed) body[param] = clean(incoming[param])

  for (const f of dataset.filters) {
    if (f.required && !body[f.param]) {
      return NextResponse.json({ error: `${f.label} is required.` }, { status: 400 })
    }
    if (f.kind === "date" && body[f.param] && !/^\d{2}\/\d{2}\/\d{4}$/.test(body[f.param])) {
      return NextResponse.json({ error: `${f.label} must be MM/DD/YYYY.` }, { status: 400 })
    }
  }

  const take = Math.min(DLD_MAX_TAKE, Math.max(1, Number.parseInt(body.P_TAKE, 10) || DLD_DEFAULT_TAKE))
  const skip = Math.max(0, Number.parseInt(body.P_SKIP, 10) || 0)
  body.P_TAKE = String(take)
  body.P_SKIP = String(skip)
  body.P_SORT = isValidSort(dataset, body.P_SORT) ? body.P_SORT : dataset.defaultSort

  const upstream = await callGateway(command, body)
  if (!upstream.ok) return NextResponse.json({ error: upstream.message }, { status: upstream.status })

  const rows = upstream.result.filter((r): r is DldRow => !!r && typeof r === "object")
  const firstTotal = rows[0]?.TOTAL
  const total = typeof firstTotal === "number" ? firstTotal : rows.length

  return NextResponse.json({ rows, total, skip, take } satisfies DldQueryResponse)
}
