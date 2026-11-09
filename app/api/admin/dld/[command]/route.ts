import { NextResponse, type NextRequest } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import {
  DLD_DATASETS,
  DLD_DEFAULT_TAKE,
  DLD_MAX_TAKE,
  DLD_SEARCH_CHUNK,
  DLD_SEARCH_COLUMN_KEY,
  DLD_SEARCH_SCAN_MAX,
  DLD_SEARCH_SCAN_ROWS_KEY,
  DLD_SEARCH_SCAN_STEP,
  DLD_SEARCH_TERM_KEY,
  DLD_SEARCH_TERM_MAX,
  isExactLookup,
  isSearchableColumn,
  isDldCommand,
  isDldLookup,
  isValidSort,
  type DldLookupResponse,
  type DldOption,
  type DldQueryResponse,
} from "@/lib/dld-open-data"
import { asRows, buildGatewayBody, callGateway, clean, flag, gatewayTotal } from "@/lib/dld-gateway"
import { containsScan, exactLookup } from "@/lib/dld-search"

/**
 * Server-side proxy for the Dubai Land Department open-data gateway, feeding
 * the admin "Real Estate Data" tables.
 *
 * `command` is either one of the nine datasets (transactions, rents, …) or one
 * of the three lookups that fill dropdowns (carea-lookup, projects-lookup,
 * ejari-property-types). Anything else is a 404 — this is not a general
 * pass-through to the gateway. (The charts endpoint is the sibling static
 * route app/api/admin/dld/charts.)
 *
 * For datasets, only parameters declared in lib/dld-open-data.ts are forwarded
 * and every value is coerced to a bounded string, so the upstream never sees
 * arbitrary client input. Paging is capped at DLD_MAX_TAKE.
 *
 * Column search (`SEARCH_COLUMN` + `SEARCH_TERM` in the body): the gateway
 * has no `%term%` filter of its own, so the proxy reads the filtered result
 * set in aligned chunks of DLD_SEARCH_CHUNK rows — each chunk cached in
 * Postgres (lib/dld-cache.ts) so repeat searches over the same filters never
 * hit the gateway again — and matches locally:
 *
 *   • whole number on a sortable column → "exact": sort by that column and
 *     binary-search the chunks, ~log2(chunks) gateway calls, whole set covered;
 *   • anything else → "contains": scan the first SEARCH_SCAN_ROWS rows
 *     (default DLD_SEARCH_SCAN_STEP, raised by the UI up to DLD_SEARCH_SCAN_MAX)
 *     in the table's sort order and keep rows whose column contains the term.
 *
 * Both page the matches and report what was scanned in `search`.
 */

export const runtime = "nodejs"
// A cold contains-scan of 5,000 rows is ~5 gateway calls at ~3.5s each.
export const maxDuration = 60

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

  const built = buildGatewayBody(dataset, incoming)
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 })
  const body = built.body

  const take = Math.min(DLD_MAX_TAKE, Math.max(1, Number.parseInt(body.P_TAKE, 10) || DLD_DEFAULT_TAKE))
  const skip = Math.max(0, Number.parseInt(body.P_SKIP, 10) || 0)
  body.P_TAKE = String(take)
  body.P_SKIP = String(skip)
  body.P_SORT = isValidSort(dataset, body.P_SORT) ? body.P_SORT : dataset.defaultSort

  // ── Column search: read chunks (cache → gateway), match here, page matches ─
  const searchColumn = clean(incoming[DLD_SEARCH_COLUMN_KEY])
  const searchTerm = clean(incoming[DLD_SEARCH_TERM_KEY]).slice(0, DLD_SEARCH_TERM_MAX).toLowerCase()
  if (searchTerm) {
    if (!isSearchableColumn(dataset, searchColumn)) {
      return NextResponse.json({ error: "Unknown search column." }, { status: 400 })
    }
    // Any whole number of chunks from one up to the max: the page walks a
    // scan 1,000 rows at a time so progress shows, DLD_SEARCH_SCAN_STEP per click.
    const requestedScan = Number.parseInt(clean(incoming[DLD_SEARCH_SCAN_ROWS_KEY]), 10) || DLD_SEARCH_SCAN_STEP
    const scanLimit = Math.min(DLD_SEARCH_SCAN_MAX, Math.max(DLD_SEARCH_CHUNK, Math.ceil(requestedScan / DLD_SEARCH_CHUNK) * DLD_SEARCH_CHUNK))
    // `refresh: true` (the page's Refresh button) re-pulls every chunk from DLD.
    const refresh = flag(incoming.refresh)
    const search = isExactLookup(dataset, searchColumn, searchTerm)
      ? await exactLookup(command, body, { column: searchColumn, term: searchTerm, refresh })
      : await containsScan(command, body, { column: searchColumn, term: searchTerm, scanLimit, refresh })
    if ("error" in search) return NextResponse.json({ error: search.error.message }, { status: search.error.status })

    const response: DldQueryResponse = {
      rows: search.matches.slice(skip, skip + take),
      total: search.matches.length,
      skip,
      take,
      search: search.info,
    }
    return NextResponse.json(response)
  }

  const upstream = await callGateway(command, body)
  if (!upstream.ok) return NextResponse.json({ error: upstream.message }, { status: upstream.status })

  const rows = asRows(upstream.result)
  return NextResponse.json({ rows, total: gatewayTotal(rows), skip, take } satisfies DldQueryResponse)
}
