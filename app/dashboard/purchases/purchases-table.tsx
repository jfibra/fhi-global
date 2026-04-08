"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard/shell"
import { getRoleColor } from "@/components/dashboard/sidebar-config"
import { roleToLabel } from "@/lib/auth"
import {
  fetchCategoriesForPurchase,
  fetchPurchases,
  fetchTaxEntitiesForPurchase,
  softDeletePurchase,
  type CategoryOption,
  type Purchase,
  type TaxEntityOption,
  type TaxType,
} from "@/lib/purchase-service"
import { PurchaseActions } from "./purchase-actions"
import { PurchaseAttachmentsDialog } from "./purchase-attachments-dialog"
import { PurchaseFormDialog } from "./purchase-form-dialog"

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastType = "success" | "error"
type SortField = "invoice_number" | "tax_month" | "total_actual_amount" | "created_at"
type SortDir = "asc" | "desc"

const PER_PAGE_OPTIONS = [10, 20, 50] as const

// ─── Toast Stack ──────────────────────────────────────────────────────────────

function ToastStack({
  toasts,
  remove,
}: {
  toasts: Array<{ id: number; type: ToastType; text: string }>
  remove: (id: number) => void
}) {
  return (
    <div className="fixed bottom-6 right-6 z-[80] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold pointer-events-auto max-w-xs transition-all ${
            toast.type === "success"
              ? "bg-green-50 text-green-800 border border-green-100"
              : "bg-rose-50 text-rose-800 border border-rose-100"
          }`}
        >
          <span className="flex-1">{toast.text}</span>
          <button type="button" onClick={() => remove(toast.id)} className="opacity-60 hover:opacity-100 text-xs ml-2">✕</button>
        </div>
      ))}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(value: string) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function formatMonth(value: string) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-US", { year: "numeric", month: "long" })
}

function formatAmount(value: number | null, currency = "AED") {
  if (value == null) return "—"
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + " " + currency
}

function TaxTypeBadge({ type }: { type: TaxType }) {
  if (type === "vat") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        VAT
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
      Non VAT
    </span>
  )
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-[#f3f4f6]">
          {Array.from({ length: 11 }).map((__, j) => (
            <td key={j} className="px-4 py-4 first:pl-6 last:pr-6">
              <div className={`h-3 rounded-full bg-[#f0f2f5] animate-pulse ${j === 0 ? "w-36" : "w-20"}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function SortableHead({
  label,
  field,
  activeField,
  dir,
  onToggle,
}: {
  label: string
  field: SortField
  activeField: SortField
  dir: SortDir
  onToggle: (field: SortField) => void
}) {
  const isActive = activeField === field
  return (
    <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5 whitespace-nowrap">
      <button
        type="button"
        onClick={() => onToggle(field)}
        className={`inline-flex items-center gap-1.5 transition-colors ${
          isActive ? "text-[#001f3f]" : "text-[#9ca3af] hover:text-[#6b7280]"
        }`}
      >
        {label}
        <ArrowUpDown
          className={`w-3.5 h-3.5 ${isActive ? "opacity-100" : "opacity-50"} ${
            isActive && dir === "desc" ? "rotate-180" : ""
          }`}
        />
      </button>
    </th>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PurchasesTable({
  currentUserId,
  currentRole,
  userName,
}: {
  currentUserId: string
  currentRole: string
  userName: string
}) {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [taxEntities, setTaxEntities] = useState<TaxEntityOption[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<10 | 20 | 50>(10)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [taxTypeFilter, setTaxTypeFilter] = useState<"all" | TaxType>("all")
  const [taxMonthFilter, setTaxMonthFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [entityFilter, setEntityFilter] = useState("all")
  const [showDeleted, setShowDeleted] = useState(false)
  const [sortField, setSortField] = useState<SortField>("created_at")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [loading, setLoading] = useState(false)

  // dialog state
  const [showForm, setShowForm] = useState(false)
  const [viewMode, setViewMode] = useState(false)
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null)
  const [showAttachments, setShowAttachments] = useState(false)
  const [attachmentPurchase, setAttachmentPurchase] = useState<Purchase | null>(null)

  const [toasts, setToasts] = useState<Array<{ id: number; type: ToastType; text: string }>>([])
  const toastIdRef = useRef(0)

  const addToast = (type: ToastType, text: string) => {
    const id = ++toastIdRef.current
    setToasts((prev) => [...prev, { id, type, text }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  // Generate tax-month options from loaded purchase data
  const taxMonthOptions = Array.from(
    new Set(purchases.map((p) => p.tax_month).filter(Boolean)),
  ).sort().reverse()

  const loadReferenceData = useCallback(async () => {
    const [entitiesRes, categoriesRes] = await Promise.all([
      fetchTaxEntitiesForPurchase(),
      fetchCategoriesForPurchase(),
    ])
    if (!entitiesRes.error) setTaxEntities(entitiesRes.data ?? [])
    if (!categoriesRes.error) setCategories(categoriesRes.data ?? [])
  }, [])

  const loadPurchases = useCallback(async () => {
    setLoading(true)
    try {
      const { data, total: count, error } = await fetchPurchases({
        page,
        perPage,
        search: search || undefined,
        taxType: taxTypeFilter === "all" ? undefined : taxTypeFilter,
        taxMonth: taxMonthFilter === "all" ? undefined : taxMonthFilter,
        categoryId: categoryFilter === "all" ? undefined : categoryFilter,
        taxEntityId: entityFilter === "all" ? undefined : entityFilter,
        showDeleted,
        sortField,
        sortDir,
      })
      if (error) { addToast("error", error); return }
      setPurchases(data ?? [])
      setTotal(count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, taxTypeFilter, taxMonthFilter, categoryFilter, entityFilter, showDeleted, sortField, sortDir])

  useEffect(() => { void loadReferenceData() }, [loadReferenceData])
  useEffect(() => { void loadPurchases() }, [loadPurchases])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((prev) => prev === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("asc") }
    setPage(1)
  }

  const handleDelete = async (purchase: Purchase) => {
    const ok = window.confirm(`Delete purchase "${purchase.invoice_number}"? This action soft-deletes the record.`)
    if (!ok) return
    const { error } = await softDeletePurchase(purchase.id)
    if (error) { addToast("error", error); return }
    addToast("success", "Purchase deleted")
    void loadPurchases()
  }

  const openCreate = () => { setSelectedPurchase(null); setViewMode(false); setShowForm(true) }
  const openEdit = (p: Purchase) => { setSelectedPurchase(p); setViewMode(false); setShowForm(true) }
  const openView = (p: Purchase) => { setSelectedPurchase(p); setViewMode(true); setShowForm(true) }
  const openAttachments = (p: Purchase) => { setAttachmentPurchase(p); setShowAttachments(true) }

  const onSaved = (purchase: Purchase, isEdit: boolean) => {
    setShowForm(false)
    addToast("success", isEdit ? "Purchase updated" : "Purchase created")
    void loadPurchases()
  }

  // Live-update attachment count in the table without full reload
  const handleCountChange = (id: string, count: number) => {
    setPurchases((prev) =>
      prev.map((p) => p.id === id ? { ...p, attachments_count: count } : p),
    )
    if (attachmentPurchase?.id === id) {
      setAttachmentPurchase((prev) => prev ? { ...prev, attachments_count: count } : prev)
    }
  }

  return (
    <DashboardShell
      role={currentRole}
      roleLabel={roleToLabel(currentRole)}
      roleColor={getRoleColor(currentRole)}
      userName={userName}
    >
      <div className="space-y-6">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#001f3f] to-[#d6b357] flex items-center justify-center shadow-lg">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0d1117]">
                Purchases
              </h1>
              <p className="text-sm text-[#6b7280]">Manage VAT purchase records for Dubai accounting</p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-4 py-2.5 rounded-full text-sm font-semibold shadow-md hover:translate-y-[-1px] hover:shadow-lg transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Add Purchase
          </button>
        </div>

        {/* Filters bar */}
        <div className="bg-white/60 backdrop-blur-xl rounded-[24px] border border-white/60 shadow-sm shadow-black/5 p-4">
          <div className="flex flex-col xl:flex-row gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search invoice number or notes…"
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 placeholder:text-[#9ca3af]"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-[#9ca3af]" />

              <select
                value={taxTypeFilter}
                onChange={(e) => { setTaxTypeFilter(e.target.value as "all" | TaxType); setPage(1) }}
                className="pl-3 pr-8 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer"
              >
                <option value="all">All Tax Types</option>
                <option value="vat">VAT</option>
                <option value="non_vat">Non VAT</option>
              </select>

              <select
                value={taxMonthFilter}
                onChange={(e) => { setTaxMonthFilter(e.target.value); setPage(1) }}
                className="pl-3 pr-8 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer"
              >
                <option value="all">All Months</option>
                {taxMonthOptions.map((m) => (
                  <option key={m} value={m}>{formatMonth(m)}</option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
                className="pl-3 pr-8 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.category_name}</option>
                ))}
              </select>

              <select
                value={entityFilter}
                onChange={(e) => { setEntityFilter(e.target.value); setPage(1) }}
                className="pl-3 pr-8 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer"
              >
                <option value="all">All Vendors</option>
                {taxEntities.map((te) => (
                  <option key={te.id} value={te.id}>{te.registered_name}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => { setShowDeleted((prev) => !prev); setPage(1) }}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium border transition-all ${
                  showDeleted
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : "bg-white/80 border-[#e5e5e5] text-[#6b7280] hover:border-[#d0d5dd]"
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Deleted
              </button>

              <button
                type="button"
                onClick={() => void loadPurchases()}
                className="p-2.5 rounded-2xl border border-[#e5e5e5] bg-white/80 text-[#6b7280] hover:text-[#001f3f] hover:border-[#001f3f]/20 transition-all"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white/60 backdrop-blur-xl rounded-[24px] border border-white/60 shadow-sm shadow-black/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f0f2f5] bg-white/40">
                  <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5 pl-6 whitespace-nowrap">Vendor</th>
                  <SortableHead label="Invoice" field="invoice_number" activeField={sortField} dir={sortDir} onToggle={toggleSort} />
                  <SortableHead label="Tax Month" field="tax_month" activeField={sortField} dir={sortDir} onToggle={toggleSort} />
                  <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5 whitespace-nowrap">Tax Type</th>
                  <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5 whitespace-nowrap">Gross Taxable</th>
                  <SortableHead label="Total Amount" field="total_actual_amount" activeField={sortField} dir={sortDir} onToggle={toggleSort} />
                  <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5 whitespace-nowrap">Currency</th>
                  <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5 whitespace-nowrap">Category</th>
                  <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5 whitespace-nowrap">Created By</th>
                  <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5 whitespace-nowrap">Files</th>
                  <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5 whitespace-nowrap">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#f8f9fa]">
                {loading ? (
                  <SkeletonRows />
                ) : purchases.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-14 text-center">
                      <div className="flex flex-col items-center gap-2 text-[#9ca3af]">
                        <ShoppingCart className="w-9 h-9 opacity-40" />
                        <p className="text-sm font-medium text-[#6b7280]">No purchases recorded yet.</p>
                        <p className="text-xs">Add your first purchase to start tracking VAT expenses.</p>
                        <button
                          type="button"
                          onClick={openCreate}
                          className="mt-3 inline-flex items-center gap-2 bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-4 py-2.5 rounded-full text-sm font-semibold shadow-md hover:translate-y-[-1px] hover:shadow-lg transition-all duration-200"
                        >
                          <Plus className="w-4 h-4" />
                          Add Purchase
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  purchases.map((purchase) => (
                    <tr
                      key={purchase.id}
                      className={`hover:bg-[#fcfdff] transition-colors ${purchase.deleted_at ? "opacity-60" : ""}`}
                    >
                      <td className="px-4 py-3.5 pl-6 whitespace-nowrap font-semibold text-[#0d1117]">
                        {purchase.company_tax_entities?.registered_name ?? "—"}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs text-[#374151]">
                        {purchase.invoice_number}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-[#374151]">
                        {formatMonth(purchase.tax_month)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <TaxTypeBadge type={purchase.tax_type} />
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-right font-mono text-xs text-[#374151]">
                        {purchase.gross_taxable != null
                          ? new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(purchase.gross_taxable)
                          : "—"}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-right font-mono text-sm font-semibold text-[#0d1117]">
                        {new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(purchase.total_actual_amount)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-[#374151] text-xs font-semibold">
                        {purchase.currency_code}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-[#6b7280]">
                        {purchase.purchase_categories?.category_name ?? <span className="text-[#9ca3af]">—</span>}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-[#6b7280]">
                        {purchase.profiles?.fullname ?? "—"}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {purchase.attachments_count > 0 ? (
                          <button
                            type="button"
                            onClick={() => openAttachments(purchase)}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-600 border border-sky-200 hover:bg-sky-100 transition-colors"
                          >
                            <Paperclip className="w-3 h-3" />
                            {purchase.attachments_count}
                          </button>
                        ) : (
                          <span className="text-[#9ca3af] text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 pr-6 whitespace-nowrap">
                        <PurchaseActions
                          purchase={purchase}
                          onView={() => openView(purchase)}
                          onEdit={() => openEdit(purchase)}
                          onAttachments={() => openAttachments(purchase)}
                          onDelete={() => void handleDelete(purchase)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-3.5 border-t border-[#f0f2f5] bg-white/40">
            <p className="text-xs text-[#9ca3af]">
              Showing {total === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <select
                value={perPage}
                onChange={(e) => { setPerPage(Number(e.target.value) as 10 | 20 | 50); setPage(1) }}
                className="pl-3 pr-8 py-1.5 rounded-xl border border-[#e5e5e5] text-xs bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer"
              >
                {PER_PAGE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt} / page</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-xl border border-[#e5e5e5] text-[#6b7280] hover:text-[#001f3f] hover:border-[#001f3f]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs text-[#6b7280] px-1">Page {page} of {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-xl border border-[#e5e5e5] text-[#6b7280] hover:text-[#001f3f] hover:border-[#001f3f]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <PurchaseFormDialog
        open={showForm}
        viewMode={viewMode}
        editPurchase={selectedPurchase}
        taxEntities={taxEntities}
        categories={categories}
        currentUserId={currentUserId}
        onClose={() => { setShowForm(false); setViewMode(false); setSelectedPurchase(null) }}
        onSaved={onSaved}
        onError={(msg) => addToast("error", msg)}
      />

      <PurchaseAttachmentsDialog
        open={showAttachments}
        purchase={attachmentPurchase}
        currentUserId={currentUserId}
        onClose={() => { setShowAttachments(false); setAttachmentPurchase(null) }}
        onCountChange={handleCountChange}
      />

      <ToastStack
        toasts={toasts}
        remove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </DashboardShell>
  )
}
