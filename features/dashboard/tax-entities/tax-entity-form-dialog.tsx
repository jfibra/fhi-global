"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import {
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  DollarSign,
  Globe,
  Hash,
  Home,
  Landmark,
  Mail,
  MapPin,
  Pencil,
  Percent,
  Plus,
  Tag,
  X,
} from "lucide-react"
import {
  createTaxEntity,
  type TaxEntity,
  type TaxEntityDeveloper,
  type TaxEntityFormData,
  updateTaxEntity,
} from "@/lib/tax-entity-service"

// UAE TRN is 15 digits — formatted as XXX-XXXXXXX-XXXXX
const TRN_REGEX = /^[0-9]{15}$/

function formatTRN(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 15)
  if (digits.length <= 3) return digits
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`
}

function stripTRN(value: string): string {
  return value.replace(/\D/g, "").slice(0, 15)
}

const EMPTY_FORM: TaxEntityFormData = {
  registered_name: "",
  trade_name: "",
  tax_registration_number: "",
  entity_type: "sale",
  developer_id: null,
  company_type: "",
  country_code: "AE",
  state_province: "",
  city: "",
  street_address: "",
  building: "",
  postal_code: "",
  vat_registered: true,
  vat_rate: 5,
  currency_code: "AED",
  is_active: true,
}

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <label className="text-xs font-bold uppercase tracking-wider text-[#374151] ml-1 mb-2 block">
      {text}
      {required && " *"}
    </label>
  )
}

function DeveloperSelector({
  value,
  onChange,
  developers,
  disabled,
}: {
  value: string | null
  onChange: (id: string | null) => void
  developers: TaxEntityDeveloper[]
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = developers.find((dev) => dev.id === value) ?? null

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 rounded-2xl border border-[#e5e5e5] bg-white text-left text-sm transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        <div className="flex items-center justify-between gap-3">
          {selected ? (
            <div className="flex items-center gap-2.5 min-w-0">
              {selected.logo_url ? (
                <img
                  src={selected.logo_url}
                  alt={selected.name}
                  className="w-6 h-6 rounded-md object-contain border border-[#e5e5e5] bg-white"
                />
              ) : (
                <div className="w-6 h-6 rounded-md bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] text-white text-[10px] font-bold flex items-center justify-center">
                  {selected.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="truncate">{selected.name}</span>
            </div>
          ) : (
            <span className="text-[#9ca3af]">Select developer</span>
          )}
          <ChevronDown className="w-4 h-4 text-[#9ca3af] shrink-0" />
        </div>
      </button>

      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full rounded-2xl border border-[#e5e5e5] bg-white shadow-xl overflow-hidden">
          <button
            type="button"
            onClick={() => {
              onChange(null)
              setOpen(false)
            }}
            className="w-full px-4 py-2.5 text-left text-sm text-[#6b7280] hover:bg-[#f8fafc]"
          >
            None
          </button>
          <div className="max-h-56 overflow-y-auto">
            {developers.map((dev) => (
              <button
                type="button"
                key={dev.id}
                onClick={() => {
                  onChange(dev.id)
                  setOpen(false)
                }}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-[#f8fafc] flex items-center gap-2.5"
              >
                {dev.logo_url ? (
                  <img
                    src={dev.logo_url}
                    alt={dev.name}
                    className="w-6 h-6 rounded-md object-contain border border-[#e5e5e5] bg-white"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-md bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] text-white text-[10px] font-bold flex items-center justify-center">
                    {dev.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="truncate">{dev.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function TaxEntityFormDialog({
  open,
  editEntity,
  viewMode,
  developers,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean
  editEntity: TaxEntity | null
  viewMode: boolean
  developers: TaxEntityDeveloper[]
  onClose: () => void
  onSaved: (entity: TaxEntity, isEdit: boolean) => void
  onError: (message: string) => void
}) {
  const [form, setForm] = useState<TaxEntityFormData>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof TaxEntityFormData, string>>>({})

  useEffect(() => {
    if (!open) return
    setErrors({})

    if (editEntity) {
      setForm({
        registered_name: editEntity.registered_name,
        trade_name: editEntity.trade_name ?? "",
        tax_registration_number: stripTRN(editEntity.tax_registration_number),
        entity_type: editEntity.entity_type,
        developer_id: editEntity.developer_id,
        company_type: editEntity.company_type ?? "",
        country_code: editEntity.country_code,
        state_province: editEntity.state_province ?? "",
        city: editEntity.city ?? "",
        street_address: editEntity.street_address ?? "",
        building: editEntity.building ?? "",
        postal_code: editEntity.postal_code ?? "",
        vat_registered: editEntity.vat_registered,
        vat_rate: editEntity.vat_rate,
        currency_code: editEntity.currency_code,
        is_active: editEntity.is_active,
      })
      return
    }

    setForm(EMPTY_FORM)
  }, [open, editEntity])

  const disabled = viewMode || busy

  const set = <K extends keyof TaxEntityFormData>(key: K, value: TaxEntityFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  useEffect(() => {
    if (form.entity_type === "purchase" && form.developer_id) {
      set("developer_id", null)
    }
  }, [form.entity_type])

  const validate = () => {
    const nextErrors: Partial<Record<keyof TaxEntityFormData, string>> = {}

    if (!form.registered_name.trim()) nextErrors.registered_name = "Registered company name is required."
    if (!TRN_REGEX.test(form.tax_registration_number)) {
      nextErrors.tax_registration_number = "TRN must be exactly 15 digits (e.g. 100-1234567-00003)."
    }
    if (!form.country_code.trim()) nextErrors.country_code = "Country is required."
    if (!form.currency_code.trim()) nextErrors.currency_code = "Currency is required."
    if (Number.isNaN(Number(form.vat_rate)) || Number(form.vat_rate) < 0) {
      nextErrors.vat_rate = "VAT rate must be a valid non-negative number."
    }
    if (form.entity_type === "sale" && !form.developer_id) {
      nextErrors.developer_id = "Developer is required for sale entities."
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const title = useMemo(() => {
    if (viewMode) return "View Tax Entity"
    if (editEntity) return "Edit Tax Entity"
    return "Add Tax Entity"
  }, [viewMode, editEntity])

  const subtitle = viewMode
    ? "Review VAT registered company details"
    : editEntity
      ? "Update company tax entity information"
      : "Create a VAT registered company record"

  const handleSubmit = async () => {
    if (disabled || !validate()) return
    setBusy(true)
    try {
      if (editEntity) {
        const { data, error } = await updateTaxEntity(editEntity.id, form)
        if (error || !data) {
          onError(error ?? "Failed to update tax entity.")
          return
        }
        onSaved(data, true)
        return
      }

      const { data, error } = await createTaxEntity(form)
      if (error || !data) {
        onError(error ?? "Failed to create tax entity.")
        return
      }
      onSaved(data, false)
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  const inp = (hasError: boolean) =>
    `w-full pl-11 pr-4 py-3 rounded-2xl border bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm placeholder:text-[#9ca3af] ${
      disabled ? "bg-[#f8fafc]" : ""
    } ${
      hasError ? "border-rose-400" : "border-[#e5e5e5]"
    }`

  const iconCls = "absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none"

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />

        <div className="relative w-full sm:max-w-[min(1100px,calc(100%-3rem))] max-h-[95dvh] flex flex-col bg-white/95 backdrop-blur-2xl rounded-t-[32px] sm:rounded-[32px] border border-white/60 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#f0f0f0] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] flex items-center justify-center">
                {viewMode ? <Landmark className="w-5 h-5 text-white" /> : editEntity ? <Pencil className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
              </div>
              <div>
                <h3 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">{title}</h3>
                <p className="text-xs text-[#6b7280]">{subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-[#e5e5e5] text-[#6b7280] hover:text-[#0d1117] hover:border-[#0d1117] transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
            {/* ── Section: identity ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Registered Name */}
              <div>
                <FieldLabel text="Registered Company Name" required />
                <div className="relative">
                  <Building2 className={iconCls} />
                  <input
                    className={inp(!!errors.registered_name)}
                    value={form.registered_name}
                    onChange={(e) => set("registered_name", e.target.value)}
                    placeholder="e.g. Emaar Properties PJSC"
                    disabled={disabled}
                  />
                </div>
                {errors.registered_name && <p className="text-xs text-rose-500 mt-1 ml-1">{errors.registered_name}</p>}
              </div>

              {/* Trade Name */}
              <div>
                <FieldLabel text="Trade Name" />
                <div className="relative">
                  <Tag className={iconCls} />
                  <input
                    className={inp(false)}
                    value={form.trade_name}
                    onChange={(e) => set("trade_name", e.target.value)}
                    placeholder="e.g. Emaar"
                    disabled={disabled}
                  />
                </div>
              </div>

              {/* TRN */}
              <div>
                <FieldLabel text="Tax Registration Number (TRN)" required />
                <div className="relative">
                  <Hash className={iconCls} />
                  <input
                    className={`${inp(!!errors.tax_registration_number)} font-mono tracking-wide`}
                    value={formatTRN(form.tax_registration_number)}
                    onChange={(e) => set("tax_registration_number", stripTRN(e.target.value))}
                    placeholder="100-1234567-00003"
                    inputMode="numeric"
                    disabled={disabled}
                  />
                </div>
                {errors.tax_registration_number
                  ? <p className="text-xs text-rose-500 mt-1 ml-1">{errors.tax_registration_number}</p>
                  : <p className="text-[11px] text-[#9ca3af] mt-1 ml-1">UAE VAT TRN Â· 15 digits Â· XXX-XXXXXXX-XXXXX</p>
                }
              </div>

              {/* Entity Type */}
              <div>
                <FieldLabel text="Entity Type" required />
                <div className="relative">
                  <Landmark className={iconCls} />
                  <select
                    className={`${inp(false)} appearance-none`}
                    value={form.entity_type}
                    onChange={(e) => set("entity_type", e.target.value as "sale" | "purchase")}
                    disabled={disabled}
                  >
                    <option value="sale">Sale Entity</option>
                    <option value="purchase">Purchase Entity</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                </div>
              </div>

              {/* Developer (sale only) */}
              {form.entity_type === "sale" && (
                <div className="sm:col-span-2">
                  <FieldLabel text="Developer" required />
                  <DeveloperSelector
                    value={form.developer_id}
                    onChange={(v) => set("developer_id", v)}
                    developers={developers}
                    disabled={disabled}
                  />
                  {errors.developer_id && <p className="text-xs text-rose-500 mt-1 ml-1">{errors.developer_id}</p>}
                </div>
              )}

              {/* Company Type */}
              <div>
                <FieldLabel text="Company Type" />
                <div className="relative">
                  <Briefcase className={iconCls} />
                  <input
                    className={inp(false)}
                    value={form.company_type}
                    onChange={(e) => set("company_type", e.target.value)}
                    placeholder="e.g. LLC, PJSC, FZE"
                    disabled={disabled}
                  />
                </div>
              </div>

              {/* Country */}
              <div>
                <FieldLabel text="Country Code" required />
                <div className="relative">
                  <Globe className={iconCls} />
                  <input
                    className={inp(!!errors.country_code)}
                    value={form.country_code}
                    onChange={(e) => set("country_code", e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="AE"
                    maxLength={2}
                    disabled={disabled}
                  />
                </div>
                {errors.country_code && <p className="text-xs text-rose-500 mt-1 ml-1">{errors.country_code}</p>}
              </div>

              {/* State / Province */}
              <div>
                <FieldLabel text="State / Province" />
                <div className="relative">
                  <MapPin className={iconCls} />
                  <input
                    className={inp(false)}
                    value={form.state_province}
                    onChange={(e) => set("state_province", e.target.value)}
                    placeholder="e.g. Dubai"
                    disabled={disabled}
                  />
                </div>
              </div>

              {/* City */}
              <div>
                <FieldLabel text="City" />
                <div className="relative">
                  <MapPin className={iconCls} />
                  <input
                    className={inp(false)}
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                    placeholder="e.g. Dubai"
                    disabled={disabled}
                  />
                </div>
              </div>

              {/* Street Address */}
              <div className="sm:col-span-2">
                <FieldLabel text="Street Address" />
                <div className="relative">
                  <Home className={iconCls} />
                  <input
                    className={inp(false)}
                    value={form.street_address}
                    onChange={(e) => set("street_address", e.target.value)}
                    placeholder="e.g. Sheikh Zayed Road"
                    disabled={disabled}
                  />
                </div>
              </div>

              {/* Building */}
              <div>
                <FieldLabel text="Building" />
                <div className="relative">
                  <Building2 className={iconCls} />
                  <input
                    className={inp(false)}
                    value={form.building}
                    onChange={(e) => set("building", e.target.value)}
                    placeholder="e.g. Emirates Tower"
                    disabled={disabled}
                  />
                </div>
              </div>

              {/* Postal Code */}
              <div>
                <FieldLabel text="Postal Code" />
                <div className="relative">
                  <Mail className={iconCls} />
                  <input
                    className={inp(false)}
                    value={form.postal_code}
                    onChange={(e) => set("postal_code", e.target.value)}
                    placeholder="e.g. 00000"
                    disabled={disabled}
                  />
                </div>
              </div>

              {/* VAT Rate */}
              <div>
                <FieldLabel text="VAT Rate" />
                <div className="relative">
                  <Percent className={iconCls} />
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className={`${inp(!!errors.vat_rate)} pr-10`}
                    value={form.vat_rate}
                    onChange={(e) => set("vat_rate", Number(e.target.value || 0))}
                    placeholder="5.00"
                    disabled={disabled}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#9ca3af] pointer-events-none">%</span>
                </div>
                {errors.vat_rate && <p className="text-xs text-rose-500 mt-1 ml-1">{errors.vat_rate}</p>}
              </div>

              {/* Currency Code */}
              <div>
                <FieldLabel text="Currency Code" required />
                <div className="relative">
                  <DollarSign className={iconCls} />
                  <input
                    className={inp(!!errors.currency_code)}
                    value={form.currency_code}
                    onChange={(e) => set("currency_code", e.target.value.toUpperCase().slice(0, 3))}
                    maxLength={3}
                    placeholder="AED"
                    disabled={disabled}
                  />
                </div>
                {errors.currency_code && <p className="text-xs text-rose-500 mt-1 ml-1">{errors.currency_code}</p>}
              </div>

              {/* ── Toggles ── */}
              <div className="sm:col-span-2 grid sm:grid-cols-2 gap-3">
                {([
                  { key: "vat_registered" as const, label: "VAT Registered", desc: "Include VAT in calculations" },
                  { key: "is_active" as const, label: "Active Entity", desc: "Available for invoicing" },
                ] as const).map(({ key, label, desc }) => (
                  <div
                    key={key}
                    onClick={() => !disabled && set(key, !form[key])}
                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all select-none ${
                      disabled ? "cursor-default" : "cursor-pointer hover:bg-[#f8fafc]"
                    } ${
                      form[key] ? "bg-white border-[#001f3f]/20 shadow-sm" : "bg-[#fafbfc] border-[#f0f2f5]"
                    }`}
                  >
                    <div
                      className={`relative w-11 h-6 rounded-full transition-all flex-shrink-0 ${
                        form[key] ? "bg-gradient-to-b from-[#0a3d6b] to-[#001f3f]" : "bg-[#d1d5db]"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                          form[key] ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#374151]">{label}</p>
                      <p className="text-xs text-[#9ca3af]">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#f0f0f0] flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-full border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] transition-all"
            >
              {viewMode ? "Close" : "Cancel"}
            </button>

            {!viewMode && (
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={busy}
                className="bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] text-white px-7 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-lg shadow-md disabled:opacity-60 disabled:translate-y-0 flex items-center gap-2"
              >
                {busy ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving…
                  </>
                ) : editEntity ? (
                  <>
                    <Check className="w-4 h-4" />
                    Save Changes
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add Tax Entity
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </Portal>
  )
}
