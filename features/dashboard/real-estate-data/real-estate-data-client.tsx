"use client"

// Admin → Real Estate Data.
//
// Three top-level tabs:
//   Index           — DLD's official Property Price Index. Reuses the exact
//                      same component the public /open-data page renders
//                      (components/public/price-index-chart.tsx) — one chart,
//                      one implementation, so the two surfaces never drift.
//   Breakdowns      — daily volume / value and category splits for a dataset
//                      + date range, defaulting to the last 7 days.
//   Real Estate Data — the nine raw DLD tables (Transactions, Rents, Project,
//                      Valuations, Land, Building, Unit, Broker, Developer),
//                      each with its own filter form, summary strip and table,
//                      reachable through a second row of tabs underneath.
//
// Everything about a dataset — its filters, default sort, and columns — comes
// from lib/dld-open-data.ts; this file only knows how to render one, not what
// it contains. Data flows through /api/admin/dld/{command} (see that route
// for why it is proxied). Lookups (areas, projects, property types) are
// fetched once per page load and shared across the dataset tabs.

import { useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarRange, ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, X } from "lucide-react"
import { FilterSelect, type FilterSelectOption } from "@/components/ui/filter-select"
import { PriceIndexChart } from "@/components/public/price-index-chart"
import { BreakdownSection, RefreshButton, TabSummary } from "./market-charts"
import { cacheDelete, cacheGet, cacheSet } from "./client-cache"
import {
  DLD_DATASETS,
  DLD_DEFAULT_TAKE,
  DLD_SEARCH_CHUNK,
  DLD_SEARCH_COLUMN_KEY,
  DLD_SEARCH_SCAN_MAX,
  DLD_SEARCH_SCAN_ROWS_KEY,
  DLD_SEARCH_SCAN_STEP,
  DLD_SEARCH_TERM_KEY,
  DLD_SEARCH_TERM_MAX,
  DLD_TAB_ORDER,
  isoToDldDate,
  missingRequired,
  resolveDefault,
  type DldColumn,
  type DldCommand,
  type DldDataset,
  type DldFilterField,
  type DldLookupName,
  type DldLookupResponse,
  type DldOption,
  type DldQueryResponse,
  type DldRow,
  type DldSearchInfo,
} from "@/lib/dld-open-data"

const INPUT_CLS =
  "h-11 w-full rounded-xl border border-[#e5e7eb] bg-white px-3.5 text-sm text-[#0f2940] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5"

const PAGE_SIZES = [10, 25, 50, 100]

type Lookups = Partial<Record<DldLookupName, DldOption[]>>

/** A dataset tab's remembered view (see DatasetPanel). */
type TableMemo = {
  values: Record<string, string>
  applied: Record<string, string>
  sort: string
  page: number
  pageSize: number
  searchColumn: string
  searchTerm: string
  appliedSearch: { column: string; term: string; scanRows: number } | null
}

type TopTab = "index" | "breakdowns" | "real-estate-data"
const TOP_TABS: Array<{ key: TopTab; label: string }> = [
  { key: "index", label: "General Index" },
  { key: "breakdowns", label: "Breakdowns" },
  { key: "real-estate-data", label: "Real Estate Data" },
]

/**
 * Index is the landing tab. A dataset's own hash (#rents, #brokers, …) opens
 * straight to Real Estate Data on that dataset — same deep links as before —
 * and any other recognized hash opens its own top tab.
 */
function topTabFromHash(): TopTab {
  if (typeof window === "undefined") return "index"
  const h = window.location.hash.replace("#", "")
  if ((TOP_TABS.map((t) => t.key) as string[]).includes(h)) return h as TopTab
  if ((DLD_TAB_ORDER as readonly string[]).includes(h)) return "real-estate-data"
  return "index"
}

function datasetFromHash(): DldCommand {
  if (typeof window === "undefined") return "transactions"
  const h = window.location.hash.replace("#", "")
  return (DLD_TAB_ORDER as readonly string[]).includes(h) ? (h as DldCommand) : "transactions"
}

function initialValues(dataset: DldDataset): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of dataset.filters) out[f.param] = resolveDefault(f)
  return out
}

/** Form values (ISO dates) → the gateway's parameter shape (MM/DD/YYYY). */
function toRequestBody(dataset: DldDataset, values: Record<string, string>): Record<string, string> {
  const body: Record<string, string> = {}
  for (const f of dataset.filters) {
    const v = values[f.param] ?? ""
    body[f.param] = f.kind === "date" ? isoToDldDate(v) : v
  }
  return body
}

// ─── Cell formatting ─────────────────────────────────────────────────────────

const money = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 })
const num = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 2 })

function formatCell(col: DldColumn, raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") return "—"
  switch (col.format) {
    case "date":
    case "datetime": {
      const d = new Date(String(raw))
      if (Number.isNaN(d.getTime())) return String(raw)
      const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      if (col.format === "date") return date
      return `${date} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
    }
    case "money":
      return typeof raw === "number" ? money.format(raw) : String(raw)
    case "area":
    case "number":
      return typeof raw === "number" ? num.format(raw) : String(raw)
    case "percent":
      return typeof raw === "number" ? `${num.format(raw)}%` : String(raw)
    default:
      return String(raw).replace(/ /g, " ").trim() || "—"
  }
}

function isNumericFormat(col: DldColumn): boolean {
  return col.format === "money" || col.format === "area" || col.format === "number" || col.format === "percent"
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RealEstateDataClient() {
  const [topTab, setTopTab] = useState<TopTab>("index")
  const [dataset, setDataset] = useState<DldCommand>("transactions")
  const [lookups, setLookups] = useState<Lookups>({})
  const [lookupErrors, setLookupErrors] = useState<Partial<Record<DldLookupName, string>>>({})

  // URL-hash-driven tabs (deep-linkable: #index, #breakdowns, #rents, …).
  useEffect(() => {
    setTopTab(topTabFromHash())
    setDataset(datasetFromHash())
    const onHash = () => {
      setTopTab(topTabFromHash())
      setDataset(datasetFromHash())
    }
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])

  // Fetch each lookup once; failure only disables that one dropdown's options.
  useEffect(() => {
    const names: DldLookupName[] = ["carea-lookup", "projects-lookup", "ejari-property-types"]
    let cancelled = false
    for (const name of names) {
      void (async () => {
        try {
          const res = await fetch(`/api/admin/dld/${name}`, { method: "POST" })
          const json = (await res.json()) as DldLookupResponse & { error?: string }
          if (cancelled) return
          if (!res.ok) throw new Error(json.error || "Lookup failed")
          setLookups((prev) => ({ ...prev, [name]: json.options ?? [] }))
        } catch (err) {
          if (cancelled) return
          setLookupErrors((prev) => ({ ...prev, [name]: err instanceof Error ? err.message : "Lookup failed" }))
        }
      })()
    }
    return () => {
      cancelled = true
    }
  }, [])

  const selectTopTab = (key: TopTab) => {
    setTopTab(key)
    if (typeof window === "undefined") return
    // Real Estate Data keeps a dataset-specific hash (#rents, …) so deep
    // links stay precise; the other three tabs just use their own key.
    window.history.replaceState(null, "", `#${key === "real-estate-data" ? dataset : key}`)
  }
  const selectDataset = (key: DldCommand) => {
    setDataset(key)
    setTopTab("real-estate-data")
    if (typeof window !== "undefined") window.history.replaceState(null, "", `#${key}`)
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="font-['Outfit'] text-2xl font-bold text-[#0d1117]">Real Estate Data</h1>
        <p className="text-sm text-[#6b7280] mt-0.5">
          Live open data from the Dubai Land Department — the official price index, quick breakdowns, a sales overview,
          and the full transactions, rents, projects, valuations, land, buildings, units, brokers and developers tables.
        </p>
      </div>

      {/* Top-level tab bar — plain underline tabs (label + a bar under the
          active one), not filled pills. */}
      <div className="mb-6 overflow-x-auto border-b border-[#e8eaed]">
        <div className="flex min-w-max gap-x-7">
          {TOP_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => selectTopTab(t.key)}
              className={`relative -mb-px whitespace-nowrap pb-3 text-sm font-semibold transition-colors ${
                topTab === t.key ? "text-[#001f3f]" : "text-[#8a93a3] hover:text-[#4b5563]"
              }`}
            >
              {t.label}
              {topTab === t.key && <span aria-hidden className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[#001f3f]" />}
            </button>
          ))}
        </div>
      </div>

      {topTab === "index" && <PriceIndexChart />}
      {topTab === "breakdowns" && <BreakdownSection />}
      {topTab === "real-estate-data" && (
        <>
          {/* Dataset sub-tabs */}
          <div className="mb-6 -mx-1 overflow-x-auto">
            <div className="mx-1 inline-flex min-w-full gap-1 p-1 rounded-2xl bg-[#eef1f5] border border-[#e8eaed]">
              {DLD_TAB_ORDER.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectDataset(key)}
                  className={`flex-1 whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    dataset === key ? "bg-white text-[#001f3f] shadow-sm" : "text-[#6b7280] hover:text-[#001f3f]"
                  }`}
                >
                  {DLD_DATASETS[key].label}
                </button>
              ))}
            </div>
          </div>

          {/* Keyed on the dataset so each one gets fresh form + table state. */}
          <DatasetPanel key={dataset} dataset={DLD_DATASETS[dataset]} lookups={lookups} lookupErrors={lookupErrors} />
        </>
      )}
    </>
  )
}
// ─── One dataset: filter form + table ────────────────────────────────────────

function DatasetPanel({
  dataset,
  lookups,
  lookupErrors,
}: {
  dataset: DldDataset
  lookups: Lookups
  lookupErrors: Partial<Record<DldLookupName, string>>
}) {
  // Where this tab was left last time (30-minute client cache): the form,
  // the applied filters/search/sort/page — so coming back shows the same view.
  const stateKey = `table:${dataset.command}:state`
  const [memo] = useState(() => cacheGet<TableMemo>(stateKey)?.data ?? null)

  const [values, setValues] = useState<Record<string, string>>(() => memo?.values ?? initialValues(dataset))
  // The filters the current table was loaded with — editing the form does not
  // refetch until "Search" is pressed, matching the DLD site.
  const [applied, setApplied] = useState<Record<string, string>>(() => memo?.applied ?? initialValues(dataset))
  const [sort, setSort] = useState(memo?.sort ?? dataset.defaultSort)
  const [page, setPage] = useState(memo?.page ?? 1)
  const [pageSize, setPageSize] = useState(memo?.pageSize ?? DLD_DEFAULT_TAKE)

  // Column search ("contains", like SQL `%term%`): pick a column, type a term.
  // Draft state is what's in the box; `appliedSearch` is what the table shows.
  // Defaults to the first text column (e.g. "Developer" for projects).
  const defaultSearchColumn = (dataset.columns.find((c) => !c.format) ?? dataset.columns[0]).key
  const [searchColumn, setSearchColumn] = useState(memo?.searchColumn ?? defaultSearchColumn)
  const [searchTerm, setSearchTerm] = useState(memo?.searchTerm ?? "")
  // `scanRows` is how far a contains-search may read (raised by "Search the
  // next 5,000 rows"); the exact number lookup ignores it.
  const [appliedSearch, setAppliedSearch] = useState<{ column: string; term: string; scanRows: number } | null>(memo?.appliedSearch ?? null)

  useEffect(() => {
    cacheSet<TableMemo>(stateKey, { values, applied, sort, page, pageSize, searchColumn, searchTerm, appliedSearch })
  }, [stateKey, values, applied, sort, page, pageSize, searchColumn, searchTerm, appliedSearch])

  // One "query key" per (filters, search, sort, page, pageSize). The result
  // for a key is cached client-side; `attempt` (Retry / Refresh) forces a
  // refetch of the same key. The table is loading whenever nothing is on hand
  // for the current key — derived, so the effect never calls setState synchronously.
  const [attempt, setAttempt] = useState(0)
  const queryKey = useMemo(
    () => JSON.stringify({ applied, appliedSearch, sort, page, pageSize }),
    [applied, appliedSearch, sort, page, pageSize],
  )
  const resultKey = `table:${dataset.command}:${queryKey}`
  type Loaded = { rows: DldRow[]; total: number; error: string | null; search: DldSearchInfo | null }
  const [fetched, setFetched] = useState<(Loaded & { key: string; attempt: number; at: number }) | null>(null)

  // Tabs with required filters (the date ranges) don't load until the user
  // has filled them in and pressed Search — there is no default range.
  const awaitingRequired = missingRequired(dataset, applied).length > 0

  // What's on screen: this attempt's fetch, else the cached copy of this key.
  // `attempt` is a deliberate dependency: Retry/Refresh delete the cached
  // copy first, and this must re-read (and miss) rather than keep the old one.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cached = useMemo(() => cacheGet<Loaded>(resultKey), [resultKey, attempt])
  const result: (Loaded & { at: number }) | null =
    fetched && fetched.key === queryKey && fetched.attempt === attempt
      ? fetched
      : cached
        ? { ...cached.data, at: cached.at }
        : null

  useEffect(() => {
    if (awaitingRequired || result) return
    let cancelled = false
    void (async () => {
      let next: Loaded
      try {
        const res = await fetch(`/api/admin/dld/${dataset.command}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...toRequestBody(dataset, applied),
            P_TAKE: String(pageSize),
            P_SKIP: String((page - 1) * pageSize),
            P_SORT: sort,
            // Retry/Refresh re-pull search chunks from DLD instead of the server cache.
            refresh: attempt > 0 ? "1" : "",
            ...(appliedSearch
              ? {
                  [DLD_SEARCH_COLUMN_KEY]: appliedSearch.column,
                  [DLD_SEARCH_TERM_KEY]: appliedSearch.term,
                  [DLD_SEARCH_SCAN_ROWS_KEY]: String(appliedSearch.scanRows),
                }
              : {}),
          }),
        })
        const json = (await res.json()) as DldQueryResponse & { error?: string }
        next = res.ok
          ? { rows: json.rows ?? [], total: json.total ?? 0, error: null, search: json.search ?? null }
          : { rows: [], total: 0, error: json.error || "Request failed.", search: null }
      } catch {
        next = { rows: [], total: 0, error: "Could not load data. Check your connection and try again.", search: null }
      }
      if (cancelled) return
      // Errors are not cached — the next visit should try again.
      const at = next.error ? Date.now() : cacheSet(resultKey, next).at
      setFetched({ key: queryKey, attempt, at, ...next })
    })()
    return () => {
      cancelled = true
    }
    // queryKey encodes every input above; listing it alone keeps one fetch per change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, attempt, dataset, awaitingRequired, !!result])

  const loading = !awaitingRequired && !result
  const rows = result?.rows ?? []
  const total = result?.total ?? 0
  const error = result?.error ?? null
  const searchInfo = result?.search ?? null
  const updatedAt = result && !result.error ? result.at : null
  // Retry (after an error) and Refresh both drop the cached copy and refetch.
  const retry = () => {
    cacheDelete(resultKey)
    setAttempt((a) => a + 1)
  }

  const applySearch = () => {
    const term = searchTerm.trim()
    const next = term ? { column: searchColumn, term, scanRows: DLD_SEARCH_SCAN_STEP } : null
    if (JSON.stringify(next) === JSON.stringify(appliedSearch)) return
    setPage(1)
    setAppliedSearch(next)
  }
  const searchFurther = () => {
    if (!appliedSearch) return
    setPage(1)
    setAppliedSearch({ ...appliedSearch, scanRows: Math.min(DLD_SEARCH_SCAN_MAX, appliedSearch.scanRows + DLD_SEARCH_SCAN_STEP) })
  }
  const clearSearch = () => {
    setSearchTerm("")
    if (appliedSearch) {
      setPage(1)
      setAppliedSearch(null)
    }
  }
  const searchColumnLabel = dataset.columns.find((c) => c.key === searchColumn)?.label ?? searchColumn

  const missingNow = missingRequired(dataset, values)

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (missingNow.length) return
    setPage(1)
    setApplied(values)
  }

  const onReset = () => {
    const fresh = initialValues(dataset)
    setValues(fresh)
    setApplied(fresh)
    setSort(dataset.defaultSort)
    setSearchColumn(defaultSearchColumn)
    setSearchTerm("")
    setAppliedSearch(null)
    setPage(1)
  }

  const toggleSort = (key: string) => {
    if (!dataset.sortable.includes(key)) return
    const asc = `${key}_ASC`
    setSort((cur) => (cur === asc ? `${key}_DESC` : asc))
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, (page - 1) * pageSize + rows.length)

  return (
    <div className="space-y-4">
      {/* Filter form */}
      <form onSubmit={onSearch} className="bg-white rounded-2xl border border-[#e8eaed] p-5">
        <p className="text-xs text-[#6b7280] mb-4">
          Note: All fields marked with asterisk (<span className="text-rose-600">*</span>) are mandatory
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {dataset.filters.map((f) => (
            <FilterControl
              key={f.param}
              field={f}
              value={values[f.param] ?? ""}
              onChange={(v) => setValues((prev) => ({ ...prev, [f.param]: v }))}
              lookups={lookups}
              lookupErrors={lookupErrors}
            />
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <button
            type="submit"
            disabled={loading || missingNow.length > 0}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#0a2e57] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-[#e5e7eb] bg-white text-sm font-semibold text-[#374151] hover:border-[#001f3f]/30 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reset
          </button>
          {missingNow.length > 0 && (
            <span className="text-xs text-[#6b7280]">
              {missingNow.map((f) => f.label).join(" and ")} required.
            </span>
          )}
        </div>
      </form>

      {/* Fast summary for the applied filters — exact counts, no full pull. */}
      <TabSummary dataset={dataset} applied={applied} ready={!awaitingRequired} />

      {/* Results */}
      <div className="bg-white rounded-2xl border border-[#e8eaed] overflow-hidden">
        {/* Column search — SQL-style "contains" on one column of the loaded results. */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-3.5 border-b border-[#f0f2f5] bg-[#fafbfc]">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#6b7280] mr-1">Search in</span>
          <FilterSelect
            value={searchColumn}
            onValueChange={setSearchColumn}
            options={dataset.columns.map((c) => ({ value: c.key, label: c.label }))}
            ariaLabel="Column to search"
            className="h-9 rounded-xl py-0 max-w-[220px]"
            searchPlaceholder="Search columns…"
          />
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  applySearch()
                }
              }}
              placeholder={`Contains… e.g. "emaar" in ${searchColumnLabel}`}
              maxLength={DLD_SEARCH_TERM_MAX}
              aria-label={`Search ${searchColumnLabel}`}
              className="w-full h-9 pl-9 pr-9 rounded-xl border border-[#e5e7eb] bg-white text-sm text-[#0f2940] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5"
            />
            {(searchTerm || appliedSearch) && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-[#9ca3af] hover:text-[#0f2940] hover:bg-[#eef1f5]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={applySearch}
            disabled={loading || !searchTerm.trim()}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#0a2e57] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Find
          </button>
          {appliedSearch && (
            <div className="basis-full flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#6b7280]">
              {loading || !searchInfo ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Searching &ldquo;{appliedSearch.term}&rdquo;
                  {appliedSearch.scanRows > DLD_SEARCH_SCAN_STEP && <> in the first {money.format(appliedSearch.scanRows)} rows</>}
                  …
                </span>
              ) : (
                <>
                  <span>
                    {money.format(total)} match{total === 1 ? "" : "es"} for &ldquo;{appliedSearch.term}&rdquo; in{" "}
                    {dataset.columns.find((c) => c.key === appliedSearch.column)?.label ?? appliedSearch.column}
                    {searchInfo.mode === "exact" ? (
                      <> · exact number lookup across all {money.format(searchInfo.available)} rows</>
                    ) : searchInfo.truncated ? (
                      <span className="text-amber-700">
                        {" "}
                        · searched the first {money.format(searchInfo.scanned)} of {money.format(searchInfo.available)} rows
                      </span>
                    ) : (
                      <> · searched all {money.format(searchInfo.scanned)} rows</>
                    )}
                    {searchInfo.cacheHits > 0 && <span className="text-[#9ca3af]"> · {money.format(searchInfo.cacheHits * DLD_SEARCH_CHUNK)} rows from cache</span>}
                  </span>
                  {searchInfo.mode === "contains" && searchInfo.truncated && (
                    appliedSearch.scanRows < DLD_SEARCH_SCAN_MAX ? (
                      <button
                        type="button"
                        onClick={searchFurther}
                        className="inline-flex items-center h-7 px-2.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 font-semibold hover:bg-amber-100"
                      >
                        Search the next {money.format(Math.min(DLD_SEARCH_SCAN_STEP, searchInfo.available - searchInfo.scanned))} rows
                      </button>
                    ) : (
                      <span className="text-amber-700">Scan limit reached — narrow the filters above to search the rest.</span>
                    )
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-[#f0f2f5]">
          <div className="text-sm text-[#374151]">
            <span className="font-semibold text-[#0d1117]">{dataset.label}</span>
            <span className="text-[#9ca3af]"> · </span>
            {loading ? (
              <span className="text-[#9ca3af]">Loading…</span>
            ) : total > 0 ? (
              <span>
                Showing {money.format(from)}–{money.format(to)} of {money.format(total)}
              </span>
            ) : awaitingRequired ? (
              <span className="text-[#9ca3af]">Waiting for a date range</span>
            ) : (
              <span className="text-[#9ca3af]">No results</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-[#6b7280]">
            {!awaitingRequired && <RefreshButton onClick={retry} loading={loading} updatedAt={updatedAt} />}
            <span>Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(1)
              }}
              className="h-8 rounded-lg border border-[#e5e7eb] bg-white px-2 text-xs text-[#374151] focus:outline-none focus:border-[#001f3f]"
              aria-label="Rows per page"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mx-5 my-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <span>{error}</span>
            <button type="button" onClick={retry} className="shrink-0 font-semibold underline underline-offset-2">
              Retry
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#f8fafc] text-[11px] uppercase tracking-wide text-[#6b7280]">
              <tr>
                {dataset.columns.map((col) => {
                  const sortable = dataset.sortable.includes(col.key)
                  const active = sort.startsWith(`${col.key}_`)
                  const dir = active ? (sort.endsWith("_DESC") ? "desc" : "asc") : null
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      className={`px-4 py-3 font-semibold whitespace-nowrap ${isNumericFormat(col) ? "text-right" : "text-left"}`}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(col.key)}
                          className={`inline-flex items-center gap-1 hover:text-[#001f3f] ${active ? "text-[#001f3f]" : ""}`}
                        >
                          {col.label}
                          {dir === "asc" ? (
                            <ArrowUp className="w-3 h-3" />
                          ) : dir === "desc" ? (
                            <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        col.label
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f5]">
              {loading && rows.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {dataset.columns.map((col) => (
                      <td key={col.key} className="px-4 py-3">
                        <div className="h-3.5 rounded bg-[#eef1f5] animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={dataset.columns.length} className="px-4 py-12 text-center text-sm text-[#9ca3af]">
                    {awaitingRequired ? (
                      <span className="inline-flex items-center gap-2">
                        <CalendarRange className="w-4 h-4" />
                        Pick a date range above and press Search.
                      </span>
                    ) : error ? (
                      "Nothing to show."
                    ) : (
                      "No records match these filters."
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={`${row.RN ?? i}-${i}`} className={`hover:bg-[#f8fafc] ${loading ? "opacity-50" : ""}`}>
                    {dataset.columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 whitespace-nowrap text-[#374151] ${isNumericFormat(col) ? "text-right tabular-nums" : ""}`}
                        title={row[col.key] === null || row[col.key] === undefined ? undefined : String(row[col.key])}
                      >
                        <span className="block max-w-[28rem] truncate">{formatCell(col, row[col.key])}</span>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pager */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-[#f0f2f5] text-xs text-[#6b7280]">
          <span>
            Page {money.format(page)} of {money.format(totalPages)}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-[#e5e7eb] bg-white text-[#374151] hover:border-[#001f3f]/30 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-[#e5e7eb] bg-white text-[#374151] hover:border-[#001f3f]/30 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-[#9ca3af]">
        Source: Dubai Land Department open data (gateway.dubailand.gov.ae). Figures are as published by DLD and may lag by a day.
      </p>
    </div>
  )
}

// ─── One filter control ──────────────────────────────────────────────────────

function FilterControl({
  field,
  value,
  onChange,
  lookups,
  lookupErrors,
}: {
  field: DldFilterField
  value: string
  onChange: (v: string) => void
  lookups: Lookups
  lookupErrors: Partial<Record<DldLookupName, string>>
}) {
  const id = `dld-${field.param}`

  const options = useMemo<FilterSelectOption[]>(() => {
    if (field.kind === "select") {
      // Required selects (e.g. rents "Date") have no "All" — a value must be picked.
      const base = field.required ? [] : [{ value: "", label: "All" }]
      return [...base, ...(field.options ?? [])]
    }
    if (field.kind === "lookup" && field.lookup) {
      return [{ value: "", label: "All" }, ...(lookups[field.lookup] ?? [])]
    }
    return []
  }, [field, lookups])

  const label = (
    <label htmlFor={id} className="block text-sm font-medium text-[#0d1117] mb-1.5">
      {field.label}
      {field.required && <span className="text-rose-600"> *</span>}
    </label>
  )

  if (field.kind === "date") {
    return (
      <div>
        {label}
        <input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} className={INPUT_CLS} required={field.required} />
      </div>
    )
  }

  if (field.kind === "text") {
    return (
      <div>
        {label}
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={INPUT_CLS}
          maxLength={120}
        />
      </div>
    )
  }

  const lookupPending = field.kind === "lookup" && field.lookup && !lookups[field.lookup] && !lookupErrors[field.lookup]
  const lookupFailed = field.kind === "lookup" && field.lookup ? lookupErrors[field.lookup] : undefined

  return (
    <div>
      {label}
      <FilterSelect
        value={value}
        onValueChange={onChange}
        options={options}
        placeholder={lookupPending ? "Loading…" : "All"}
        disabled={!!lookupPending}
        ariaLabel={field.label}
        className="w-full max-w-none h-11 rounded-xl"
        searchPlaceholder={`Search ${field.label.toLowerCase()}…`}
      />
      {lookupFailed && <p className="mt-1 text-[11px] text-rose-600">Options unavailable: {lookupFailed}</p>}
    </div>
  )
}
