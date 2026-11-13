import "server-only"

import { businessDate, saleCredits, type SaleRow } from "@/lib/fhi-chat-tools"

/**
 * Deal nudges (boss via Juliecor, 2026-11-13): a sale that has waited for
 * validation longer than STUCK_DAYS since it was recorded is "waiting long".
 * One rule for the welcome-screen tiles, my_sales, the weekly coaching note
 * and the team leader's view — so the same deal is stuck everywhere or
 * nowhere. Days count from the day the sale was recorded (created_at), which
 * is when the office's check starts; the reservation date can be weeks
 * earlier and would make a fresh file look old.
 */

export const STUCK_DAYS = 14

const dayOf = (iso: string) => iso.slice(0, 10)
const daysBetween = (from: string, to: string) => Math.max(Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400e3), 0)

export const isPendingSale = (s: SaleRow) => (s.validation_status ?? "pending") === "pending"

/** How many days a pending sale has waited since it was recorded (today = a Dubai YYYY-MM-DD). */
export const waitingDays = (s: SaleRow, today: string) => daysBetween(dayOf(s.created_at), today)

export type StuckDeal = { sale: SaleRow; days: number; agentIds: string[] }

/**
 * The pending sales credited to any of `agentIds` that have waited STUCK_DAYS
 * or more, longest wait first. A shared deal appears once.
 */
export function stuckDeals(sales: SaleRow[], agentIds: Iterable<string>, today: string): StuckDeal[] {
  const ids = new Set(agentIds)
  return sales
    .filter(isPendingSale)
    .map((s) => ({ sale: s, days: waitingDays(s, today), agentIds: saleCredits(s).map((c) => c.agentId).filter((id) => ids.has(id)) }))
    .filter((d) => d.agentIds.length && d.days >= STUCK_DAYS)
    .sort((a, b) => b.days - a.days || businessDate(a.sale).localeCompare(businessDate(b.sale)))
}
