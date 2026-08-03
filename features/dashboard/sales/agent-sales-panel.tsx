"use client"

// Per-agent sales drill-in. Clicking a row in a Sales Report opens this: who
// the agent is, their production totals, and every sale they've recorded —
// across all three sale types — with its own filters.

import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  AlertTriangle, ArrowLeft, ArrowUpDown, Building2, CalendarDays, Handshake,
  KeyRound, Mail, Search, TrendingUp, Wallet, Clock, X, type LucideIcon,
} from "lucide-react"
import { UserAvatar } from "@/components/user-avatar"
import {
  fetchSales,
  type SaleRecord,
  type SaleType,
  type CommissionStatus,
  type ValidationStatus,
} from "@/lib/sales-service"

// Mirrors the (unexported) sort union in lib/sales-service.
type SortField = "reservation_date" | "contract_price" | "created_at"
type SortDir = "asc" | "desc"
import { ROLE_COLORS, ROLE_OPTIONS } from "@/lib/user-service"
import { formatCompactMoney, formatCurrency, formatDate, StatusBadge } from "./sale-ui"

type DeveloperOption = { id: string; name: string }

const PER_PAGE = 10

const SALE_TYPE_META: Record<SaleType, { label: string; icon: LucideIcon }> = {
  project: { label: "Project Sale", icon: Building2 },
  brokerage: { label: "Brokerage", icon: Handshake },
  rental: { label: "Rental", icon: KeyRound },
}

const COMMISSION_STATUSES: CommissionStatus[] = ["pending", "processing", "approved", "released", "rejected"]
const VALIDATION_STATUSES: ValidationStatus[] = ["pending", "under_review", "validated", "invalid_sale"]

// Word-initial capitals. `\b` is ASCII-only and would uppercase every accented
// letter ("josé" → "JosÉ"), so boundaries are start-of-string or separators.
const titleCase = (v: string) =>
  v.toLowerCase().replace(/(^|[\s\-'’.])(\p{L})/gu, (_m, sep: string, c: string) => sep + c.toUpperCase())

function roleLabel(role: string | null): string {
  const key = (role ?? "member").toLowerCase()
  return ROLE_OPTIONS.find((o) => o.value === key)?.label ?? titleCase(key.replace(/_/g, " "))
}

function roleChip(role: string | null): string {
  const c = ROLE_COLORS[(role ?? "member").toLowerCase().trim()] ?? ROLE_COLORS.member
  return `${c.bg} ${c.text} ${c.border}`
}

/** Payload of /api/admin/users/[id]/brief — header + lifetime tiles. */
type AgentBrief = {
  email: string | null
  fullname: string | null
  role: string | null
  profileUrl: string | null
  joinedAt: string | null
  teamName: string | null
  sales: { deals: number; value: number; pending: number; released: number }
}

function Tile({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-black/[0.08] p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#001f3f] flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-[#d6b357]" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">{label}</p>
        <p className="text-lg font-bold text-[#0d1117] truncate" title={value}>{value}</p>
        {hint && <p className="text-[11px] text-[#9ca3af] truncate">{hint}</p>}
      </div>
    </div>
  )
}

function Field({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[#6b7280] min-w-0">
      <Icon className="w-3.5 h-3.5 text-[#9ca3af] shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  )
}

export function AgentSalesPanel({
  agentId,
  agentName,
  currentRole,
  currentUserId,
  developers,
  backLabel,
  onBack,
  onViewSale,
}: {
  agentId: string
  /** Name known at click time; null on deep-link — the brief fetch fills it. */
  agentName: string | null
  currentRole: string
  currentUserId: string
  developers: DeveloperOption[]
  backLabel: string
  onBack: () => void
  onViewSale: (sale: SaleRecord) => void
}) {
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loadedKey, setLoadedKey] = useState("")

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<SaleType | "all">("all")
  const [developerFilter, setDeveloperFilter] = useState("all")
  const [commissionFilter, setCommissionFilter] = useState<CommissionStatus | "all">("all")
  const [validationFilter, setValidationFilter] = useState<ValidationStatus | "all">("all")
  const [year, setYear] = useState<number | "all">("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  // created_at (never null) rather than reservation_date: PostgREST's bare
  // ORDER BY … DESC is NULLS FIRST, which would pin dateless legacy rows on top.
  const [sortField, setSortField] = useState<SortField>("created_at")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [salesError, setSalesError] = useState<string | null>(null)
  const [retryTick, setRetryTick] = useState(0)

  const [brief, setBrief] = useState<AgentBrief | null>(null)
  const [briefState, setBriefState] = useState<"loading" | "done" | "failed">("loading")

  const displayName = brief?.fullname ?? agentName
  const displayTitle = displayName ? titleCase(displayName) : "Agent"

  // A year pick drives the date range; a manual range clears the year chip so
  // only one of them is ever in effect.
  const effectiveFrom = dateFrom || (year === "all" ? "" : `${year}-01-01`)
  const effectiveTo = dateTo || (year === "all" ? "" : `${year}-12-31`)

  const requestKey = [
    page, search, typeFilter, developerFilter, commissionFilter, validationFilter,
    effectiveFrom, effectiveTo, sortField, sortDir, retryTick,
  ].join("|")
  const loading = loadedKey !== requestKey

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  // Sales list for the current filters. fetchSales reports failures via the
  // returned `error` (it never throws) — surface it instead of rendering a
  // failed query as "no sales"; the catch covers anything unexpected so the
  // loading skeleton can't wedge on permanently.
  useEffect(() => {
    if (loadedKey === requestKey) return
    let alive = true
    void (async () => {
      try {
        const { data, total: count, error } = await fetchSales({
          page,
          perPage: PER_PAGE,
          search: search || undefined,
          saleType: typeFilter === "all" ? undefined : typeFilter,
          agentId,
          developerId: developerFilter === "all" ? undefined : developerFilter,
          commissionStatus: commissionFilter === "all" ? undefined : commissionFilter,
          validationStatus: validationFilter === "all" ? undefined : validationFilter,
          reservationDateFrom: effectiveFrom || undefined,
          reservationDateTo: effectiveTo || undefined,
          sortField,
          sortDir,
          currentRole,
          currentUserId,
        })
        if (!alive) return
        setSales(data ?? [])
        setTotal(count ?? 0)
        setSalesError(error ?? null)
      } catch {
        if (!alive) return
        setSales([])
        setTotal(0)
        setSalesError("Could not load this agent's sales. Check your connection and retry.")
      } finally {
        if (alive) setLoadedKey(requestKey)
      }
    })()
    return () => { alive = false }
  }, [
    loadedKey, requestKey, page, search, typeFilter, agentId, developerFilter,
    commissionFilter, validationFilter, effectiveFrom, effectiveTo, sortField,
    sortDir, currentRole, currentUserId,
  ])

  // Agent header + lifetime tiles, from the narrow admin brief endpoint.
  // Keyed by agentId: the panel is remounted per agent by its caller, so state
  // starts clean and this effect only fetches (no synchronous setState).
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = await fetch(`/api/admin/users/${agentId}/brief`, { cache: "no-store" })
        if (!res.ok) throw new Error(`brief ${res.status}`)
        const d = (await res.json()) as AgentBrief
        if (!alive) return
        setBrief(d)
        setBriefState("done")
      } catch {
        // Header degrades to the name; tiles show "—" rather than fake zeros.
        if (alive) setBriefState("failed")
      }
    })()
    return () => { alive = false }
  }, [agentId])

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  // No setState nested inside an updater — StrictMode double-invokes updaters,
  // which would flip the direction twice.
  const toggleSort = (field: SortField) => {
    setPage(1)
    if (field === sortField) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
      return
    }
    setSortField(field)
    // First click sorts ascending, same as the report table's headers.
    setSortDir("asc")
  }

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear()
    return Array.from({ length: 5 }, (_, i) => y - i)
  }, [])

  const activeFilters =
    (search ? 1 : 0) + (typeFilter !== "all" ? 1 : 0) + (developerFilter !== "all" ? 1 : 0) +
    (commissionFilter !== "all" ? 1 : 0) + (validationFilter !== "all" ? 1 : 0) +
    (year !== "all" ? 1 : 0) + (dateFrom || dateTo ? 1 : 0)

  const resetFilters = () => {
    setSearchInput(""); setSearch(""); setTypeFilter("all"); setDeveloperFilter("all")
    setCommissionFilter("all"); setValidationFilter("all"); setYear("all")
    setDateFrom(""); setDateTo(""); setPage(1)
  }

  const selectCls = "pl-3 pr-8 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white focus:outline-none focus:border-[#001f3f] cursor-pointer"

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6b7280] hover:text-[#001f3f] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> {backLabel}
      </button>

      {/* ── Agent header ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-black/[0.08] p-5">
        <div className="flex flex-wrap items-center gap-4">
          <UserAvatar name={displayTitle} imageUrl={brief?.profileUrl ?? null} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-['Outfit'] text-xl font-bold text-[#0d1117] truncate">{displayTitle}</h2>
              {brief?.role && (
                <span className={`text-[10px] font-bold capitalize px-2 py-0.5 rounded-full border ${roleChip(brief.role)}`}>
                  {roleLabel(brief.role)}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
              {brief?.email && <Field icon={Mail}>{brief.email}</Field>}
              {brief?.teamName && <Field icon={Building2}>{brief.teamName}</Field>}
              {brief?.joinedAt && <Field icon={CalendarDays}>Joined {formatDate(brief.joinedAt)}</Field>}
              {briefState === "loading" && <span className="text-xs text-[#c0c6cf]">Loading agent details…</span>}
              {briefState === "failed" && <span className="text-xs text-[#c0c6cf]">Agent details unavailable</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Lifetime production — "—" until the brief loads, never fake zeros */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Tile icon={Wallet} label="Total contract value" value={brief ? formatCompactMoney(brief.sales.value) : "—"} hint="All sale types" />
        <Tile icon={TrendingUp} label="Total deals" value={brief ? String(brief.sales.deals) : "—"} hint="Lifetime" />
        <Tile icon={Clock} label="Commission pending" value={brief ? String(brief.sales.pending) : "—"} />
        <Tile icon={TrendingUp} label="Commission released" value={brief ? String(brief.sales.released) : "—"} />
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-black/[0.08] p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search client, unit, project, property…"
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm bg-white focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 placeholder:text-[#9ca3af]"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => {
              const t = e.target.value as SaleType | "all"
              setTypeFilter(t)
              // Only project sales carry a developer — a developer filter on
              // brokerage/rental can never match, so drop it with the select.
              if (t === "brokerage" || t === "rental") setDeveloperFilter("all")
              setPage(1)
            }}
            className={selectCls}
            aria-label="Sale type"
          >
            <option value="all">All types</option>
            {(Object.keys(SALE_TYPE_META) as SaleType[]).map((t) => (
              <option key={t} value={t}>{SALE_TYPE_META[t].label}</option>
            ))}
          </select>

          {(typeFilter === "all" || typeFilter === "project") && (
            <select value={developerFilter} onChange={(e) => { setDeveloperFilter(e.target.value); setPage(1) }} className={selectCls} aria-label="Developer">
              <option value="all">All Developers</option>
              {developers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}

          <select value={commissionFilter} onChange={(e) => { setCommissionFilter(e.target.value as CommissionStatus | "all"); setPage(1) }} className={selectCls} aria-label="Commission status">
            <option value="all">Commission: All</option>
            {COMMISSION_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s.replace(/_/g, " "))}</option>)}
          </select>

          <select value={validationFilter} onChange={(e) => { setValidationFilter(e.target.value as ValidationStatus | "all"); setPage(1) }} className={selectCls} aria-label="Validation status">
            <option value="all">Validation: All</option>
            {VALIDATION_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s.replace(/_/g, " "))}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={year}
            onChange={(e) => {
              const v = e.target.value
              setYear(v === "all" ? "all" : Number(v))
              setDateFrom(""); setDateTo(""); setPage(1)
            }}
            className={selectCls}
            aria-label="Year"
          >
            <option value="all">All years</option>
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>

          <label className="text-xs text-[#9ca3af] font-semibold uppercase tracking-wider">Reservation date</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setYear("all"); setPage(1) }}
            className="px-3 py-2 rounded-2xl border border-[#e5e5e5] text-sm bg-white focus:outline-none focus:border-[#001f3f]"
            aria-label="Reservation date from"
          />
          <span className="text-xs text-[#9ca3af]">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setYear("all"); setPage(1) }}
            className="px-3 py-2 rounded-2xl border border-[#e5e5e5] text-sm bg-white focus:outline-none focus:border-[#001f3f]"
            aria-label="Reservation date to"
          />

          {activeFilters > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-[#e5e5e5] text-xs font-semibold text-[#6b7280] hover:border-[#001f3f] hover:text-[#001f3f] transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Clear {activeFilters} filter{activeFilters === 1 ? "" : "s"}
            </button>
          )}
        </div>
      </div>

      {/* ── Sales table ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-black/[0.08] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#f0f2f5]">
          <h3 className="font-['Outfit'] text-sm font-bold text-[#0d1117]">
            Sales by {displayTitle}
            <span className="ml-2 text-xs font-semibold text-[#9ca3af]">({total})</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#f0f2f5] bg-[#fafbfc]">
                {[
                  { label: "Type" },
                  { label: "Developer" },
                  { label: "Project / Property" },
                  { label: "Client" },
                  { label: "Contract Price", field: "contract_price" as SortField, right: true },
                  { label: "Reservation Date", field: "reservation_date" as SortField },
                  { label: "Commission" },
                  { label: "Validation" },
                ].map((h) => (
                  <th
                    key={h.label}
                    className={`text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider px-4 py-3 whitespace-nowrap first:pl-6 last:pr-6 ${h.right ? "text-right" : "text-left"}`}
                  >
                    {h.field ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(h.field!)}
                        className="inline-flex items-center gap-1 uppercase hover:text-[#001f3f] transition-colors"
                      >
                        {h.label}
                        <ArrowUpDown
                          className={`w-3 h-3 transition-transform ${
                            sortField === h.field
                              ? `text-[#001f3f] ${sortDir === "desc" ? "rotate-180" : ""}`
                              : "opacity-40"
                          }`}
                        />
                      </button>
                    ) : h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f8f9fa]">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-4 py-2.5 first:pl-6 last:pr-6">
                        <div className={`h-3 rounded-full bg-[#f0f2f5] animate-pulse ${j === 0 ? "w-24" : "w-20"}`} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : salesError ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center">
                    <div className="inline-flex flex-col items-center gap-3">
                      <p className="inline-flex items-center gap-2 text-sm text-[#b45309]">
                        <AlertTriangle className="w-4 h-4 shrink-0" /> {salesError}
                      </p>
                      <button
                        type="button"
                        onClick={() => setRetryTick((t) => t + 1)}
                        className="px-4 py-2 rounded-xl bg-[#001f3f] hover:bg-[#002b57] text-white text-xs font-semibold transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center text-sm text-[#9ca3af]">
                    No sales match these filters.
                  </td>
                </tr>
              ) : (
                sales.map((s) => {
                  const Meta = SALE_TYPE_META[s.sale_type]
                  return (
                    <tr
                      key={s.id}
                      onClick={() => onViewSale(s)}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return
                        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onViewSale(s) }
                      }}
                      tabIndex={0}
                      className="hover:bg-[#fcfdff] focus:outline-none focus-visible:bg-[#f3f4f6] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-2.5 first:pl-6 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#374151]">
                          <Meta.icon className="w-3.5 h-3.5 text-[#9ca3af]" />
                          {Meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[#374151] whitespace-nowrap">{titleCase(s.developers?.name ?? "") || "—"}</td>
                      <td className="px-4 py-2.5 text-[#374151] whitespace-nowrap">
                        {titleCase(s.projects?.name ?? s.property_address ?? s.property_type ?? "") || "—"}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-[#0d1117] whitespace-nowrap">
                        {s.clients ? titleCase(`${s.clients.first_name} ${s.clients.last_name}`) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-sm font-semibold text-[#0d1117] whitespace-nowrap">
                        {formatCurrency(s.contract_price)}
                      </td>
                      <td className="px-4 py-2.5 text-[#374151] whitespace-nowrap">{formatDate(s.reservation_date)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap"><StatusBadge value={s.commission_status} type="commission" /></td>
                      <td className="px-4 py-2.5 last:pr-6 whitespace-nowrap"><StatusBadge value={s.validation_status} type="validation" /></td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 px-6 py-3.5 border-t border-[#f0f2f5]">
            <p className="text-xs text-[#6b7280] tabular-nums">
              Showing {Math.min((page - 1) * PER_PAGE + 1, total)}–{Math.min(page * PER_PAGE, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-xl border border-[#e5e5e5] text-xs font-semibold text-[#374151] disabled:opacity-40 hover:border-[#001f3f] transition-colors"
              >
                ← Prev
              </button>
              <span className="text-xs font-semibold text-[#374151] tabular-nums">{page} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-xl border border-[#e5e5e5] text-xs font-semibold text-[#374151] disabled:opacity-40 hover:border-[#001f3f] transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Calendar hint for the empty-date case */}
      {activeFilters === 0 && total > 0 && (
        <p className="text-[11px] text-[#9ca3af] flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5" />
          Showing every sale this agent has recorded. Use the filters above to narrow by year, date, developer or status.
        </p>
      )}
    </div>
  )
}
