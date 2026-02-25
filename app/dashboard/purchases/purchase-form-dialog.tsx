"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import {
  Calendar,
  Check,
  DollarSign,
  Eye,
  FileText,
  Hash,
  Pencil,
  Plus,
  Receipt,
  StickyNote,
  Tag,
  X,
} from "lucide-react"
import {
  createPurchase,
  updatePurchase,
  type CategoryOption,
  type Purchase,
  type PurchaseFormData,
  type TaxEntityOption,
  type TaxType,
} from "@/lib/purchase-service"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <label className="text-xs font-bold uppercase tracking-wider text-[#374151] ml-1 mb-2 block">
      {text}{required && " *"}
    </label>
  )
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function parseTaxMonth(value: string) {
  // value = "YYYY-MM-01"
  if (!value) return { month: new Date().getMonth() + 1, year: new Date().getFullYear() }
  const [y, m] = value.split("-")
  return { month: Number(m), year: Number(y) }
}

function buildTaxMonth(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i)

const iconCls = "absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none z-10"

const EMPTY_FORM: PurchaseFormData = {
  tax_entity_id:         "",
  tax_month:             buildTaxMonth(new Date().getMonth() + 1, CURRENT_YEAR),
  tax_type:              "vat",
  invoice_number:        "",
  gross_taxable:         "",
  total_actual_amount:   "",
  category_id:           "",
  currency_code:         "AED",
  notes:                 "",
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PurchaseFormDialog({
  open,
  viewMode,
  editPurchase,
  taxEntities,
  categories,
  currentUserId,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean
  viewMode: boolean
  editPurchase: Purchase | null
  taxEntities: TaxEntityOption[]
  categories: CategoryOption[]
  currentUserId: string
  onClose: () => void
  onSaved: (purchase: Purchase, isEdit: boolean) => void
  onError: (message: string) => void
}) {
  const isEdit = Boolean(editPurchase)
  const disabled = viewMode

  const [form, setForm] = useState<PurchaseFormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof PurchaseFormData, string>>>({})
  const [saving, setSaving] = useState(false)
  const [taxMonth, setTaxMonth] = useState({ month: new Date().getMonth() + 1, year: CURRENT_YEAR })

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (editPurchase) {
      const parsed = parseTaxMonth(editPurchase.tax_month)
      setTaxMonth(parsed)
      setForm({
        tax_entity_id:       editPurchase.tax_entity_id,
        tax_month:           editPurchase.tax_month,
        tax_type:            editPurchase.tax_type,
        invoice_number:      editPurchase.invoice_number,
        gross_taxable:       editPurchase.gross_taxable != null ? String(editPurchase.gross_taxable) : "",
        total_actual_amount: String(editPurchase.total_actual_amount),
        category_id:         editPurchase.category_id ?? "",
        currency_code:       editPurchase.currency_code,
        notes:               editPurchase.notes ?? "",
      })
    } else {
      const now = new Date()
      const m = now.getMonth() + 1
      const y = now.getFullYear()
      setTaxMonth({ month: m, year: y })
      setForm({ ...EMPTY_FORM, tax_month: buildTaxMonth(m, y) })
    }
  }, [open, editPurchase])

  // Sync tax_month field when month/year pickers change
  useEffect(() => {
    setForm((prev) => ({ ...prev, tax_month: buildTaxMonth(taxMonth.month, taxMonth.year) }))
  }, [taxMonth])

  const set = <K extends keyof PurchaseFormData>(key: K, value: PurchaseFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validate = () => {
    const errs: typeof errors = {}
    if (!form.tax_entity_id)            errs.tax_entity_id = "Vendor is required"
    if (!form.invoice_number.trim())    errs.invoice_number = "Invoice number is required"
    if (!form.total_actual_amount || Number(form.total_actual_amount) <= 0)
      errs.total_actual_amount = "Total amount must be greater than 0"
    return errs
  }

  const handleSubmit = async () => {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setSaving(true)
    try {
      if (isEdit && editPurchase) {
        const { data, error } = await updatePurchase(editPurchase.id, form, currentUserId)
        if (error) { onError(error); return }
        onSaved(data!, true)
      } else {
        const { data, error } = await createPurchase(form, currentUserId)
        if (error) { onError(error); return }
        onSaved(data!, false)
      }
    } finally {
      setSaving(false)
    }
  }

  const inp = (hasError: boolean, extraCls = "") =>
    `w-full pl-11 pr-4 py-3 rounded-2xl border bg-white text-sm text-[#0d1117] placeholder:text-[#9ca3af]
    focus:outline-none focus:ring-4 focus:ring-[#001f3f]/5 transition-all disabled:bg-[#f8fafc] disabled:cursor-default
    ${hasError ? "border-rose-400 focus:border-rose-400" : "border-[#e5e5e5] focus:border-[#001f3f]"} ${extraCls}`

  const inpNoIcon = (hasError: boolean) =>
    `w-full px-4 py-3 rounded-2xl border bg-white text-sm text-[#0d1117] placeholder:text-[#9ca3af]
    focus:outline-none focus:ring-4 focus:ring-[#001f3f]/5 transition-all disabled:bg-[#f8fafc] disabled:cursor-default
    ${hasError ? "border-rose-400" : "border-[#e5e5e5] focus:border-[#001f3f]"}`

  if (!open) return null

  const title = viewMode ? "View Purchase" : isEdit ? "Edit Purchase" : "Add Purchase"

  return (
    <Portal>
      <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-2xl bg-white rounded-[28px] shadow-2xl flex flex-col max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative shrink-0 px-7 pt-7 pb-5">
            <div
              className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[28px]"
              style={{ background: "linear-gradient(to right, #001f3f, #d6b357)" }}
            />
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#001f3f] to-[#d6b357] flex items-center justify-center shadow-md">
                  {viewMode ? <Eye className="w-4.5 h-4.5 text-white" />
                    : isEdit ? <Pencil className="w-4.5 h-4.5 text-white" />
                    : <Plus className="w-4.5 h-4.5 text-white" />}
                </div>
                <div>
                  <h2 className="font-['Space_Grotesk'] text-lg font-bold text-[#0d1117]">{title}</h2>
                  <p className="text-xs text-[#9ca3af] mt-0.5">
                    {viewMode ? "Purchase record details"
                      : isEdit ? "Update purchase transaction"
                      : "Record a new purchase transaction"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f3f4f6] text-[#9ca3af] hover:text-[#374151] transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mx-7 h-px bg-[#f0f2f5]" />

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5">

            {/* Vendor */}
            <div>
              <FieldLabel text="Vendor (Tax Entity)" required />
              <div className="relative">
                <Receipt className={iconCls} />
                <select
                  value={form.tax_entity_id}
                  onChange={(e) => set("tax_entity_id", e.target.value)}
                  disabled={disabled}
                  className={inp(Boolean(errors.tax_entity_id), "appearance-none")}
                >
                  <option value="">Select vendor…</option>
                  {taxEntities.map((te) => (
                    <option key={te.id} value={te.id}>
                      {te.registered_name} — {te.tax_registration_number} ({te.country_code})
                    </option>
                  ))}
                </select>
              </div>
              {errors.tax_entity_id && (
                <p className="text-xs text-rose-500 mt-1.5 ml-1">{errors.tax_entity_id}</p>
              )}
            </div>

            {/* Tax Month — month + year pickers */}
            <div>
              <FieldLabel text="Tax Month" required />
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <Calendar className={iconCls} />
                  <select
                    value={taxMonth.month}
                    onChange={(e) => setTaxMonth((prev) => ({ ...prev, month: Number(e.target.value) }))}
                    disabled={disabled}
                    className={inp(false, "appearance-none")}
                  >
                    {MONTHS.map((name, idx) => (
                      <option key={idx + 1} value={idx + 1}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <Calendar className={iconCls} />
                  <select
                    value={taxMonth.year}
                    onChange={(e) => setTaxMonth((prev) => ({ ...prev, year: Number(e.target.value) }))}
                    disabled={disabled}
                    className={inp(false, "appearance-none")}
                  >
                    {YEAR_OPTIONS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Tax Type */}
            <div>
              <FieldLabel text="Tax Type" required />
              <div className="grid grid-cols-2 gap-3">
                {(["vat", "non_vat"] as TaxType[]).map((type) => {
                  const isSelected = form.tax_type === type
                  return (
                    <div
                      key={type}
                      onClick={() => !disabled && set("tax_type", type)}
                      className={`flex items-center gap-3 p-4 rounded-xl border transition-all
                        ${disabled ? "cursor-default" : "cursor-pointer"}
                        ${isSelected
                          ? "bg-white border-[#001f3f]/20 shadow-sm"
                          : "bg-[#fafbfc] border-[#f0f2f5]"
                        }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
                          ${isSelected ? "border-[#001f3f] bg-[#001f3f]" : "border-[#d1d5db] bg-white"}`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#0d1117]">
                          {type === "vat" ? "VAT" : "Non VAT"}
                        </p>
                        <p className="text-[11px] text-[#9ca3af]">
                          {type === "vat" ? "5% VAT applicable" : "No VAT applicable"}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Invoice Number */}
            <div>
              <FieldLabel text="Invoice Number" required />
              <div className="relative">
                <Hash className={iconCls} />
                <input
                  type="text"
                  value={form.invoice_number}
                  onChange={(e) => set("invoice_number", e.target.value)}
                  placeholder="e.g. INV-2025-001"
                  disabled={disabled}
                  className={inp(Boolean(errors.invoice_number))}
                />
              </div>
              {errors.invoice_number && (
                <p className="text-xs text-rose-500 mt-1.5 ml-1">{errors.invoice_number}</p>
              )}
            </div>

            {/* Amounts */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel text="Gross Taxable Amount" />
                <div className="relative">
                  <DollarSign className={iconCls} />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.gross_taxable}
                    onChange={(e) => set("gross_taxable", e.target.value)}
                    placeholder="0.00"
                    disabled={disabled}
                    className={inp(false)}
                  />
                </div>
              </div>
              <div>
                <FieldLabel text="Total Actual Amount" required />
                <div className="relative">
                  <DollarSign className={iconCls} />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.total_actual_amount}
                    onChange={(e) => set("total_actual_amount", e.target.value)}
                    placeholder="0.00"
                    disabled={disabled}
                    className={inp(Boolean(errors.total_actual_amount))}
                  />
                </div>
                {errors.total_actual_amount && (
                  <p className="text-xs text-rose-500 mt-1.5 ml-1">{errors.total_actual_amount}</p>
                )}
              </div>
            </div>

            {/* Category + Currency */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel text="Category" />
                <div className="relative">
                  <Tag className={iconCls} />
                  <select
                    value={form.category_id}
                    onChange={(e) => set("category_id", e.target.value)}
                    disabled={disabled}
                    className={inp(false, "appearance-none")}
                  >
                    <option value="">No category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.category_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <FieldLabel text="Currency" required />
                <div className="relative">
                  <DollarSign className={iconCls} />
                  <select
                    value={form.currency_code}
                    onChange={(e) => set("currency_code", e.target.value)}
                    disabled={disabled}
                    className={inp(false, "appearance-none")}
                  >
                    {["AED", "USD", "EUR", "GBP", "SAR", "QAR", "KWD", "BHD", "OMR"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <FieldLabel text="Notes" />
              <div className="relative">
                <StickyNote className="absolute left-4 top-4 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                <textarea
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Additional notes or description…"
                  rows={3}
                  disabled={disabled}
                  className={`w-full pl-11 pr-4 py-3 rounded-2xl border bg-white text-sm text-[#0d1117] placeholder:text-[#9ca3af]
                    focus:outline-none focus:ring-4 focus:ring-[#001f3f]/5 focus:border-[#001f3f] transition-all
                    border-[#e5e5e5] disabled:bg-[#f8fafc] disabled:cursor-default resize-none`}
                />
              </div>
            </div>

            {/* View mode: show file count info */}
            {viewMode && editPurchase && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#f8fafc] border border-[#f0f2f5]">
                <FileText className="w-4 h-4 text-[#9ca3af]" />
                <span className="text-sm text-[#6b7280]">
                  {editPurchase.attachments_count > 0
                    ? `${editPurchase.attachments_count} attachment${editPurchase.attachments_count === 1 ? "" : "s"}`
                    : "No attachments"}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          {!viewMode && (
            <>
              <div className="mx-7 h-px bg-[#f0f2f5]" />
              <div className="shrink-0 px-7 pb-7 pt-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-5 py-3 rounded-2xl border border-[#e5e5e5] text-sm font-semibold text-[#374151] bg-white hover:bg-[#f8fafc] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-md transition-all hover:translate-y-[-1px] hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
                    style={{ background: "linear-gradient(to right, #001f3f, #d6b357)" }}
                  >
                    {saving ? (
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Purchase"}
                  </button>
                </div>
              </div>
            </>
          )}
          {viewMode && (
            <div className="shrink-0 px-7 pb-7 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="w-full px-5 py-3 rounded-2xl border border-[#e5e5e5] text-sm font-semibold text-[#374151] bg-white hover:bg-[#f8fafc] transition-all"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </Portal>
  )
}
