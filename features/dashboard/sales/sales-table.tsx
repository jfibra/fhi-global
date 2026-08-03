"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowRight,
  ArrowUpDown,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  Filter,
  FileText,
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
  XCircle,
  type LucideIcon,
} from "lucide-react"
import { formatCurrency, formatDate, StatusBadge, toTitleCase } from "./sale-ui"
import { AgentSalesPanel } from "./agent-sales-panel"
import { TopSellerStudio } from "./marketing/top-seller-studio"
import {
  canEditSaleForRole,
  canManageSaleAttachmentsForRole,
  fetchSales,
  fetchSalesForExport,
  fetchSalesSummary,
  fetchSalesSummaryFiltered,
  fetchDevelopersForSale,
  fetchAgentsForSale,
  notifySaleEvent,
  updateSaleValidationStatus,
  deleteSale,
  isAdminRole,
  EXPORT_MAX_ROWS,
  SALE_PROPERTY_TYPES,
  type SaleRecord,
  type SaleType,
  type SaleTypeSummary,
  type CommissionStatus,
  type ValidationStatus,
  type DeveloperOption,
  type AgentOption,
} from "@/lib/sales-service"
import { isSecretaryLikeRole } from "@/lib/app-roles"
import {
  buildCsv,
  buildPrintableHtml,
  downloadCsv,
  exportColumnsFor,
  exportFilename,
  printHtml,
  type ExportPayload,
} from "./sale-export"
import { SaleExportButton, type ExportFormat } from "./sale-export-button"
import { SaleActions } from "./sale-actions"
import { SaleAttachmentsDialog } from "./sale-attachments-dialog"
import { SaleConfirmDialog } from "./sale-confirm-dialog"
import { SaleFormDialog } from "./sale-form-dialog"
import { SaleDetails } from "./sale-details"
import { ValidationDiscussion, type DiscussionTab } from "./[id]/validation-discussion"

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastType = "success" | "error"
type SortField = "reservation_date" | "contract_price" | "created_at"
type SortDir = "asc" | "desc"

const PER_PAGE_OPTIONS = [10, 20, 50] as const

// URL slug per sale type. Each has its own route (see app/(users)/{role}/sales/*),
// so a report is a real page rather than a query param on the chooser.
export const SALE_TYPE_SLUGS: Record<SaleType, string> = {
  project:   "project-sale",
  brokerage: "brokerage-sale",
  rental:    "rental",
}

const TYPE_SLUG_RE = new RegExp(`/(${Object.values(SALE_TYPE_SLUGS).join("|")})$`)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Sale-type selector cards — mirror the "Encode a Sale" 3-card page (icon + title
// + description), reusing the same icons (Building2/Handshake/KeyRound).
const SALE_TYPE_TABS: Array<{ type: SaleType; label: string; desc: string; icon: LucideIcon }> = [
  { type: "project",   label: "Project Sale / Off-Plan", desc: "Units sold within a developer's project.",      icon: Building2 },
  { type: "brokerage", label: "Brokerage / Ready Unit",    desc: "Resale / private-owner deals — no developer.",  icon: Handshake },
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
// formatDate / formatCurrency / StatusBadge live in ./sale-ui so the per-agent
// drill-in renders them identically.

const pad2 = (n: number) => String(n).padStart(2, "0")

// A <select> sizes itself to its widest <option>, so an agent list of full names
// would otherwise stretch one control past 340px and push the rest of the bar
// onto a second line. Cap the width — the closed control only ever has to show
// the short "All …" labels.
const filterSelectCls =
  "shrink-0 w-auto max-w-[190px] pl-3 pr-8 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const

function SummaryTile({ label, value, icon: Icon, hint }: { label: string; value: string; icon: LucideIcon; hint?: string }) {
  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-[20px] border border-white/60 shadow-sm shadow-black/5 p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#001f3f] flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">{label}</p>
        <p className="text-lg font-bold text-[#0d1117] truncate">{value}</p>
        {hint && <p className="text-[11px] text-[#9ca3af] truncate">{hint}</p>}
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
            <td key={j} className="px-4 py-2.5 first:pl-6 last:pr-6">
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
  saleType = null,
}: {
  currentUserId: string
  currentRole: string
  userName: string
  /** From the route. null = the chooser screen. */
  saleType?: SaleType | null
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
  const [propertyTypeFilter, setPropertyTypeFilter] = useState("all")
  const [commissionFilter, setCommissionFilter] = useState<CommissionStatus | "all">("all")
  const [validationFilter, setValidationFilter] = useState<ValidationStatus | "all">("all")
  const [monthFilter, setMonthFilter] = useState("all")
  const [yearFilter, setYearFilter] = useState("all")
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
  // The active type is the route, not a query param: /{role}/sales is the
  // chooser and /{role}/sales/{slug} is that type's report. The base is derived
  // by stripping a type slug off the current path, so this works for every role
  // without knowing the role→path mapping.
  const salesBase = pathname.replace(TYPE_SLUG_RE, "")
  const activeTab: SaleType | null = saleType ?? null
  const setActiveType = (t: SaleType | null) => {
    router.push(t ? `${salesBase}/${SALE_TYPE_SLUGS[t]}` : salesBase, { scroll: false })
  }
  const searchParams = useSearchParams()
  const drillParam = searchParams.get("agent")
  const drillId = drillParam && UUID_RE.test(drillParam) ? drillParam : null
  const [summaries, setSummaries] = useState<Record<SaleType, SaleTypeSummary>>({
    project:   { dealCount: 0, totalValue: 0, pendingCount: 0 },
    brokerage: { dealCount: 0, totalValue: 0, pendingCount: 0 },
    rental:    { dealCount: 0, totalValue: 0, pendingCount: 0 },
  })
  // Totals for the tiles above the table. Separate from `summaries` (which feeds
  // the chooser cards and must stay a whole-type overview) because these follow
  // the filter bar. `data` null = not loaded yet, shown as "—" rather than 0.
  // `filtered` false means the numbers are the unfiltered fallback and the tile
  // has to say so. `key` records WHICH filter set produced them: without it the
  // tiles keep last query's numbers while the hint already claims they match the
  // new filters, and an export taken mid-change would stamp them into the file.
  const [activeSummary, setActiveSummary] = useState<{
    key: string
    data: SaleTypeSummary | null
    filtered: boolean
  }>({ key: "", data: null, filtered: true })

  // dialog state
  const [showForm, setShowForm] = useState(false)
  const [viewMode, setViewMode] = useState(false)
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [detailSale, setDetailSale] = useState<SaleRecord | null>(null)
  const [showAttachments, setShowAttachments] = useState(false)
  const [attachmentSale, setAttachmentSale] = useState<SaleRecord | null>(null)
  const [discussionTarget, setDiscussionTarget] = useState<{ sale: SaleRecord; tab: DiscussionTab } | null>(null)
  // Row click drills into that agent's full sales history (admins only — for
  // an agent every row is their own, so there'd be nothing to drill into).
  // The open drill lives in ?agent= so browser Back returns to the report and
  // the view survives refresh / can be linked; state only caches the clicked
  // row's name so the header isn't blank while the panel fetches the profile.
  const [agentDrill, setAgentDrill] = useState<{ id: string; name: string | null } | null>(null)
  const [showTopSeller, setShowTopSeller] = useState(false)

  // Confirmation flow. Validate is a direct click; Invalid Sale / Under Review
  // ask for a click-confirm; Delete asks for a press-and-hold confirm.
  const [confirm, setConfirm] = useState<
    | { kind: "validation"; sale: SaleRecord; nextStatus: ValidationStatus }
    | { kind: "delete"; sale: SaleRecord }
    | null
  >(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const [toasts, setToasts] = useState<Array<{ id: number; type: ToastType; text: string }>>([])
  const toastIdRef = useRef(0)

  const isAdminUser = isAdminRole(currentRole)

  const addToast = (type: ToastType, text: string) => {
    const id = ++toastIdRef.current
    setToasts((prev) => [...prev, { id, type, text }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  // Current year back to 2020 — the platform has no sales older than that, and a
  // longer list is worse to scan than the exact date inputs beside it.
  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear()
    return Array.from({ length: Math.max(1, now - 2019) }, (_, i) => now - i)
  }, [])

  // Month / year is shorthand for a reservation-date range, so it collapses into
  // the same two bounds the query already takes instead of becoming a second,
  // parallel date filter. A period wins over the manual inputs, and the handlers
  // below clear whichever one the user isn't using — so the bar can never show
  // "March 2026" next to a date range that contradicts it.
  const period = useMemo(() => {
    if (yearFilter === "all") return null
    const y = Number(yearFilter)
    if (monthFilter === "all") return { from: `${y}-01-01`, to: `${y}-12-31` }
    const m = Number(monthFilter)
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate() // day 0 of next month
    return { from: `${y}-${pad2(m)}-01`, to: `${y}-${pad2(m)}-${pad2(lastDay)}` }
  }, [yearFilter, monthFilter])

  const effectiveFrom = period?.from ?? dateFrom
  const effectiveTo = period?.to ?? dateTo

  const pickPeriod = (next: { month?: string; year?: string }) => {
    if (next.month !== undefined) setMonthFilter(next.month)
    if (next.year !== undefined) {
      setYearFilter(next.year)
      if (next.year === "all") setMonthFilter("all") // a month with no year has no range
    }
    setDateFrom("")
    setDateTo("")
    setPage(1)
  }
  const pickDate = (which: "from" | "to", value: string) => {
    if (which === "from") setDateFrom(value)
    else setDateTo(value)
    setMonthFilter("all")
    setYearFilter("all")
    setPage(1)
  }
  const clearPeriod = () => {
    setMonthFilter("all")
    setYearFilter("all")
    setDateFrom("")
    setDateTo("")
    setPage(1)
  }

  // agentFilter counts: it narrows the rows and the totals like any other, and
  // leaving it out made "Reset all filters" quietly skip it.
  const filtersActive =
    propertyTypeFilter !== "all" ||
    developerFilter !== "all" ||
    commissionFilter !== "all" ||
    validationFilter !== "all" ||
    agentFilter !== "all" ||
    Boolean(effectiveFrom || effectiveTo) ||
    Boolean(search)

  const resetFilters = () => {
    setPropertyTypeFilter("all")
    setDeveloperFilter("all")
    setCommissionFilter("all")
    setValidationFilter("all")
    setAgentFilter("all")
    setSearchInput("")
    clearPeriod()
  }

  // Identifies the filter set a totals response belongs to. activeTab is part of
  // it so switching report type can't briefly show the previous type's totals.
  const summaryKey = [
    activeTab, agentFilter, propertyTypeFilter, developerFilter,
    commissionFilter, validationFilter, effectiveFrom, effectiveTo, search,
  ].join("|")

  const loadReferenceData = useCallback(async () => {
    const [devsRes, agentsRes] = await Promise.all([
      fetchDevelopersForSale(),
      fetchAgentsForSale(),
    ])
    if (!devsRes.error) setDevelopers(devsRes.data ?? [])
    if (!agentsRes.error) setAgents(agentsRes.data ?? [])
  }, [])

  // Sequenced like the summary: filters can fire several of these in a row, and
  // whichever resolves last would otherwise win — leaving the table showing a
  // superseded filter's rows.
  const salesSeqRef = useRef(0)
  const loadSales = useCallback(async () => {
    if (!activeTab) return // chooser screen — nothing to load yet
    const seq = ++salesSeqRef.current
    setLoading(true)
    try {
      const { data, total: count, error } = await fetchSales({
        page,
        perPage,
        search: search || undefined,
        saleType: activeTab,
        agentId: agentFilter === "all" ? undefined : agentFilter,
        developerId: developerFilter === "all" ? undefined : developerFilter,
        propertyType: propertyTypeFilter === "all" ? undefined : propertyTypeFilter,
        commissionStatus: commissionFilter === "all" ? undefined : commissionFilter,
        validationStatus: validationFilter === "all" ? undefined : validationFilter,
        reservationDateFrom: effectiveFrom || undefined,
        reservationDateTo: effectiveTo || undefined,
        sortField,
        sortDir,
        currentRole,
        currentUserId,
      })
      if (seq !== salesSeqRef.current) return // superseded by a newer filter set
      if (error) {
        // Clear rather than leave the previous filter's rows under the new
        // filter bar — a stale table reads as a real (wrong) result.
        addToast("error", error)
        setSales([])
        setTotal(0)
        return
      }
      setSales(data ?? [])
      setTotal(count ?? 0)
    } finally {
      if (seq === salesSeqRef.current) setLoading(false)
    }
  }, [page, perPage, search, activeTab, agentFilter, developerFilter, propertyTypeFilter, commissionFilter, validationFilter, effectiveFrom, effectiveTo, sortField, sortDir, currentRole, currentUserId])

  // Per-type summaries for the chooser cards' record counts. Scoped like
  // fetchSales (agents see only their own) but deliberately unfiltered — the
  // cards preview each type as a whole, before any filter exists. The tiles on
  // the report use loadActiveSummary below instead.
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

  // Totals for the active report's tiles, narrowed by the same filters as the
  // rows. Sequenced because the filter bar can fire several of these in quick
  // succession and an older response landing last would show a total that
  // doesn't match the table. Nothing is set before the await — the tiles ride
  // the table's own `loading` flag instead, which avoids a cascading render on
  // every keystroke in the search box.
  const summarySeqRef = useRef(0)
  const loadActiveSummary = useCallback(async () => {
    if (!activeTab) return
    const seq = ++summarySeqRef.current
    const key = summaryKey
    const res = await fetchSalesSummaryFiltered({
      saleType: activeTab,
      agentId: agentFilter === "all" ? undefined : agentFilter,
      currentRole,
      currentUserId,
      filters: {
        propertyType: propertyTypeFilter === "all" ? undefined : propertyTypeFilter,
        developerId: developerFilter === "all" ? undefined : developerFilter,
        commissionStatus: commissionFilter === "all" ? undefined : commissionFilter,
        validationStatus: validationFilter === "all" ? undefined : validationFilter,
        reservationDateFrom: effectiveFrom || undefined,
        reservationDateTo: effectiveTo || undefined,
        search: search || undefined,
      },
    })
    if (seq !== summarySeqRef.current) return // superseded
    setActiveSummary({ key, data: res.data, filtered: res.filtered })
  }, [summaryKey, activeTab, agentFilter, propertyTypeFilter, developerFilter, commissionFilter, validationFilter, effectiveFrom, effectiveTo, search, currentRole, currentUserId])

  useEffect(() => { void loadReferenceData() }, [loadReferenceData])
  useEffect(() => { void loadSales() }, [loadSales])
  useEffect(() => { void loadSummaries() }, [loadSummaries])
  useEffect(() => { void loadActiveSummary() }, [loadActiveSummary])

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
    // Each type owns a different set of columns, so drop the filters that don't
    // exist on the one being opened rather than silently narrowing it.
    if (t !== "project") setDeveloperFilter("all") // brokerage/rental have no developer
    else setPropertyTypeFilter("all")              // project sales carry a unit, not a property type
  }
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

  // In-flight guard: rows keep their stale status until setSales lands, so a
  // rapid double-click would otherwise fire the update (and its email) twice.
  const validationBusyRef = useRef<Set<string>>(new Set())
  const handleValidationShortcut = async (sale: SaleRecord, nextStatus: ValidationStatus) => {
    if (!isAdminUser || validationBusyRef.current.has(sale.id)) return
    validationBusyRef.current.add(sale.id)
    try {
      const { data, error, previousStatus } = await updateSaleValidationStatus(sale.id, nextStatus, currentUserId, currentRole)
      if (error) { addToast("error", error); return }
      // Gate on the authoritative pre-update status, not the possibly-stale row.
      if (previousStatus !== nextStatus) notifySaleEvent(sale.id, "validation")
      setSales((prev) => prev.map((item) => (item.id === sale.id ? data! : item)))
      addToast("success", `Validation set to ${STATUS_LABEL[nextStatus]}`)
      // pending-validation count changed
      void loadSummaries()
      void loadActiveSummary()
    } finally {
      validationBusyRef.current.delete(sale.id)
    }
  }

  // Runs the pending confirmation (Invalid Sale / Under Review, or Delete).
  // Always closes the dialog afterwards — success or failure is surfaced via a
  // toast, and reopening gives a fresh (re-armed) hold-to-confirm button.
  const runConfirm = async () => {
    if (!confirm || confirmBusy) return
    setConfirmBusy(true)
    try {
      if (confirm.kind === "delete") {
        const { error } = await deleteSale(confirm.sale.id)
        if (error) {
          addToast("error", error)
        } else {
          addToast("success", "Sale deleted")
          void loadSales()
          void loadSummaries()
          void loadActiveSummary()
        }
      } else {
        await handleValidationShortcut(confirm.sale, confirm.nextStatus)
      }
    } finally {
      setConfirm(null)
      setConfirmBusy(false)
    }
  }

  const onSaved = (sale: SaleRecord, isEdit: boolean) => {
    setShowForm(false)
    addToast("success", isEdit ? "Sale updated" : "Sale recorded successfully")
    void loadSales()
    void loadSummaries()
    void loadActiveSummary()
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
    columns.push({ key: "agent", header: "Agent", tdClassName: "font-semibold text-[#0d1117]", cell: (s) => toTitleCase(s.profiles?.fullname) || "—" })
  }
  if (activeTab === "project") {
    columns.push({ key: "developer", header: "Developer", tdClassName: "text-[#374151]", cell: (s) => toTitleCase(s.developers?.name) || "—" })
    columns.push({ key: "project", header: "Project", tdClassName: "text-[#374151]", cell: (s) => toTitleCase(s.projects?.name) || "—" })
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
  columns.push({ key: "client", header: "Client", tdClassName: "font-semibold text-[#0d1117]", cell: (s) => (s.clients ? toTitleCase(`${s.clients.first_name} ${s.clients.last_name}`) : "—") })
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
    // One line, never wrapping: with flex-wrap these six controls stacked into
    // five rows once the column narrowed, stretching every row to ~200px tall.
    // The three validation shortcuts are icon buttons (labelled via title +
    // aria-label) so the column stays narrow too.
    cell: (s) => (
      <div className="flex items-center gap-1.5 flex-nowrap">
        {isAdminUser && (
          <>
            {([
              { status: "validated" as const, label: "Validate sale", Icon: CheckCircle2, needsConfirm: true, cls: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
              { status: "invalid_sale" as const, label: "Mark invalid sale", Icon: XCircle, needsConfirm: true, cls: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" },
              { status: "under_review" as const, label: "Mark under review", Icon: Clock, needsConfirm: true, cls: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100" },
            ]).map(({ status, label, Icon, needsConfirm, cls }) => (
              <button
                key={status}
                type="button"
                onClick={() =>
                  needsConfirm
                    ? setConfirm({ kind: "validation", sale: s, nextStatus: status })
                    : void handleValidationShortcut(s, status)
                }
                disabled={s.validation_status === status}
                title={label}
                aria-label={label}
                className={`w-8 h-8 inline-flex items-center justify-center rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${cls}`}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
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
          onDelete={() => setConfirm({ kind: "delete", sale: s })}
        />
      </div>
    ),
  })

  const colCount = columns.length
  const activeMeta = activeTab ? SALE_TYPE_TABS.find((t) => t.type === activeTab) : undefined
  const ActiveIcon = activeMeta?.icon ?? TrendingUp

  // Tile numbers, but only if they were computed for the filters currently on
  // screen. Null otherwise — shown as "—", never as 0 and never as a stale
  // number the hint would then mislabel as "matching your filters".
  const tileSummary = activeSummary.key === summaryKey ? activeSummary.data : null
  const tileHint = !tileSummary
    ? undefined
    : !activeSummary.filtered
      ? "all records — filtered totals unavailable"
      : filtersActive
        ? "matching your filters"
        : undefined

  // Plain-language description of what's in effect, stamped onto the export so
  // a downloaded file can't be mistaken for the full report.
  const filterLines = () => {
    const out: string[] = []
    if (activeMeta) out.push(`Sale type: ${activeMeta.label}`)
    if (search) out.push(`Search: "${search}"`)
    if (isAdminUser && agentFilter !== "all") {
      out.push(`Agent: ${agents.find((a) => a.id === agentFilter)?.fullname ?? agentFilter}`)
    }
    if (developerFilter !== "all") {
      out.push(`Developer: ${developers.find((d) => d.id === developerFilter)?.name ?? developerFilter}`)
    }
    if (propertyTypeFilter !== "all") out.push(`Property type: ${propertyTypeFilter}`)
    if (commissionFilter !== "all") out.push(`Commission: ${STATUS_LABEL[commissionFilter] ?? commissionFilter}`)
    if (validationFilter !== "all") out.push(`Validation: ${STATUS_LABEL[validationFilter] ?? validationFilter}`)
    if (yearFilter !== "all") {
      out.push(`Period: ${monthFilter === "all" ? yearFilter : `${MONTHS[Number(monthFilter) - 1]} ${yearFilter}`}`)
    } else if (dateFrom || dateTo) {
      out.push(`Reservation date: ${dateFrom || "any"} to ${dateTo || "any"}`)
    }
    return out
  }

  // Pulls every matching row (not just the page) with the filters currently in
  // effect, then hands it to the CSV writer or the print document.
  const handleExport = async (format: ExportFormat) => {
    if (!activeTab) return
    const { data, truncated, error } = await fetchSalesForExport({
      search: search || undefined,
      saleType: activeTab,
      agentId: agentFilter === "all" ? undefined : agentFilter,
      developerId: developerFilter === "all" ? undefined : developerFilter,
      propertyType: propertyTypeFilter === "all" ? undefined : propertyTypeFilter,
      commissionStatus: commissionFilter === "all" ? undefined : commissionFilter,
      validationStatus: validationFilter === "all" ? undefined : validationFilter,
      reservationDateFrom: effectiveFrom || undefined,
      reservationDateTo: effectiveTo || undefined,
      sortField,
      sortDir,
      currentRole,
      currentUserId,
    })
    if (error) { addToast("error", `Export failed: ${error}`); return }
    if (!data.length) { addToast("error", "Nothing to export — no sales match these filters."); return }

    const title = `${activeMeta?.label ?? "Sales"} Report`
    const payload: ExportPayload = {
      title,
      subtitle: activeMeta?.desc,
      filterLines: filterLines(),
      columns: exportColumnsFor(activeTab),
      rows: data,
      totals: tileSummary
        ? { ...tileSummary, filtered: activeSummary.filtered }
        : null,
      truncated,
      generatedBy: userName ?? null,
    }

    if (format === "csv") {
      downloadCsv(exportFilename(title, "csv"), buildCsv(payload))
      addToast("success", `Exported ${data.length} sale${data.length === 1 ? "" : "s"} to Excel`)
    } else {
      printHtml(buildPrintableHtml(payload))
    }
    if (truncated) {
      addToast("error", `Export capped at ${EXPORT_MAX_ROWS} rows — narrow the filters for the complete set.`)
    }
  }

  return (
    <>
      <div className="space-y-6">

        {/* Drill-in is checked before the chooser so ?agent= works from the
            sales root too — the Top Sales board on the Overview links straight
            here, without having to pick a sale type first. */}
        {isAdminUser && drillId ? (
          /* ── Drill-in: one agent's full sales history ── */
          <AgentSalesPanel
            // Remount per agent so no filter or row state leaks between them.
            key={drillId}
            agentId={drillId}
            agentName={agentDrill?.id === drillId ? agentDrill.name : null}
            currentRole={currentRole}
            currentUserId={currentUserId}
            developers={developers}
            backLabel={`Back to ${activeMeta?.label ?? "Sales"}`}
            onBack={() => router.push(pathname, { scroll: false })}
            onViewSale={(s) => openView(s)}
          />
        ) : activeTab === null ? (
          /* ── Chooser: pick a sale type (mirrors the Encode-a-Sale page) ── */
          <>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] flex items-center justify-center shadow-lg">
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
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#001f3f] flex items-center justify-center shadow-lg">
                  <ActiveIcon className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0d1117]">
                    {activeMeta?.label ?? "Sales"} Report
                  </h1>
                  <p className="text-sm text-[#6b7280]">{activeMeta?.desc}</p>
                </div>
                <div className="ml-auto flex items-center gap-2 shrink-0">
                  {/* Exports every row matching the current filters, not the
                      page on screen — available to every role, each scoped to
                      the sales they can already see. */}
                  <SaleExportButton onExport={handleExport} />
                  {isAdminUser && (
                    <button
                      type="button"
                      onClick={() => setShowTopSeller(true)}
                      className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#d6b357] text-[#001f3f] text-sm font-bold hover:bg-[#c8a544] transition-colors"
                    >
                      <Crown className="w-4 h-4" />
                      Top Seller Poster
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Summary tiles for the active tab — these follow the filter bar, so
                they always describe the same set of sales as the rows below.
                Falls back to the unfiltered type summary if the filtered totals
                aren't available, and says so rather than showing a wrong number. */}
            <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 transition-opacity ${loading ? "opacity-60" : ""}`}>
              <SummaryTile
                label="Deals"
                value={tileSummary ? String(tileSummary.dealCount) : "—"}
                icon={FileText}
                hint={tileHint}
              />
              <SummaryTile
                label="Total Contract Value"
                value={tileSummary ? formatCurrency(tileSummary.totalValue) : "—"}
                icon={Wallet}
                hint={tileHint}
              />
              <SummaryTile
                label="Pending Validation"
                value={tileSummary ? String(tileSummary.pendingCount) : "—"}
                icon={Clock}
                hint={tileHint}
              />
            </div>

        {/* Filters bar */}
        <div className="bg-white/60 backdrop-blur-xl rounded-[24px] border border-white/60 shadow-sm shadow-black/5 p-4">
          <div className="flex flex-col gap-3">
            {/* One flat wrapping row with items-center. It must not be a
                stretch row: when the controls wrap, a stretched search wrapper
                grows to the full two-line height and its absolutely-centered
                magnifier drifts below the input. */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search client, unit, project, property…"
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 placeholder:text-[#9ca3af]"
                />
              </div>

              <Filter className="w-3.5 h-3.5 text-[#9ca3af] shrink-0" />

              {isAdminUser && (
                <select
                  value={agentFilter}
                  onChange={(e) => { setAgentFilter(e.target.value); setPage(1) }}
                  className={filterSelectCls}
                  aria-label="Agent"
                >
                  <option value="all">All Agents</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.fullname ?? a.id}</option>
                  ))}
                </select>
              )}

              {activeTab === "project" ? (
                <select
                  value={developerFilter}
                  onChange={(e) => { setDeveloperFilter(e.target.value); setPage(1) }}
                  className={filterSelectCls}
                  aria-label="Developer"
                >
                  <option value="all">All Developers</option>
                  {developers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              ) : (
                // Brokerage and rental sales record a free property type instead
                // of a developer/project, so that's what they filter on.
                <select
                  value={propertyTypeFilter}
                  onChange={(e) => { setPropertyTypeFilter(e.target.value); setPage(1) }}
                  className={filterSelectCls}
                  aria-label="Property type"
                >
                  <option value="all">All Property Types</option>
                  {SALE_PROPERTY_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}

              <select
                value={commissionFilter}
                onChange={(e) => { setCommissionFilter(e.target.value as CommissionStatus | "all"); setPage(1) }}
                className={filterSelectCls}
                aria-label="Commission status"
              >
                <option value="all">Commission: All</option>
                {COMMISSION_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s] ?? s.replace(/_/g, " ")}</option>
                ))}
              </select>

              <select
                value={validationFilter}
                onChange={(e) => { setValidationFilter(e.target.value as ValidationStatus | "all"); setPage(1) }}
                className={filterSelectCls}
                aria-label="Validation status"
              >
                <option value="all">Validation: All</option>
                {VALIDATION_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s] ?? s.replace(/_/g, " ")}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => void loadSales()}
                className="shrink-0 p-2.5 rounded-2xl border border-[#e5e5e5] bg-white/80 text-[#6b7280] hover:text-[#001f3f] hover:border-[#001f3f]/20 transition-all"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Period — a month/year shortcut and an exact range, both writing the
                same reservation-date bounds. Picking one clears the other. */}
            <div className="flex flex-wrap items-center gap-2 border-t border-[#f0f0f0] pt-3">
              <span className="text-xs text-[#9ca3af] font-medium">Period:</span>

              <select
                value={yearFilter}
                onChange={(e) => pickPeriod({ year: e.target.value })}
                aria-label="Year"
                className="pl-3 pr-8 py-2 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer"
              >
                <option value="all">All Years</option>
                {yearOptions.map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>

              <select
                value={monthFilter}
                onChange={(e) => pickPeriod({ month: e.target.value })}
                disabled={yearFilter === "all"}
                aria-label={yearFilter === "all" ? "Month — pick a year first" : "Month"}
                title={yearFilter === "all" ? "Pick a year first" : undefined}
                className="pl-3 pr-8 py-2 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="all">All Months</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1)}>{m}</option>
                ))}
              </select>

              <span className="hidden sm:inline text-xs text-[#d1d5db]">|</span>
              <span className="text-xs text-[#9ca3af] font-medium">Reservation date:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => pickDate("from", e.target.value)}
                aria-label="Reservation date from"
                className="px-3 py-2 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer"
              />
              <span className="text-xs text-[#9ca3af]">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => pickDate("to", e.target.value)}
                aria-label="Reservation date to"
                className="px-3 py-2 rounded-2xl border border-[#e5e5e5] text-sm bg-white/80 focus:outline-none focus:border-[#001f3f] cursor-pointer"
              />
              {(effectiveFrom || effectiveTo) && (
                <button
                  type="button"
                  onClick={clearPeriod}
                  className="text-xs text-rose-500 hover:text-rose-700 transition-colors"
                >
                  Clear period
                </button>
              )}

              {filtersActive && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#e5e5e5] bg-white/80 text-xs font-semibold text-[#6b7280] hover:text-[#001f3f] hover:border-[#001f3f]/20 transition-all"
                >
                  <X className="w-3 h-3" />
                  Reset all filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action legend — explains the validation shortcut icons (admins only) */}
        {isAdminUser && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs text-[#6b7280]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af]">Action icons</span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Validate sale
            </span>
            <span className="inline-flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-rose-600" /> Invalid sale
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-sky-600" /> Under review
            </span>
          </div>
        )}

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
                  sales.map((sale) => {
                    const drillable = isAdminUser && Boolean(sale.agent_id)
                    const openDrill = () => {
                      setAgentDrill({ id: sale.agent_id, name: sale.profiles?.fullname ?? null })
                      router.push(`${pathname}?agent=${sale.agent_id}`, { scroll: false })
                    }
                    return (
                      <tr
                        key={sale.id}
                        onClick={drillable ? openDrill : undefined}
                        onKeyDown={drillable ? (e) => {
                          if (e.target !== e.currentTarget) return
                          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDrill() }
                        } : undefined}
                        tabIndex={drillable ? 0 : undefined}
                        title={drillable ? `View all sales by ${sale.profiles?.fullname ?? "this agent"}` : undefined}
                        className={`hover:bg-[#fcfdff] focus:outline-none focus-visible:bg-[#f3f4f6] transition-colors ${drillable ? "cursor-pointer" : ""}`}
                      >
                        {columns.map((col) => (
                          <td
                            key={col.key}
                            // The Actions cell holds its own buttons — a click
                            // there must not also drill into the agent.
                            onClick={col.key === "actions" || col.key === "files" ? (e) => e.stopPropagation() : undefined}
                            className={`px-4 py-2.5 whitespace-nowrap align-middle first:pl-6 last:pr-6 ${col.tdClassName ?? "text-[#374151]"}`}
                          >
                            {col.cell(sale)}
                          </td>
                        ))}
                      </tr>
                    )
                  })
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

      {/* Delete — press-and-hold to confirm (irreversible) */}
      {confirm?.kind === "delete" && (
        <SaleConfirmDialog
          title="Delete this sale?"
          message={`This permanently deletes ${
            (confirm.sale.clients
              ? `${confirm.sale.clients.first_name} ${confirm.sale.clients.last_name}`.trim()
              : "") || "this sale"
          }'s record — including its attachments, activity log and discussion. This can't be undone.`}
          confirmLabel="Hold to delete"
          tone="danger"
          hold
          busy={confirmBusy}
          onConfirm={() => void runConfirm()}
          onCancel={() => { if (!confirmBusy) setConfirm(null) }}
        />
      )}

      {/* Invalid Sale / Under Review — click to confirm (Validate stays direct) */}
      {confirm?.kind === "validation" && (
        <SaleConfirmDialog
          title={
            confirm.nextStatus === "validated"
              ? "Validate this sale?"
              : confirm.nextStatus === "invalid_sale"
                ? "Mark as Invalid Sale?"
                : "Move to Under Review?"
          }
          message={`This sets the validation status to ${STATUS_LABEL[confirm.nextStatus]}. You can change it again later.`}
          confirmLabel={
            confirm.nextStatus === "validated"
              ? "Validate Sale"
              : confirm.nextStatus === "invalid_sale"
                ? "Mark Invalid Sale"
                : "Move to Under Review"
          }
          tone="primary"
          busy={confirmBusy}
          onConfirm={() => void runConfirm()}
          onCancel={() => { if (!confirmBusy) setConfirm(null) }}
        />
      )}

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

      {showTopSeller && <TopSellerStudio onClose={() => setShowTopSeller(false)} />}

      <ToastStack
        toasts={toasts}
        remove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </>
  )
}
