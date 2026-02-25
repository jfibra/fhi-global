"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowUpDown,
  Building2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Landmark,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard/shell"
import { getRoleColor } from "@/components/dashboard/sidebar-config"
import { roleToLabel } from "@/lib/auth"
import {
  fetchTaxEntities,
  fetchTaxEntityDevelopers,
  softDeleteTaxEntity,
  toggleTaxEntityActive,
  type TaxEntity,
  type TaxEntityDeveloper,
} from "@/lib/tax-entity-service"
import { TaxEntityActions } from "./tax-entity-actions"
import { TaxEntityFormDialog } from "./tax-entity-form-dialog"

type ToastType = "success" | "error"

type SortField = "registered_name" | "created_at" | "entity_type" | "country_code"
type SortDir = "asc" | "desc"

const PER_PAGE_OPTIONS = [10, 20, 50] as const

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

function formatDate(value: string) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function TypeBadge({ type }: { type: "sale" | "purchase" }) {
  if (type === "sale") {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">Sale</span>
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">Purchase</span>
}

function StatusBadge({ active }: { active: boolean }) {
  if (active) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">Inactive</span>
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, index) => (
        <tr key={index} className="border-b border-[#f3f4f6]">
          {Array.from({ length: 11 }).map((__, cellIndex) => (
            <td key={cellIndex} className="px-4 py-4 first:pl-6 last:pr-6">
              <div className={`h-3 rounded-full bg-[#f0f2f5] animate-pulse ${cellIndex === 0 ? "w-36" : "w-20"}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function TaxEntitiesTable({ currentRole, userName }: { currentRole: string; userName: string }) {
  const [entities, setEntities] = useState<TaxEntity[]>([])
  const [developers, setDevelopers] = useState<TaxEntityDeveloper[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<10 | 20 | 50>(10)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [entityType, setEntityType] = useState<"all" | "sale" | "purchase">("all")
  const [country, setCountry] = useState("all")
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all")
  const [developerId, setDeveloperId] = useState("all")
  const [showDeleted, setShowDeleted] = useState(false)
  const [sortField, setSortField] = useState<SortField>("created_at")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [viewMode, setViewMode] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState<TaxEntity | null>(null)
  const [toasts, setToasts] = useState<Array<{ id: number; type: ToastType; text: string }>>([])

  const toastIdRef = useRef(0)

  const addToast = (type: ToastType, text: string) => {
    const id = ++toastIdRef.current
    setToasts((prev) => [...prev, { id, type, text }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, 4000)
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  const countryOptions = useMemo(() => {
    const set = new Set<string>()
    entities.forEach((entity) => {
      if (entity.country_code) set.add(entity.country_code.toUpperCase())
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [entities])

  const loadDevelopers = useCallback(async () => {
    const { data, error } = await fetchTaxEntityDevelopers()
    if (error) {
      addToast("error", error)
      return
    }
    setDevelopers(data ?? [])
  }, [])

  const loadEntities = useCallback(async () => {
    setLoading(true)
    try {
      const { data, total: count, error } = await fetchTaxEntities({
        page,
        perPage,
        search: search || undefined,
        entityType: entityType === "all" ? undefined : entityType,
        country: country === "all" ? undefined : country,
        status: status === "all" ? undefined : status === "active",
        developerId: developerId === "all" ? undefined : developerId,
        showDeleted,
        sortField,
        sortDir,
      })
      if (error) {
        addToast("error", error)
        return
      }
      setEntities(data ?? [])
      setTotal(count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, entityType, country, status, developerId, showDeleted, sortField, sortDir])

  useEffect(() => {
    void loadDevelopers()
  }, [loadDevelopers])

  useEffect(() => {
    void loadEntities()
  }, [loadEntities])

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

  const handleSoftDelete = async (entity: TaxEntity) => {
    const ok = window.confirm(`Soft delete "${entity.registered_name}"?`)
    if (!ok) return
    const { error } = await softDeleteTaxEntity(entity.id)
    if (error) {
      addToast("error", error)
      return
    }
    addToast("success", "Tax entity deleted")
    void loadEntities()
  }

  const handleToggleActive = async (entity: TaxEntity) => {
    const { error } = await toggleTaxEntityActive(entity.id, entity.is_active)
    if (error) {
      addToast("error", error)
      return
    }
    addToast("success", "Status updated")
    void loadEntities()
  }

  const openCreate = () => {
    setSelectedEntity(null)
    setViewMode(false)
    setShowForm(true)
  }

  const openEdit = (entity: TaxEntity) => {
    setSelectedEntity(entity)
    setViewMode(false)
    setShowForm(true)
  }

  const openView = (entity: TaxEntity) => {
    setSelectedEntity(entity)
    setViewMode(true)
    setShowForm(true)
  }

  const onSaved = (entity: TaxEntity, isEdit: boolean) => {
    setShowForm(false)
    setSelectedEntity(entity)
    addToast("success", isEdit ? "Tax entity updated" : "Tax entity created")
    void loadEntities()
  }

  return (
    <DashboardShell role={currentRole} roleLabel={roleToLabel(currentRole)} roleColor={getRoleColor(currentRole)} userName={userName}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#001f3f] to-[#d6b357] flex items-center justify-center shadow-lg">
              <Landmark className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-['Space_Grotesk'] text-2xl font-bold tracking-tight text-[#0d1117]">Company Tax Entities</h1>
              <p className="text-sm text-[#6b7280]">Manage VAT registered companies used for invoicing</p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-4 py-2.5 rounded-full text-sm font-semibold shadow-md hover:translate-y-[-1px] hover:shadow-lg transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Add Tax Entity
          </button>
        </div>

        <div className="bg-white/60 backdrop-blur-xl rounded-[24px] border border-white/60 shadow-sm shadow-black/5 p-4">
          <div className="flex flex-col xl:flex-row gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search name, trade name, TRN, city..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 placeholder:text-[#9ca3af]"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-[#9ca3af]" />

              <select
                value={entityType}
                onChange={(event) => {
                  setEntityType(event.target.value as "all" | "sale" | "purchase")
                  setPage(1)
                }}
                className="pl-3 pr-8 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="sale">Sale Entities</option>
                <option value="purchase">Purchase Entities</option>
              </select>

              <select
                value={country}
                onChange={(event) => {
                  setCountry(event.target.value)
                  setPage(1)
                }}
                className="pl-3 pr-8 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer"
              >
                <option value="all">All Countries</option>
                {countryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as "all" | "active" | "inactive")
                  setPage(1)
                }}
                className="pl-3 pr-8 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <select
                value={developerId}
                onChange={(event) => {
                  setDeveloperId(event.target.value)
                  setPage(1)
                }}
                className="pl-3 pr-8 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer"
              >
                <option value="all">All Developers</option>
                {developers.map((developer) => (
                  <option key={developer.id} value={developer.id}>
                    {developer.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  setShowDeleted((prev) => !prev)
                  setPage(1)
                }}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium border transition-all ${
                  showDeleted
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : "bg-white/80 border-[#e5e5e5] text-[#6b7280] hover:border-[#d0d5dd]"
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Show Deleted
              </button>

              <button
                type="button"
                onClick={() => void loadEntities()}
                className="p-2.5 rounded-2xl border border-[#e5e5e5] bg-white/80 text-[#6b7280] hover:text-[#001f3f] hover:border-[#001f3f]/20 transition-all"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-xl rounded-[24px] border border-white/60 shadow-sm shadow-black/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f0f2f5] bg-white/40">
                  <SortableHead label="Registered Name" field="registered_name" activeField={sortField} dir={sortDir} onToggle={toggleSort} />
                  <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5 whitespace-nowrap">Trade Name</th>
                  <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5 whitespace-nowrap">TRN</th>
                  <SortableHead label="Entity Type" field="entity_type" activeField={sortField} dir={sortDir} onToggle={toggleSort} />
                  <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5 whitespace-nowrap">Developer</th>
                  <SortableHead label="Country" field="country_code" activeField={sortField} dir={sortDir} onToggle={toggleSort} />
                  <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5 whitespace-nowrap">VAT Rate</th>
                  <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5 whitespace-nowrap">Currency</th>
                  <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5 whitespace-nowrap">Status</th>
                  <SortableHead label="Created Date" field="created_at" activeField={sortField} dir={sortDir} onToggle={toggleSort} />
                  <th className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5 whitespace-nowrap">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#f8f9fa]">
                {loading ? (
                  <SkeletonRows />
                ) : entities.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-14 text-center">
                      <div className="flex flex-col items-center gap-2 text-[#9ca3af]">
                        <Building2 className="w-9 h-9 opacity-40" />
                        <p className="text-sm font-medium text-[#6b7280]">No tax entities found.</p>
                        <p className="text-xs">Create a tax entity to start managing VAT companies.</p>
                        <button
                          type="button"
                          onClick={openCreate}
                          className="mt-3 inline-flex items-center gap-2 bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-4 py-2.5 rounded-full text-sm font-semibold shadow-md hover:translate-y-[-1px] hover:shadow-lg transition-all duration-200"
                        >
                          <Plus className="w-4 h-4" />
                          Add Tax Entity
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  entities.map((entity) => (
                    <tr key={entity.id} className="hover:bg-[#fcfdff] transition-colors">
                      <td className="px-4 py-3.5 first:pl-6 whitespace-nowrap font-semibold text-[#0d1117]">{entity.registered_name}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-[#6b7280]">{entity.trade_name || "—"}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs text-[#374151]">{entity.tax_registration_number}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap"><TypeBadge type={entity.entity_type} /></td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-[#374151]">{entity.developers?.name ?? "—"}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-[#374151]">{entity.country_code || "—"}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-[#374151]">{entity.vat_rate.toFixed(2)}%</td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-[#374151]">{entity.currency_code}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap"><StatusBadge active={entity.is_active} /></td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-[#6b7280]">{formatDate(entity.created_at)}</td>
                      <td className="px-4 py-3.5 last:pr-6 whitespace-nowrap">
                        <TaxEntityActions
                          entity={entity}
                          onView={() => openView(entity)}
                          onEdit={() => openEdit(entity)}
                          onToggleActive={() => void handleToggleActive(entity)}
                          onDelete={() => void handleSoftDelete(entity)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-3.5 border-t border-[#f0f2f5] bg-white/40">
            <p className="text-xs text-[#9ca3af]">
              Showing {total === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
            </p>

            <div className="flex items-center gap-2">
              <select
                value={perPage}
                onChange={(event) => {
                  const value = Number(event.target.value) as 10 | 20 | 50
                  setPerPage(value)
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

      <TaxEntityFormDialog
        open={showForm}
        editEntity={selectedEntity}
        viewMode={viewMode}
        developers={developers}
        onClose={() => {
          setShowForm(false)
          setViewMode(false)
          setSelectedEntity(null)
        }}
        onSaved={onSaved}
        onError={(message) => addToast("error", message)}
      />

      <ToastStack toasts={toasts} remove={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} />
    </DashboardShell>
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
        className={`inline-flex items-center gap-1.5 transition-colors ${isActive ? "text-[#001f3f]" : "text-[#9ca3af] hover:text-[#6b7280]"}`}
      >
        {label}
        <ArrowUpDown className={`w-3.5 h-3.5 ${isActive ? "opacity-100" : "opacity-50"} ${isActive && dir === "desc" ? "rotate-180" : ""}`} />
      </button>
    </th>
  )
}