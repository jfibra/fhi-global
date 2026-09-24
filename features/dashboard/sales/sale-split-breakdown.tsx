"use client"

import { Star } from "lucide-react"
import { SALE_DEAL_ROLE_LABELS, type SalePartner } from "@/lib/sales-service"
import { formatCurrency, toTitleCase } from "./sale-ui"

/**
 * The money split of a shared sale: each agent's role, share and credited
 * amount (share × contract price — what their own totals count, migration
 * 056), with the total. Shown when a Sales Reports / drill-in row's partner
 * line is opened. `highlightId` marks whose view it is: the viewer ("you") or,
 * in a per-agent drill-in, that agent.
 */
export function SaleSplitBreakdown({
  partners,
  contractPrice,
  ownerId,
  highlightId,
  highlightLabel = "you",
}: {
  partners: SalePartner[]
  contractPrice: number
  /** The agent who recorded the sale. */
  ownerId: string
  highlightId?: string
  highlightLabel?: string
}) {
  // Cents, the way the SQL totals round them.
  const rows = partners.map((p) => ({ ...p, amount: Math.round(contractPrice * p.share) / 100 }))
  const totalShare = Math.round(rows.reduce((sum, r) => sum + r.share, 0) * 100) / 100

  return (
    <div className="max-w-2xl overflow-hidden rounded-2xl border border-[#d6b357]/40 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0f2f5] bg-[#d6b357]/10 px-4 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a6d2a]">Partnership split</p>
        <p className="text-[11px] text-[#6b7280]">Each agent&apos;s totals count their share</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">
            <th className="px-4 py-2 font-bold">Agent</th>
            <th className="px-4 py-2 font-bold">Role</th>
            <th className="px-4 py-2 text-right font-bold">Share</th>
            <th className="px-4 py-2 text-right font-bold">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f0f2f5]">
          {rows.map((r) => {
            const mine = r.agent_id === highlightId
            return (
              <tr key={r.agent_id} className={mine ? "bg-[#d6b357]/[0.06]" : undefined}>
                <td className="px-4 py-2.5 font-semibold text-[#0d1117]">
                  {toTitleCase(r.name) || "Agent"}
                  {mine && <span className="ml-1 font-normal text-[#9ca3af]">({highlightLabel})</span>}
                </td>
                <td className="px-4 py-2.5 text-xs text-[#6b7280]">
                  <span className={`inline-flex items-center gap-1 ${r.role === "lead" ? "font-semibold text-[#8a6d2a]" : ""}`}>
                    {r.role === "lead" && <Star className="h-3 w-3 fill-current" />}
                    {SALE_DEAL_ROLE_LABELS[r.role]}
                  </span>
                  {r.agent_id === ownerId && <span className="block text-[10px] text-[#9ca3af]">recorded this sale</span>}
                </td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-[#0d1117]">{r.share}%</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-[#0d1117]">{formatCurrency(r.amount)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[#e8eaed] bg-[#f8fafc]">
            <td className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#374151]" colSpan={2}>
              Total · contract price
            </td>
            <td className="px-4 py-2.5 text-right font-mono font-bold text-[#0d1117]">{totalShare}%</td>
            <td className="px-4 py-2.5 text-right font-mono font-bold text-[#0d1117]">{formatCurrency(contractPrice)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
