"use client"

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react"
import {
  ArchiveRestore,
  ArrowDownWideNarrow,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  History,
  Loader2,
  Pencil,
  Search,
  Trash2,
} from "lucide-react"
import { RoleBadge } from "@/components/role-badge"
import { UserAvatar } from "@/components/user-avatar"
import {
  type AdminListingRow,
  type AdminListingsSummary,
  type DeveloperOption,
  fetchAdminListings,
  fetchDeveloperOptions,
  setAdminListingDeleted,
} from "@/lib/admin-listings-service"
import {
  type MenuItem,
  BRAND_GRADIENT,
  Chip,
  ChipDivider,
  DISPLAY,
  LISTING_GRID,
  ListingCard,
  ListingRow,
  Portal,
  RowMenu,
  ToolbarActions,
  ToolbarSearch,
  ToolbarSelect,
  ViewToggle,
  WHITE_PAGE,
} from "./listing-ui"
import { publicPath } from "./listing-card-facts"
import { ListingEditDialog } from "./listing-edit-dialog"
import { ListingActivityDrawer } from "./listing-activity-drawer"

// Admin "All Listings" — the same cards, chips and toolbar as an agent's own
// listings page (both render from ./listing-ui), over every agent's listings.
//
// Three things differ, all because of what this view is:
//  • the rows come from the service-role API (/api/admin/listings), so paging,
//    filtering and sorting happen on the SERVER — the chip counts come from that
//    endpoint's org-wide summary, not from the page in hand,
//  • each card names the owning agent,
//  • no marketing tools. Flyer/Poster/share-card writes are scoped to the owning
//    agent (saveAgentListingOgCard filters on agent_id), so offering them to an
//    admin looking at someone else's listing would silently fail. Admin actions
//    are view / edit / activity / delete / restore instead.

type SortKey = "updated_desc" | "created_desc" | "price_desc" | "price_asc" | "title_asc"

const SORT_LABELS: Record<SortKey, string> = {
  updated_desc: "Recently edited",
  created_desc: "Newest first",
  price_desc: "Price: high to low",
  price_asc: "Price: low to high",
  title_asc: "Title A–Z",
}

const SORT_QUERY: Record<SortKey, { sort: "updated_at" | "created_at" | "title" | "price"; dir: "asc" | "desc" }> = {
  updated_desc: { sort: "updated_at", dir: "desc" },
  created_desc: { sort: "created_at", dir: "desc" },
  price_desc: { sort: "price", dir: "desc" },
  price_asc: { sort: "price", dir: "asc" },
  title_asc: { sort: "title", dir: "asc" },
}

const PER_PAGE = 24

type StatusFilter = "all" | "published" | "draft" | "archived"
type KindFilter = "all" | "sale" | "rent"

type Toast = { id: number; variant: "success" | "error"; message: string }
let toastSeq = 0

// ─── Confirm ──────────────────────────────────────────────────────────────────

type ConfirmState = {
  title: string
  message: string
  confirmLabel: string
  action: () => void | Promise<void>
}

function ConfirmDialog({ state, onCancel }: { state: ConfirmState; onCancel: () => void }) {
  const [busy, setBusy] = useState(false)
  return (
    <Portal>
      <div className="fixed inset-0 z-[230] flex items-center justify-center p-4">
        <button
          type="button"
          aria-label="Cancel"
          className="absolute inset-0 bg-[#001f3f]/40 backdrop-blur-sm"
          onClick={onCancel}
        />
        <div
          role="dialog"
          aria-modal="true"
          className="relative bg-white rounded-[24px] p-6 max-w-sm w-full shadow-2xl border border-white/60"
        >
          <h3 className={`${DISPLAY} text-base font-bold text-[#0d1117]`}>{state.title}</h3>
          <p className="text-sm text-[#6b7280] leading-relaxed mt-1.5 mb-6">{state.message}</p>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 rounded-full border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setBusy(true)
                void Promise.resolve(state.action()).finally(() => setBusy(false))
              }}
              className="px-5 py-2.5 rounded-full bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 transition-all disabled:opacity-60 inline-flex items-center gap-2"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {state.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AllListingsClient() {
  const [rows, setRows] = useState<AdminListingRow[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<AdminListingsSummary | null>(null)
  const [developers, setDevelopers] = useState<DeveloperOption[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  /** Bumped to re-run the fetch effect without changing any filter. */
  const [reloadKey, setReloadKey] = useState(0)

  const [searchInput, setSearchInput] = useState("")
  // Server-side search: defer so typing doesn't fire a request per keystroke.
  const search = useDeferredValue(searchInput)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [kindFilter, setKindFilter] = useState<KindFilter>("all")
  const [developerId, setDeveloperId] = useState("all")
  const [showDeleted, setShowDeleted] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>("updated_desc")
  const [view, setView] = useState<"grid" | "list">("grid")
  const [page, setPage] = useState(1)

  const [editTarget, setEditTarget] = useState<AdminListingRow | null>(null)
  const [activityTarget, setActivityTarget] = useState<AdminListingRow | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((variant: Toast["variant"], message: string) => {
    const id = ++toastSeq
    setToasts((t) => [...t, { id, variant, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const safePage = Math.min(page, totalPages)

  // One effect owns the fetch; every filter is a dependency, so changing any of
  // them re-queries the server. All setState sits inside the async body.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      setRefreshing(true)
      const { sort, dir } = SORT_QUERY[sortKey]
      const res = await fetchAdminListings({
        page: safePage,
        perPage: PER_PAGE,
        search: search.trim() || undefined,
        developerId: developerId === "all" ? undefined : developerId,
        status: statusFilter === "all" ? undefined : statusFilter,
        kind: kindFilter === "all" ? undefined : kindFilter,
        showDeleted,
        sort,
        dir,
      })
      if (cancelled) return
      if (res.error) showToast("error", res.error)
      else {
        setRows(res.data)
        setTotal(res.total)
        if (res.summary) setSummary(res.summary)
      }
      setLoading(false)
      setRefreshing(false)
    })()
    return () => {
      cancelled = true
    }
  }, [
    safePage,
    search,
    developerId,
    statusFilter,
    kindFilter,
    showDeleted,
    sortKey,
    reloadKey,
    showToast,
  ])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await fetchDeveloperOptions()
      if (!cancelled) setDevelopers(data)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filtersActive =
    searchInput.trim() !== "" ||
    statusFilter !== "all" ||
    kindFilter !== "all" ||
    developerId !== "all" ||
    showDeleted

  const clearFilters = () => {
    setSearchInput("")
    setStatusFilter("all")
    setKindFilter("all")
    setDeveloperId("all")
    setShowDeleted(false)
    setPage(1)
  }

  /** Every filter change goes back to page 1 — page 7 of the old result set is
   *  meaningless once the query changes. */
  const withReset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setPage(1)
  }

  const setDeleted = async (row: AdminListingRow, deleted: boolean) => {
    const { error } = await setAdminListingDeleted(row.id, deleted)
    if (error) {
      showToast("error", error)
      return
    }
    showToast("success", deleted ? "Listing deleted." : "Listing restored.")
    setReloadKey((k) => k + 1)
  }

  const askDelete = (row: AdminListingRow) =>
    setConfirm({
      title: "Delete this listing?",
      message: `“${row.title}” comes off the public site and out of ${
        row.agent?.fullname ?? "the agent"
      }'s list. You can restore it from here.`,
      confirmLabel: "Delete",
      action: async () => {
        setConfirm(null)
        await setDeleted(row, true)
      },
    })

  const menuFor = (row: AdminListingRow): MenuItem[] => {
    const isDeleted = Boolean(row.deleted_at)
    const items: MenuItem[] = []
    if (row.status === "published" && !isDeleted) {
      items.push({
        label: "Open public page",
        icon: ExternalLink,
        onSelect: () => window.open(publicPath(row), "_blank", "noopener,noreferrer"),
      })
    }
    items.push({ label: "Activity log", icon: History, onSelect: () => setActivityTarget(row) })
    if (!isDeleted) items.push({ label: "Edit listing", icon: Pencil, onSelect: () => setEditTarget(row) })
    if (isDeleted) {
      items.push({ label: "Restore", icon: ArchiveRestore, onSelect: () => void setDeleted(row, false) })
    } else {
      items.push({ label: "Delete", icon: Trash2, onSelect: () => askDelete(row), destructive: true })
    }
    return items
  }

  /** The owning agent — the one thing this view shows that the agent's own
   *  listings page has no need for. */
  const agentMeta = (row: AdminListingRow) => (
    <span className="flex items-center gap-1.5 min-w-0">
      <UserAvatar name={row.agent?.fullname ?? "Unknown"} size={18} />
      <span className="text-[11px] font-medium text-[#374151] truncate">
        {row.agent?.fullname ?? "Unknown agent"}
      </span>
      {row.agent?.role && <RoleBadge role={row.agent.role} />}
    </span>
  )

  const cardFooter = (row: AdminListingRow) => {
    const isDeleted = Boolean(row.deleted_at)
    return (
      <>
        {isDeleted ? (
          <button
            type="button"
            onClick={() => void setDeleted(row, false)}
            className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 transition-colors whitespace-nowrap"
          >
            <ArchiveRestore className="w-3 h-3" /> Restore
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditTarget(row)}
              className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold text-[#001f3f] hover:bg-[#001f3f]/[0.07] transition-colors whitespace-nowrap"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
            <button
              type="button"
              onClick={() => setActivityTarget(row)}
              className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold text-[#0e7490] hover:bg-[#0891b2]/10 transition-colors whitespace-nowrap"
            >
              <History className="w-3 h-3" /> Activity
            </button>
          </>
        )}
        <RowMenu items={menuFor(row)} label={`More actions for ${row.title}`} />
      </>
    )
  }

  const rowFooter = (row: AdminListingRow) => (
    <>
      <button
        type="button"
        onClick={() => setActivityTarget(row)}
        title="Activity log"
        className="w-7 h-7 flex items-center justify-center rounded-lg text-[#0e7490] hover:bg-[#0891b2]/10"
      >
        <History className="w-3.5 h-3.5" />
      </button>
      {!row.deleted_at && (
        <button
          type="button"
          onClick={() => setEditTarget(row)}
          title="Edit listing"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#001f3f] hover:bg-[#001f3f]/[0.07]"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
      <RowMenu items={menuFor(row)} label={`More actions for ${row.title}`} />
    </>
  )

  const developerOptions = useMemo(
    () => [
      { value: "all", label: "All developers" },
      ...developers.map((d) => ({ value: d.id, label: d.name })),
    ],
    [developers],
  )

  const statusChips: { value: StatusFilter; label: string; count?: number }[] = [
    { value: "all", label: "All", count: summary?.total },
    { value: "published", label: "Published", count: summary?.published },
    { value: "draft", label: "Draft", count: summary?.draft },
    { value: "archived", label: "Archived", count: summary?.archived },
  ]

  return (
    <>
      <div className={`space-y-3 ${WHITE_PAGE}`}>
        {/* Header — this view needs a title; an agent's own page doesn't, since
            the sidebar row already says "My listings". */}
        <div className="flex items-center gap-3">
          <div className={`${BRAND_GRADIENT} w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm`}>
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h1 className={`${DISPLAY} text-[22px] leading-tight font-bold text-[#101828]`}>All Listings</h1>
            <p className="text-[13px] text-[#667085] tabular-nums">
              {summary ? `${summary.total} live across every agent` : "Every agent's listings"}
              {summary && summary.deleted > 0 ? ` · ${summary.deleted} deleted` : ""}
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <ToolbarSearch
            value={searchInput}
            onChange={withReset(setSearchInput)}
            placeholder="Search listing titles…"
          />

          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <ToolbarSelect
              icon={ArrowDownWideNarrow}
              label="Sort by"
              value={sortKey}
              onChange={(v) => withReset(setSortKey)(v as SortKey)}
              options={(Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({
                value: k,
                label: SORT_LABELS[k],
              }))}
            />
            <ToolbarSelect
              icon={Building2}
              label="Developer"
              value={developerId}
              onChange={withReset(setDeveloperId)}
              options={developerOptions}
            />
            <ToolbarActions
              onClear={clearFilters}
              clearDisabled={!filtersActive}
              onRefresh={() => setReloadKey((k) => k + 1)}
              refreshing={refreshing}
            />
          </div>
        </div>

        {/* Chips. Counts are org-wide from the API summary — the page in hand is
            only one server page, so it can't count anything itself. */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {statusChips.map((c) => (
              <Chip
                key={c.value}
                active={statusFilter === c.value}
                count={c.count}
                onClick={() => withReset(setStatusFilter)(c.value)}
              >
                {c.label}
              </Chip>
            ))}

            <ChipDivider />

            <Chip
              active={kindFilter === "sale"}
              count={summary?.sale}
              onClick={() => withReset(setKindFilter)(kindFilter === "sale" ? "all" : "sale")}
            >
              For sale
            </Chip>
            <Chip
              active={kindFilter === "rent"}
              count={summary?.rent}
              onClick={() => withReset(setKindFilter)(kindFilter === "rent" ? "all" : "rent")}
            >
              For rent
            </Chip>

            <ChipDivider />

            <Chip
              active={showDeleted}
              count={summary?.deleted}
              onClick={() => withReset(setShowDeleted)(!showDeleted)}
            >
              Deleted
            </Chip>
          </div>

          <ViewToggle view={view} onChange={setView} />
        </div>

        {/* Results */}
        {loading ? (
          <div className={LISTING_GRID}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-[268px] rounded-2xl bg-white border border-[#e6eaf1] animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-[22px] border border-[#e6eaf1] bg-white shadow-sm p-10 text-center">
            <span className="w-14 h-14 rounded-2xl bg-[#f4f6f9] text-[#9ca3af] flex items-center justify-center mx-auto mb-4">
              <Search className="w-6 h-6" />
            </span>
            <h3 className={`${DISPLAY} text-lg font-bold text-[#0d1117]`}>No listings found</h3>
            <p className="text-sm text-[#6b7280] mt-1.5">
              {filtersActive ? "Try widening or clearing the filters." : "No agent has created a listing yet."}
            </p>
            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 h-11 px-5 rounded-xl border border-[#e5e7eb] text-sm font-bold text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] transition-all"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : view === "grid" ? (
          <div className={LISTING_GRID}>
            {rows.map((row) => (
              <ListingCard
                key={row.id}
                row={row}
                deleted={Boolean(row.deleted_at)}
                meta={agentMeta(row)}
                footer={cardFooter(row)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[22px] border border-[#e6eaf1] bg-white shadow-sm overflow-hidden divide-y divide-[#f1f3f6]">
            {rows.map((row) => (
              <ListingRow
                key={row.id}
                row={row}
                deleted={Boolean(row.deleted_at)}
                meta={agentMeta(row)}
                footer={rowFooter(row)}
              />
            ))}
          </div>
        )}

        {/* Pagination — server-side, unlike the agent page's single fetch. */}
        {total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-[#9ca3af] tabular-nums">
              Showing {(safePage - 1) * PER_PAGE + 1}–{Math.min(safePage * PER_PAGE, total)} of {total}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  aria-label="Previous page"
                  className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#e6eaf1] bg-white text-[#6b7280] hover:border-[#001f3f] hover:text-[#001f3f] disabled:opacity-40 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pg =
                    totalPages <= 5 ? i + 1 : Math.min(Math.max(1, safePage - 2), totalPages - 4) + i
                  return (
                    <button
                      key={pg}
                      type="button"
                      onClick={() => setPage(pg)}
                      aria-current={pg === safePage ? "page" : undefined}
                      className={`w-8 h-8 rounded-xl text-[12px] font-bold border transition-all tabular-nums ${
                        pg === safePage
                          ? `${BRAND_GRADIENT} border-transparent`
                          : "bg-white border-[#e6eaf1] text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f]"
                      }`}
                    >
                      {pg}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  aria-label="Next page"
                  className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#e6eaf1] bg-white text-[#6b7280] hover:border-[#001f3f] hover:text-[#001f3f] disabled:opacity-40 transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ListingEditDialog
        listing={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={(msg) => {
          setEditTarget(null)
          showToast("success", msg)
          setReloadKey((k) => k + 1)
        }}
        onError={(msg) => showToast("error", msg)}
      />

      {activityTarget && (
        <ListingActivityDrawer listing={activityTarget} onClose={() => setActivityTarget(null)} />
      )}

      {confirm && <ConfirmDialog state={confirm} onCancel={() => setConfirm(null)} />}

      <Portal>
        <div
          className="fixed bottom-4 right-4 z-[240] flex flex-col gap-2 pointer-events-none"
          aria-live="polite"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm border ${
                t.variant === "success"
                  ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                  : "bg-rose-50 text-rose-900 border-rose-200"
              }`}
            >
              {t.message}
            </div>
          ))}
        </div>
      </Portal>
    </>
  )
}
