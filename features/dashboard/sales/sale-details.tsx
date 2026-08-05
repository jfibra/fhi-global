"use client"

import { createPortal } from "react-dom"
import { useEffect, useState } from "react"
import {
  Briefcase,
  Building2,
  Calendar,
  DollarSign,
  MapPin,
  Paperclip,
  Phone,
  User,
  X,
} from "lucide-react"
import type { SaleRecord, CommissionStatus, ValidationStatus } from "@/lib/sales-service"
import { toTitleCase } from "./sale-ui"

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

function formatDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + " AED"
}

function StatusBadge({ value }: { value: string }) {
  const colors: Record<string, string> = {
    pending:      "bg-amber-50 text-amber-700 border-amber-200",
    processing:   "bg-blue-50 text-blue-700 border-blue-200",
    approved:     "bg-emerald-50 text-emerald-700 border-emerald-200",
    released:     "bg-violet-50 text-violet-700 border-violet-200",
    rejected:     "bg-rose-50 text-rose-700 border-rose-200",
    under_review: "bg-sky-50 text-sky-700 border-sky-200",
    validated:    "bg-emerald-50 text-emerald-700 border-emerald-200",
    invalid_sale: "bg-rose-50 text-rose-700 border-rose-200",
  }
  const labels: Record<string, string> = {
    invalid_sale: "Invalid Sale",
    under_review: "Under Review",
  }
  const cls   = colors[value] ?? "bg-slate-100 text-slate-600 border-slate-200"
  const label = labels[value] ?? value.replace(/_/g, " ")
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${cls}`}>
      {label}
    </span>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">{label}</span>
      <span className="text-sm text-[#0d1117] font-medium">{value ?? "—"}</span>
    </div>
  )
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-[20px] border border-white/60 shadow-sm shadow-black/5 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-xl bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
        <h3 className="font-['Outfit'] text-sm font-bold text-[#0d1117] uppercase tracking-wider">{title}</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
        {children}
      </div>
    </div>
  )
}

export function SaleDetails({
  sale,
  onClose,
}: {
  sale: SaleRecord
  onClose: () => void
}) {
  const clientName = sale.clients
    ? `${sale.clients.first_name} ${sale.clients.last_name}`
    : "—"

  return (
    <Portal>
      <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-3xl bg-[#fafbfc] rounded-[28px] shadow-2xl flex flex-col max-h-[95vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative shrink-0 px-7 pt-7 pb-5 bg-white rounded-t-[28px]">
            <div
              className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[28px]"
              style={{ background: "linear-gradient(to bottom, #0a3d6b, #001f3f)" }}
            />
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] flex items-center justify-center shadow-md">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">{clientName}</h2>
                  <p className="text-xs text-[#9ca3af] mt-0.5">
                    {sale.projects?.name ?? "—"} · {sale.developers?.name ?? "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge value={sale.commission_status} />
                <StatusBadge value={sale.validation_status} />
                <button
                  type="button"
                  onClick={onClose}
                  className="ml-2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f3f4f6] text-[#9ca3af] hover:text-[#374151] transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Body — section order is deliberate: Agent, Client, Property, Contract. */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">

            {/* Agent */}
            <SectionCard icon={Briefcase} title="Agent Information">
              <DetailRow label="Agent" value={sale.profiles?.fullname} />
            </SectionCard>

            {/* Client */}
            <SectionCard icon={User} title="Client Information">
              <DetailRow label="Name" value={clientName} />
              <DetailRow label="Email" value={sale.clients?.email} />
              <DetailRow label="Phone" value={sale.clients?.phone} />
            </SectionCard>

            {/* Property */}
            <SectionCard icon={Building2} title="Property Information">
              <DetailRow label="Deal Type" value={sale.sale_type === "rental" ? "Rental" : sale.sale_type === "brokerage" ? "Brokerage" : "Project Sale"} />
              {sale.sale_type === "project" ? (
                <>
                  <DetailRow label="Developer" value={sale.developers?.name} />
                  <DetailRow label="Project" value={sale.projects?.name} />
                  <DetailRow label="Unit Type" value={sale.project_units?.unit_type} />
                </>
              ) : (
                <>
                  <DetailRow label="Property Type" value={sale.property_type} />
                  <DetailRow label="Property Address" value={sale.property_address} />
                </>
              )}
              <DetailRow label="Unit Number" value={sale.unit_number} />
              <DetailRow label="Block" value={sale.block_number} />
              <DetailRow label="Lot" value={sale.lot_number} />
            </SectionCard>

            {/* Contract */}
            <SectionCard icon={DollarSign} title="Contract Details">
              <DetailRow label="Contract Price" value={formatCurrency(sale.contract_price)} />
              <DetailRow label="Reservation Date" value={formatDate(sale.reservation_date)} />
              <DetailRow label="Price / SQFT" value={sale.price_per_sqm ? formatCurrency(sale.price_per_sqm) : null} />
              <DetailRow label="Total Area (SQFT)" value={sale.total_area_sqm ? `${sale.total_area_sqm} sqft` : null} />
              <DetailRow label="Payment Plan" value={sale.payment_plan} />
              <div className="col-span-2 md:col-span-3">
                <DetailRow label="Payment Terms" value={sale.payment_terms} />
              </div>
              {sale.remarks && (
                <div className="col-span-2 md:col-span-3">
                  <DetailRow label="Remarks" value={sale.remarks} />
                </div>
              )}
            </SectionCard>

            {/* Workflow */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/60 backdrop-blur-xl rounded-[20px] border border-white/60 shadow-sm shadow-black/5 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-2">Commission Status</p>
                <StatusBadge value={sale.commission_status} />
              </div>
              <div className="bg-white/60 backdrop-blur-xl rounded-[20px] border border-white/60 shadow-sm shadow-black/5 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-2">Validation Status</p>
                <StatusBadge value={sale.validation_status} />
                {/* Audit stamp — who made this call, and when. */}
                {sale.validation_changed_at && (
                  <p className="mt-2 text-[11px] text-[#6b7280]">
                    by <span className="font-semibold text-[#374151]">{toTitleCase(sale.validation_changed_by_name) || "—"}</span>
                    {" · "}{formatDate(sale.validation_changed_at)}
                  </p>
                )}
              </div>
            </div>

            {/* Meta */}
            <div className="bg-white/60 backdrop-blur-xl rounded-[20px] border border-white/60 shadow-sm shadow-black/5 p-5">
              {/* Agent moved to its own section at the top, so it isn't repeated here. */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <DetailRow label="Attachments" value={
                  <span className="inline-flex items-center gap-1.5">
                    <Paperclip className="w-3 h-3" />
                    {sale.attachments_count}
                  </span>
                } />
                <DetailRow label="Created" value={formatDate(sale.created_at)} />
                <DetailRow label="Updated" value={formatDate(sale.updated_at)} />
              </div>
            </div>
          </div>

          <div className="mx-7 h-px bg-[#f0f2f5]" />
          <div className="shrink-0 px-7 py-4 flex justify-end bg-white rounded-b-[28px]">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:bg-[#f3f4f6] transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
