"use client"

// Account 360 — the drill-in view behind an Account Directory card. Everything
// about one account on one screen: profile, upline, team, recruits, invitations,
// sales, listings and activity, all from a single /overview request.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  ArrowLeft, Edit3, Mail, Phone, Linkedin, Facebook, Users, Network, Ticket,
  TrendingUp, Building2, Clock, Calendar, BadgeCheck, Loader2,
  ChevronLeft, ChevronRight, UserPlus, Briefcase, Globe, Search, ArrowUpRight,
} from "lucide-react"
import { UserAvatar } from "@/components/user-avatar"
import type { UserRecord } from "@/lib/user-service"
import { ROLE_COLORS, STATUS_COLORS, ROLE_OPTIONS, TIMEZONES, getUserDisplayName } from "@/lib/user-service"
import { formatDate, relativeTime, formatDateAtTimeInZone } from "@/lib/utils"
import { eventColor, humanizeEvent } from "@/components/dashboard/system-logs/log-meta"
import type { UserOverview, UserPerson } from "@/lib/user-overview"

const ACTIVITY_PER_PAGE = 10
const PEOPLE_PER_PAGE = 8

type TabId = "overview" | "network" | "invites" | "sales" | "listings" | "activity"

type ActivityRow = {
  id: string
  occurred_at: string
  event: string
  source: string
  actor_name: string | null
  subject_label: string | null
  description: string | null
}

/* ── small helpers ───────────────────────────────────────────────────────── */

const titleCase = (v: string) => v.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase())

const money = (v: number, currency = "AED") =>
  `${currency} ${Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`

/** Compact money for tight spots: AED 18.5M / AED 940K. */
function moneyShort(v: number, currency = "AED"): string {
  const n = Number(v || 0)
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 1_000) return `${currency} ${Math.round(n / 1_000)}K`
  return `${currency} ${n.toLocaleString("en-US")}`
}

function metaStr(metadata: Record<string, unknown> | null, key: string): string {
  const v = (metadata ?? {})[key]
  return typeof v === "string" ? v.trim() : ""
}

function contactFrom(metadata: Record<string, unknown> | null, kind: "phone" | "whatsapp"): string {
  const m = metadata ?? {}
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "")
  return [s(m[`${kind}_country_code`]), s(m[`${kind}_number`])].filter(Boolean).join(" ")
}

function roleLabel(role: string | null): string {
  const key = (role ?? "member").toLowerCase()
  return ROLE_OPTIONS.find((o) => o.value === key)?.label ?? titleCase(key.replace(/_/g, " "))
}

function roleChip(role: string | null): string {
  const c = ROLE_COLORS[(role ?? "member").toLowerCase().trim()] ?? ROLE_COLORS.member
  return `${c.bg} ${c.text} ${c.border}`
}

function statusChip(status: string | null): string {
  const c = STATUS_COLORS[(status ?? "pending").toLowerCase().trim()] ?? STATUS_COLORS.pending
  return `${c.bg} ${c.text} ${c.border}`
}

const dash = <span className="text-[#c0c6cf]">—</span>

/* ── presentational blocks ───────────────────────────────────────────────── */

const TONES: Record<string, string> = {
  navy: "bg-[#001f3f]/8 text-[#001f3f]",
  gold: "bg-[#d6b357]/18 text-[#8a6a10]",
  emerald: "bg-emerald-50 text-emerald-600",
  violet: "bg-violet-50 text-violet-600",
  sky: "bg-sky-50 text-sky-600",
}

function StatTile({
  icon, label, value, hint, tone = "navy",
}: {
  icon: ReactNode
  label: string
  value: string
  hint?: string
  tone?: keyof typeof TONES
}) {
  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white p-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 [&_svg]:w-4 [&_svg]:h-4 ${TONES[tone]}`}>
        {icon}
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-black/40">{label}</p>
      <p className="text-xl font-bold text-[#0d1117] font-['Outfit'] mt-0.5 tabular-nums truncate" title={value}>{value}</p>
      {hint && <p className="text-[11px] text-[#9ca3af] mt-0.5 truncate">{hint}</p>}
    </div>
  )
}

function Field({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      {icon && (
        <div className="w-8 h-8 rounded-full bg-[#f4f6f9] text-[#6b7280] flex items-center justify-center shrink-0 [&_svg]:w-4 [&_svg]:h-4">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-black/40 mb-0.5">{label}</p>
        <div className="text-[13px] text-[#374151] break-words">{children}</div>
      </div>
    </div>
  )
}

function Panel({ title, count, action, children }: { title: string; count?: number; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#f0f2f5]">
        <h3 className="font-['Outfit'] text-sm font-bold text-[#0d1117]">
          {title}
          {count !== undefined && <span className="ml-2 text-xs font-semibold text-[#9ca3af]">({count})</span>}
        </h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="px-5 py-10 text-center text-xs text-[#9ca3af]">{children}</p>
}

/** A searchable, paginated list of people with their production. */
function PersonList({
  title,
  people,
  total,
  emptyLabel,
  showSales = true,
  onOpen,
}: {
  title: string
  people: UserPerson[]
  /** True population size — `people` may be a capped slice of it. */
  total?: number
  emptyLabel: string
  showSales?: boolean
  onOpen?: (id: string) => void
}) {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const shownTotal = total ?? people.length
  const truncated = shownTotal > people.length

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return people
    return people.filter((p) =>
      (p.fullname ?? "").toLowerCase().includes(q) ||
      (p.role ?? "").toLowerCase().includes(q) ||
      (p.roleInTeam ?? "").toLowerCase().includes(q),
    )
  }, [people, search])

  const pages = Math.max(1, Math.ceil(filtered.length / PEOPLE_PER_PAGE))
  const safePage = Math.min(page, pages)
  const slice = filtered.slice((safePage - 1) * PEOPLE_PER_PAGE, safePage * PEOPLE_PER_PAGE)

  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white overflow-hidden flex flex-col">
      {/* header — title + search */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#f0f2f5]">
        <h3 className="font-['Outfit'] text-sm font-bold text-[#0d1117] shrink-0">
          {title}
          <span className="ml-2 text-xs font-semibold text-[#9ca3af]">({shownTotal})</span>
        </h3>
        <div className="relative w-full max-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9ca3af] pointer-events-none" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search name or role…"
            className="w-full h-9 pl-8 pr-3 rounded-xl border border-[#eceff3] bg-[#f8fafc] text-xs text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:bg-white focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/6 transition-all"
          />
        </div>
      </div>

      {/* rows */}
      {people.length === 0 ? (
        <EmptyRow>{emptyLabel}</EmptyRow>
      ) : filtered.length === 0 ? (
        <EmptyRow>No one matches “{search}”.</EmptyRow>
      ) : (
        <div className="flex-1">
          {slice.map((p) => {
            const name = titleCase(p.fullname ?? "Unnamed")
            const inner = (
              <>
                <UserAvatar name={name} imageUrl={p.profileUrl} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#0d1117] truncate">{name}</p>
                  <p className="text-[11px] text-[#9ca3af] truncate">
                    {p.roleInTeam ? titleCase(p.roleInTeam) : roleLabel(p.role)}
                    {p.joinedAt ? ` · joined ${formatDate(p.joinedAt)}` : ""}
                  </p>
                </div>
                {showSales && (
                  <div className="shrink-0 text-right hidden sm:block">
                    <p className="text-[12px] font-bold text-[#0d1117] tabular-nums">
                      {p.salesCount ? moneyShort(p.salesValue ?? 0) : dash}
                    </p>
                    <p className="text-[10px] text-[#9ca3af]">{p.salesCount ?? 0} {p.salesCount === 1 ? "deal" : "deals"}</p>
                  </div>
                )}
                <span className={`shrink-0 text-[10px] font-bold capitalize px-2 py-0.5 rounded-full border ${roleChip(p.role)}`}>
                  {roleLabel(p.role)}
                </span>
                <span className={`shrink-0 text-[10px] font-bold capitalize px-2 py-0.5 rounded-full border ${statusChip(p.status)}`}>
                  {p.status ?? "pending"}
                </span>
              </>
            )
            return onOpen ? (
              <button
                key={p.id}
                type="button"
                onClick={() => onOpen(p.id)}
                className="w-full flex items-center gap-3 px-5 py-3 border-b border-[#f6f7f9] last:border-0 hover:bg-[#f9fafb] transition-colors text-left"
              >
                {inner}
              </button>
            ) : (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3 border-b border-[#f6f7f9] last:border-0">{inner}</div>
            )
          })}
        </div>
      )}

      {truncated && (
        <p className="px-5 py-2 text-[11px] text-[#9ca3af] border-t border-[#f0f2f5]">
          Showing the first {people.length} of {shownTotal}.
        </p>
      )}

      {/* pager */}
      {filtered.length > PEOPLE_PER_PAGE && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#f0f2f5]">
          <span className="text-[11px] text-[#9ca3af] tabular-nums">
            {(safePage - 1) * PEOPLE_PER_PAGE + 1}–{Math.min(safePage * PEOPLE_PER_PAGE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="p-1.5 rounded-lg border border-[#e5e5e5] text-[#6b7280] disabled:opacity-40 hover:border-[#001f3f]/30 transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-semibold text-[#374151] px-1 tabular-nums">{safePage} / {pages}</span>
            <button
              type="button"
              onClick={() => setPage((p) => (p < pages ? p + 1 : p))}
              disabled={safePage >= pages}
              className="p-1.5 rounded-lg border border-[#e5e5e5] text-[#6b7280] disabled:opacity-40 hover:border-[#001f3f]/30 transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Referral chain above this account — direct referrer first. */
function UplineStrip({ upline, onOpen }: { upline: UserPerson[]; onOpen?: (id: string) => void }) {
  if (upline.length === 0) return null
  const [direct, ...rest] = upline

  return (
    <div className="flex flex-wrap items-center gap-3 px-5 sm:px-6 py-3 bg-[#f8fafc] border-t border-[#f0f2f5]">
      <span className="text-[10px] font-bold uppercase tracking-wider text-black/40 shrink-0">Upline</span>

      <button
        type="button"
        onClick={onOpen ? () => onOpen(direct.id) : undefined}
        disabled={!onOpen}
        className="inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-[#e4e7ec] bg-white hover:border-[#001f3f]/30 transition-colors disabled:cursor-default"
      >
        <UserAvatar name={titleCase(direct.fullname ?? "Unnamed")} imageUrl={direct.profileUrl} size={24} />
        <span className="text-[13px] font-semibold text-[#0d1117]">{titleCase(direct.fullname ?? "Unnamed")}</span>
        <span className={`text-[10px] font-bold capitalize px-2 py-0.5 rounded-full border ${roleChip(direct.role)}`}>
          {roleLabel(direct.role)}
        </span>
        {onOpen && <ArrowUpRight className="w-3.5 h-3.5 text-[#9ca3af]" />}
      </button>

      {rest.length > 0 && (
        <span className="flex items-center gap-1.5 text-[11px] text-[#9ca3af] min-w-0">
          {rest.map((p) => (
            <span key={p.id} className="flex items-center gap-1.5 min-w-0">
              <ChevronRight className="w-3 h-3 shrink-0" />
              {onOpen ? (
                <button type="button" onClick={() => onOpen(p.id)} className="truncate hover:text-[#001f3f] hover:underline">
                  {titleCase(p.fullname ?? "Unnamed")}
                </button>
              ) : (
                <span className="truncate">{titleCase(p.fullname ?? "Unnamed")}</span>
              )}
            </span>
          ))}
        </span>
      )}
    </div>
  )
}

/* ── main ────────────────────────────────────────────────────────────────── */

export function UserDetailView({
  user,
  onBack,
  onEdit,
  onOpenUser,
  refreshToken = 0,
}: {
  user: UserRecord
  onBack: () => void
  onEdit: () => void
  /** Drill from a teammate/recruit/upline row into that person's own 360 view. */
  onOpenUser?: (id: string) => void
  /** Bump to force a refetch of the same account (e.g. after a profile save). */
  refreshToken?: number
}) {
  // The caller remounts this component per account (key={id}:{refreshToken}),
  // so initial state IS the reset — no state has to be cleared on prop change.
  const [data, setData] = useState<UserOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabId>("overview")

  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [activityPage, setActivityPage] = useState(1)
  const [activityTotal, setActivityTotal] = useState(0)
  /** Identifies the page currently held in `activity` — drives the spinner. */
  const [activityKey, setActivityKey] = useState("")

  const displayName = titleCase(getUserDisplayName(user))
  const phone = contactFrom(user.metadata, "phone")
  const whatsapp = contactFrom(user.metadata, "whatsapp")
  const linkedin = metaStr(user.metadata, "linkedin")
  const facebook = metaStr(user.metadata, "facebook")
  const nationality = metaStr(user.metadata, "nationality")
  const license = metaStr(user.metadata, "license_number")

  // ── overview payload ───────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = await fetch(`/api/admin/users/${user.id}/overview`, { cache: "no-store" })
        const d = res.ok ? ((await res.json()) as UserOverview) : null
        if (alive) { setData(d); setLoading(false) }
      } catch {
        if (alive) { setData(null); setLoading(false) }
      }
    })()
    return () => { alive = false }
  }, [user.id, refreshToken])

  // ── activity (lazy, only once the tab is opened) ───────────────────────
  // `activityKey` records which page is in state; the spinner is derived from
  // it, and the request id guard stops a slow response landing out of order.
  const wantActivityKey = `${user.id}:${activityPage}`
  const activityLoading = tab === "activity" && activityKey !== wantActivityKey
  const activityReqRef = useRef(0)

  useEffect(() => {
    if (tab !== "activity" || activityKey === wantActivityKey) return
    const reqId = ++activityReqRef.current
    void (async () => {
      try {
        const res = await fetch(
          `/api/admin/users/${user.id}/activity?page=${activityPage}&perPage=${ACTIVITY_PER_PAGE}`,
          { cache: "no-store" },
        )
        const d = (await res.json()) as { rows?: ActivityRow[]; total?: number }
        if (reqId !== activityReqRef.current) return
        setActivity(d.rows ?? [])
        setActivityTotal(d.total ?? 0)
      } catch {
        if (reqId !== activityReqRef.current) return
        setActivity([])
        setActivityTotal(0)
      } finally {
        if (reqId === activityReqRef.current) setActivityKey(wantActivityKey)
      }
    })()
  }, [tab, user.id, activityPage, activityKey, wantActivityKey])

  const activityPages = Math.max(1, Math.ceil(activityTotal / ACTIVITY_PER_PAGE))
  const activeTeam = useMemo(() => data?.teams.find((t) => t.isActive) ?? null, [data])
  const upline = data?.upline ?? []

  const TABS: { id: TabId; label: string; badge?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "network", label: "Team & Recruits", badge: (data?.teammatesTotal ?? 0) + (data?.recruitsTotal ?? 0) },
    { id: "invites", label: "Invitations", badge: data?.invites.length },
    { id: "sales", label: "Sales Reports", badge: data?.sales.count },
    { id: "listings", label: "Listings", badge: data?.listings.count },
    { id: "activity", label: "Activity", badge: data?.activityTotal },
  ]

  return (
    <div className="space-y-4">
      {/* back */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6b7280] hover:text-[#001f3f] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> All accounts
      </button>

      {/* ── hero — solid navy band, name on white below it ───────────────── */}
      <div className="rounded-2xl border border-black/[0.08] bg-white overflow-hidden">
        <div className="h-20 bg-[#001f3f]" />
        <div className="px-5 sm:px-6 pb-5">
          <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
            <div className="-mt-12 rounded-full ring-4 ring-white shadow-md shrink-0">
              <UserAvatar name={displayName} imageUrl={user.profile_url} size={104} />
            </div>

            <div className="min-w-0 flex-1 pt-4">
              <h2 className="font-['Outfit'] text-[26px] sm:text-[32px] leading-tight font-extrabold text-[#0d1117] break-words">
                {displayName}
              </h2>
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <span className={`text-[11px] font-bold capitalize px-2.5 py-1 rounded-full border ${roleChip(user.role)}`}>
                  {roleLabel(user.role)}
                </span>
                <span className={`text-[11px] font-bold capitalize px-2.5 py-1 rounded-full border ${statusChip(user.status)}`}>
                  {user.status ?? "pending"}
                </span>
                {user.is_deleted && (
                  <span className="text-[11px] font-bold uppercase px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-100">Deleted</span>
                )}
                {activeTeam && (
                  <span className="text-[11px] font-semibold text-[#6b7280] inline-flex items-center gap-1.5">
                    <Network className="w-3.5 h-3.5 text-[#9ca3af]" />{activeTeam.name}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onEdit}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#002b57] transition-colors shrink-0"
            >
              <Edit3 className="w-4 h-4" /> Edit profile
            </button>
          </div>

          {/* quick contact strip */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 pt-4 border-t border-[#f0f2f5] text-xs text-[#6b7280]">
            {phone && <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-[#9ca3af]" />{phone}</span>}
            {whatsapp && <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-emerald-500" />{whatsapp}</span>}
            {(data?.email ?? user.email) && (
              <a href={`mailto:${data?.email ?? user.email}`} className="inline-flex items-center gap-1.5 hover:text-[#001f3f]">
                <Mail className="w-3.5 h-3.5 text-[#9ca3af]" />{data?.email ?? user.email}
              </a>
            )}
            {facebook && (
              <a href={facebook} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-blue-600 hover:underline">
                <Facebook className="w-3.5 h-3.5" />Facebook
              </a>
            )}
            {linkedin && (
              <a href={linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-blue-600 hover:underline">
                <Linkedin className="w-3.5 h-3.5" />LinkedIn
              </a>
            )}
            <span className="inline-flex items-center gap-1.5 ml-auto">
              <Clock className="w-3.5 h-3.5 text-[#9ca3af]" />
              Last online:{" "}
              <span className="font-semibold text-[#374151]">
                {loading ? "…" : data?.lastSignInAt ? relativeTime(data.lastSignInAt) : "Never signed in"}
              </span>
            </span>
          </div>
        </div>

        {/* upline chain */}
        {!loading && <UplineStrip upline={upline} onOpen={onOpenUser} />}
      </div>

      {/* ── stat tiles ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[104px] rounded-2xl bg-white border border-black/[0.08] animate-pulse" />)
        ) : (
          <>
            <StatTile icon={<UserPlus />} label="Recruits" value={String(data?.recruitsTotal ?? 0)} hint="Referred by this user" tone="gold" />
            <StatTile icon={<Network />} label="Team members" value={String(data?.teammatesTotal ?? 0)} hint={activeTeam?.name ?? "No team"} tone="navy" />
            <StatTile icon={<TrendingUp />} label="Own sales" value={String(data?.sales.count ?? 0)} hint={money(data?.sales.totalValue ?? 0)} tone="emerald" />
            <StatTile icon={<Users />} label="Group sales" value={String(data?.groupSales.combined.count ?? 0)} hint={money(data?.groupSales.combined.value ?? 0)} tone="gold" />
            <StatTile icon={<Building2 />} label="Listings" value={String(data?.listings.count ?? 0)} hint={`${data?.listings.byStatus.published ?? 0} published`} tone="sky" />
            <StatTile icon={<Ticket />} label="Invitations" value={String(data?.invites.length ?? 0)} hint={`${data?.invites.filter((i) => i.status === "active").length ?? 0} active`} tone="violet" />
          </>
        )}
      </div>

      {/* ── tabs ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-black/[0.08] bg-white overflow-hidden">
        <div className="flex gap-1 px-3 pt-3 border-b border-[#f0f2f5] overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all whitespace-nowrap ${
                tab === t.id ? "bg-[#001f3f] text-white" : "text-[#6b7280] hover:text-[#111827] hover:bg-[#f3f4f6]"
              }`}
            >
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className={`ml-1.5 text-[10px] font-bold ${tab === t.id ? "text-[#d6b357]" : "text-[#9ca3af]"}`}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5 bg-[#fafbfc]">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#9ca3af]">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading account details…
            </div>
          ) : (
            <>
              {/* ── Overview ─────────────────────────────────────────── */}
              {tab === "overview" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Panel title="Personal">
                    <div className="p-5 space-y-4">
                      <Field label="Full name">{displayName}</Field>
                      <Field label="Birthday" icon={<Calendar />}>{user.birthday ? formatDate(user.birthday) : dash}</Field>
                      <Field label="Gender">{user.gender ? titleCase(user.gender) : dash}</Field>
                      <Field label="Nationality" icon={<Globe />}>{nationality || dash}</Field>
                      <Field label="License number" icon={<BadgeCheck />}>{license || dash}</Field>
                    </div>
                  </Panel>

                  <Panel title="Account">
                    <div className="p-5 space-y-4">
                      <Field label="Role">{roleLabel(user.role)}</Field>
                      <Field label="Status">{titleCase(user.status ?? "pending")}</Field>
                      <Field label="Joined" icon={<Calendar />}>{user.joined_at ? formatDate(user.joined_at) : dash}</Field>
                      <Field label="Timezone" icon={<Clock />}>
                        {user.timezone ? (TIMEZONES.find((t) => t.value === user.timezone)?.label ?? user.timezone) : dash}
                      </Field>
                      <Field label="Upline / referred by" icon={<Users />}>
                        {upline.length === 0 ? (
                          user.referred_by_name ? titleCase(user.referred_by_name) : dash
                        ) : (
                          <ol className="space-y-1">
                            {upline.map((p, i) => (
                              <li key={p.id} className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-[#c0c6cf] tabular-nums w-4">{i + 1}.</span>
                                {onOpenUser ? (
                                  <button type="button" onClick={() => onOpenUser(p.id)} className="text-[13px] text-[#001f3f] font-semibold hover:underline">
                                    {titleCase(p.fullname ?? "Unnamed")}
                                  </button>
                                ) : (
                                  <span className="text-[13px] font-semibold">{titleCase(p.fullname ?? "Unnamed")}</span>
                                )}
                                <span className="text-[11px] text-[#9ca3af]">· {roleLabel(p.role)}</span>
                              </li>
                            ))}
                          </ol>
                        )}
                      </Field>
                    </div>
                  </Panel>

                  <Panel title="Team">
                    <div className="p-5 space-y-4">
                      <Field label="Current team" icon={<Network />}>
                        {activeTeam ? activeTeam.name : dash}
                      </Field>
                      <Field label="Position" icon={<Briefcase />}>
                        {activeTeam?.roleInTeam ? titleCase(activeTeam.roleInTeam) : dash}
                      </Field>
                      <Field label="In team since" icon={<Calendar />}>
                        {activeTeam?.joinedAt ? formatDate(activeTeam.joinedAt) : dash}
                      </Field>
                      <Field label="Team production" icon={<TrendingUp />}>
                        {data?.groupSales.team.count
                          ? `${data.groupSales.team.count} deals · ${money(data.groupSales.team.value)}`
                          : dash}
                      </Field>
                      {(data?.teams.length ?? 0) > 1 && (
                        <Field label="Previous teams">
                          <ul className="space-y-1">
                            {data?.teams.filter((t) => !t.isActive).map((t) => (
                              <li key={`${t.id}-${t.joinedAt}`} className="text-[12px] text-[#6b7280]">
                                {t.name}
                                {t.leftAt ? ` · left ${formatDate(t.leftAt)}` : ""}
                              </li>
                            ))}
                          </ul>
                        </Field>
                      )}
                    </div>
                  </Panel>
                </div>
              )}

              {/* ── Team & Recruits ──────────────────────────────────── */}
              {tab === "network" && (
                <div className="space-y-4">
                  {/* group production */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <StatTile
                      icon={<Network />}
                      label="Team sales"
                      value={money(data?.groupSales.team.value ?? 0)}
                      hint={`${data?.groupSales.team.count ?? 0} deals from ${data?.teammates.length ?? 0} members`}
                      tone="navy"
                    />
                    <StatTile
                      icon={<UserPlus />}
                      label="Recruit sales"
                      value={money(data?.groupSales.recruits.value ?? 0)}
                      hint={`${data?.groupSales.recruits.count ?? 0} deals from ${data?.recruits.length ?? 0} recruits`}
                      tone="gold"
                    />
                    <StatTile
                      icon={<TrendingUp />}
                      label="Group total"
                      value={money(data?.groupSales.combined.value ?? 0)}
                      hint={`${data?.groupSales.combined.count ?? 0} deals incl. own production`}
                      tone="emerald"
                    />
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <PersonList
                      title={activeTeam ? `Team — ${activeTeam.name}` : "Team members"}
                      people={data?.teammates ?? []}
                      total={data?.teammatesTotal}
                      emptyLabel={activeTeam ? "No other active members in this team." : "This account isn't in a team yet."}
                      onOpen={onOpenUser}
                    />
                    <PersonList
                      title="Recruits"
                      people={data?.recruits ?? []}
                      total={data?.recruitsTotal}
                      emptyLabel="Nobody has registered with this user's referral link yet."
                      onOpen={onOpenUser}
                    />
                  </div>
                </div>
              )}

              {/* ── Invitations ──────────────────────────────────────── */}
              {tab === "invites" && (
                <Panel title="Invitation links created" count={data?.invites.length ?? 0}>
                  {(data?.invites.length ?? 0) === 0 ? (
                    <EmptyRow>This account hasn&apos;t created any invitation links.</EmptyRow>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[13px]">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-wider text-black/40 border-b border-[#f0f2f5]">
                            <th className="text-left font-bold px-5 py-2.5">Label</th>
                            <th className="text-left font-bold px-5 py-2.5">Developer</th>
                            <th className="text-left font-bold px-5 py-2.5">Uses</th>
                            <th className="text-left font-bold px-5 py-2.5">Expires</th>
                            <th className="text-left font-bold px-5 py-2.5">Status</th>
                            <th className="text-left font-bold px-5 py-2.5">Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data?.invites.map((inv) => (
                            <tr key={inv.id} className="border-b border-[#f6f7f9] last:border-0">
                              <td className="px-5 py-3 font-semibold text-[#0d1117]">{inv.label || "Untitled link"}</td>
                              <td className="px-5 py-3 text-[#6b7280]">{inv.developerName || "Any"}</td>
                              <td className="px-5 py-3 tabular-nums text-[#374151]">
                                {inv.useCount}{inv.maxUses ? ` / ${inv.maxUses}` : ""}
                              </td>
                              <td className="px-5 py-3 text-[#6b7280]">{inv.expiresAt ? formatDate(inv.expiresAt) : "Never"}</td>
                              <td className="px-5 py-3">
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                  inv.status === "active" ? "bg-emerald-50 text-emerald-600"
                                    : inv.status === "expired" ? "bg-amber-50 text-amber-600"
                                    : inv.status === "used_up" ? "bg-sky-50 text-sky-600"
                                    : "bg-rose-50 text-rose-600"
                                }`}>
                                  {inv.status.replace("_", " ")}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-[#9ca3af]">{inv.createdAt ? formatDate(inv.createdAt) : dash}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>
              )}

              {/* ── Sales ────────────────────────────────────────────── */}
              {tab === "sales" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatTile icon={<TrendingUp />} label="Total deals" value={String(data?.sales.count ?? 0)} tone="emerald" />
                    <StatTile icon={<TrendingUp />} label="Contract value" value={money(data?.sales.totalValue ?? 0)} tone="gold" />
                    <StatTile icon={<BadgeCheck />} label="Released" value={String(data?.sales.byStatus.released ?? 0)} tone="navy" />
                    <StatTile icon={<Clock />} label="Pending" value={String(data?.sales.byStatus.pending ?? 0)} tone="violet" />
                  </div>
                  <Panel title="Recent sales reports" count={data?.sales.count ?? 0}>
                    {(data?.sales.recent.length ?? 0) === 0 ? (
                      <EmptyRow>No sales reported by this account yet.</EmptyRow>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                          <thead>
                            <tr className="text-[10px] uppercase tracking-wider text-black/40 border-b border-[#f0f2f5]">
                              <th className="text-left font-bold px-5 py-2.5">Project</th>
                              <th className="text-left font-bold px-5 py-2.5">Developer</th>
                              <th className="text-left font-bold px-5 py-2.5">Type</th>
                              <th className="text-right font-bold px-5 py-2.5">Contract price</th>
                              <th className="text-left font-bold px-5 py-2.5">Commission</th>
                              <th className="text-left font-bold px-5 py-2.5">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data?.sales.recent.map((s) => (
                              <tr key={s.id} className="border-b border-[#f6f7f9] last:border-0">
                                <td className="px-5 py-3 font-semibold text-[#0d1117]">{s.projectName || "—"}</td>
                                <td className="px-5 py-3 text-[#6b7280]">{s.developerName || "—"}</td>
                                <td className="px-5 py-3 text-[#6b7280] capitalize">{s.saleType ?? "—"}</td>
                                <td className="px-5 py-3 text-right tabular-nums font-semibold text-[#0d1117]">{money(s.contractPrice)}</td>
                                <td className="px-5 py-3">
                                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#f4f6f9] text-[#6b7280] capitalize">
                                    {s.commissionStatus ?? "—"}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-[#9ca3af]">{s.date ? formatDate(s.date) : dash}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Panel>
                </div>
              )}

              {/* ── Listings ─────────────────────────────────────────── */}
              {tab === "listings" && (
                <Panel title="Agent listings" count={data?.listings.count ?? 0}>
                  {(data?.listings.recent.length ?? 0) === 0 ? (
                    <EmptyRow>This account has no listings.</EmptyRow>
                  ) : (
                    <div>
                      {data?.listings.recent.map((l) => (
                        <div key={l.id} className="flex items-center gap-3 px-5 py-3 border-b border-[#f6f7f9] last:border-0">
                          <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold text-[#0d1117] truncate">{l.title || "Untitled listing"}</p>
                            <p className="text-[11px] text-[#9ca3af]">
                              {l.listingKind ? titleCase(l.listingKind) : "—"}
                              {l.updatedAt ? ` · updated ${relativeTime(l.updatedAt)}` : ""}
                            </p>
                          </div>
                          {l.price != null && (
                            <span className="text-[13px] font-bold text-[#0d1117] tabular-nums shrink-0">
                              {money(l.price, l.currency ?? "AED")}
                            </span>
                          )}
                          <span className="shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#f4f6f9] text-[#6b7280]">
                            {l.status ?? "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              )}

              {/* ── Activity ─────────────────────────────────────────── */}
              {tab === "activity" && (
                <Panel
                  title="Activity log"
                  count={activityTotal}
                  action={activityPages > 1 ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                        disabled={activityPage === 1 || activityLoading}
                        className="p-1.5 rounded-lg border border-[#e5e5e5] text-[#6b7280] disabled:opacity-40 hover:border-[#001f3f]/30 transition-colors"
                        aria-label="Previous"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[11px] font-semibold text-[#374151] px-1 tabular-nums">{activityPage} / {activityPages}</span>
                      <button
                        type="button"
                        onClick={() => setActivityPage((p) => (p < activityPages ? p + 1 : p))}
                        disabled={activityPage >= activityPages || activityLoading}
                        className="p-1.5 rounded-lg border border-[#e5e5e5] text-[#6b7280] disabled:opacity-40 hover:border-[#001f3f]/30 transition-colors"
                        aria-label="Next"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : undefined}
                >
                  {activityLoading ? (
                    <div className="flex items-center gap-2 px-5 py-10 text-xs text-[#9ca3af]">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading activity…
                    </div>
                  ) : activity.length === 0 ? (
                    <EmptyRow>No activity recorded for this user yet.</EmptyRow>
                  ) : (
                    <ol className="px-5 py-4 space-y-3">
                      {activity.map((row) => (
                        <li key={row.id} className="flex items-start gap-3">
                          <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: eventColor(row.event) }} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold" style={{ color: eventColor(row.event) }}>{humanizeEvent(row.event)}</span>
                              <span className="text-[10px] text-[#9ca3af]">from {row.source}</span>
                              <span
                                className="text-[10px] text-[#9ca3af] ml-auto"
                                title={`Dubai: ${formatDateAtTimeInZone(row.occurred_at, "Asia/Dubai")} · PH: ${formatDateAtTimeInZone(row.occurred_at, "Asia/Manila")}`}
                              >
                                {relativeTime(row.occurred_at)}
                              </span>
                            </div>
                            {(row.description || row.subject_label) && (
                              <p className="text-xs text-[#374151] mt-0.5 break-words">{row.description || row.subject_label}</p>
                            )}
                            {row.actor_name && <p className="text-[10px] text-[#9ca3af] mt-0.5">by {row.actor_name}</p>}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </Panel>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
