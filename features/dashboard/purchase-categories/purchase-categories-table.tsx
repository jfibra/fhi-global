"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Tag,
} from "lucide-react"
import {
  deletePurchaseCategory,
  fetchPurchaseCategories,
  togglePurchaseCategoryActive,
  type CategoryType,
  type PurchaseCategory,
} from "@/lib/purchase-category-service"
import { PurchaseCategoryActions } from "./purchase-category-actions"
import { PurchaseCategoryFormDialog } from "./purchase-category-form-dialog"

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastType = "success" | "error"
type SortField = "category_name" | "created_at"
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
          <button
            type="button"
            onClick={() => remove(toast.id)}
            className="opacity-60 hover:opacity-100 text-xs ml-2"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(value: string) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function TypeBadge({ type }: { type: CategoryType }) {
  if (type === "default") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
        Default
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
      Custom
    </span>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  if (active) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        Active
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
      Inactive
    </span>
  )
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, index) => (
        <tr key={index} className="border-b border-[#f3f4f6]">
          {Array.from({ length: 6 }).map((__, cellIndex) => (
            <td key={cellIndex} className="px-4 py-4 first:pl-6 last:pr-6">
              <div
                className={`h-3 rounded-full bg-[#f0f2f5] animate-pulse ${cellIndex === 0 ? "w-40" : "w-20"}`}
              />
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

export function PurchaseCategoriesTable({
  currentUserId,
  currentRole,
  userName,
}: {
  currentUserId: string
  currentRole: string
  userName: string
}) {
  const [categories, setCategories] = useState<PurchaseCategory[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<10 | 20 | 50>(10)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [categoryType, setCategoryType] = useState<"all" | CategoryType>("all")
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all")
  const [sortField, setSortField] = useState<SortField>("created_at")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<PurchaseCategory | null>(null)
  const [toasts, setToasts] = useState<Array<{ id: number; type: ToastType; text: string }>>([])

  const toastIdRef = useRef(0)

  const addToast = (type: ToastType, text: string) => {
    const id = ++toastIdRef.current
    setToasts((prev) => [...prev, { id, type, text }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  const loadCategories = useCallback(async () => {
    setLoading(true)
    try {
      const { data, total: count, error } = await fetchPurchaseCategories({
        page,
        perPage,
        search: search || undefined,
        categoryType: categoryType === "all" ? undefined : categoryType,
        status: status === "all" ? undefined : status === "active",
        sortField,
        sortDir,
      })
      if (error) {
        addToast("error", error)
        return
      }
      setCategories(data ?? [])
      setTotal(count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, categoryType, status, sortField, sortDir])

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timeout)
  }, [searchInput])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("asc")
    }
    setPage(1)
  }

  const handleDelete = async (category: PurchaseCategory) => {
    const ok = window.confirm(`Delete "${category.category_name}"? This cannot be undone.`)
    if (!ok) return
    const { error } = await deletePurchaseCategory(category.id)
    if (error) {
      addToast("error", error)
      return
    }
    addToast("success", "Category deleted")
    void loadCategories()
  }

  const handleToggleActive = async (category: PurchaseCategory) => {
    const { error } = await togglePurchaseCategoryActive(category.id, category.is_active)
    if (error) {
      addToast("error", error)
      return
    }
    addToast("success", "Status updated")
    void loadCategories()
  }

  const openCreate = () => {
    setSelectedCategory(null)
    setShowForm(true)
  }

  const openEdit = (category: PurchaseCategory) => {
    setSelectedCategory(category)
    setShowForm(true)
  }

  const onSaved = (category: PurchaseCategory, isEdit: boolean) => {
    setShowForm(false)
    setSelectedCategory(null)
    addToast("success", isEdit ? "Category updated" : "Category created")
    void loadCategories()
  }

  return (
    <>
      <div className="space-y-6">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] flex items-center justify-center shadow-lg">
              <Tag className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0d1117]">
                Purchase Categories
              </h1>
              <p className="text-sm text-[#6b7280]">
                Manage categories used for purchase expense records
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] text-white px-4 py-2.5 rounded-full text-sm font-semibold shadow-md hover:translate-y-[-1px] hover:shadow-lg transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        </div>

        {/* Filters bar */}
        <div className="bg-white/60 backdrop-blur-xl rounded-[24px] border border-white/60 shadow-sm shadow-black/5 p-4">
          <div className="flex flex-col xl:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search category name…"
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 placeholder:text-[#9ca3af]"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-[#9ca3af]" />

              <select
                value={categoryType}
                onChange={(e) => {
                  setCategoryType(e.target.value as "all" | CategoryType)
                  setPage(1)
                }}
                className="pl-3 pr-8 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="default">Default</option>
                <option value="custom">Custom</option>
              </select>

              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as "all" | "active" | "inactive")
                  setPage(1)
                }}
                className="pl-3 pr-8 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <button
                type="button"
                onClick={() => void loadCategories()}
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
                  <SortableHead
                    label="Category Name"
                    field="category_name"
                    activeField={sortField}
                    dir={sortDir}
                    onToggle={toggleSort}
                  />
                  <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5 whitespace-nowrap">
                    Type
                  </th>
                  <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5 whitespace-nowrap">
                    Created By
                  </th>
                  <SortableHead
                    label="Created Date"
                    field="created_at"
                    activeField={sortField}
                    dir={sortDir}
                    onToggle={toggleSort}
                  />
                  <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5 whitespace-nowrap">
                    Status
                  </th>
                  <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5 whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#f8f9fa]">
                {loading ? (
                  <SkeletonRows />
                ) : categories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-14 text-center">
                      <div className="flex flex-col items-center gap-2 text-[#9ca3af]">
                        <Tag className="w-9 h-9 opacity-40" />
                        <p className="text-sm font-medium text-[#6b7280]">
                          No purchase categories found.
                        </p>
                        <p className="text-xs">
                          Create a category to organize purchase records.
                        </p>
                        <button
                          type="button"
                          onClick={openCreate}
                          className="mt-3 inline-flex items-center gap-2 bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] text-white px-4 py-2.5 rounded-full text-sm font-semibold shadow-md hover:translate-y-[-1px] hover:shadow-lg transition-all duration-200"
                        >
                          <Plus className="w-4 h-4" />
                          Add Category
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  categories.map((category) => (
                    <tr key={category.id} className="hover:bg-[#fcfdff] transition-colors">
                      <td className="px-4 py-3.5 first:pl-6 whitespace-nowrap font-semibold text-[#0d1117]">
                        {category.category_name}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <TypeBadge type={category.category_type} />
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-[#374151]">
                        {category.profiles?.fullname ?? "System"}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-[#6b7280]">
                        {formatDate(category.created_at)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <StatusBadge active={category.is_active} />
                      </td>
                      <td className="px-4 py-3.5 last:pr-6 whitespace-nowrap">
                        <PurchaseCategoryActions
                          category={category}
                          onEdit={() => openEdit(category)}
                          onToggleActive={() => void handleToggleActive(category)}
                          onDelete={() => void handleDelete(category)}
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
              Showing{" "}
              {total === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of{" "}
              {total}
            </p>

            <div className="flex items-center gap-2">
              <select
                value={perPage}
                onChange={(e) => {
                  const v = Number(e.target.value) as 10 | 20 | 50
                  setPerPage(v)
                  setPage(1)
                }}
                className="pl-3 pr-8 py-1.5 rounded-xl border border-[#e5e5e5] text-xs bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer"
              >
                {PER_PAGE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option} / page
                  </option>
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

              <span className="text-xs text-[#6b7280] px-1">
                Page {page} of {totalPages}
              </span>

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

      <PurchaseCategoryFormDialog
        open={showForm}
        editCategory={selectedCategory}
        currentRole={currentRole}
        currentUserId={currentUserId}
        onClose={() => {
          setShowForm(false)
          setSelectedCategory(null)
        }}
        onSaved={onSaved}
        onError={(message) => addToast("error", message)}
      />

      <ToastStack
        toasts={toasts}
        remove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </>
  )
}
