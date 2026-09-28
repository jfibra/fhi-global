"use client"

// Admin → Real Estate Data.
//
// A faithful port of the DLD open-data explorer: nine tabs, each with its own
// filter form and a paged, sortable table. Everything about a tab — its
// filters, default sort, and columns — comes from lib/dld-open-data.ts; this
// file only knows how to render a dataset, not what any dataset contains.
//
// Data flows through /api/admin/dld/{command} (see that route for why it is
// proxied). Lookups (areas, projects, property types) are fetched once per
// page load and shared across tabs.

import { useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Loader2, RefreshCw, Search } from "lucide-react"
import { FilterSelect, type FilterSelectOption } from "@/components/ui/filter-select"
import {
  DLD_DATASETS,
  DLD_DEFAULT_TAKE,
  DLD_TAB_ORDER,
  isoToDldDate,
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
} from "@/lib/dld-open-data"

const INPUT_CLS =
  "h-11 w-full rounded-xl border border-[#e5e7eb] bg-white px-3.5 text-sm text-[#0f2940] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5"

const PAGE_SIZES = [10, 25, 50, 100]

type Lookups = Partial<Record<DldLookupName, DldOption[]>>

function tabFromHash(): DldCommand {
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
      return String(raw).replace(/ /g, " ").trim() || "—"
  }
}

function isNumericFormat(col: DldColumn): boolean {
  return col.format === "money" || col.format === "area" || col.format === "number" || col.format === "percent"
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RealEstateDataClient() {
  const [tab, setTab] = useState<DldCommand>("transactions")
  const [lookups, setLookups] = useState<Lookups>({})
  const [lookupErrors, setLookupErrors] = useState<Partial<Record<DldLookupName, string>>>({})

  // URL-hash-driven tabs (deep-linkable: #rents, #brokers, …), same as System Logs.
  useEffect(() => {
    setTab(tabFromHash())
    const onHash = () => setTab(tabFromHash())
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

  const selectTab = (key: DldCommand) => {
    setTab(key)
    if (typeof window !== "undefined") window.history.replaceState(null, "", `#${key}`)
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="font-['Outfit'] text-2xl font-bold text-[#0d1117]">Real Estate Data</h1>
        <p className="text-sm text-[#6b7280] mt-0.5">
          Live open data from the Dubai Land Department — transactions, rents, projects, valuations, land, buildings, units, brokers and developers.
        </p>
      </div>

      {/* Tab bar */}
      <div className="mb-6 -mx-1 overflow-x-auto">
        <div className="mx-1 inline-flex min-w-full gap-1 p-1 rounded-2xl bg-[#eef1f5] border border-[#e8eaed]">
          {DLD_TAB_ORDER.map((key) => {
            const ds = DLD_DATASETS[key]
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectTab(key)}
                className={`flex-1 whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  tab === key ? "bg-white text-[#001f3f] shadow-sm" : "text-[#6b7280] hover:text-[#001f3f]"
                }`}
              >
                {ds.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Keyed on the tab so each dataset gets fresh form + table state. */}
      <DatasetPanel key={tab} dataset={DLD_DATASETS[tab]} lookups={lookups} lookupErrors={lookupErrors} />
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
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(dataset))
  // The filters the current table was loaded with — editing the form does not
  // refetch until "Search" is pressed, matching the DLD site.
  const [applied, setApplied] = useState<Record<string, string>>(() => initialValues(dataset))
  const [sort, setSort] = useState(dataset.defaultSort)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DLD_DEFAULT_TAKE)

  // One "query key" per (filters, sort, page, pageSize, retry attempt). The
  // table is loading whenever the last result was produced for a different
  // key — derived, so the effect never calls setState synchronously.
  const [attempt, setAttempt] = useState(0)
  const queryKey = useMemo(
    () => JSON.stringify({ applied, sort, page, pageSize, attempt }),
    [applied, sort, page, pageSize, attempt],
  )
  const [result, setResult] = useState<{ key: string; rows: DldRow[]; total: number; error: string | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      let next: { rows: DldRow[]; total: number; error: string | null }
      try {
        const res = await fetch(`/api/admin/dld/${dataset.command}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...toRequestBody(dataset, applied),
            P_TAKE: String(pageSize),
            P_SKIP: String((page - 1) * pageSize),
            P_SORT: sort,
          }),
        })
        const json = (await res.json()) as DldQueryResponse & { error?: string }
        next = res.ok
          ? { rows: json.rows ?? [], total: json.total ?? 0, error: null }
          : { rows: [], total: 0, error: json.error || "Request failed." }
      } catch {
        next = { rows: [], total: 0, error: "Could not load data. Check your connection and try again." }
      }
      if (!cancelled) setResult({ key: queryKey, ...next })
    })()
    return () => {
      cancelled = true
    }
    // queryKey encodes every input above; listing it alone keeps one fetch per change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, dataset])

  const loading = result?.key !== queryKey
  const rows = result?.rows ?? []
  const total = result?.total ?? 0
  const error = result?.error ?? null
  const retry = () => setAttempt((a) => a + 1)

  const missingRequired = dataset.filters.filter((f) => f.required && !(values[f.param] ?? "").trim())

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (missingRequired.length) return
    setPage(1)
    setApplied(values)
  }

  const onReset = () => {
    const fresh = initialValues(dataset)
    setValues(fresh)
    setApplied(fresh)
    setSort(dataset.defaultSort)
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
            disabled={loading || missingRequired.length > 0}
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
          {missingRequired.length > 0 && (
            <span className="text-xs text-rose-600">
              {missingRequired.map((f) => f.label).join(", ")} required.
            </span>
          )}
        </div>
      </form>

      {/* Results */}
      <div className="bg-white rounded-2xl border border-[#e8eaed] overflow-hidden">
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
            ) : (
              <span className="text-[#9ca3af]">No results</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-[#6b7280]">
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
                    {error ? "Nothing to show." : "No records match these filters."}
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
