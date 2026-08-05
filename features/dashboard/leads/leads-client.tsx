"use client"

// The admin Emails page — the old Leads Inquiries table rebuilt as a
// Gmail-style client. Left pane lists conversations (each "Inquire Now" lead
// is an incoming email), the right pane reads the selected one, replies are
// real emails sent through SMTP and recorded on the thread, and Compose sends
// a standalone email to any address. Folders: Inbox (leads), Sent (everything
// sent from the dashboard), Archived (soft-deleted leads).
//
// Selection and folder live in the URL (?folder=&open=) so refresh/back and
// shared links restore the same view — same pattern as the Account Directory.

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Archive, ArrowLeft, Building2, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  Clock, Globe, Inbox, Loader2, Mail, MailOpen, MessageCircle, MonitorSmartphone,
  PenSquare, Phone, PhoneCall, RefreshCw, RotateCcw, Search, Send, Star, Tag, Trash2, Undo2, X,
} from "lucide-react"
import { UserAvatar } from "@/components/user-avatar"
import { formatDateTime, relativeTime } from "@/lib/utils"
import {
  type Inquiry,
  type InquiriesSummary,
  type InquiryCategory,
  type InquiryStatus,
  type SentEmail,
  fetchEmailThread,
  fetchInquiries,
  fetchInquiry,
  fetchSentEmails,
  deleteSentEmail,
  markEmailThreadRead,
  sendComposedEmail,
  sendInquiryReply,
  setInquiryDeleted,
  setInquiryRead,
  setInquiryStarred,
  setInquiryStatus,
  syncInbox,
  LOOKING_FOR_LABELS,
  CATEGORY_LABELS,
} from "@/lib/inquiries-service"

const PER_PAGE = 25
type Folder = "inbox" | "starred" | "sent" | "archived"

/** Gmail-style time: clock time today, "Aug 5" this year, date otherwise. */
function mailTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function StatusChip({ row }: { row: Inquiry }) {
  if (row.deleted_at) {
    return <span className="px-2 py-0.5 text-[10px] font-semibold bg-rose-50 text-rose-600">Archived</span>
  }
  if (row.status === "contacted") {
    return <span className="px-2 py-0.5 text-[10px] font-semibold bg-sky-50 text-sky-700">Contacted</span>
  }
  if (row.status === "closed") {
    return <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700">Closed</span>
  }
  return null
}

/** Square icon button used across the reading-pane toolbar. */
function IconBtn({
  title, onClick, disabled, tone = "default", children,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  tone?: "default" | "danger" | "success"
  children: ReactNode
}) {
  const tones = {
    default: "text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#001f3f]",
    danger: "text-[#5f6368] hover:bg-rose-50 hover:text-rose-600",
    success: "text-[#5f6368] hover:bg-emerald-50 hover:text-emerald-600",
  }
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`w-9 h-9 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${tones[tone]}`}
    >
      {children}
    </button>
  )
}

export function LeadsClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const folder = (searchParams.get("folder") as Folder) || "inbox"
  const openId = searchParams.get("open") || ""

  // ── list state ──────────────────────────────────────────────────────────
  const [rows, setRows] = useState<Inquiry[]>([])
  const [sentRows, setSentRows] = useState<SentEmail[]>([])
  // Unread replies per correspondent (lowercased address → count).
  const [sentUnread, setSentUnread] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<InquiriesSummary | null>(null)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [category, setCategory] = useState("")
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  // ── reading pane state ──────────────────────────────────────────────────
  const [thread, setThread] = useState<{ inquiry: Inquiry; emails: SentEmail[] } | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  // Bumped when the inbox sync lands new replies, so an open thread refetches.
  const [threadVersion, setThreadVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  // ── compose window (null = closed; fields prefill a reply) ───────────────
  const [compose, setCompose] = useState<{ to?: string; toName?: string; subject?: string } | null>(null)

  // ── row selection (inbox/archived) — Gmail checkboxes for bulk actions ───
  // Always a subset of the current page: load() resets it on every fetch, so
  // pagination, filters and folder switches can't carry hidden selections.
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const unread = summary?.unread ?? 0

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const sp = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") sp.delete(k)
        else sp.set(k, v)
      }
      const qs = sp.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  const openFolder = (next: Folder) => {
    setPage(1)
    setParams({ folder: next === "inbox" ? null : next, open: null })
  }

  // ── loads ───────────────────────────────────────────────────────────────
  // Sequence guard: switching folders fires a new load while the previous one
  // may still be in flight — without it, a slow Sent request resolving late
  // stomps the Inbox you already switched back to.
  const loadSeq = useRef(0)
  // Stale-while-revalidate: the last snapshot per folder/page/filter combo.
  // Returning to a folder paints it instantly from here (no skeleton) while a
  // silent refresh runs underneath — the Gmail feel.
  const cacheRef = useRef(new Map<string, { rows?: Inquiry[]; sent?: SentEmail[]; total: number }>())
  const load = useCallback(async () => {
    const seq = ++loadSeq.current
    const cacheKey = `${folder}|${page}|${search}|${status}|${category}`
    const cached = cacheRef.current.get(cacheKey)
    if (cached) {
      if (folder === "sent") setSentRows(cached.sent ?? [])
      else setRows(cached.rows ?? [])
      setTotal(cached.total)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setListError(null)
    setSelected(new Set())
    try {
      if (folder === "sent") {
        const { data, total: t, unreadByAddress, error } = await fetchSentEmails({ page, perPage: PER_PAGE, search })
        if (seq !== loadSeq.current) return
        if (error) {
          // A snapshot on screen beats an error page — keep it, note the failure.
          if (cached) setNotice(error)
          else { setListError(error); setSentRows([]); setTotal(0) }
          return
        }
        setSentRows(data)
        setSentUnread(unreadByAddress)
        setTotal(t)
        cacheRef.current.set(cacheKey, { sent: data, total: t })
        // Keep the Sent tab counter honest while browsing this folder.
        if (!search) setSummary((s) => (s ? { ...s, sent: t } : { total: 0, new: 0, sent: t }))
      } else {
        const { data, total: t, summary: s, error } = await fetchInquiries({
          page, perPage: PER_PAGE, search,
          status: status || undefined,
          category: category || undefined,
          archivedOnly: folder === "archived",
          starredOnly: folder === "starred",
        })
        if (seq !== loadSeq.current) return
        if (error) {
          if (cached) setNotice(error)
          else { setListError(error); setRows([]); setTotal(0) }
          return
        }
        setRows(data)
        setTotal(t)
        setSummary(s)
        cacheRef.current.set(cacheKey, { rows: data, total: t })
      }
    } finally {
      if (seq === loadSeq.current) setLoading(false)
    }
  }, [folder, page, search, status, category])

  // Deferred a tick so state updates happen outside the effect body
  // (react-hooks/set-state-in-effect) and rapid filter changes coalesce.
  useEffect(() => {
    const t = setTimeout(() => { void load() }, 0)
    return () => clearTimeout(t)
  }, [load])

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  // Pull lead replies from the company mailbox once per visit. Silent when
  // nothing is new (or IMAP isn't configured); on fresh replies the list and
  // any open thread refetch so the conversation shows both sides.
  const syncedRef = useRef(false)
  useEffect(() => {
    if (syncedRef.current) return
    syncedRef.current = true
    const t = setTimeout(async () => {
      const { ingested } = await syncInbox()
      if (ingested > 0) {
        setNotice(`${ingested} new ${ingested === 1 ? "reply" : "replies"} from your mailbox.`)
        setThreadVersion((v) => v + 1)
        void load()
      }
    }, 100)
    return () => clearTimeout(t)
  }, [load])

  /** Manual refresh = check the mailbox first, then reload the list. */
  const handleRefresh = async () => {
    setSyncing(true)
    const { ingested, error } = await syncInbox()
    setSyncing(false)
    if (error) setNotice(error)
    if (ingested > 0) {
      setNotice(`${ingested} new ${ingested === 1 ? "reply" : "replies"} from your mailbox.`)
      setThreadVersion((v) => v + 1)
    }
    void load()
  }

  // Update one conversation everywhere it appears: the visible list, the open
  // thread, and the folder snapshots — otherwise the instant repaint on the
  // next folder switch would briefly resurrect the old read/status state.
  const patchRow = useCallback((id: string, patch: Partial<Inquiry>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setThread((t) => (t && t.inquiry.id === id ? { ...t, inquiry: { ...t.inquiry, ...patch } } : t))
    for (const [key, snap] of cacheRef.current) {
      if (snap.rows?.some((r) => r.id === id)) {
        cacheRef.current.set(key, {
          ...snap,
          rows: snap.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })
      }
    }
  }, [])

  // Load the open conversation. Also marks it read (deep links included) —
  // opening mail is what "read" means. Fire-and-forget; unread counts adjust
  // locally so the badge doesn't wait a round trip. Deferred a tick so no
  // state is set synchronously in the effect body.
  useEffect(() => {
    let cancelled = false
    const t = setTimeout(async () => {
      if (!openId || folder === "sent") { setThread(null); return }
      setThreadLoading(true)
      const { data, emails, error } = await fetchInquiry(openId)
      if (cancelled) return
      setThreadLoading(false)
      if (error || !data) { setThread(null); setNotice(error ?? "Conversation not found."); return }
      setThread({ inquiry: data, emails })
      if (!data.read_at) {
        void setInquiryRead(data.id, true)
        patchRow(data.id, { read_at: new Date().toISOString() })
        setSummary((s) => (s ? { ...s, unread: Math.max(0, (s.unread ?? 0) - 1) } : s))
      }
    }, 0)
    return () => { cancelled = true; clearTimeout(t) }
  }, [openId, folder, patchRow, threadVersion])

  // Toast auto-dismiss.
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])

  // ── pane actions ────────────────────────────────────────────────────────
  const markUnread = async (lead: Inquiry) => {
    const { error } = await setInquiryRead(lead.id, false)
    if (error) { setNotice(error); return }
    patchRow(lead.id, { read_at: null })
    setSummary((s) => (s ? { ...s, unread: (s.unread ?? 0) + 1 } : s))
    setParams({ open: null })
  }

  /** A correspondence was opened — clear its unread badge everywhere. */
  const onCorrespondenceRead = useCallback((address: string, count: number) => {
    setSentUnread((m) => {
      if (!(address in m)) return m
      const next = { ...m }
      delete next[address]
      return next
    })
    setSummary((s) => (s ? { ...s, sentUnread: Math.max(0, (s.sentUnread ?? 0) - count) } : s))
  }, [])

  /** Optimistic star/unstar — flips instantly, rolls back if the save fails. */
  const toggleStar = async (row: Inquiry) => {
    const starring = !row.starred_at
    patchRow(row.id, { starred_at: starring ? new Date().toISOString() : null })
    setSummary((s) => (s ? { ...s, starred: Math.max(0, (s.starred ?? 0) + (starring ? 1 : -1)) } : s))
    const { error } = await setInquiryStarred(row.id, starring)
    if (error) {
      patchRow(row.id, { starred_at: row.starred_at ?? null })
      setSummary((s) => (s ? { ...s, starred: Math.max(0, (s.starred ?? 0) + (starring ? -1 : 1)) } : s))
      setNotice(error)
      return
    }
    // Unstarring while inside Starred removes the row from this folder.
    if (folder === "starred" && !starring) void load()
  }

  const changeStatus = async (lead: Inquiry, next: InquiryStatus, message: string) => {
    setBusy(true)
    const { error } = await setInquiryStatus(lead.id, next)
    setBusy(false)
    if (error) { setNotice(error); return }
    patchRow(lead.id, {
      status: next,
      contacted_at: next === "new" ? null : lead.contacted_at ?? new Date().toISOString(),
    })
    setNotice(message)
  }

  const toggleArchive = async (lead: Inquiry) => {
    const archiving = !lead.deleted_at
    setBusy(true)
    const { error } = await setInquiryDeleted(lead.id, archiving)
    setBusy(false)
    if (error) { setNotice(error); return }
    setNotice(archiving ? "Conversation archived." : "Conversation restored.")
    setRows((rs) => rs.filter((r) => r.id !== lead.id))
    setParams({ open: null })
    void load()
  }

  // ── bulk selection ──────────────────────────────────────────────────────
  const pageIds = folder === "sent" ? sentRows.map((r) => r.id) : rows.map((r) => r.id)
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))

  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(pageIds))
  }

  /** Archive (deleted=true) or restore (false) every checked conversation. */
  const bulkSetDeleted = async (deleted: boolean) => {
    const ids = [...selected]
    if (ids.length === 0) return
    setBusy(true)
    const results = await Promise.all(ids.map((id) => setInquiryDeleted(id, deleted)))
    setBusy(false)
    const failed = results.filter((r) => r.error).length
    const done = ids.length - failed
    setNotice(
      failed
        ? `${done} ${deleted ? "archived" : "restored"}, ${failed} failed — try again.`
        : `${done} conversation${done === 1 ? "" : "s"} ${deleted ? "archived" : "restored"}.`,
    )
    if (openId && ids.includes(openId)) setParams({ open: null })
    void load()
  }

  /** Sent folder: permanently delete the checked records (confirmed first). */
  const bulkDeleteSent = async () => {
    const ids = [...selected]
    if (ids.length === 0) return
    const label = ids.length === 1 ? "this sent email" : `${ids.length} sent emails`
    if (!window.confirm(`Delete ${label}? This can't be undone.`)) return
    setBusy(true)
    const results = await Promise.all(ids.map((id) => deleteSentEmail(id)))
    setBusy(false)
    const failed = results.filter((r) => r.error).length
    const done = ids.length - failed
    setNotice(
      failed
        ? `${done} deleted, ${failed} failed — try again.`
        : `${done} sent email${done === 1 ? "" : "s"} deleted.`,
    )
    setSummary((s) => (s ? { ...s, sent: Math.max(0, (s.sent ?? 0) - done) } : s))
    if (openId && ids.includes(openId)) setParams({ open: null })
    void load()
  }

  const selectedSent = useMemo(
    () => (folder === "sent" ? sentRows.find((r) => r.id === openId) ?? null : null),
    [folder, sentRows, openId],
  )

  const paneOpen = folder === "sent" ? Boolean(selectedSent) : Boolean(openId)

  // ── render ──────────────────────────────────────────────────────────────
  // `urgent` renders as the gold attention badge (unread things); `count` is
  // the quiet gray total shown when nothing needs attention.
  const folderItems: Array<{ key: Folder; label: string; icon: typeof Inbox; count?: number; urgent?: number }> = [
    { key: "inbox", label: "Inbox", icon: Inbox, urgent: unread },
    { key: "starred", label: "Starred", icon: Star, count: summary?.starred ?? 0 },
    { key: "sent", label: "Sent", icon: Send, count: summary?.sent ?? 0, urgent: summary?.sentUnread ?? 0 },
    { key: "archived", label: "Archived", icon: Archive },
  ]
  const categoryItems: Array<{ key: InquiryCategory; label: string; count: number }> = (
    ["off_plan", "ready", "rent"] as InquiryCategory[]
  ).map((key) => ({ key, label: CATEGORY_LABELS[key], count: summary?.categories?.[key] ?? 0 }))

  // Rail categories filter the inquiry folders; from Sent they jump to Inbox.
  const pickCategory = (key: InquiryCategory) => {
    const next = category === key ? "" : key
    setCategory(next)
    setPage(1)
    if (folder === "sent") setParams({ folder: null, open: null })
  }

  return (
    <div className="space-y-4">
      {notice && (
        <div className="border border-[#e5e8ec] bg-white px-4 py-2.5 text-sm text-[#374151] shadow-sm">{notice}</div>
      )}

      {/* Mail client */}
      <div className="bg-white border border-[#e5e8ec] overflow-hidden flex flex-col h-[calc(100vh-170px)] min-h-[560px]">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-b border-[#f0f0f0]">
          <button
            type="button"
            onClick={() => setCompose({})}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#d6b357] text-[#1a1408] text-sm font-bold hover:brightness-95 transition-all shadow-sm"
          >
            <PenSquare className="w-4 h-4" /> Compose
          </button>

          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
            <input
              className="w-full pl-11 pr-4 py-2.5 border border-[#e5e8ec] bg-white text-sm focus:outline-none focus:border-[#001f3f] transition-all"
              placeholder={folder === "sent" ? "Search sent emails…" : "Search by name, email, phone, or project…"}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          {folder !== "sent" && (
            <>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1) }}
                className="px-3.5 py-2.5 border border-[#e5e8ec] bg-white text-xs font-semibold text-[#374151] focus:outline-none focus:border-[#001f3f]"
              >
                <option value="">All status</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="closed">Closed</option>
              </select>
              {/* Desktop picks categories from the rail; this is the mobile fallback. */}
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setPage(1) }}
                className="md:hidden px-3.5 py-2.5 border border-[#e5e8ec] bg-white text-xs font-semibold text-[#374151] focus:outline-none focus:border-[#001f3f]"
              >
                <option value="">All categories</option>
                <option value="off_plan">Off Plan</option>
                <option value="ready">Ready</option>
                <option value="rent">Rent</option>
              </select>
            </>
          )}

          <IconBtn title="Check for new mail" onClick={() => void handleRefresh()}>
            <RefreshCw className={`w-4 h-4 ${loading || syncing ? "animate-spin" : ""}`} />
          </IconBtn>
        </div>

        {/* Panes */}
        <div className="flex flex-1 min-h-0">
          {/* Mailbox rail — folders + categories (desktop) */}
          <aside className="hidden md:flex flex-col w-[190px] shrink-0 border-r border-[#f0f0f0] py-3 overflow-y-auto">
            <p className="px-4 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">Mailbox</p>
            {folderItems.map((f) => {
              const active = folder === f.key
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => openFolder(f.key)}
                  className={`relative w-full flex items-center gap-2.5 px-4 py-2 text-[13px] font-semibold transition-colors ${
                    active ? "bg-[#faf7ee] text-[#0d1117]" : "text-[#5f6368] hover:bg-[#f5f6f8] hover:text-[#0d1117]"
                  }`}
                >
                  {active && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#d6b357]" aria-hidden="true" />}
                  <f.icon className={`w-4 h-4 shrink-0 ${active ? "text-[#b8913f]" : ""}`} />
                  <span className="flex-1 text-left truncate">{f.label}</span>
                  {(f.urgent ?? 0) > 0 ? (
                    <span className="min-w-[18px] h-[18px] px-1 text-[10px] font-bold flex items-center justify-center bg-[#d6b357] text-[#1a1408]">
                      {f.urgent}
                    </span>
                  ) : (f.count ?? 0) > 0 ? (
                    <span className="text-[11px] font-semibold text-[#9ca3af]">{f.count}</span>
                  ) : null}
                </button>
              )
            })}

            <p className="px-4 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">Categories</p>
            {categoryItems.map((c) => {
              const active = category === c.key
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => pickCategory(c.key)}
                  title={active ? `Stop filtering by ${c.label}` : `Show only ${c.label} inquiries`}
                  className={`relative w-full flex items-center gap-2.5 px-4 py-2 text-[13px] font-semibold transition-colors ${
                    active ? "bg-[#faf7ee] text-[#0d1117]" : "text-[#5f6368] hover:bg-[#f5f6f8] hover:text-[#0d1117]"
                  }`}
                >
                  {active && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#d6b357]" aria-hidden="true" />}
                  <Tag className={`w-4 h-4 shrink-0 ${active ? "text-[#b8913f]" : ""}`} />
                  <span className="flex-1 text-left truncate">{c.label}</span>
                  {c.count > 0 && <span className="text-[11px] font-semibold text-[#9ca3af]">{c.count}</span>}
                </button>
              )
            })}
          </aside>

          {/* Message list */}
          <div className={`${paneOpen ? "hidden lg:flex" : "flex"} flex-col w-full lg:w-[400px] xl:w-[440px] lg:border-r border-[#f0f0f0] min-h-0`}>
            {/* Mobile folder strip — the rail is hidden below md */}
            <div className="md:hidden flex items-center gap-1 px-2 py-2 border-b border-[#f0f0f0] overflow-x-auto">
              {folderItems.map((f) => {
                const active = folder === f.key
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => openFolder(f.key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                      active ? "bg-[#001f3f] text-white" : "text-[#5f6368] hover:bg-[#f5f6f8]"
                    }`}
                  >
                    <f.icon className="w-3.5 h-3.5" /> {f.label}
                    {(f.urgent ?? 0) > 0 && (
                      <span className="min-w-[16px] h-[16px] px-1 text-[10px] font-bold flex items-center justify-center bg-[#d6b357] text-[#1a1408]">
                        {f.urgent}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {/* Select-all bar — bulk archive/restore/delete for checked rows */}
            {!loading && pageIds.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-2 border-b border-[#f0f0f0] bg-[#fafbfc]">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = selected.size > 0 && !allSelected }}
                  onChange={toggleSelectAll}
                  aria-label="Select all on this page"
                  className="w-4 h-4 accent-[#001f3f] cursor-pointer shrink-0"
                />
                {selected.size > 0 ? (
                  <>
                    <span className="text-xs font-semibold text-[#374151]">{selected.size} selected</span>
                    {folder === "inbox" || folder === "starred" ? (
                      <button
                        type="button"
                        onClick={() => void bulkSetDeleted(true)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#e5e8ec] text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Archive
                      </button>
                    ) : folder === "archived" ? (
                      <button
                        type="button"
                        onClick={() => void bulkSetDeleted(false)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#e5e8ec] text-xs font-semibold text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void bulkDeleteSent()}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#e5e8ec] text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-[#9ca3af]">Select</span>
                )}
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="h-16 bg-[#f8f9fa] animate-pulse" />
                  ))}
                </div>
              ) : listError ? (
                <div className="p-8 text-center text-sm text-rose-600">{listError}</div>
              ) : folder === "sent" ? (
                sentRows.length === 0 ? (
                  <EmptyList icon={Send} title="Nothing sent yet" hint="Replies and composed emails will appear here." />
                ) : (
                  sentRows.map((m) => {
                    const active = openId === m.id
                    const unreadReplies = m.inquiry_id ? 0 : sentUnread[m.to_email.toLowerCase()] ?? 0
                    return (
                      <div
                        key={m.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setParams({ open: m.id })}
                        onKeyDown={(e) => { if (e.key === "Enter") setParams({ open: m.id }) }}
                        className={`w-full text-left px-4 py-3 border-b border-[#f5f5f5] cursor-pointer transition-colors ${
                          active ? "bg-[#001f3f]/[0.05]" : unreadReplies > 0 ? "bg-white hover:bg-[#f8f9fa]" : "hover:bg-[#f8f9fa]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selected.has(m.id)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleSelect(m.id)}
                            aria-label={`Select email to ${m.to_name || m.to_email}`}
                            className="w-4 h-4 mt-0.5 accent-[#001f3f] cursor-pointer shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`flex-1 min-w-0 text-sm truncate ${unreadReplies > 0 ? "font-bold text-[#0d1117]" : "font-semibold text-[#374151]"}`}>
                                To: {m.to_name || m.to_email}
                              </p>
                              {unreadReplies > 0 && (
                                <span className="min-w-[18px] h-[18px] px-1 text-[10px] font-bold flex items-center justify-center bg-[#d6b357] text-[#1a1408] shrink-0">
                                  {unreadReplies}
                                </span>
                              )}
                              {m.status === "failed" && (
                                <span className="px-2 py-0.5 text-[10px] font-semibold bg-rose-50 text-rose-600">Failed</span>
                              )}
                              <span className={`text-[11px] shrink-0 ${unreadReplies > 0 ? "font-bold text-[#0d1117]" : "text-[#9ca3af]"}`}>{mailTime(m.created_at)}</span>
                            </div>
                            <p className={`text-[13px] truncate mt-0.5 ${unreadReplies > 0 ? "font-bold text-[#0d1117]" : "text-[#0d1117] font-medium"}`}>{m.subject}</p>
                            <p className="text-xs text-[#9ca3af] truncate mt-0.5">{m.body_text}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )
              ) : rows.length === 0 ? (
                <EmptyList
                  icon={folder === "archived" ? Archive : folder === "starred" ? Star : Inbox}
                  title={
                    folder === "archived" ? "No archived conversations"
                    : folder === "starred" ? "No starred emails"
                    : "Inbox zero"
                  }
                  hint={
                    folder === "archived" ? "Archived leads will appear here."
                    : folder === "starred" ? "Click the star on an email to keep it here."
                    : "Inquiries from the Inquire Now form on project pages will appear here."
                  }
                />
              ) : (
                rows.map((row) => {
                  const isUnread = !row.read_at && !row.deleted_at
                  const active = openId === row.id
                  // div + role, not <button>: the row holds a checkbox, and
                  // interactive elements can't nest inside a button.
                  return (
                    <div
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setParams({ open: row.id })}
                      onKeyDown={(e) => { if (e.key === "Enter") setParams({ open: row.id }) }}
                      className={`w-full text-left px-4 py-3 border-b border-[#f5f5f5] cursor-pointer transition-colors ${
                        active ? "bg-[#001f3f]/[0.05]" : isUnread ? "bg-white hover:bg-[#f8f9fa]" : "bg-[#fafbfc] hover:bg-[#f8f9fa]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleSelect(row.id)}
                          aria-label={`Select conversation from ${row.name}`}
                          className="w-4 h-4 accent-[#001f3f] cursor-pointer shrink-0"
                        />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); void toggleStar(row) }}
                          aria-label={row.starred_at ? `Unstar ${row.name}` : `Star ${row.name}`}
                          title={row.starred_at ? "Unstar" : "Star"}
                          className="shrink-0 p-0.5"
                        >
                          <Star className={`w-4 h-4 transition-colors ${
                            row.starred_at ? "fill-[#d6b357] text-[#d6b357]" : "text-[#cdd2d9] hover:text-[#b8913f]"
                          }`} />
                        </button>
                        <UserAvatar name={row.name} size={38} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`flex-1 min-w-0 text-sm truncate ${isUnread ? "font-bold text-[#0d1117]" : "font-medium text-[#4b5563]"}`}>
                              {row.name}
                            </p>
                            {isUnread && <span className="w-2 h-2 rounded-full bg-[#d6b357] shrink-0" />}
                            <span className={`text-[11px] shrink-0 ${isUnread ? "font-bold text-[#0d1117]" : "text-[#9ca3af]"}`}>
                              {mailTime(row.created_at)}
                            </span>
                          </div>
                          <p className={`text-[13px] truncate mt-0.5 ${isUnread ? "font-semibold text-[#1f2937]" : "text-[#6b7280]"}`}>
                            {row.project_name ? `Inquiry — ${row.project_name}` : `${CATEGORY_LABELS[row.property_category] ?? row.property_category} inquiry`}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#f3f4f6] text-[#374151]">
                              {CATEGORY_LABELS[row.property_category] ?? row.property_category}
                            </span>
                            <StatusChip row={row} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* List pagination */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-[#f0f0f0]">
              <p className="text-[11px] text-[#9ca3af]">
                {total > 0 ? `${Math.min((page - 1) * PER_PAGE + 1, total)}–${Math.min(page * PER_PAGE, total)} of ${total}` : "No results"}
              </p>
              <div className="flex items-center gap-1">
                <IconBtn title="Previous page" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="w-4 h-4" />
                </IconBtn>
                <IconBtn title="Next page" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  <ChevronRight className="w-4 h-4" />
                </IconBtn>
              </div>
            </div>
          </div>

          {/* Reading pane */}
          <div className={`${paneOpen ? "flex" : "hidden lg:flex"} flex-col flex-1 min-w-0 min-h-0`}>
            {folder === "sent" ? (
              selectedSent ? (
                <SentReader
                  email={selectedSent}
                  threadVersion={threadVersion}
                  onBack={() => setParams({ open: null })}
                  onOpenLead={(inquiryId) => setParams({ folder: null, open: inquiryId })}
                  onMarkedRead={onCorrespondenceRead}
                  onSent={(m) => {
                    setNotice(`Email sent to ${m.to_email}.`)
                    setSummary((s) => (s ? { ...s, sent: (s.sent ?? 0) + 1 } : s))
                    setSentRows((rs) => [m, ...rs])
                  }}
                />
              ) : (
                <EmptyPane />
              )
            ) : openId ? (
              threadLoading || !thread ? (
                <div className="flex-1 flex items-center justify-center gap-2 text-sm text-[#9ca3af]">
                  <Loader2 className="w-5 h-5 animate-spin" /> Opening conversation…
                </div>
              ) : (
                <ThreadReader
                  thread={thread}
                  busy={busy}
                  onBack={() => setParams({ open: null })}
                  onToggleStar={() => void toggleStar(thread.inquiry)}
                  onMarkUnread={() => void markUnread(thread.inquiry)}
                  onStatus={(s, msg) => void changeStatus(thread.inquiry, s, msg)}
                  onArchive={() => void toggleArchive(thread.inquiry)}
                  onReplied={(email) => {
                    setThread((t) => (t ? { ...t, emails: [...t.emails, email] } : t))
                    patchRow(thread.inquiry.id, {
                      status: thread.inquiry.status === "new" ? "contacted" : thread.inquiry.status,
                      contacted_at: thread.inquiry.contacted_at ?? new Date().toISOString(),
                    })
                    setSummary((s) => (s ? { ...s, sent: (s.sent ?? 0) + 1 } : s))
                    setNotice(`Reply sent to ${thread.inquiry.email}.`)
                  }}
                  onNotice={setNotice}
                />
              )
            ) : (
              <EmptyPane />
            )}
          </div>
        </div>
      </div>

      {compose && (
        <ComposeWindow
          initial={compose}
          onClose={() => setCompose(null)}
          onSent={(email) => {
            setCompose(null)
            setNotice(`Email sent to ${email.to_email}.`)
            setSummary((s) => (s ? { ...s, sent: (s.sent ?? 0) + 1 } : s))
            setThreadVersion((v) => v + 1)
            if (folder === "sent") setSentRows((rs) => [email, ...rs])
          }}
        />
      )}
    </div>
  )
}

function EmptyList({ icon: Icon, title, hint }: { icon: typeof Inbox; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="w-14 h-14 bg-[#f3f4f6] flex items-center justify-center mb-3">
        <Icon className="w-7 h-7 text-[#d1d5db]" />
      </div>
      <p className="text-sm font-semibold text-[#374151]">{title}</p>
      <p className="text-xs text-[#9ca3af] mt-1">{hint}</p>
    </div>
  )
}

function EmptyPane() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
      <div className="w-16 h-16 bg-[#f3f4f6] flex items-center justify-center mb-4">
        <MailOpen className="w-8 h-8 text-[#d1d5db]" />
      </div>
      <p className="text-sm font-semibold text-[#374151]">Select a conversation to read</p>
      <p className="text-xs text-[#9ca3af] mt-1">Click an email on the left — reply without leaving the page.</p>
    </div>
  )
}

// ─── Reading pane: a lead conversation ────────────────────────────────────────

function ThreadReader({
  thread, busy, onBack, onToggleStar, onMarkUnread, onStatus, onArchive, onReplied, onNotice,
}: {
  thread: { inquiry: Inquiry; emails: SentEmail[] }
  busy: boolean
  onBack: () => void
  onToggleStar: () => void
  onMarkUnread: () => void
  onStatus: (s: InquiryStatus, message: string) => void
  onArchive: () => void
  onReplied: (email: SentEmail) => void
  onNotice: (n: string) => void
}) {
  const l = thread.inquiry
  const isArchived = Boolean(l.deleted_at)
  const fullPhone = `${l.phone_country_code} ${l.phone}`
  const waNumber = `${l.phone_country_code}${l.phone}`.replace(/[^0-9]/g, "")
  const subjectLine = l.project_name ? `Inquiry — ${l.project_name}` : "New property inquiry"

  const bottomRef = useRef<HTMLDivElement>(null)

  return (
    <>
      {/* Pane toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-[#f0f0f0]">
        <IconBtn title="Back to list" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </IconBtn>
        <div className="flex-1 min-w-0 px-1">
          <p className="text-sm font-bold text-[#0d1117] truncate">{subjectLine}</p>
        </div>
        <IconBtn title={l.starred_at ? "Unstar" : "Star"} onClick={onToggleStar} disabled={busy}>
          <Star className={`w-4 h-4 ${l.starred_at ? "fill-[#d6b357] text-[#b8913f]" : ""}`} />
        </IconBtn>
        <IconBtn title="Mark as unread" onClick={onMarkUnread} disabled={busy}>
          <Mail className="w-4 h-4" />
        </IconBtn>
        {!isArchived && l.status !== "contacted" && (
          <IconBtn title="Mark contacted" onClick={() => onStatus("contacted", "Marked as contacted.")} disabled={busy}>
            <PhoneCall className="w-4 h-4" />
          </IconBtn>
        )}
        {!isArchived && l.status !== "closed" && (
          <IconBtn title="Mark closed" tone="success" onClick={() => onStatus("closed", "Marked as closed.")} disabled={busy}>
            <CheckCircle2 className="w-4 h-4" />
          </IconBtn>
        )}
        {!isArchived && l.status !== "new" && (
          <IconBtn title="Reopen as new" onClick={() => onStatus("new", "Reopened as new.")} disabled={busy}>
            <Undo2 className="w-4 h-4" />
          </IconBtn>
        )}
        <IconBtn title={isArchived ? "Restore" : "Archive"} tone={isArchived ? "success" : "danger"} onClick={onArchive} disabled={busy}>
          {isArchived ? <RotateCcw className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
        </IconBtn>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-4">
          {/* Subject + chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">{subjectLine}</h2>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#f3f4f6] text-[#374151]">
              {CATEGORY_LABELS[l.property_category] ?? l.property_category}
            </span>
            <StatusChip row={l} />
            {!l.deleted_at && l.status === "new" && (
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#d6b357]/15 text-[#8a6d1f]">New</span>
            )}
          </div>

          {/* The lead's message */}
          <div className="border border-[#e5e8ec] bg-white">
            <div className="flex items-start gap-3 px-5 pt-4">
              <UserAvatar name={l.name} size={40} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="text-sm font-bold text-[#0d1117]">{l.name}</p>
                  <a href={`mailto:${l.email}`} className="text-xs text-[#6b7280] hover:text-[#001f3f] truncate">&lt;{l.email}&gt;</a>
                </div>
                <p className="text-[11px] text-[#9ca3af]">to FHI Global</p>
              </div>
              <span className="text-[11px] text-[#9ca3af] shrink-0" title={formatDateTime(l.created_at)}>
                {formatDateTime(l.created_at)} · {relativeTime(l.created_at)}
              </span>
            </div>

            <div className="px-5 py-4 text-sm text-[#374151] leading-relaxed">
              <p>
                <strong>{l.name}</strong> submitted the Inquire Now form
                {l.project_name ? <> for <strong>{l.project_name}</strong></> : null}
                {l.developer_name ? <> by {l.developer_name}</> : null}.
              </p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <ThreadFact label="Interested in" value={CATEGORY_LABELS[l.property_category] ?? l.property_category} />
                <ThreadFact label="Who they are" value={LOOKING_FOR_LABELS[l.looking_for] ?? l.looking_for} />
                <ThreadFact label="Phone" value={fullPhone} />
                <ThreadFact label="Email" value={l.email} />
              </div>

              {/* Quick contact actions */}
              <div className="flex items-center gap-2 flex-wrap mt-5">
                <a href={`tel:${l.phone_country_code}${l.phone.replace(/[^0-9]/g, "")}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#e5e8ec] text-xs font-semibold text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] transition-all">
                  <Phone className="w-3.5 h-3.5" /> Call
                </a>
                <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#e5e8ec] text-xs font-semibold text-[#374151] hover:border-[#25d366] hover:text-[#128c4a] transition-all">
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </a>
                {l.project_name && (
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#f3f4f6] text-xs font-semibold text-[#374151]">
                    <Building2 className="w-3.5 h-3.5" /> {l.project_name}
                  </span>
                )}
              </div>

              {/* Submission meta, folded away like Gmail's details */}
              <details className="mt-4 group">
                <summary className="inline-flex items-center gap-1 text-xs text-[#9ca3af] cursor-pointer select-none hover:text-[#374151]">
                  <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" /> Submission details
                </summary>
                <div className="mt-3 bg-[#f8f9fa] px-4 py-3 space-y-1.5 text-xs text-[#6b7280]">
                  <p className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {formatDateTime(l.created_at)}</p>
                  <p className="flex items-center gap-1.5"><Globe className="w-3 h-3" /> {l.ip_address ?? "IP unavailable"} · {l.source === "project_page" ? "Project page — Inquire Now" : l.source}</p>
                  <p className="flex items-start gap-1.5 break-all"><MonitorSmartphone className="w-3 h-3 mt-0.5 shrink-0" /> {l.user_agent ?? "Device unavailable"}</p>
                  {l.contacted_at && <p className="flex items-center gap-1.5"><PhoneCall className="w-3 h-3" /> First contacted {formatDateTime(l.contacted_at)}</p>}
                </div>
              </details>
            </div>
          </div>

          {/* The conversation — our messages and the lead's replies */}
          {thread.emails.map((m) => (
            <EmailMessageCard key={m.id} m={m} counterpartName={l.name} />
          ))}

          {/* Reply composer — keyed by lead so drafts reset per conversation */}
          <ReplyBox
            key={l.id}
            lead={l}
            disabled={isArchived}
            onReplied={(email) => { onReplied(email); bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }}
            onNotice={onNotice}
          />
          <div ref={bottomRef} />
        </div>
      </div>
    </>
  )
}

function ThreadFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-[#9ca3af]">{label}</p>
      <p className="text-sm font-semibold text-[#111827] break-all">{value}</p>
    </div>
  )
}

// ─── Reply box ────────────────────────────────────────────────────────────────

function ReplyBox({
  lead, disabled, onReplied, onNotice,
}: {
  lead: Inquiry
  disabled: boolean
  onReplied: (email: SentEmail) => void
  onNotice: (n: string) => void
}) {
  const defaultSubject = lead.project_name
    ? `Re: Your inquiry about ${lead.project_name}`
    : "Re: Your inquiry — FHI Global"

  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState(defaultSubject)
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (disabled) {
    return (
      <p className="text-xs text-[#9ca3af] text-center py-2">
        This conversation is archived — restore it to reply.
      </p>
    )
  }

  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 px-6 py-2.5 border border-[#e5e8ec] text-sm font-bold text-[#001f3f] hover:bg-[#001f3f] hover:text-white transition-all"
        >
          <Send className="w-4 h-4" /> Reply
        </button>
      </div>
    )
  }

  const send = async () => {
    if (!subject.trim() || !message.trim()) { setError("Write a subject and a message first."); return }
    setSending(true)
    setError(null)
    const { email, error: err } = await sendInquiryReply(lead.id, subject.trim(), message.trim())
    setSending(false)
    if (err) { setError(err); if (email) onReplied(email); return }
    if (email) onReplied(email)
    setOpen(false)
    setMessage("")
    onNotice(`Reply sent to ${lead.email}.`)
  }

  return (
    <div className="border border-[#e5e8ec] bg-white overflow-hidden">
      <div className="px-5 pt-4 pb-1">
        <p className="text-xs text-[#6b7280]">
          Replying to <span className="font-semibold text-[#374151]">{lead.name}</span> &lt;{lead.email}&gt;
        </p>
      </div>
      <div className="px-5 py-2">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          placeholder="Subject"
          className="w-full py-2 text-sm font-semibold text-[#0d1117] border-b border-[#f0f0f0] focus:outline-none focus:border-[#001f3f]/40"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={10_000}
          rows={6}
          autoFocus
          placeholder={`Hi ${lead.name.split(/\s+/)[0]},`}
          className="w-full py-3 text-sm text-[#374151] leading-relaxed resize-y focus:outline-none"
        />
      </div>
      {error && <p className="px-5 pb-1 text-xs font-semibold text-rose-600">{error}</p>}
      <div className="flex items-center gap-2 px-5 py-3 border-t border-[#f0f0f0]">
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#001f3f] text-white text-sm font-bold hover:bg-[#0a3d6b] disabled:opacity-60 transition-all"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? "Sending…" : "Send"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null) }}
          disabled={sending}
          className="px-4 py-2.5 text-sm font-semibold text-[#6b7280] hover:bg-[#f1f3f4] transition-all"
        >
          Discard
        </button>
        <span className="ml-auto text-[11px] text-[#c4c4c4]">Sent from your FHI Global email</span>
      </div>
    </div>
  )
}

// ─── One message in a conversation (ours or theirs) ──────────────────────────

/**
 * Split a reply into the fresh text and the quoted history mail clients drag
 * along ("On ... wrote:", "> ..." lines, Outlook separators). Display-only —
 * the stored body keeps everything.
 */
function splitQuoted(text: string): { visible: string; quoted: string } {
  const t = text.replace(/\r\n/g, "\n")
  const patterns = [
    /^On [\s\S]{0,400}?wrote:\s*$/m, // Gmail/Apple attribution (may wrap lines)
    /^\s*>/m, // first quoted line
    /^-{3,}\s*Original Message\s*-{3,}/im,
    /^_{8,}\s*$/m, // Outlook separator
  ]
  let cut = -1
  for (const re of patterns) {
    const idx = t.search(re)
    if (idx !== -1 && (cut === -1 || idx < cut)) cut = idx
  }
  // No quote found, or the message IS the quote (bottom-posted) — show it all.
  if (cut <= 0) return { visible: t.trim(), quoted: "" }
  const visible = t.slice(0, cut).trim()
  if (!visible) return { visible: t.trim(), quoted: "" }
  return { visible, quoted: t.slice(cut).trim() }
}

function EmailMessageCard({ m, counterpartName }: { m: SentEmail; counterpartName: string | null }) {
  const inbound = m.direction === "inbound"
  const { visible, quoted } = inbound ? splitQuoted(m.body_text) : { visible: m.body_text, quoted: "" }
  const [showQuoted, setShowQuoted] = useState(false)
  return (
    <div
      className={`border ${
        m.status === "failed" ? "border-rose-200 bg-rose-50/40" : inbound ? "border-[#e5e8ec] bg-white" : "border-[#eef0f2] bg-[#fbfcfd]"
      }`}
    >
      <div className="flex items-start gap-3 px-5 pt-4">
        {inbound ? (
          <UserAvatar name={m.from_name ?? counterpartName ?? m.from_email ?? "?"} size={40} />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[#001f3f] flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">FHI</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-sm font-bold text-[#0d1117]">
              {inbound ? m.from_name ?? counterpartName ?? m.from_email : m.sent_by_name ?? "FHI Global"}
            </p>
            <span className="text-xs text-[#6b7280] truncate">
              {inbound ? "replied to FHI Global" : `to ${m.to_email}`}
            </span>
          </div>
          <p className="text-[13px] font-semibold text-[#374151] mt-0.5 truncate">{m.subject}</p>
        </div>
        <span className="text-[11px] text-[#9ca3af] shrink-0" title={formatDateTime(m.created_at)}>
          {formatDateTime(m.created_at)}
        </span>
      </div>
      <div className="px-5 py-4">
        {m.status === "failed" && (
          <p className="mb-2 text-xs font-semibold text-rose-600">
            Failed to send{m.error ? ` — ${m.error}` : ""}. This message was not delivered.
          </p>
        )}
        <p className="text-sm text-[#374151] leading-relaxed whitespace-pre-wrap">{visible}</p>
        {quoted && (
          <>
            <button
              type="button"
              onClick={() => setShowQuoted((v) => !v)}
              aria-expanded={showQuoted}
              className="mt-3 px-2 py-0.5 text-[11px] font-bold tracking-wider text-[#9ca3af] bg-[#f1f3f4] hover:text-[#374151] transition-colors"
              title={showQuoted ? "Hide quoted text" : "Show quoted text"}
            >
              •••
            </button>
            {showQuoted && (
              <p className="mt-3 pl-3 border-l-2 border-[#e5e8ec] text-[13px] text-[#9ca3af] leading-relaxed whitespace-pre-wrap">
                {quoted}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Reading pane: a sent email / correspondence with one address ─────────────

function SentReader({
  email, threadVersion, onBack, onOpenLead, onMarkedRead, onSent,
}: {
  email: SentEmail
  /** Bumped by the parent when the mailbox sync lands new messages. */
  threadVersion: number
  onBack: () => void
  onOpenLead: (inquiryId: string) => void
  /** Stable callback (parent useCallback) — this effect depends on it. */
  onMarkedRead: (address: string, count: number) => void
  onSent: (m: SentEmail) => void
}) {
  // A reply to a lead lives on that lead's thread — link over to it. Composed
  // mail has no lead, so the full back-and-forth with that address loads here.
  const isLeadReply = Boolean(email.inquiry_id)
  const [rows, setRows] = useState<SentEmail[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(async () => {
      if (isLeadReply) { setRows(null); return }
      const { rows: r } = await fetchEmailThread(email.to_email)
      if (cancelled) return
      // Opening the conversation reads it — stamp locally (so a refetch can't
      // double-count) and persist in the background.
      const unreadCount = r.filter((x) => x.direction === "inbound" && !x.read_at).length
      if (unreadCount > 0) {
        void markEmailThreadRead(email.to_email)
        onMarkedRead(email.to_email.toLowerCase(), unreadCount)
        const stamp = new Date().toISOString()
        setRows(r.map((x) => (x.direction === "inbound" && !x.read_at ? { ...x, read_at: stamp } : x)))
      } else {
        setRows(r)
      }
    }, 0)
    return () => { cancelled = true; clearTimeout(t) }
  }, [email.id, email.to_email, isLeadReply, threadVersion, onMarkedRead])

  const messages = isLeadReply ? [email] : rows && rows.length > 0 ? rows : [email]

  return (
    <>
      <div className="flex items-center gap-1 px-3 py-2 border-b border-[#f0f0f0]">
        <IconBtn title="Back to list" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </IconBtn>
        <div className="flex-1 min-w-0 px-1">
          <p className="text-sm font-bold text-[#0d1117] truncate">{email.subject}</p>
        </div>
        {isLeadReply && (
          <button
            type="button"
            onClick={() => onOpenLead(email.inquiry_id!)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#e5e8ec] text-xs font-semibold text-[#001f3f] hover:bg-[#001f3f] hover:text-white transition-all"
          >
            <Inbox className="w-3.5 h-3.5" /> Open conversation
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-4">
          {messages.map((m) => (
            <EmailMessageCard key={m.id} m={m} counterpartName={email.to_name} />
          ))}

          {/* Reply sits under the last message, like any mail client. Lead
              replies are answered on the lead's own thread instead. */}
          {!isLeadReply && (
            <SentReplyBox
              key={email.id}
              toEmail={email.to_email}
              toName={email.to_name}
              defaultSubject={/^re:/i.test(email.subject) ? email.subject : `Re: ${email.subject}`}
              onSent={(m) => {
                setRows((r) => [...(r ?? [email]), m])
                onSent(m)
              }}
            />
          )}
        </div>
      </div>
    </>
  )
}

// ─── Reply box under a Sent correspondence ────────────────────────────────────

function SentReplyBox({
  toEmail, toName, defaultSubject, onSent,
}: {
  toEmail: string
  toName: string | null
  defaultSubject: string
  onSent: (m: SentEmail) => void
}) {
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState(defaultSubject)
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 px-6 py-2.5 border border-[#e5e8ec] text-sm font-bold text-[#001f3f] hover:bg-[#001f3f] hover:text-white transition-all"
        >
          <Send className="w-4 h-4" /> Reply
        </button>
      </div>
    )
  }

  const send = async () => {
    if (!subject.trim() || !message.trim()) { setError("Write a subject and a message first."); return }
    setSending(true)
    setError(null)
    const { email, error: err } = await sendComposedEmail({
      to: toEmail,
      toName: toName ?? undefined,
      subject: subject.trim(),
      message: message.trim(),
    })
    setSending(false)
    if (err) { setError(err); return }
    if (email) onSent(email)
    setOpen(false)
    setMessage("")
  }

  return (
    <div className="border border-[#e5e8ec] bg-white overflow-hidden">
      <div className="px-5 pt-4 pb-1">
        <p className="text-xs text-[#6b7280]">
          Replying to <span className="font-semibold text-[#374151]">{toName || toEmail}</span>
          {toName ? <> &lt;{toEmail}&gt;</> : null}
        </p>
      </div>
      <div className="px-5 py-2">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          placeholder="Subject"
          className="w-full py-2 text-sm font-semibold text-[#0d1117] border-b border-[#f0f0f0] focus:outline-none focus:border-[#001f3f]/40"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={10_000}
          rows={6}
          autoFocus
          placeholder={`Hi ${(toName || "there").split(/\s+/)[0]},`}
          className="w-full py-3 text-sm text-[#374151] leading-relaxed resize-y focus:outline-none"
        />
      </div>
      {error && <p className="px-5 pb-1 text-xs font-semibold text-rose-600">{error}</p>}
      <div className="flex items-center gap-2 px-5 py-3 border-t border-[#f0f0f0]">
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#001f3f] text-white text-sm font-bold hover:bg-[#0a3d6b] disabled:opacity-60 transition-all"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? "Sending…" : "Send"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null) }}
          disabled={sending}
          className="px-4 py-2.5 text-sm font-semibold text-[#6b7280] hover:bg-[#f1f3f4] transition-all"
        >
          Discard
        </button>
        <span className="ml-auto text-[11px] text-[#c4c4c4]">Sent from your FHI Global email</span>
      </div>
    </div>
  )
}

// ─── Compose window (Gmail-style, bottom-right) ───────────────────────────────

function ComposeWindow({
  initial, onClose, onSent,
}: {
  /** Prefill for reply-from-Sent; empty object for a blank compose. */
  initial: { to?: string; toName?: string; subject?: string }
  onClose: () => void
  onSent: (email: SentEmail) => void
}) {
  const [to, setTo] = useState(initial.to ?? "")
  const [toName, setToName] = useState(initial.toName ?? "")
  const [subject, setSubject] = useState(initial.subject ?? "")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) { setError("Enter a valid email address."); return }
    if (!subject.trim() || !message.trim()) { setError("Write a subject and a message first."); return }
    setSending(true)
    setError(null)
    const { email, error: err } = await sendComposedEmail({
      to: to.trim(),
      toName: toName.trim() || undefined,
      subject: subject.trim(),
      message: message.trim(),
    })
    setSending(false)
    if (err) { setError(err); return }
    if (email) onSent(email)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(520px,calc(100vw-2rem))] bg-white shadow-2xl shadow-black/25 border border-[#e5e5e5] overflow-hidden flex flex-col max-h-[min(640px,calc(100vh-4rem))]">
      <div className="flex items-center justify-between gap-3 px-5 py-3 bg-[#001f3f]">
        <p className="text-sm font-bold text-white">New message</p>
        <button
          type="button"
          onClick={onClose}
          disabled={sending}
          aria-label="Close compose"
          className="w-7 h-7 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-5 flex-1 overflow-y-auto">
        <div className="flex items-center gap-2 border-b border-[#f0f0f0]">
          <span className="text-xs text-[#9ca3af] shrink-0 w-14">To</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            type="email"
            placeholder="recipient@email.com"
            className="flex-1 py-2.5 text-sm text-[#0d1117] focus:outline-none"
            autoFocus
          />
        </div>
        <div className="flex items-center gap-2 border-b border-[#f0f0f0]">
          <span className="text-xs text-[#9ca3af] shrink-0 w-14">Name</span>
          <input
            value={toName}
            onChange={(e) => setToName(e.target.value)}
            placeholder="Optional — recipient's name"
            className="flex-1 py-2.5 text-sm text-[#0d1117] focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 border-b border-[#f0f0f0]">
          <span className="text-xs text-[#9ca3af] shrink-0 w-14">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            placeholder="Subject"
            className="flex-1 py-2.5 text-sm font-semibold text-[#0d1117] focus:outline-none"
          />
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={10_000}
          rows={9}
          placeholder="Write your message…"
          className="w-full py-3 text-sm text-[#374151] leading-relaxed resize-none focus:outline-none"
        />
      </div>

      {error && <p className="px-5 pb-2 text-xs font-semibold text-rose-600">{error}</p>}
      <div className="flex items-center gap-2 px-5 py-3 border-t border-[#f0f0f0]">
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#d6b357] text-[#1a1408] text-sm font-bold hover:brightness-95 disabled:opacity-60 transition-all"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? "Sending…" : "Send"}
        </button>
        <span className="ml-auto text-[11px] text-[#c4c4c4]">Delivered with the FHI Global template</span>
      </div>
    </div>
  )
}
