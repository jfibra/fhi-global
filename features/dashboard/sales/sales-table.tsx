"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Handshake,
  History,
  KeyRound,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react"
import {
  canEditSaleForRole,
  canManageSaleAttachmentsForRole,
  fetchSales,
  fetchSalesSummary,
  fetchDevelopersForSale,
  fetchAgentsForSale,
  updateSaleValidationStatus,
  isAdminRole,
  type SaleRecord,
  type SaleType,
  type SaleTypeSummary,
  type CommissionStatus,
  type ValidationStatus,
  type DeveloperOption,
  type AgentOption,
} from "@/lib/sales-service"
import { isSecretaryLikeRole } from "@/lib/app-roles"
import { SaleActions } from "./sale-actions"
import { SaleAttachmentsDialog } from "./sale-attachments-dialog"
import { SaleFormDialog } from "./sale-form-dialog"
import { SaleDetails } from "./sale-details"
import { ValidationDiscussion, type DiscussionTab } from "./[id]/validation-discussion"

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastType = "success" | "error"
type SortField = "reservation_date" | "contract_price" | "created_at"
type SortDir = "asc" | "desc"

const PER_PAGE_OPTIONS = [10, 20, 50] as const

// Sale-type selector cards — mirror the "Encode a Sale" 3-card page (icon + title
// + description), reusing the same icons (Building2/Handshake/KeyRound).
const SALE_TYPE_TABS: Array<{ type: SaleType; label: string; desc: string; icon: LucideIcon }> = [
  { type: "project",   label: "Project Sale", desc: "Units sold within a developer's project.",      icon: Building2 },
  { type: "brokerage", label: "Brokerage",    desc: "Resale / private-owner deals — no developer.",  icon: Handshake },
  { type: "rental",    label: "Rental",       desc: "Rental transactions and lease contracts.",       icon: KeyRound },
]

// One table column. `sortField` turns the header into a sort toggle; `cell` renders
// the value for a row. Columns are built per active tab so brokerage/rental drop the
// project-only Developer/Project/Unit columns and show Property Type/Address instead.
type Col = {
  key: string
  header: string
  sortField?: SortField
  tdClassName?: string
  cell: (s: SaleRecord) => ReactNode
}

const COMMISSION_STATUSES: CommissionStatus[] = ["pending", "processing", "approved", "released", "rejected"]
const VALIDATION_STATUSES: ValidationStatus[] = ["pending", "under_review", "validated", "invalid_sale"]

const STATUS_LABEL: Record<string, string> = {
  pending:      "Pending",
  processing:   "Processing",
  approved:     "Approved",
  released:     "Released",
  rejected:     "Rejected",
  under_review: "Under Review",
  validated:    "Validated",
  invalid_sale: "Invalid Sale",
}

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

function formatDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + " AED"
}

function StatusBadge({ value, type }: { value: string; type: "commission" | "validation" }) {
  const colors: Record<string, string> = {
    // commission statuses
    pending:      "bg-amber-50 text-amber-700 border-amber-200",
    processing:   "bg-blue-50 text-blue-700 border-blue-200",
    approved:     "bg-emerald-50 text-emerald-700 border-emerald-200",
    released:     "bg-violet-50 text-violet-700 border-violet-200",
    rejected:     "bg-rose-50 text-rose-700 border-rose-200",
    // validation statuses
    under_review: "bg-sky-50 text-sky-700 border-sky-200",
    validated:    "bg-emerald-50 text-emerald-700 border-emerald-200",
    invalid_sale: "bg-rose-50 text-rose-700 border-rose-200",
  }
  const labels: Record<string, string> = {
    pending:      "Pending",
    processing:   "Processing",
    approved:     "Approved",
    released:     "Released",
    rejected:     "Rejected",
    under_review: "Under Review",
    validated:    "Validated",
    invalid_sale: "Invalid Sale",
  }
  const cls   = colors[value] ?? "bg-slate-100 text-slate-600 border-slate-200"
  const label = labels[value] ?? value.replace(/_/g, " ")
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${cls}`}>
      {label}
    </span>
  )
}

function SummaryTile({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-[20px] border border-white/60 shadow-sm shadow-black/5 p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#001f3f] to-[#d6b357] flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">{label}</p>
        <p className="text-lg font-bold text-[#0d1117] truncate">{value}</p>
      </div>
    </div>
  )
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-[#f3f4f6]">
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="px-4 py-4 first:pl-6 last:pr-6">
              <div className={`h-3 rounded-full bg-[#f0f2f5] animate-pulse ${j === 0 ? "w-32" : "w-20"}`} />
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
        <ArrowUpDown className={`w-3.5 h-3.5 ${isActive ? "opacity-100" : "opacity-50"} ${isActive && dir === "desc" ? "rotate-180" : ""}`} />
      </button>
    </th>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SalesTable({
  currentUserId,
  currentRole,
  userName,
}: {
  currentUserId: string
  currentRole: string
  userName: string
}) {
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [developers, setDevelopers] = useState<DeveloperOption[]>([])
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<10 | 20 | 50>(10)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [agentFilter, setAgentFilter] = useState("all")
  const [developerFilter, setDeveloperFilter] = useState("all")
  const [commissionFilter, setCommissionFilter] = useState<CommissionStatus | "all">("all")
  const [validationFilter, setValidationFilter] = useState<ValidationStatus | "all">("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sortField, setSortField] = useState<SortField>("created_at")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [loading, setLoading] = useState(false)

  // Selected sale type lives in the ?type= query param so it survives a refresh and
  // is deep-linkable. null (missing/invalid param) = the chooser screen (three cards);
  // a type = its report. The per-type summary (deal count / value / pending) powers the
  // card badges and the tiles; all three load together so the cards preview counts.
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const typeParam = searchParams.get("type")
  const activeTab: SaleType | null =
    typeParam === "project" || typeParam === "brokerage" || typeParam === "rental" ? typeParam : null
  const setActiveType = (t: SaleType | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (t) params.set("type", t)
    else params.delete("type")
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
  const [summaries, setSummaries] = useState<Record<SaleType, SaleTypeSummary>>({
    project:   { dealCount: 0, totalValue: 0, pendingCount: 0 },
    brokerage: { dealCount: 0, totalValue: 0, pendingCount: 0 },
    rental:    { dealCount: 0, totalValue: 0, pendingCount: 0 },
  })

  // dialog state
  const [showForm, setShowForm] = useState(false)
  const [viewMode, setViewMode] = useState(false)
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [detailSale, setDetailSale] = useState<SaleRecord | null>(null)
  const [showAttachments, setShowAttachments] = useState(false)
  const [attachmentSale, setAttachmentSale] = useState<SaleRecord | null>(null)
  const [discussionTarget, setDiscussionTarget] = useState<{ sale: SaleRecord; tab: DiscussionTab } | null>(null)

  const [toasts, setToasts] = useState<Array<{ id: number; type: ToastType; text: string }>>([])
  const toastIdRef = useRef(0)

  const isAdminUser = isAdminRole(currentRole)

  const addToast = (type: ToastType, text: string) => {
    const id = ++toastIdRef.current
    setToasts((prev) => [...prev, { id, type, text }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  const loadReferenceData = useCallback(async () => {
    const [devsRes, agentsRes] = await Promise.all([
      fetchDevelopersForSale(),
      fetchAgentsForSale(),
    ])
    if (!devsRes.error) setDevelopers(devsRes.data ?? [])
    if (!agentsRes.error) setAgents(agentsRes.data ?? [])
  }, [])

  const loadSales = useCallback(async () => {
    if (!activeTab) return // chooser screen — nothing to load yet
    setLoading(true)
    try {
      const { data, total: count, error } = await fetchSales({
        page,
        perPage,
        search: search || undefined,
        saleType: activeTab,
        agentId: agentFilter === "all" ? undefined : agentFilter,
        developerId: developerFilter === "all" ? undefined : developerFilter,
        commissionStatus: commissionFilter === "all" ? undefined : commissionFilter,
        validationStatus: validationFilter === "all" ? undefined : validationFilter,
        reservationDateFrom: dateFrom || undefined,
        reservationDateTo: dateTo || undefined,
        sortField,
        sortDir,
        currentRole,
        currentUserId,
      })
      if (error) { addToast("error", error); return }
      setSales(data ?? [])
      setTotal(count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, activeTab, agentFilter, developerFilter, commissionFilter, validationFilter, dateFrom, dateTo, sortField, sortDir, currentRole, currentUserId])

  // Per-type summaries for the tab badges + tiles. Scoped like fetchSales (agents
  // see only their own), and deliberately ignore the in-view filters so the numbers
  // stay a stable overview — only re-fetched when the agent scope changes.
  const loadSummaries = useCallback(async () => {
    const scope = { agentId: agentFilter === "all" ? undefined : agentFilter, currentRole, currentUserId }
    const [proj, brok, rent] = await Promise.all([
      fetchSalesSummary({ saleType: "project", ...scope }),
      fetchSalesSummary({ saleType: "brokerage", ...scope }),
      fetchSalesSummary({ saleType: "rental", ...scope }),
    ])
    const zero: SaleTypeSummary = { dealCount: 0, totalValue: 0, pendingCount: 0 }
    setSummaries({ project: proj.data ?? zero, brokerage: brok.data ?? zero, rental: rent.data ?? zero })
  }, [agentFilter, currentRole, currentUserId])

  useEffect(() => { void loadReferenceData() }, [loadReferenceData])
  useEffect(() => { void loadSales() }, [loadSales])
  useEffect(() => { void loadSummaries() }, [loadSummaries])

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((prev) => prev === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("asc") }
    setPage(1)
  }

  const onTabChange = (t: SaleType) => {
    setActiveType(t)
    setPage(1)
    if (t !== "project") setDeveloperFilter("all") // brokerage/rental have no developer
  }
  const goBack = () => { setActiveType(null); setPage(1) }
  const openEdit = (s: SaleRecord) => {
    if (!canEditSaleForRole(currentRole, s)) {
      addToast("error", "You can only edit sales that are Invalid Sale or Under Review")
      return
    }
    setSelectedSale(s)
    setViewMode(false)
    setShowForm(true)
  }
  const openView = (s: SaleRecord) => { setDetailSale(s); setShowDetails(true) }
  const openAttachments = (s: SaleRecord) => {
    setAttachmentSale(s)
    setShowAttachments(true)
  }

  const openDiscussion = (sale: SaleRecord, tab: DiscussionTab = "discussion") => {
    setDiscussionTarget({ sale, tab })
  }
  const closeDiscussion = () => setDiscussionTarget(null)

  const handleValidationShortcut = async (sale: SaleRecord, nextStatus: ValidationStatus) => {
    if (!isAdminUser) return
    const { data, error } = await updateSaleValidationStatus(sale.id, nextStatus, currentUserId, currentRole)
    if (error) { addToast("error", error); return }
    setSales((prev) => prev.map((item) => (item.id === sale.id ? data! : item)))
    addToast("success", `Validation set to ${STATUS_LABEL[nextStatus]}`)
    void loadSummaries() // pending-validation count changed
  }

  const onSaved = (sale: SaleRecord, isEdit: boolean) => {
    setShowForm(false)
    addToast("success", isEdit ? "Sale updated" : "Sale recorded successfully")
    void loadSales()
    void loadSummaries()
  }

  const handleCountChange = (id: string, count: number) => {
    setSales((prev) => prev.map((s) => s.id === id ? { ...s, attachments_count: count } : s))
    if (attachmentSale?.id === id) {
      setAttachmentSale((prev) => prev ? { ...prev, attachments_count: count } : prev)
    }
  }

  // Columns are tab-aware: Project keeps Developer/Project/Unit; Brokerage & Rental
  // swap those for Property Type/Address. The Agent column shows only for admins
  // (an agent's own rows would all read the same name). Built once per render.
  const columns: Col[] = []
  if (isAdminUser) {
    columns.push({ key: "agent", header: "Agent", tdClassName: "font-semibold text-[#0d1117]", cell: (s) => s.profiles?.fullname ?? "—" })
  }
  if (activeTab === "project") {
    columns.push({ key: "developer", header: "Developer", tdClassName: "text-[#374151]", cell: (s) => s.developers?.name ?? "—" })
    columns.push({ key: "project", header: "Project", tdClassName: "text-[#374151]", cell: (s) => s.projects?.name ?? "—" })
    columns.push({
      key: "unit", header: "Unit", tdClassName: "text-xs text-[#6b7280]",
      cell: (s) => s.unit_number
        ? `${s.project_units?.unit_type ?? ""} · ${s.unit_number}`
        : (s.project_units?.unit_type ?? "—"),
    })
  } else {
    columns.push({ key: "ptype", header: "Property Type", tdClassName: "text-[#374151]", cell: (s) => s.property_type ?? "—" })
    columns.push({ key: "paddr", header: "Property Address", tdClassName: "text-[#374151]", cell: (s) => s.property_address ?? "—" })
  }
  columns.push({ key: "client", header: "Client", tdClassName: "font-semibold text-[#0d1117]", cell: (s) => (s.clients ? `${s.clients.first_name} ${s.clients.last_name}` : "—") })
  columns.push({ key: "price", header: "Contract Price", sortField: "contract_price", tdClassName: "text-right font-mono text-sm font-semibold text-[#0d1117]", cell: (s) => formatCurrency(s.contract_price) })
  columns.push({ key: "resv", header: "Reservation Date", sortField: "reservation_date", tdClassName: "text-[#374151]", cell: (s) => formatDate(s.reservation_date) })
  columns.push({ key: "comm", header: "Commission", cell: (s) => <StatusBadge value={s.commission_status} type="commission" /> })
  columns.push({ key: "valid", header: "Validation", cell: (s) => <StatusBadge value={s.validation_status} type="validation" /> })
  columns.push({ key: "created", header: "Created", sortField: "created_at", tdClassName: "text-[#6b7280]", cell: (s) => formatDate(s.created_at) })
  columns.push({
    key: "files", header: "Files",
    cell: (s) => s.attachments_count > 0 ? (
      <button
        type="button"
        onClick={() => openAttachments(s)}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-600 border border-sky-200 hover:bg-sky-100 transition-colors"
      >
        <Paperclip className="w-3 h-3" />
        {s.attachments_count}
      </button>
    ) : (
      <span className="text-[#9ca3af] text-xs">—</span>
    ),
  })
  columns.push({
    key: "actions", header: "Actions",
    cell: (s) => (
      <div className="flex flex-wrap items-center gap-2">
        {isAdminUser && (
          <>
            <button
              type="button"
              onClick={() => void handleValidationShortcut(s, "validated")}
              disabled={s.validation_status === "validated"}
              className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              Validate Sale
            </button>
            <button
              type="button"
              onClick={() => void handleValidationShortcut(s, "invalid_sale")}
              disabled={s.validation_status === "invalid_sale"}
              className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
            >
              Invalid Sale
            </button>
            <button
              type="button"
              onClick={() => void handleValidationShortcut(s, "under_review")}
              disabled={s.validation_status === "under_review"}
              className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors"
            >
              Under Review
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => openDiscussion(s)}
          title="Open validation discussion"
          className="w-8 h-8 inline-flex items-center justify-center rounded-full border border-[#e5e5e5] bg-white text-[#6b7280] hover:border-[#001f3f]/80 hover:text-[#001f3f] transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
        {isAdminUser && (
          <button
            type="button"
            onClick={() => openDiscussion(s, "activity")}
            title="View activity history"
            className="w-8 h-8 inline-flex items-center justify-center rounded-full border border-[#e5e5e5] bg-white text-[#6b7280] hover:border-[#001f3f]/80 hover:text-[#001f3f] transition-colors"
          >
            <History className="w-4 h-4" />
          </button>
        )}
        <SaleActions
          sale={s}
          currentRole={currentRole}
          onView={() => openView(s)}
          onEdit={() => openEdit(s)}
          onAttachments={() => openAttachments(s)}
        />
      </div>
    ),
  })

  const colCount = columns.length
  const activeMeta = activeTab ? SALE_TYPE_TABS.find((t) => t.type === activeTab) : undefined
  const ActiveIcon = activeMeta?.icon ?? TrendingUp

  return (
    <>
      <div className="space-y-6">

        {activeTab === null ? (
          /* ── Chooser: pick a sale type (mirrors the Encode-a-Sale page) ── */
          <>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#001f3f] to-[#d6b357] flex items-center justify-center shadow-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0d1117]">
                  Sales Reports
                </h1>
                <p className="text-sm text-[#6b7280]">
                  {isSecretaryLikeRole(currentRole)
                    ? "Choose a report to monitor deals, join validation discussion, and attach documents."
                    : "Which report do you want to view? Choose one to start."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {SALE_TYPE_TABS.map((t) => {
                const Icon = t.icon
                return (
                  <button
                    key={t.type}
                    type="button"
                    onClick={() => onTabChange(t.type)}
                    className="group text-left rounded-2xl border border-black/[0.08] bg-white p-6 transition-all hover:border-[#001f3f]/30 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-14 h-14 rounded-full bg-[#f3f4f6] flex items-center justify-center transition-colors group-hover:bg-[#001f3f]/5">
                        <Icon className="w-7 h-7 text-[#9ca3af] transition-colors group-hover:text-[#001f3f]" />
                      </div>
                      <span className="inline-flex items-baseline gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#f3f4f6] text-[#6b7280]">
                        {summaries[t.type].dealCount}
                        <span className="font-medium opacity-80">records</span>
                      </span>
                    </div>
                    <h3 className="mt-5 font-['Outfit'] text-xl font-bold text-[#0d1117]">{t.label}</h3>
                    <p className="mt-1.5 text-sm text-[#6b7280]">{t.desc}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#d6b357] transition-all group-hover:gap-2.5">
                      View report
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          /* ── Report: the table for the chosen sale type ── */
          <>
            <div className="space-y-4">
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6b7280] hover:text-[#001f3f] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to reports
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#001f3f] to-[#d6b357] flex items-center justify-center shadow-lg">
                  <ActiveIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0d1117]">
                    {activeMeta?.label ?? "Sales"} Report
                  </h1>
                  <p className="text-sm text-[#6b7280]">{activeMeta?.desc}</p>
                </div>
              </div>
            </div>

            {/* Summary tiles for the active tab (deal count already shown on the cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SummaryTile label="Total Contract Value" value={formatCurrency(summaries[activeTab].totalValue)} icon={Wallet} />
              <SummaryTile label="Pending Validation" value={String(summaries[activeTab].pendingCount)} icon={Clock} />
            </div>

        {/* Filters bar */}
        <div className="bg-white/60 backdrop-blur-xl rounded-[24px] border border-white/60 shadow-sm shadow-black/5 p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col xl:flex-row gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search client, unit, project, property…"
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 placeholder:text-[#9ca3af]"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-3.5 h-3.5 text-[#9ca3af]" />

                {isAdminUser && (
                  <select
                    value={agentFilter}
                    onChange={(e) => { setAgentFilter(e.target.value); setPage(1) }}
                    className="pl-3 pr-8 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer"
                  >
                    <option value="all">All Agents</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.fullname ?? a.id}</option>
                    ))}
                  </select>
                )}

                {activeTab === "project" && (
                  <select
                    value={developerFilter}
                    onChange={(e) => { setDeveloperFilter(e.target.value); setPage(1) }}
                    className="pl-3 pr-8 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer"
                  >
                    <option value="all">All Developers</option>
                    {developers.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                )}

                <select
                  value={commissionFilter}
                  onChange={(e) => { setCommissionFilter(e.target.value as CommissionStatus | "all"); setPage(1) }}
                  className="pl-3 pr-8 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer"
                >
                  <option value="all">Commission: All</option>
                  {COMMISSION_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s] ?? s.replace(/_/g, " ")}</option>
                  ))}
                </select>

                <select
                  value={validationFilter}
                  onChange={(e) => { setValidationFilter(e.target.value as ValidationStatus | "all"); setPage(1) }}
                  className="pl-3 pr-8 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer"
                >
                  <option value="all">Validation: All</option>
                  {VALIDATION_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s] ?? s.replace(/_/g, " ")}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => void loadSales()}
                  className="p-2.5 rounded-2xl border border-[#e5e5e5] bg-white/80 text-[#6b7280] hover:text-[#001f3f] hover:border-[#001f3f]/20 transition-all"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* Date range */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#9ca3af] font-medium">Reservation date:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                className="px-3 py-2 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer"
              />
              <span className="text-xs text-[#9ca3af]">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                className="px-3 py-2 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer"
              />
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={() => { setDateFrom(""); setDateTo(""); setPage(1) }}
                  className="text-xs text-rose-500 hover:text-rose-700 transition-colors"
                >
                  Clear dates
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white/60 backdrop-blur-xl rounded-[24px] border border-white/60 shadow-sm shadow-black/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f0f2f5] bg-white/40">
                  {columns.map((col) =>
                    col.sortField ? (
                      <SortableHead
                        key={col.key}
                        label={col.header}
                        field={col.sortField}
                        activeField={sortField}
                        dir={sortDir}
                        onToggle={toggleSort}
                      />
                    ) : (
                      <th
                        key={col.key}
                        className="text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3.5 whitespace-nowrap first:pl-6 last:pr-6"
                      >
                        {col.header}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-[#f8f9fa]">
                {loading ? (
                  <SkeletonRows cols={colCount} />
                ) : sales.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className="px-6 py-14 text-center">
                      <div className="flex flex-col items-center gap-2 text-[#9ca3af]">
                        <TrendingUp className="w-9 h-9 opacity-40" />
                        <p className="text-sm font-medium text-[#6b7280]">No sales recorded for this type yet.</p>
                        <p className="text-xs">
                          Use the <span className="font-semibold text-[#001f3f]">Encode Sale</span> button in the sidebar to record one.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-[#fcfdff] transition-colors">
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-4 py-3.5 whitespace-nowrap first:pl-6 last:pr-6 ${col.tdClassName ?? "text-[#374151]"}`}
                        >
                          {col.cell(sale)}
                        </td>
                      ))}
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
          </>
        )}
      </div>

      {/* Dialogs */}
      <SaleFormDialog
        open={showForm}
        viewMode={viewMode}
        editSale={selectedSale}
        currentUserId={currentUserId}
        currentRole={currentRole}
        onClose={() => { setShowForm(false); setViewMode(false); setSelectedSale(null) }}
        onSaved={onSaved}
        onError={(msg: string) => addToast("error", msg)}
      />

      {showDetails && detailSale && (
        <SaleDetails
          sale={detailSale}
          onClose={() => { setShowDetails(false); setDetailSale(null) }}
        />
      )}

      <SaleAttachmentsDialog
        open={showAttachments}
        sale={attachmentSale}
        currentUserId={currentUserId}
        currentRole={currentRole}
        onClose={() => { setShowAttachments(false); setAttachmentSale(null) }}
        onCountChange={handleCountChange}
      />

      {discussionTarget && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center px-4 py-6">
          <div className="absolute inset-0 bg-black/40" onClick={closeDiscussion} />
          <div className="relative z-10 w-full max-w-3xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={closeDiscussion}
                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/80 text-[#374151] shadow-sm hover:bg-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ValidationDiscussion
              saleId={discussionTarget.sale.id}
              currentUserId={currentUserId}
              currentRole={currentRole}
              validationStatus={discussionTarget.sale.validation_status}
              isAdmin={isAdminUser}
              initialTab={discussionTarget.tab}
            />
          </div>
        </div>
      )}

      <ToastStack
        toasts={toasts}
        remove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </>
  )
}
