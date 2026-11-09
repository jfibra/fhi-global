import "server-only"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { DLD_DATASETS, type DldRow } from "@/lib/dld-open-data"
import { buildGatewayBody } from "@/lib/dld-gateway"
import { exactLookup } from "@/lib/dld-search"
import { toBroker, type Broker, type BrokerLookupResponse } from "@/lib/brokers"

/**
 * One RERA broker by BRN — the `brokers` table (migration 085) first, the
 * Dubai Land Department register when it isn't saved yet, the saved copy is
 * over BROKER_FRESH_MS old, or `refresh`. A DLD answer is upserted. If DLD is
 * down, a stale saved copy is still served (source "stale").
 *
 * Used by GET /api/brokers/<brn> (the BRN field's Search button).
 */

/** DLD publishes daily; a day-old copy is current enough. */
const BROKER_FRESH_MS = 24 * 60 * 60 * 1000

export const BRN_PATTERN = /^\d{1,10}$/

export type BrokerLookupResult =
  | ({ ok: true } & BrokerLookupResponse)
  | { ok: false; status: number; error: string; notFound?: boolean }

export async function lookupBroker(
  brn: string,
  { refresh = false, cachedOnly = false }: { refresh?: boolean; cachedOnly?: boolean } = {},
): Promise<BrokerLookupResult> {
  if (!BRN_PATTERN.test(brn)) {
    return { ok: false, status: 400, error: "A RERA BRN is a number — check the broker card." }
  }

  const admin = createAdminSupabase()
  const { data: saved } = await admin.from("brokers").select("*").eq("broker_number", Number(brn)).maybeSingle()
  const savedBroker = saved as Broker | null

  if (savedBroker && !refresh && Date.now() - new Date(savedBroker.fetched_at).getTime() < BROKER_FRESH_MS) {
    return { ok: true, broker: savedBroker, source: "saved" }
  }

  // Saved copy or nothing — never wakes DLD (the profile page on load).
  if (cachedOnly) {
    if (savedBroker) return { ok: true, broker: savedBroker, source: "saved" }
    return { ok: false, status: 409, error: "Not looked up yet." }
  }

  const built = buildGatewayBody(DLD_DATASETS.brokers, {})
  if (!built.ok) return { ok: false, status: 500, error: built.error }

  const result = await exactLookup("brokers", built.body, { column: "BROKER_NUMBER", term: brn, refresh })
  if ("error" in result) {
    if (savedBroker) return { ok: true, broker: savedBroker, source: "stale" }
    return { ok: false, status: result.error.status, error: result.error.message }
  }

  const row: DldRow | undefined = result.matches[0]
  if (!row) {
    return { ok: false, status: 404, notFound: true, error: `No broker with BRN ${brn} in the Dubai Land Department register.` }
  }

  const record = toBroker(row)
  const fetched_at = new Date().toISOString()
  const { data: upserted, error } = await admin
    .from("brokers")
    .upsert({ ...record, fetched_at }, { onConflict: "broker_number" })
    .select("*")
    .single()

  // A failed save shouldn't hide the answer DLD just gave.
  const broker = (error ? { ...record, fetched_at } : upserted) as Broker
  return { ok: true, broker, source: "dld" }
}
