"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowRight,
  ArrowUpDown,
  BadgeCheck,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  Filter,
  FileText,
  Handshake,
  History,
  Hourglass,
  KeyRound,
  MessageSquare,
  Paperclip,
  Pencil,
  RefreshCw,
  Search,
  TrendingUp,
  User,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react"
import { formatCurrency, formatDate, partnerLine, StatusBadge, toTitleCase } from "./sale-ui"
import { AgentSalesPanel } from "./agent-sales-panel"
import { TopSellerStudio } from "./marketing/top-seller-studio"
import { TopDeveloperStudio } from "./marketing/top-developer-studio"
import {
  canEditSaleForRole,
  canManageSaleAttachmentsForRole,
  fetchSales,
  fetchSalesForExport,
  fetchSalesSummary,
  fetchSalesSummaryFiltered,
  fetchDevelopersForSale,
  fetchAgentsForSale,
  fetchLeaderReview,
  fetchTeamSalesAccess,
  notifySaleEvent,
  setLeaderConfirmation,
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
  type TeamSalesAccess,
} from "@/lib/sales-service"
import { isSalesPipelineRole, isSecretaryLikeRole } from "@/lib/app-roles"
import { FilterSelect, type FilterSelectOption } from "@/components/ui/filter-select"
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
import { ReviewMenu } from "./review-menu"
import { SaleAttachmentsDialog } from "./sale-attachments-dialog"
import { SaleConfirmDialog } from "./sale-confirm-dialog"
import { SaleFormDialog } from "./sale-form-dialog"
import { SaleDetails } from "./sale-details"
import { SaleSplitBreakdown } from "./sale-split-breakdown"
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

// Sale-type selector cards — mirror the "Record Your Sale" 3-card page (icon + title
// + description), reusing the same icons (Building2/Handshake/KeyRound).
const SALE_TYPE_TABS: Array<{ type: SaleType; label: string; desc: string; icon: LucideIcon }> = [
  { type: "project",   label: "Project Sale / Off-Plan", desc: "Units sold within a developer's project.",      icon: Building2 },
  { type: "brokerage", label: "Brokerage / Ready Unit",    desc: "Resale / private-owner sales — no developer.",  icon: Handshake },
  { type: "rental",    label: "Rental",       desc: "Rental transactions and lease contracts.",       icon: KeyRound },
]

// One table column. `sortField` turns the header into a sort toggle; `cell` renders
// the value for a row. Columns are built per active tab so brokerage/rental drop the
// project-only Developer/Project/Unit columns and show Property Type/Address instead.
type Col = {
  key: string
  header: ReactNode
  sortField?: SortField
  thClassName?: string
  tdClassName?: string
  cell: (s: SaleRecord) => ReactNode
}

/** Statuses a team leader can still confirm a sale in — before the admin decides. */
const LEADER_CONFIRMABLE: ValidationStatus[] = ["pending", "under_review"]

/** "Mar 4" for this year's dates, "Mar 4, 2025" otherwise — the Dates column's short form. */
function shortDate(value: string | null) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) })
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

/** "Belyne Prades · Damac Riverside · DRVVM2A/5/505" — which sale a panel is about. */
function saleTitle(s: SaleRecord) {
  const client = s.clients ? toTitleCase(`${s.clients.first_name} ${s.clients.last_name}`) : ""
  const place = s.sale_type === "project" ? toTitleCase(s.projects?.name) : s.property_type ?? ""
  return [client, place, s.unit_number].filter(Boolean).join(" · ") || "Sale"
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const

// Fixed option lists — built once at module scope rather than per render.
const PROPERTY_TYPE_OPTIONS: FilterSelectOption[] = [
  { label: "All Property Types", value: "all" },
  ...SALE_PROPERTY_TYPES.map((t) => ({ label: t, value: t })),
]
const COMMISSION_OPTIONS: FilterSelectOption[] = [
  { label: "Commission: All", value: "all" },
  ...COMMISSION_STATUSES.map((s) => ({ label: STATUS_LABEL[s] ?? s.replace(/_/g, " "), value: s })),
]
const VALIDATION_OPTIONS: FilterSelectOption[] = [
  { label: "Validation: All", value: "all" },
  ...VALIDATION_STATUSES.map((s) => ({ label: STATUS_LABEL[s] ?? s.replace(/_/g, " "), value: s })),
]
const MONTH_OPTIONS: FilterSelectOption[] = [
  { label: "All Months", value: "all" },
  ...MONTHS.map((m, i) => ({ label: m, value: String(i + 1) })),
]
const PER_PAGE_SELECT_OPTIONS: FilterSelectOption[] = PER_PAGE_OPTIONS.map((n) => ({
  label: `${n} / page`,
  value: String(n),
}))

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
  label: ReactNode
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
  // The agent picked in the filter. The filter's value (agentFilter, below)
  // falls back to ?member= — the Team Sales "See sales" link — until a pick.
  const [agentPick, setAgentPick] = useState("all")
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
  const searchParams = useSearchParams()
  // The active type is the route, not a query param: /{role}/sales is the
  // chooser and /{role}/sales/{slug} is that type's report. The base is derived
  // by stripping a type slug off the current path, so this works for every role
  // without knowing the role→path mapping.
  const salesBase = pathname.replace(TYPE_SLUG_RE, "")
  const activeTab: SaleType | null = saleType ?? null
  const setActiveType = (t: SaleType | null) => {
    // A team leader's "My own sales" choice follows them between report types.
    const keep = searchParams.get("scope") === "own" ? "?scope=own" : ""
    router.push(`${t ? `${salesBase}/${SALE_TYPE_SLUGS[t]}` : salesBase}${keep}`, { scroll: false })
  }
  const drillParam = searchParams.get("agent")
  const drillId = drillParam && UUID_RE.test(drillParam) ? drillParam : null

  // A team leader always has a "My team" view of the sales their team
  // recorded (migration 084) — RLS lets them read those; the team's switches
  // add Edit / Confirm per member. `teamAccess` stays null until it loads, and
  // for a team leader nothing is fetched before it does, so the report doesn't
  // flash her own sales and then swap to the team's.
  const isTeamLeaderRole = currentRole === "team_leader"
  const [teamAccess, setTeamAccess] = useState<TeamSalesAccess | null>(null)
  const accessReady = !isTeamLeaderRole || teamAccess !== null
  const leadsTeam = Boolean(teamAccess?.leads)
  const scope: "own" | "team" = leadsTeam && searchParams.get("scope") !== "own" ? "team" : "own"
  const memberParam = searchParams.get("member")
  const memberPreset = scope === "team" && memberParam && UUID_RE.test(memberParam) ? memberParam : null
  const agentFilter = agentPick !== "all" ? agentPick : (memberPreset ?? "all")
  const setAgentFilter = (value: string) => {
    setAgentPick(value)
    if (memberParam) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete("member")
      router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false })
    }
  }
  const setScope = (next: "own" | "team") => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("scope", next)
    params.delete("member")
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    setAgentPick("all")
    setPage(1)
  }
  const memberFlags = useMemo(
    () => new Map((teamAccess?.members ?? []).map((m) => [m.id, m])),
    [teamAccess],
  )
  // agent id → the team leader(s) who confirm that agent's sales first.
  const [leaderReview, setLeaderReview] = useState<Record<string, string>>({})
  const [summaries, setSummaries] = useState<Record<SaleType, SaleTypeSummary>>({
    project:   { dealCount: 0, totalValue: 0, pendingCount: 0 },
    brokerage: { dealCount: 0, totalValue: 0, pendingCount: 0 },
    rental:    { dealCount: 0, totalValue: 0, pendingCount: 0 },
  })
  // Deal counts per scope for the leader's switch ("My team (35) · My own sales (15)").
  const [scopeCounts, setScopeCounts] = useState<Record<"own" | "team", Record<SaleType, number>> | null>(null)
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
  // A shared sale whose partnership split is opened under its row.
  const [openSplitId, setOpenSplitId] = useState<string | null>(null)
  // Row click drills into that agent's full sales history (admins only — for
  // an agent every row is their own, so there'd be nothing to drill into).
  // The open drill lives in ?agent= so browser Back returns to the report and
  // the view survives refresh / can be linked; state only caches the clicked
  // row's name so the header isn't blank while the panel fetches the profile.
  const [agentDrill, setAgentDrill] = useState<{ id: string; name: string | null } | null>(null)
  const [showTopSeller, setShowTopSeller] = useState(false)
  const [showTopDeveloper, setShowTopDeveloper] = useState(false)

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

  const yearSelectOptions = useMemo<FilterSelectOption[]>(
    () => [{ label: "All Years", value: "all" }, ...yearOptions.map((y) => ({ label: String(y), value: String(y) }))],
    [yearOptions],
  )

  // Names are title-cased here for the same reason the table title-cases them:
  // the source data mixes "AGNES WHITE" with "Abe Juego", and a filter list
  // shouldn't disagree with the rows it filters. Sorted so the list is
  // scannable even before anyone types in the search box.
  //
  // Two agents have no name at all; falling back to their uuid would put a
  // wall of hex in the list, so they read as "Unnamed account" instead.
  // Whitespace is collapsed because at least one name is stored with a double
  // space ("Lito  Bibon").
  const optionLabel = (raw: string | null, fallback: string) =>
    toTitleCase(raw).replace(/\s+/g, " ").trim() || fallback

  const agentOptions = useMemo<FilterSelectOption[]>(() => {
    if (!isAdminUser && scope === "team") {
      return [
        { label: "All team members", value: "all" },
        ...(teamAccess?.members ?? []).map((m) => ({ label: optionLabel(m.name, "Unnamed account"), value: m.id })),
      ]
    }
    return [
      { label: "All Agents", value: "all" },
      ...agents
        .map((a) => ({ label: optionLabel(a.fullname, "Unnamed account"), value: a.id }))
        .sort((x, y) => x.label.localeCompare(y.label)),
    ]
  }, [agents, isAdminUser, scope, teamAccess])
  const showAgentFilter = isAdminUser || scope === "team"

  const developerOptions = useMemo<FilterSelectOption[]>(() => [
    { label: "All Developers", value: "all" },
    ...developers
      .map((d) => ({ label: optionLabel(d.name, "Unnamed developer"), value: d.id }))
      .sort((x, y) => x.label.localeCompare(y.label)),
  ], [developers])

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
    activeTab, scope, agentFilter, propertyTypeFilter, developerFilter,
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

  const loadTeamAccess = useCallback(async () => {
    if (!isTeamLeaderRole) return
    setTeamAccess(await fetchTeamSalesAccess())
  }, [isTeamLeaderRole])

  // Sequenced like the summary: filters can fire several of these in a row, and
  // whichever resolves last would otherwise win — leaving the table showing a
  // superseded filter's rows.
  const salesSeqRef = useRef(0)
  const loadSales = useCallback(async () => {
    if (!activeTab || !accessReady) return // chooser screen, or the leader's access is still loading
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
        scope,
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
  }, [page, perPage, search, activeTab, accessReady, scope, agentFilter, developerFilter, propertyTypeFilter, commissionFilter, validationFilter, effectiveFrom, effectiveTo, sortField, sortDir, currentRole, currentUserId])

  // Per-type summaries for the chooser cards' record counts. Scoped like
  // fetchSales (agents see only their own) but deliberately unfiltered — the
  // cards preview each type as a whole, before any filter exists. The tiles on
  // the report use loadActiveSummary below instead.
  const loadSummaries = useCallback(async () => {
    if (!accessReady) return
    const agentId = agentFilter === "all" ? undefined : agentFilter
    const types: SaleType[] = ["project", "brokerage", "rental"]
    const zero: SaleTypeSummary = { dealCount: 0, totalValue: 0, pendingCount: 0 }
    const load = (forScope: "own" | "team", agent?: string) =>
      Promise.all(types.map((t) => fetchSalesSummary({ saleType: t, agentId: agent, currentRole, currentUserId, scope: forScope })))
    const [current, other] = await Promise.all([
      load(scope, agentId),
      // A leader's switch shows both counts; the other scope is never member-filtered.
      leadsTeam ? load(scope === "team" ? "own" : "team") : Promise.resolve(null),
    ])
    setSummaries({ project: current[0].data ?? zero, brokerage: current[1].data ?? zero, rental: current[2].data ?? zero })
    if (!leadsTeam || !other) { setScopeCounts(null); return }
    const counts = (res: typeof current) =>
      ({ project: res[0].data?.dealCount ?? 0, brokerage: res[1].data?.dealCount ?? 0, rental: res[2].data?.dealCount ?? 0 })
    // The current scope's count is only "whole" when no member filter narrows it.
    const currentWhole = agentId ? await load(scope) : current
    setScopeCounts(scope === "team"
      ? { team: counts(currentWhole), own: counts(other) }
      : { own: counts(currentWhole), team: counts(other) })
  }, [accessReady, leadsTeam, scope, agentFilter, currentRole, currentUserId])

  // Totals for the active report's tiles, narrowed by the same filters as the
  // rows. Sequenced because the filter bar can fire several of these in quick
  // succession and an older response landing last would show a total that
  // doesn't match the table. Nothing is set before the await — the tiles ride
  // the table's own `loading` flag instead, which avoids a cascading render on
  // every keystroke in the search box.
  const summarySeqRef = useRef(0)
  const loadActiveSummary = useCallback(async () => {
    if (!activeTab || !accessReady) return
    const seq = ++summarySeqRef.current
    const key = summaryKey
    const res = await fetchSalesSummaryFiltered({
      saleType: activeTab,
      agentId: agentFilter === "all" ? undefined : agentFilter,
      currentRole,
      currentUserId,
      scope,
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
  }, [summaryKey, activeTab, accessReady, scope, agentFilter, propertyTypeFilter, developerFilter, commissionFilter, validationFilter, effectiveFrom, effectiveTo, search, currentRole, currentUserId])

  useEffect(() => { void loadReferenceData() }, [loadReferenceData])
  useEffect(() => {
    if (!isTeamLeaderRole) return
    let active = true
    void fetchTeamSalesAccess().then((access) => {
      if (active) setTeamAccess(access)
    })
    return () => { active = false }
  }, [isTeamLeaderRole])

  // "Waiting for team leader" needs to know whose team confirms first — one
  // small lookup per page of rows.
  useEffect(() => {
    if (sales.length === 0) return
    let active = true
    void fetchLeaderReview(sales.map((s) => s.agent_id)).then((map) => {
      if (active) setLeaderReview(map)
    })
    return () => { active = false }
  }, [sales])
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
  // What a team leader may do on a row — from their team's switches, per member
  // (app/api/team/sales-access). Admins edit through their own path.
  const leaderCanEdit = (s: SaleRecord) => !isAdminUser && Boolean(memberFlags.get(s.agent_id)?.canEdit)
  const leaderCanConfirm = (s: SaleRecord) =>
    !isAdminUser &&
    Boolean(memberFlags.get(s.agent_id)?.canConfirm) &&
    s.agent_id !== currentUserId &&
    LEADER_CONFIRMABLE.includes(s.validation_status)
  /** Names of the team leader(s) this sale still waits for, or null. */
  const waitingFor = (s: SaleRecord) =>
    !s.leader_confirmed_at && LEADER_CONFIRMABLE.includes(s.validation_status) ? leaderReview[s.agent_id] || null : null

  const openEdit = (s: SaleRecord) => {
    if (!canEditSaleForRole(currentRole, s, { leaderCanEdit: leaderCanEdit(s) })) {
      addToast("error", "You can't edit this sale")
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

  // The team leader's confirmation — a stamp before the admin's validation.
  const confirmBusyRef = useRef<Set<string>>(new Set())
  const handleLeaderConfirm = async (sale: SaleRecord, confirmIt: boolean) => {
    if (confirmBusyRef.current.has(sale.id)) return
    confirmBusyRef.current.add(sale.id)
    try {
      const { data, error } = await setLeaderConfirmation(sale.id, confirmIt)
      if (error || !data) { addToast("error", error ?? "Couldn't save the confirmation"); return }
      setSales((prev) => prev.map((item) => (item.id === sale.id ? data : item)))
      addToast("success", confirmIt ? "Confirmed — the admin can validate it now" : "Your confirmation was taken back")
      void loadTeamAccess() // the "waiting for you" count
    } finally {
      confirmBusyRef.current.delete(sale.id)
    }
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
      const { data, error, previousStatus } = await updateSaleValidationStatus(sale.id, nextStatus, currentUserId, currentRole, userName)
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

  // Five compact columns, so a whole row fits a laptop screen without sideways
  // scrolling (boss, 2026-11-06: agents on a mouse never found the scrollbar
  // under the old 12-column table). Related facts share a cell instead of a
  // column each: project + unit + developer, price + dates, the statuses.
  // The agent shows under the client wherever rows can be someone else's — the
  // admin's report and a team leader's team view.
  const showAgent = isAdminUser || scope === "team"
  const sortChip = (label: string, field: SortField) => {
    const active = sortField === field
    return (
      <button
        type="button"
        onClick={() => toggleSort(field)}
        title={`Sort by ${label.toLowerCase()}`}
        className={`inline-flex items-center gap-1 uppercase transition-colors ${active ? "text-[#001f3f]" : "text-[#9ca3af] hover:text-[#6b7280]"}`}
      >
        {label}
        <ArrowUpDown className={`w-3 h-3 ${active ? "opacity-100" : "opacity-50"} ${active && sortDir === "desc" ? "rotate-180" : ""}`} />
      </button>
    )
  }

  const columns: Col[] = []
  columns.push({
    key: "client",
    header: "Client",
    thClassName: "min-w-[180px]",
    cell: (s) => {
      const myShare = s.partners.find((p) => p.agent_id === currentUserId)?.share
      const open = openSplitId === s.id
      return (
        <div className="min-w-0 max-w-[250px]">
          <p className="font-semibold leading-snug text-[#0d1117]">
            {s.clients ? toTitleCase(`${s.clients.first_name} ${s.clients.last_name}`) : "—"}
          </p>
          {(showAgent || s.agent_id !== currentUserId) && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] leading-tight text-[#6b7280]">
              <User className="w-3 h-3 shrink-0" />
              <span className="truncate">by {toTitleCase(s.profiles?.fullname) || "—"}</span>
            </p>
          )}
          {s.partners.length > 0 && (
            <button
              type="button"
              // Its own control: the row click (admin drill-in) must not fire too.
              onClick={(e) => {
                e.stopPropagation()
                setOpenSplitId((cur) => (cur === s.id ? null : s.id))
              }}
              aria-expanded={open}
              title={partnerLine(s, currentUserId) ?? undefined}
              className="mt-1 inline-flex items-center gap-1 rounded-full border border-[#d6b357]/40 bg-[#d6b357]/10 px-2 py-0.5 text-[11px] font-semibold leading-tight text-[#8a6d2a] hover:bg-[#d6b357]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b357]/50"
            >
              <Handshake className="w-3 h-3 shrink-0" />
              Shared · {s.partners.length} agents{myShare != null ? ` · your share ${myShare}%` : ""}
              <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      )
    },
  })
  columns.push({
    key: "property",
    header: "Property",
    thClassName: "min-w-[170px]",
    cell: (s) => {
      if (activeTab !== "project") {
        return (
          <div className="min-w-0 max-w-[240px]">
            <p className="font-medium leading-snug text-[#0d1117]">{s.property_type ?? "—"}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-[#6b7280]">{s.property_address ?? "—"}</p>
          </div>
        )
      }
      const unit = [s.project_units?.unit_type, s.unit_number].filter(Boolean).join(" · ")
      return (
        <div className="min-w-0 max-w-[240px]">
          <p className="font-medium leading-snug text-[#0d1117]">{toTitleCase(s.projects?.name) || "—"}</p>
          {unit && <p className="mt-0.5 text-[11px] leading-snug text-[#374151]">{unit}</p>}
          <p className="text-[11px] leading-snug text-[#9ca3af]">{toTitleCase(s.developers?.name) || "—"}</p>
        </div>
      )
    },
  })
  columns.push({
    key: "money",
    // Price, then the dates under it — the preview the boss picked. One column
    // instead of two keeps a whole row on a 1440px laptop screen.
    header: (
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {sortChip("Price", "contract_price")}
        {sortChip("Reserved", "reservation_date")}
        {sortChip("Recorded", "created_at")}
      </span>
    ),
    thClassName: "min-w-[170px] whitespace-normal",
    cell: (s) => (
      <div className="space-y-0.5 text-[12px] leading-snug text-[#374151]">
        <p className="whitespace-nowrap font-mono text-sm font-semibold text-[#0d1117]">{formatCurrency(s.contract_price)}</p>
        <p className="whitespace-nowrap"><span className="text-[#9ca3af]">Reserved</span> {formatDate(s.reservation_date)}</p>
        <p className="whitespace-nowrap"><span className="text-[#9ca3af]">Recorded</span> {formatDate(s.created_at)}</p>
        {s.edited_at && (
          <p
            className="mt-1 inline-flex max-w-[200px] items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800"
            title={`Last edited ${formatDate(s.edited_at)} by ${toTitleCase(s.edited_by_name) || "—"}`}
          >
            <Pencil className="w-3 h-3 shrink-0" />
            <span className="truncate">Edited {shortDate(s.edited_at)} · {toTitleCase(s.edited_by_name) || "—"}</span>
          </p>
        )}
      </div>
    ),
  })
  columns.push({
    key: "status",
    header: "Status",
    thClassName: "min-w-[180px]",
    // The badge answers "what state" — the lines under it answer who decided
    // that and when, whether the team leader has confirmed, and the commission.
    cell: (s) => (
      <div className="min-w-0 space-y-1">
        <div>
          <StatusBadge value={s.validation_status} type="validation" />
          {s.validation_changed_at && (
            <p className="mt-0.5 text-[10px] leading-tight text-[#9ca3af]">
              by {toTitleCase(s.validation_changed_by_name) || "—"} · {formatDate(s.validation_changed_at)}
            </p>
          )}
        </div>
        {s.leader_confirmed_at ? (
          <p className="flex items-center gap-1 text-[11px] font-medium leading-tight text-emerald-700">
            <BadgeCheck className="w-3.5 h-3.5 shrink-0" />
            Team leader ✓ {toTitleCase(s.leader_confirmed_by_name) || "—"} · {shortDate(s.leader_confirmed_at)}
          </p>
        ) : waitingFor(s) ? (
          <p
            className="flex items-center gap-1 text-[11px] font-medium leading-tight text-amber-700"
            title={`${waitingFor(s)} confirms this team's sales before the admin validates them`}
          >
            <Hourglass className="w-3.5 h-3.5 shrink-0" />
            Waiting for team leader
          </p>
        ) : null}
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">
          Commission <StatusBadge value={s.commission_status} type="commission" />
        </p>
      </div>
    ),
  })
  columns.push({
    key: "actions",
    header: "Actions",
    // Pinned to the right edge, so on a narrow screen the buttons stay in
    // reach while the rest of the row scrolls under them.
    thClassName: "sticky right-0 z-10 bg-[#fbfcfd]",
    tdClassName: "sticky right-0 z-[1] whitespace-nowrap bg-white shadow-[-12px_0_12px_-12px_rgba(0,31,63,0.18)] group-hover:bg-[#fcfdff]",
    cell: (s) => {
      const canEditRow = leaderCanEdit(s)
      const canConfirmRow = leaderCanConfirm(s)
      return (
        <div className="flex items-center gap-1.5 flex-nowrap">
          {isAdminUser && (
            <ReviewMenu
              current={s.validation_status}
              onPick={(status) => setConfirm({ kind: "validation", sale: s, nextStatus: status })}
            />
          )}
          {canConfirmRow && !s.leader_confirmed_at && (
            <button
              type="button"
              onClick={() => void handleLeaderConfirm(s, true)}
              title="Confirm this sale for the admin to validate"
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              <BadgeCheck className="h-3.5 w-3.5" />
              Confirm
            </button>
          )}
          {canEditRow && (
            <button
              type="button"
              onClick={() => openEdit(s)}
              title="Edit this sale"
              aria-label="Edit this sale"
              className="w-8 h-8 inline-flex items-center justify-center rounded-full border border-[#e5e5e5] bg-white text-[#6b7280] hover:border-[#001f3f]/80 hover:text-[#001f3f] transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {s.attachments_count > 0 && (
            <button
              type="button"
              onClick={() => openAttachments(s)}
              title={`${s.attachments_count} file${s.attachments_count === 1 ? "" : "s"}`}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 text-xs font-semibold text-sky-600 hover:bg-sky-100 transition-colors"
            >
              <Paperclip className="w-3.5 h-3.5" />
              {s.attachments_count}
            </button>
          )}
          <button
            type="button"
            onClick={() => openDiscussion(s)}
            title="Open validation discussion"
            aria-label="Open validation discussion"
            className="w-8 h-8 inline-flex items-center justify-center rounded-full border border-[#e5e5e5] bg-white text-[#6b7280] hover:border-[#001f3f]/80 hover:text-[#001f3f] transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          {isAdminUser && (
            <button
              type="button"
              onClick={() => openDiscussion(s, "activity")}
              title="View activity history"
              aria-label="View activity history"
              className="w-8 h-8 inline-flex items-center justify-center rounded-full border border-[#e5e5e5] bg-white text-[#6b7280] hover:border-[#001f3f]/80 hover:text-[#001f3f] transition-colors"
            >
              <History className="w-4 h-4" />
            </button>
          )}
          <SaleActions
            sale={s}
            currentRole={currentRole}
            currentUserId={currentUserId}
            canEdit={canEditRow}
            onView={() => openView(s)}
            onEdit={() => openEdit(s)}
            onAttachments={() => openAttachments(s)}
            onDelete={() => setConfirm({ kind: "delete", sale: s })}
            onUndoConfirm={canConfirmRow && s.leader_confirmed_at ? () => void handleLeaderConfirm(s, false) : undefined}
          />
        </div>
      )
    },
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
  // An agent's value tile credits their share of shared sales (migration 056),
  // so it can read lower than the rows' full contract prices — say so. A
  // leader's team view counts each team sale once, in full.
  const valueTileHint =
    scope === "team"
      ? [tileHint, agentFilter === "all" ? "your team's sales" : "this member's share"].filter(Boolean).join(" · ")
      : isSalesPipelineRole(currentRole) && sales.some((s) => s.partners.length > 0)
        ? [tileHint, "shared sales at your share"].filter(Boolean).join(" · ")
        : tileHint
  const waitingForMe = scope === "team" && activeTab && teamAccess?.canConfirm ? teamAccess.waitingToConfirm[activeTab] : 0
  const pendingTileHint = waitingForMe > 0
    ? [tileHint, `${waitingForMe} waiting for your confirmation`].filter(Boolean).join(" · ")
    : tileHint

  // A team leader's "My team | My own sales" switch, with each side's count —
  // the way into their team's sales (migration 084). Shown on the chooser and
  // on every report.
  const scopeCount = (which: "own" | "team") =>
    scopeCounts ? (activeTab ? scopeCounts[which][activeTab] : Object.values(scopeCounts[which]).reduce((a, b) => a + b, 0)) : null
  const scopeSwitch = leadsTeam ? (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div role="tablist" aria-label="Whose sales" className="inline-flex rounded-2xl border border-[#e5e7eb] bg-white p-1 shadow-sm">
        {([
          { value: "team", label: "My team", Icon: Users },
          { value: "own", label: "My own sales", Icon: User },
        ] as const).map(({ value, label, Icon }) => {
          const active = scope === value
          const count = scopeCount(value)
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => { if (!active) setScope(value) }}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                active ? "bg-[#001f3f] text-white shadow" : "text-[#374151] hover:bg-[#f3f4f6]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {count != null && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${active ? "bg-white/15 text-white" : "bg-[#f3f4f6] text-[#6b7280]"}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {scope === "team" && teamAccess && (
        <p className="text-xs text-[#6b7280]">
          Sales recorded by {teamAccess.teamNames.join(", ") || "your team"} ({teamAccess.members.length} members).{" "}
          {teamAccess.canEdit || teamAccess.canConfirm
            ? `You can ${[teamAccess.canEdit && "edit them", teamAccess.canConfirm && "confirm new ones for the admin"].filter(Boolean).join(" and ")}.`
            : "View only — an admin can let you edit or confirm them."}
        </p>
      )}
    </div>
  ) : null

  // Plain-language description of what's in effect, stamped onto the export so
  // a downloaded file can't be mistaken for the full report.
  const filterLines = () => {
    const out: string[] = []
    if (activeMeta) out.push(`Sale type: ${activeMeta.label}`)
    if (search) out.push(`Search: "${search}"`)
    if (scope === "team") out.push(`Sales of: ${teamAccess?.teamNames.join(", ") || "your team"}`)
    if (isAdminUser && agentFilter !== "all") {
      out.push(`Agent: ${agents.find((a) => a.id === agentFilter)?.fullname ?? agentFilter}`)
    } else if (scope === "team" && agentFilter !== "all") {
      out.push(`Team member: ${memberFlags.get(agentFilter)?.name ?? agentFilter}`)
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
      scope,
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
                    ? "Choose a report to monitor sales, join validation discussion, and attach documents."
                    : "Which report do you want to view? Choose one to start."}
                </p>
              </div>
            </div>

            {scopeSwitch}

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
                    <>
                      <button
                        type="button"
                        onClick={() => setShowTopSeller(true)}
                        className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#d6b357] text-[#001f3f] text-sm font-bold hover:bg-[#c8a544] transition-colors"
                      >
                        <Crown className="w-4 h-4" />
                        Top Seller Poster
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowTopDeveloper(true)}
                        className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-full border-2 border-[#d6b357] bg-white text-[#8a6d2a] text-sm font-bold hover:bg-[#faf7ee] transition-colors"
                      >
                        <Building2 className="w-4 h-4" />
                        Top Developer Poster
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {scopeSwitch}

            {/* Summary tiles for the active tab — these follow the filter bar, so
                they always describe the same set of sales as the rows below.
                Falls back to the unfiltered type summary if the filtered totals
                aren't available, and says so rather than showing a wrong number. */}
            <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 transition-opacity ${loading ? "opacity-60" : ""}`}>
              <SummaryTile
                label="Sales"
                value={tileSummary ? String(tileSummary.dealCount) : "—"}
                icon={FileText}
                hint={tileHint}
              />
              <SummaryTile
                label="Total Contract Value"
                value={tileSummary ? formatCurrency(tileSummary.totalValue) : "—"}
                icon={Wallet}
                hint={valueTileHint}
              />
              <SummaryTile
                label="Pending Validation"
                value={tileSummary ? String(tileSummary.pendingCount) : "—"}
                icon={Clock}
                hint={pendingTileHint}
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

              {showAgentFilter && (
                <FilterSelect
                  ariaLabel={isAdminUser ? "Agent" : "Team member"}
                  value={agentFilter}
                  onValueChange={(v) => { setAgentFilter(v); setPage(1) }}
                  searchPlaceholder={isAdminUser ? "Search agents…" : "Search your team…"}
                  options={agentOptions}
                />
              )}

              {activeTab === "project" ? (
                <FilterSelect
                  ariaLabel="Developer"
                  value={developerFilter}
                  onValueChange={(v) => { setDeveloperFilter(v); setPage(1) }}
                  searchPlaceholder="Search developers…"
                  options={developerOptions}
                />
              ) : (
                // Brokerage and rental sales record a free property type instead
                // of a developer/project, so that's what they filter on.
                <FilterSelect
                  ariaLabel="Property type"
                  value={propertyTypeFilter}
                  onValueChange={(v) => { setPropertyTypeFilter(v); setPage(1) }}
                  options={PROPERTY_TYPE_OPTIONS}
                />
              )}

              <FilterSelect
                ariaLabel="Commission status"
                value={commissionFilter}
                onValueChange={(v) => { setCommissionFilter(v as CommissionStatus | "all"); setPage(1) }}
                options={COMMISSION_OPTIONS}
              />

              <FilterSelect
                ariaLabel="Validation status"
                value={validationFilter}
                onValueChange={(v) => { setValidationFilter(v as ValidationStatus | "all"); setPage(1) }}
                options={VALIDATION_OPTIONS}
              />

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

              <FilterSelect
                ariaLabel="Year"
                value={yearFilter}
                onValueChange={(v) => pickPeriod({ year: v })}
                options={yearSelectOptions}
              />

              <FilterSelect
                ariaLabel={yearFilter === "all" ? "Month — pick a year first" : "Month"}
                title={yearFilter === "all" ? "Pick a year first" : undefined}
                value={monthFilter}
                onValueChange={(v) => pickPeriod({ month: v })}
                disabled={yearFilter === "all"}
                options={MONTH_OPTIONS}
              />

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
                        className={`text-left text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-3 py-3.5 whitespace-nowrap first:pl-6 last:pr-4 ${col.thClassName ?? ""}`}
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
                        <p className="text-sm font-medium text-[#6b7280]">
                          {scope === "team" ? "Your team hasn't recorded a sale of this type yet." : "No sales recorded for this type yet."}
                        </p>
                        <p className="text-xs">
                          Use the <span className="font-semibold text-[#001f3f]">Record Your Sale</span> button in the sidebar to record one.
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
                      <Fragment key={sale.id}>
                      <tr
                        onClick={drillable ? openDrill : undefined}
                        onKeyDown={drillable ? (e) => {
                          if (e.target !== e.currentTarget) return
                          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDrill() }
                        } : undefined}
                        tabIndex={drillable ? 0 : undefined}
                        title={drillable ? `View all sales by ${sale.profiles?.fullname ?? "this agent"}` : undefined}
                        className={`group hover:bg-[#fcfdff] focus:outline-none focus-visible:bg-[#f3f4f6] transition-colors ${drillable ? "cursor-pointer" : ""}`}
                      >
                        {columns.map((col) => (
                          <td
                            key={col.key}
                            // The Actions cell holds its own buttons — a click
                            // there must not also drill into the agent.
                            onClick={col.key === "actions" ? (e) => e.stopPropagation() : undefined}
                            className={`px-3 py-3 align-middle first:pl-6 last:pr-4 ${col.tdClassName ?? "text-[#374151]"}`}
                          >
                            {col.cell(sale)}
                          </td>
                        ))}
                      </tr>
                      {openSplitId === sale.id && sale.partners.length > 0 && (
                        <tr className="bg-[#fffdf7]">
                          <td colSpan={colCount} className="px-6 pb-4 pt-1 whitespace-normal">
                            {/* Sticky, so the split stays in view even when the row is
                                scrolled sideways on a narrow screen — it used to be
                                cut off at the left edge. */}
                            <div className="sticky left-6 w-fit max-w-[min(42rem,calc(100vw-5rem))]">
                              <SaleSplitBreakdown
                                partners={sale.partners}
                                contractPrice={sale.contract_price}
                                ownerId={sale.agent_id}
                                highlightId={currentUserId}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
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
              <FilterSelect
                ariaLabel="Rows per page"
                value={String(perPage)}
                onValueChange={(v) => { setPerPage(Number(v) as 10 | 20 | 50); setPage(1) }}
                options={PER_PAGE_SELECT_OPTIONS}
                align="end"
                className="py-1.5 text-xs"
              />
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
        leaderMode={selectedSale && leaderCanEdit(selectedSale) ? { canConfirm: leaderCanConfirm(selectedSale) } : null}
        performerName={userName}
      />

      {showDetails && detailSale && (
        <SaleDetails
          sale={detailSale}
          viewerId={currentUserId}
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
          message={
            `This sets the validation status to ${STATUS_LABEL[confirm.nextStatus]}. You can change it again later.` +
            (confirm.nextStatus === "validated" && waitingFor(confirm.sale)
              ? ` ${waitingFor(confirm.sale)} (team leader) hasn't confirmed this sale yet — you can still validate it.`
              : "")
          }
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
              readOnly={discussionTarget.sale.partner_agent_ids.includes(currentUserId)}
              saleTitle={saleTitle(discussionTarget.sale)}
            />
          </div>
        </div>
      )}

      {showTopSeller && <TopSellerStudio onClose={() => setShowTopSeller(false)} />}
      {showTopDeveloper && <TopDeveloperStudio onClose={() => setShowTopDeveloper(false)} />}

      <ToastStack
        toasts={toasts}
        remove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </>
  )
}
