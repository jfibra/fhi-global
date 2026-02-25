"use client"

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import {
  Plus,
  Star,
  Pencil,
  Trash2,
  PowerOff,
  Power,
  Building2,
  CreditCard,
  Globe,
  Landmark,
  X,
  Check,
  AlertCircle,
  ChevronDown,
} from "lucide-react"
import {
  type BankAccount,
  type BankAccountFormData,
  fetchBankAccounts,
  addBankAccount,
  updateBankAccount,
  deleteBankAccount,
  setPrimaryBankAccount,
  toggleBankAccountStatus,
} from "@/lib/bank-account-service"

// ─── Portal (escapes backdrop-filter stacking context) ───────────────────────
function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

// ─── Static option lists ───────────────────────────────────────────────────────
const COUNTRIES = [
  { label: "🇦🇪 United Arab Emirates (AE)", value: "AE" },
  { label: "🇵🇭 Philippines (PH)",           value: "PH" },
]

const BANKS_BY_COUNTRY: Record<string, string[]> = {
  AE: [
    "First Abu Dhabi Bank (FAB)",
    "Emirates NBD",
    "Abu Dhabi Commercial Bank (ADCB)",
    "Dubai Islamic Bank (DIB)",
    "Mashreq Bank",
    "Abu Dhabi Islamic Bank (ADIB)",
    "RAKBANK",
    "Commercial Bank of Dubai (CBD)",
    "Emirates Islamic Bank",
    "Sharjah Islamic Bank",
    "National Bank of Fujairah",
    "National Bank of Ras Al-Khaimah",
    "United Arab Bank",
    "Invest Bank",
    "Al Hilal Bank",
    "Citibank UAE",
    "HSBC UAE",
    "Standard Chartered UAE",
  ],
  PH: [
    "BDO Unibank",
    "Bank of the Philippine Islands (BPI)",
    "Metropolitan Bank & Trust (Metrobank)",
    "Land Bank of the Philippines",
    "Philippine National Bank (PNB)",
    "Security Bank",
    "UnionBank of the Philippines",
    "Rizal Commercial Banking Corp (RCBC)",
    "EastWest Bank",
    "Development Bank of the Philippines (DBP)",
    "China Banking Corporation (Chinabank)",
    "Philippine Savings Bank (PSBank)",
    "Asia United Bank (AUB)",
    "Robinsons Bank",
    "Sterling Bank of Asia",
    "GoTyme Bank",
    "Maya Bank",
    "SeaBank Philippines",
    "Tonik Digital Bank",
    "CIMB Bank Philippines",
    "Overseas Filipino Bank (OFBank)",
  ],
}

const CURRENCY_BY_COUNTRY: Record<string, string> = {
  AE: "AED",
  PH: "PHP",
}

const CURRENCIES = [
  { label: "AED — UAE Dirham",       value: "AED" },
  { label: "PHP — Philippine Peso",  value: "PHP" },
  { label: "USD — US Dollar",        value: "USD" },
  { label: "GBP — British Pound",    value: "GBP" },
  { label: "SGD — Singapore Dollar", value: "SGD" },
  { label: "AUD — Australian Dollar",value: "AUD" },
  { label: "CAD — Canadian Dollar",  value: "CAD" },
  { label: "INR — Indian Rupee",     value: "INR" },
  { label: "PKR — Pakistani Rupee",  value: "PKR" },
  { label: "BDT — Bangladeshi Taka", value: "BDT" },
  { label: "EUR — Euro",             value: "EUR" },
  { label: "JPY — Japanese Yen",     value: "JPY" },
  { label: "CNY — Chinese Yuan",     value: "CNY" },
  { label: "KRW — South Korean Won", value: "KRW" },
  { label: "IDR — Indonesian Rupiah",value: "IDR" },
  { label: "MYR — Malaysian Ringgit",value: "MYR" },
]

const BANK_TYPES = [
  { label: "Savings",      value: "savings" },
  { label: "Checking",     value: "checking" },
  { label: "Business",     value: "business" },
  { label: "Digital Bank", value: "digital" },
]

const EMPTY_FORM: BankAccountFormData = {
  bank_name:      BANKS_BY_COUNTRY["AE"][0],
  bank_branch:    "",
  bank_country:   "AE",
  bank_type:      "savings",
  account_name:   "",
  account_number: "",
  iban:           "",
  swift_code:     "",
  routing_number: "",
  currency_code:  "AED",
  is_primary:     false,
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function maskAccountNumber(num: string) {
  if (!num || num.length <= 4) return num
  return "•".repeat(num.length - 4) + num.slice(-4)
}

function bankTypeLabel(type: string | null) {
  if (!type) return "—"
  return BANK_TYPES.find((t) => t.value === type)?.label ?? type
}

function countryLabel(code: string | null) {
  if (!code) return "—"
  return COUNTRIES.find((c) => c.value === code)?.label.replace(/^[^ ]+ /, "") ?? code
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function FieldLabel({ icon: Icon, text }: { icon?: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-1.5 ml-1 mb-2">
      {Icon && <Icon className="w-3.5 h-3.5 text-[#6b7280]" />}
      <label className="text-xs font-bold uppercase tracking-wider text-[#374151]">{text}</label>
    </div>
  )
}

function SelectField({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: { label: string; value: string }[]
  placeholder?: string
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none px-5 py-3.5 rounded-2xl border border-[#e5e5e5] bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm pr-10 cursor-pointer"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
    </div>
  )
}

// ─── Bank Account Form Modal ────────────────────────────────────────────────────
function BankAccountModal({
  open,
  editAccount,
  userId,
  hasPrimary,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean
  editAccount: BankAccount | null
  userId: string
  hasPrimary: boolean
  onClose: () => void
  onSaved: (account: BankAccount, isEdit: boolean) => void
  onError: (msg: string) => void
}) {
  const [form, setForm] = useState<BankAccountFormData>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof BankAccountFormData, string>>>({})

  useEffect(() => {
    if (open) {
      setErrors({})
      if (editAccount) {
        setForm({
          bank_name:      editAccount.bank_name,
          bank_branch:    editAccount.bank_branch ?? "",
          bank_country:   editAccount.bank_country ?? "AE",
          bank_type:      editAccount.bank_type ?? "savings",
          account_name:   editAccount.account_name,
          account_number: editAccount.account_number,
          iban:           editAccount.iban ?? "",
          swift_code:     editAccount.swift_code ?? "",
          routing_number: editAccount.routing_number ?? "",
          currency_code:  editAccount.currency_code,
          is_primary:     editAccount.is_primary,
        })
      } else {
        setForm({ ...EMPTY_FORM, is_primary: !hasPrimary })
      }
    }
  }, [open, editAccount, hasPrimary])

  const set = (key: keyof BankAccountFormData, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleCountryChange = (country: string) => {
    const banks = BANKS_BY_COUNTRY[country] ?? []
    setForm((prev) => ({
      ...prev,
      bank_country:  country,
      bank_name:     banks[0] ?? "",
      currency_code: CURRENCY_BY_COUNTRY[country] ?? prev.currency_code,
    }))
  }

  const validate = () => {
    const e: Partial<Record<keyof BankAccountFormData, string>> = {}
    if (!form.bank_name.trim())      e.bank_name      = "Bank name is required."
    if (!form.account_name.trim())   e.account_name   = "Account name is required."
    if (!form.account_number.trim()) e.account_number = "Account number is required."
    if (!form.currency_code)         e.currency_code  = "Currency is required."
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setBusy(true)
    try {
      if (editAccount) {
        const { data, error } = await updateBankAccount(editAccount.id, userId, form)
        if (error || !data) { onError(error ?? "Failed to update."); return }
        onSaved(data, true)
      } else {
        const { data, error } = await addBankAccount(userId, form)
        if (error || !data) { onError(error ?? "Failed to add."); return }
        onSaved(data, false)
      }
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Dialog */}
      <div className="relative w-full sm:max-w-2xl max-h-[95dvh] flex flex-col bg-white/80 backdrop-blur-2xl rounded-t-[32px] sm:rounded-[32px] border border-white/60 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#f0f0f0] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#001f3f] to-[#d6b357] flex items-center justify-center">
              <Landmark className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-['Space_Grotesk'] text-lg font-bold text-[#0d1117]">
                {editAccount ? "Edit Bank Account" : "Add Bank Account"}
              </h3>
              <p className="text-xs text-[#6b7280]">Used for commission payouts</p>
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

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Row 1 — Country + Bank Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel icon={Globe} text="Bank Country" />
              <SelectField value={form.bank_country} onChange={handleCountryChange} options={COUNTRIES} />
            </div>
            <div>
              <FieldLabel icon={Building2} text="Bank Name *" />
              <SelectField
                value={form.bank_name}
                onChange={(v) => set("bank_name", v)}
                options={(BANKS_BY_COUNTRY[form.bank_country] ?? []).map((b) => ({ label: b, value: b }))}
              />
              {errors.bank_name && <p className="text-xs text-rose-500 mt-1 ml-1">{errors.bank_name}</p>}
            </div>
          </div>

          {/* Row 2 — Branch + Type + Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <FieldLabel text="Bank Branch" />
              <input
                className="w-full px-5 py-3.5 rounded-2xl border border-[#e5e5e5] bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm"
                value={form.bank_branch}
                onChange={(e) => set("bank_branch", e.target.value)}
                placeholder="e.g. Dubai Main Branch"
              />
            </div>
            <div>
              <FieldLabel text="Account Type" />
              <SelectField value={form.bank_type} onChange={(v) => set("bank_type", v)} options={BANK_TYPES} />
            </div>
            <div>
              <FieldLabel text="Currency" />
              <div className="px-5 py-3.5 rounded-2xl border border-[#f0f0f0] bg-[#f8fafc] text-sm text-[#374151] font-semibold select-none">
                {form.currency_code} — {CURRENCIES.find((c) => c.value === form.currency_code)?.label.split(" — ")[1] ?? ""}
              </div>
            </div>
          </div>

          {/* Row 3 — Account name + Account number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel icon={CreditCard} text="Account Name *" />
              <input
                className={`w-full px-5 py-3.5 rounded-2xl border bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm ${errors.account_name ? "border-rose-400" : "border-[#e5e5e5]"}`}
                value={form.account_name}
                onChange={(e) => set("account_name", e.target.value)}
                placeholder="Name as it appears on account"
              />
              {errors.account_name && <p className="text-xs text-rose-500 mt-1 ml-1">{errors.account_name}</p>}
            </div>
            <div>
              <FieldLabel text="Account Number *" />
              <input
                className={`w-full px-5 py-3.5 rounded-2xl border bg-white transition-all font-mono focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm ${errors.account_number ? "border-rose-400" : "border-[#e5e5e5]"}`}
                value={form.account_number}
                onChange={(e) => set("account_number", e.target.value.replace(/\s/g, ""))}
                placeholder="Account number"
                inputMode="numeric"
              />
              {errors.account_number && <p className="text-xs text-rose-500 mt-1 ml-1">{errors.account_number}</p>}
            </div>
          </div>

          {/* Row 4 — IBAN + SWIFT + Routing */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <FieldLabel text="IBAN" />
              <input
                className="w-full px-5 py-3.5 rounded-2xl border border-[#e5e5e5] bg-white transition-all font-mono focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm uppercase"
                value={form.iban}
                onChange={(e) => set("iban", e.target.value.replace(/\s/g, "").toUpperCase())}
                placeholder="AE07 0331 2345 6789 0123 456"
                maxLength={34}
              />
            </div>
            <div>
              <FieldLabel text="SWIFT / BIC" />
              <input
                className="w-full px-5 py-3.5 rounded-2xl border border-[#e5e5e5] bg-white transition-all font-mono focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm uppercase"
                value={form.swift_code}
                onChange={(e) => set("swift_code", e.target.value.replace(/\s/g, "").toUpperCase())}
                placeholder="EBILAEAD"
                maxLength={11}
              />
            </div>
            <div>
              <FieldLabel text="Routing Number" />
              <input
                className="w-full px-5 py-3.5 rounded-2xl border border-[#e5e5e5] bg-white transition-all font-mono focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm"
                value={form.routing_number}
                onChange={(e) => set("routing_number", e.target.value.replace(/\D/g, ""))}
                placeholder="021000021"
                inputMode="numeric"
              />
            </div>
          </div>

          {/* Set as primary toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none group">
            <div
              role="checkbox"
              aria-checked={form.is_primary}
              onClick={() => set("is_primary", !form.is_primary)}
              className={`relative w-11 h-6 rounded-full transition-all flex-shrink-0 cursor-pointer ${form.is_primary ? "bg-gradient-to-r from-[#001f3f] to-[#d6b357]" : "bg-[#e5e5e5]"}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${form.is_primary ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#374151]">Set as Primary Account</p>
              <p className="text-xs text-[#6b7280]">Commission payouts go to your primary account</p>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#f0f0f0] flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 rounded-full border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={busy}
            className="bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-7 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-lg shadow-md disabled:opacity-60 disabled:translate-y-0 flex items-center gap-2"
          >
            {busy ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
            ) : editAccount ? (
              <><Check className="w-4 h-4" /> Save Changes</>
            ) : (
              <><Plus className="w-4 h-4" /> Add Account</>
            )}
          </button>
        </div>
      </div>
    </div>    </Portal>  )
}

// ─── Confirm Delete Dialog ──────────────────────────────────────────────────────
function ConfirmDeleteDialog({
  open,
  account,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean
  account: BankAccount | null
  onClose: () => void
  onConfirm: () => void
  busy: boolean
}) {
  if (!open || !account) return null

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-sm bg-white/80 backdrop-blur-2xl rounded-[28px] border border-white/60 shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h3 className="font-['Space_Grotesk'] text-base font-bold text-[#0d1117]">Delete Bank Account</h3>
            <p className="text-xs text-[#6b7280]">This action cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-[#4b5563] mb-5">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-[#0d1117]">{account.bank_name}</span> ending in{" "}
          <span className="font-mono font-semibold">•••{account.account_number.slice(-4)}</span>?
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="px-5 py-2.5 rounded-full bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 transition-all disabled:opacity-60 flex items-center gap-2"
          >
            {busy ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Deleting…</>
            ) : (
              <><Trash2 className="w-4 h-4" /> Delete</>
            )}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  )
}

// ─── Account Row ───────────────────────────────────────────────────────────────
function AccountRow({
  account,
  onEdit,
  onSetPrimary,
  onToggleStatus,
  onDelete,
  busy,
}: {
  account: BankAccount
  onEdit: (a: BankAccount) => void
  onSetPrimary: (a: BankAccount) => void
  onToggleStatus: (a: BankAccount) => void
  onDelete: (a: BankAccount) => void
  busy: boolean
}) {
  const isActive = account.status === "active"

  return (
    <div
      className={`rounded-2xl border p-4 transition-all ${
        account.is_primary
          ? "border-[#d6b357]/40 bg-gradient-to-r from-[#001f3f]/[0.03] to-[#d6b357]/[0.04]"
          : "border-[#f0f0f0] bg-white/70"
      } ${!isActive ? "opacity-60" : ""}`}
    >
      {/* Top row: bank name + badges */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${account.is_primary ? "bg-gradient-to-br from-[#001f3f] to-[#d6b357]" : "bg-[#f3f4f6]"}`}>
            <Landmark className={`w-5 h-5 ${account.is_primary ? "text-white" : "text-[#6b7280]"}`} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-[#0d1117] truncate">{account.bank_name}</p>
            <p className="text-xs text-[#6b7280] truncate">{account.account_name}</p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          {account.is_primary && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white">
              <Star className="w-3 h-3" />
              Primary
            </span>
          )}
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              isActive
                ? "bg-green-100 text-green-700"
                : "bg-[#f3f4f6] text-[#9ca3af]"
            }`}
          >
            {account.status}
          </span>
        </div>
      </div>

      {/* Details grid */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Account No.", value: maskAccountNumber(account.account_number) },
          { label: "Currency",    value: account.currency_code },
          { label: "Type",        value: bankTypeLabel(account.bank_type) },
          { label: "Country",     value: countryLabel(account.bank_country) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white/80 rounded-xl px-3 py-2 border border-[#f0f0f0]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-0.5">{label}</p>
            <p className="text-xs font-semibold text-[#374151] truncate font-mono">{value}</p>
          </div>
        ))}
      </div>

      {/* Action row */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => onEdit(account)}
          disabled={busy}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border border-[#e5e5e5] text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] transition-all disabled:opacity-50"
        >
          <Pencil className="w-3.5 h-3.5" /> Edit
        </button>

        {!account.is_primary && isActive && (
          <button
            type="button"
            onClick={() => onSetPrimary(account)}
            disabled={busy}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border border-[#d6b357]/40 text-[#b8882a] hover:bg-[#d6b357]/10 transition-all disabled:opacity-50"
          >
            <Star className="w-3.5 h-3.5" /> Set as Primary
          </button>
        )}

        <button
          type="button"
          onClick={() => onToggleStatus(account)}
          disabled={busy}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border transition-all disabled:opacity-50 ${
            isActive
              ? "border-[#fee2e2] text-[#ef4444] hover:bg-[#fee2e2]/40"
              : "border-[#dcfce7] text-[#16a34a] hover:bg-[#dcfce7]/40"
          }`}
        >
          {isActive ? <><PowerOff className="w-3.5 h-3.5" /> Deactivate</> : <><Power className="w-3.5 h-3.5" /> Activate</>}
        </button>

        {!account.is_primary && (
          <button
            type="button"
            onClick={() => onDelete(account)}
            disabled={busy}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border border-transparent text-[#9ca3af] hover:border-rose-200 hover:text-rose-500 transition-all disabled:opacity-50 ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-[#f3f4f6] to-[#e5e7eb] flex items-center justify-center mb-4">
        <Landmark className="w-8 h-8 text-[#9ca3af]" />
      </div>
      <h4 className="font-['Space_Grotesk'] text-base font-bold text-[#0d1117] mb-1">
        No bank accounts yet
      </h4>
      <p className="text-sm text-[#6b7280] max-w-xs mb-6">
        Add a bank account to receive your commission payouts directly.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-7 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-lg shadow-md flex items-center gap-2"
      >
        <Plus className="w-4 h-4" /> Add Bank Account
      </button>
    </div>
  )
}

// ─── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, type, onDismiss }: { message: string; type: "success" | "error"; onDismiss: () => void }) {
  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border text-sm font-medium transition-all ${
        type === "success"
          ? "bg-white border-green-100 text-green-700"
          : "bg-white border-rose-100 text-rose-700"
      }`}
    >
      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${type === "success" ? "bg-green-100" : "bg-rose-100"}`}>
        {type === "success"
          ? <Check className="w-3.5 h-3.5 text-green-600" />
          : <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
        }
      </div>
      {message}
      <button type="button" onClick={onDismiss} className="ml-2 text-[#9ca3af] hover:text-[#374151]">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export function BankAccountsTab({ userId }: { userId: string }) {
  const [accounts, setAccounts]       = useState<BankAccount[]>([])
  const [loading, setLoading]         = useState(true)
  const [actionBusy, setActionBusy]   = useState(false)
  const [modalOpen, setModalOpen]     = useState(false)
  const [editTarget, setEditTarget]   = useState<BankAccount | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BankAccount | null>(null)
  const [deleteBusy, setDeleteBusy]   = useState(false)
  const [toast, setToast]             = useState<{ type: "success" | "error"; message: string } | null>(null)

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message })
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await fetchBankAccounts(userId)
    if (error) showToast("error", error)
    setAccounts(data ?? [])
    setLoading(false)
  }, [userId, showToast])

  useEffect(() => { void load() }, [load])

  const hasPrimary = accounts.some((a) => a.is_primary)

  const openAdd  = () => { setEditTarget(null); setModalOpen(true) }
  const openEdit = (a: BankAccount) => { setEditTarget(a); setModalOpen(true) }

  const handleSaved = (saved: BankAccount, isEdit: boolean) => {
    if (isEdit) {
      setAccounts((prev) => {
        const updated = prev.map((a) =>
          saved.is_primary && a.id !== saved.id ? { ...a, is_primary: false } : a,
        )
        return updated.map((a) => (a.id === saved.id ? saved : a))
      })
    } else {
      setAccounts((prev) => {
        const others = saved.is_primary ? prev.map((a) => ({ ...a, is_primary: false })) : prev
        return [saved, ...others]
      })
    }
    setModalOpen(false)
    showToast("success", isEdit ? "Bank account updated." : "Bank account added successfully.")
  }

  const handleSetPrimary = async (account: BankAccount) => {
    setActionBusy(true)
    const { error } = await setPrimaryBankAccount(account.id, userId)
    if (error) { showToast("error", error); setActionBusy(false); return }
    setAccounts((prev) =>
      prev.map((a) => ({ ...a, is_primary: a.id === account.id })),
    )
    showToast("success", "Primary account updated.")
    setActionBusy(false)
  }

  const handleToggleStatus = async (account: BankAccount) => {
    setActionBusy(true)
    const { error } = await toggleBankAccountStatus(account.id, account.status)
    if (error) { showToast("error", error); setActionBusy(false); return }
    const nextStatus = account.status === "active" ? "inactive" : "active"
    setAccounts((prev) =>
      prev.map((a) => (a.id === account.id ? { ...a, status: nextStatus } : a)),
    )
    showToast("success", `Account ${nextStatus === "active" ? "activated" : "deactivated"}.`)
    setActionBusy(false)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteBusy(true)
    const { error } = await deleteBankAccount(deleteTarget.id)
    if (error) { showToast("error", error); setDeleteBusy(false); setDeleteTarget(null); return }
    setAccounts((prev) => prev.filter((a) => a.id !== deleteTarget.id))
    setDeleteTarget(null)
    showToast("success", "Bank account deleted.")
    setDeleteBusy(false)
  }

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-['Space_Grotesk'] text-lg font-bold text-[#0d1117]">Bank Accounts</h3>
            <p className="text-sm text-[#6b7280] mt-0.5">
              Manage the accounts where your commissions will be sent.
            </p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-5 py-2.5 rounded-full font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-lg shadow-md flex items-center gap-2 flex-shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Bank Account
          </button>
        </div>

        {/* Info strip */}
        {!loading && accounts.length > 0 && !hasPrimary && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>No primary account is set. Set one account as primary to receive commission payouts.</span>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-[#f0f0f0] bg-white/70 p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#f3f4f6]" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 bg-[#f3f4f6] rounded w-1/3" />
                    <div className="h-2.5 bg-[#f3f4f6] rounded w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState onAdd={openAdd} />
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                onEdit={openEdit}
                onSetPrimary={(a) => void handleSetPrimary(a)}
                onToggleStatus={(a) => void handleToggleStatus(a)}
                onDelete={(a) => setDeleteTarget(a)}
                busy={actionBusy}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <BankAccountModal
        open={modalOpen}
        editAccount={editTarget}
        userId={userId}
        hasPrimary={hasPrimary}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        onError={(msg) => showToast("error", msg)}
      />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        account={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        busy={deleteBusy}
      />

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  )
}
