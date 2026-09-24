"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, ExternalLink, FileSignature, Handshake } from "lucide-react"
import {
  fetchSaleAttachments,
  SALE_DEAL_ROLE_LABELS,
  type SaleAttachment,
  type SalePartner,
} from "@/lib/sales-service"
import { formatCurrency, toTitleCase } from "./sale-ui"

/**
 * "Partnership Sale" card for a shared sale (migration 055): each agent's role
 * and share as agreed when the sale was recorded — and, with the contract
 * price, the amount each is credited in their totals (migration 056) — plus the
 * signed A2A agreement(s) the admin checks before validating. Renders nothing
 * for a solo sale, so callers can drop it in unconditionally.
 */
export function SalePartnersPanel({
  saleId,
  ownerId,
  partners,
  viewerId,
  contractPrice,
}: {
  saleId: string
  /** The agent who recorded the sale (sales_reports.agent_id). */
  ownerId: string
  partners: SalePartner[]
  viewerId?: string
  /** Shows each agent's credited amount (share × price) next to their share. */
  contractPrice?: number
}) {
  const [agreements, setAgreements] = useState<SaleAttachment[] | null>(null)
  const shared = partners.length > 0

  useEffect(() => {
    if (!shared) return
    let active = true
    void fetchSaleAttachments(saleId).then(({ data }) => {
      if (active) setAgreements((data ?? []).filter((a) => a.category === "partnership_agreement"))
    })
    return () => {
      active = false
    }
  }, [saleId, shared])

  if (!shared) return null

  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-[20px] border border-[#d6b357]/40 shadow-sm shadow-black/5 p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-b from-[#d6b357] to-[#b8913f] flex items-center justify-center">
            <Handshake className="w-3.5 h-3.5 text-[#001428]" />
          </div>
          <h3 className="font-['Outfit'] text-sm font-bold text-[#0d1117] uppercase tracking-wider">Partnership Sale</h3>
        </div>
        <span className="rounded-full border border-[#d6b357]/40 bg-[#d6b357]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#8a6d2a]">
          {partners.length} agents
        </span>
      </div>

      <ul className="divide-y divide-[#f0f2f5]">
        {partners.map((p) => (
          <li key={p.agent_id} className="flex items-center justify-between gap-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#0d1117]">
                {toTitleCase(p.name) || "Agent"}
                {p.agent_id === viewerId && <span className="ml-1 font-normal text-[#9ca3af]">(you)</span>}
              </p>
              <p className="text-xs text-[#6b7280]">
                <span className={p.role === "lead" ? "font-semibold text-[#8a6d2a]" : undefined}>{SALE_DEAL_ROLE_LABELS[p.role]}</span>
                {p.agent_id === ownerId && " · recorded this sale"}
                {p.brn && ` · BRN ${p.brn}`}
              </p>
            </div>
            <span className="shrink-0 text-right">
              <span className="block font-mono text-sm font-bold text-[#0d1117]">{p.share}%</span>
              {contractPrice != null && Number.isFinite(contractPrice) && (
                <span className="block font-mono text-[11px] text-[#6b7280]">{formatCurrency((contractPrice * p.share) / 100)}</span>
              )}
            </span>
          </li>
        ))}
        {contractPrice != null && Number.isFinite(contractPrice) && (
          <li className="flex items-center justify-between gap-4 pt-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-[#374151]">Total · contract price</p>
            <span className="shrink-0 text-right">
              <span className="block font-mono text-sm font-bold text-[#0d1117]">
                {Math.round(partners.reduce((sum, p) => sum + p.share, 0) * 100) / 100}%
              </span>
              <span className="block font-mono text-[11px] font-semibold text-[#0d1117]">{formatCurrency(contractPrice)}</span>
            </span>
          </li>
        )}
      </ul>

      <div className="mt-4 border-t border-[#f0f2f5] pt-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">Signed A2A agreement</p>
        {agreements === null ? (
          <div className="h-9 rounded-xl bg-[#f3f4f6] animate-pulse" />
        ) : agreements.length === 0 ? (
          <p className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            No signed agreement is attached to this sale — check its files before validating.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {agreements.map((a) => (
              <a
                key={a.id}
                href={a.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-2 rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-semibold text-[#001f3f] transition-colors hover:border-[#001f3f]"
              >
                <FileSignature className="h-3.5 w-3.5 shrink-0 text-[#b8913f]" />
                <span className="truncate">{a.file_name}</span>
                <ExternalLink className="h-3 w-3 shrink-0 text-[#9ca3af]" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
