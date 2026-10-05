"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Building2, Check, ChevronDown, ChevronRight, Clock, ExternalLink, FileSpreadsheet, FileText, Loader2, Network, RefreshCw, Search, UserPlus, UserRound, Users, X,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { isAdminStaffRole } from "@/lib/app-roles"
import { getDashboardRouteByRole, roleToLabel } from "@/lib/auth"
import { STATUS_COLORS } from "@/lib/user-service"
import { countryFlag } from "@/lib/countries"
import type { RecruitmentDeal, RecruitmentPerson } from "@/app/api/admin/recruitment/route"

/**
 * Accounts & Invites → Recruitment (admin staff): the questions the Account
 * Directory can't answer at a glance —
 *   · who is waiting for approval, and who invited them (Activate right here);
 *   · who recruits most (direct recruits: total, active, pending, last 30 days);
 *   · a recruiter's whole downline, level by level — with an Excel / PDF export
 *     of the whole pyramid (each person under the one who recruited them);
 *   · accounts that registered on the website directly, with no inviter.
 * Everything is derived on the client from one compact list of accounts
 * (GET /api/admin/recruitment); activating goes through the same
 * PATCH /api/admin/users/[id] the Directory uses.
 */

type Tab = "pending" | "direct" | "recruiters" | "downline"
const DAY = 24 * 60 * 60 * 1000
const MAX_DEPTH = 8

/** "AED 2.4M" / "AED 850K" for columns; the exact figure goes in the tooltip. */
const fmtAedShort = (n: number) => (n >= 1_000_000 ? `AED ${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M` : n >= 1_000 ? `AED ${Math.round(n / 1_000)}K` : n > 0 ? `AED ${n}` : "—")
const fmtAed = (n: number) => `AED ${Math.round(n).toLocaleString("en-AE")}`

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric" }) : "—"

function StatusChip({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.pending
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-bold capitalize ${c.bg} ${c.text} ${c.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {status}
    </span>
  )
}

function Avatar({ p, size = "h-9 w-9 text-sm" }: { p: RecruitmentPerson; size?: string }) {
  return p.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.photo} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#001f3f] to-[#003366] font-bold text-white`}>
      {p.name.charAt(0).toUpperCase()}
    </span>
  )
}

export default function RecruitmentPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))
  const base = getDashboardRouteByRole(role)

  const [people, setPeople] = useState<RecruitmentPerson[] | null>(null)
  const [deals, setDeals] = useState<RecruitmentDeal[]>([])
  /** The sales figure the admin clicked, opened into its deals. */
  const [dealsView, setDealsView] = useState<{ title: string; subtitle: string; agentIds: Set<string>; level: Map<string, { level: number; via: string }> } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<Tab>("pending")
  const [query, setQuery] = useState("")
  const [rootId, setRootId] = useState<string | null>(null)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState<string | null>(null)
  // When the list was loaded — "last 30 days" is measured from here, so the memos stay pure.
  const [loadedAt, setLoadedAt] = useState(0)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/recruitment", { cache: "no-store" })
      const json = (await res.json().catch(() => ({}))) as { people?: RecruitmentPerson[]; deals?: RecruitmentDeal[]; error?: string }
      if (!res.ok || !json.people) throw new Error(json.error ?? `Request failed (${res.status}).`)
      setPeople(json.people)
      setDeals(json.deals ?? [])
      setLoadedAt(Date.now())
      setError(null)
      // A link straight to one person (the admin bell): their queue, searched for them.
      const wanted = new URLSearchParams(window.location.search).get("focus")
      const hit = wanted ? json.people.find((p) => p.id === wanted) : null
      if (hit) {
        setTab(hit.status === "pending" ? "pending" : "direct")
        setQuery(hit.name)
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    if (!allowed) return
    void load()
  }, [allowed, load])

  const byId = useMemo(() => new Map((people ?? []).map((p) => [p.id, p])), [people])
  const childrenOf = useMemo(() => {
    const m = new Map<string, RecruitmentPerson[]>()
    for (const p of people ?? []) {
      if (!p.invitedBy || !byId.has(p.invitedBy)) continue
      const list = m.get(p.invitedBy) ?? []
      list.push(p)
      m.set(p.invitedBy, list)
    }
    for (const list of m.values()) list.sort((a, b) => (b.joinedAt ?? "").localeCompare(a.joinedAt ?? ""))
    return m
  }, [people, byId])

  const recent = useCallback((p: RecruitmentPerson) => !!p.joinedAt && loadedAt - new Date(p.joinedAt).getTime() <= 30 * DAY, [loadedAt])

  const pending = useMemo(
    () => (people ?? []).filter((p) => p.status === "pending").sort((a, b) => (b.joinedAt ?? "").localeCompare(a.joinedAt ?? "")),
    [people],
  )

  // Registered on the website with no invite link behind them.
  const direct = useMemo(
    () => (people ?? []).filter((p) => !p.invitedBy || !byId.has(p.invitedBy)).sort((a, b) => (b.joinedAt ?? "").localeCompare(a.joinedAt ?? "")),
    [people, byId],
  )

  /** Validated sales of everyone under a recruiter, any depth (not the recruiter's own). */
  const networkSales = useCallback(
    (id: string) => {
      const seen = new Set<string>([id])
      const stack = [id]
      let deals = 0, value = 0
      while (stack.length) {
        for (const c of childrenOf.get(stack.pop() as string) ?? []) {
          if (seen.has(c.id)) continue
          seen.add(c.id)
          deals += c.deals
          value += c.sales
          stack.push(c.id)
        }
      }
      return { deals, value }
    },
    [childrenOf],
  )

  /** Everyone under a recruiter, any depth, cycle-safe. */
  const networkSize = useCallback(
    (id: string) => {
      const seen = new Set<string>([id])
      const stack = [id]
      let n = 0
      while (stack.length) {
        for (const c of childrenOf.get(stack.pop() as string) ?? []) {
          if (seen.has(c.id)) continue
          seen.add(c.id)
          n++
          stack.push(c.id)
        }
      }
      return n
    },
    [childrenOf],
  )

  /** The downline as rows, depth-first: each person right under their recruiter. */
  const downlineRows = useCallback(
    (rootId: string) => {
      const rows: { level: number; p: RecruitmentPerson; via: string }[] = []
      const seen = new Set<string>([rootId])
      const walk = (id: string, level: number, via: string) => {
        for (const c of childrenOf.get(id) ?? []) {
          if (seen.has(c.id)) continue
          seen.add(c.id)
          rows.push({ level, p: c, via })
          if (level < 12) walk(c.id, level + 1, c.name)
        }
      }
      walk(rootId, 1, byId.get(rootId)?.name ?? "")
      return rows
    },
    [childrenOf, byId],
  )

  /** "Own sales" of one person → their deals. */
  const showOwnDeals = (p: RecruitmentPerson) =>
    setDealsView({ title: `${p.name} — own sales`, subtitle: `${p.deals} validated deal${p.deals === 1 ? "" : "s"} · ${fmtAed(p.sales)}`, agentIds: new Set([p.id]), level: new Map() })
  /** "Network sales" of a recruiter → every deal by anyone under them, with each seller's level. */
  const showNetworkDeals = (root: RecruitmentPerson) => {
    const rows = downlineRows(root.id)
    const n = networkSales(root.id)
    setDealsView({
      title: `${root.name} — network sales`,
      subtitle: `${n.deals} validated deal${n.deals === 1 ? "" : "s"} by people in the network · ${fmtAed(n.value)}`,
      agentIds: new Set(rows.map((r) => r.p.id)),
      level: new Map(rows.map((r) => [r.p.id, { level: r.level, via: r.via }])),
    })
  }

  const exportDownline = (root: RecruitmentPerson, kind: "csv" | "pdf") => {
    const rows = downlineRows(root.id)
    const levels = rows.reduce((m, r) => Math.max(m, r.level), 0)
    const stamp = new Date().toISOString().slice(0, 10)
    const file = `downline-${root.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${stamp}`
    if (kind === "csv") {
      const head = ["Level", "Name", "Role", "Status", "Joined", "Recruited by", "Validated deals", "Validated sales (AED)"]
      const body = rows.map((r) => [String(r.level), `${"    ".repeat(r.level - 1)}${r.level > 1 ? "└ " : ""}${r.p.name}`, roleToLabel(r.p.role), r.p.status, fmtDate(r.p.joinedAt), r.via, String(r.p.deals), String(r.p.sales)])
      const csv = "\uFEFF" + [head, ...body].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n")
      const a = document.createElement("a")
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
      a.download = `${file}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
      return
    }
    const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    const w = window.open("", "_blank", "width=1000,height=720")
    if (!w) return
    const perLevel = Array.from({ length: levels }, (_, i) => rows.filter((r) => r.level === i + 1).length)
    const tr = rows
      .map(
        (r) => `<tr class="l${Math.min(r.level, 6)}">
          <td class="n">${r.level}</td>
          <td class="name" style="padding-left:${12 + (r.level - 1) * 22}px"><span class="tick">${r.level > 1 ? "└" : "•"}</span><strong>${esc(r.p.name)}</strong></td>
          <td>${esc(roleToLabel(r.p.role))}</td>
          <td><span class="st ${esc(r.p.status)}">${esc(r.p.status)}</span></td>
          <td>${esc(fmtDate(r.p.joinedAt))}</td>
          <td class="via">${esc(r.via)}</td>
          <td class="num">${r.p.deals ? `${r.p.deals} · ${esc(fmtAed(r.p.sales))}` : "—"}</td>
        </tr>`,
      )
      .join("")
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Downline — ${esc(root.name)}</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; padding: 32px; }
  .band { background: #001f3f; border-bottom: 4px solid #d6b357; border-radius: 12px 12px 0 0; padding: 22px 28px; }
  .band h1 { color: #fff; font-size: 22px; }
  .band .gold { color: #d6b357; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
  .meta { display: flex; flex-wrap: wrap; gap: 24px; padding: 14px 28px; background: #f6f8fb; border: 1px solid #e8eaed; border-top: 0; font-size: 12px; color: #4b5563; }
  .meta strong { color: #001f3f; }
  table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 12px; }
  th { background: #001f3f; color: #fff; text-align: left; padding: 9px 10px; font-size: 10.5px; letter-spacing: 1px; text-transform: uppercase; }
  td { padding: 8px 10px; border-bottom: 1px solid #eef0f3; vertical-align: top; }
  .n { color: #9ca3af; width: 44px; text-align: center; }
  .tick { color: #d6b357; margin-right: 8px; font-weight: 700; }
  .via { color: #6b7280; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .l1 td { background: #fbfaf5; }
  .st { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 700; text-transform: capitalize; }
  .st.active { background: #dcfce7; color: #166534; } .st.pending { background: #fef3c7; color: #92400e; } .st.inactive { background: #f3f4f6; color: #4b5563; }
  .foot { margin-top: 22px; text-align: center; font-size: 11px; color: #9ca3af; }
  .foot b { color: #b8913f; }
  @page { size: portrait; margin: 12mm; }
</style></head><body>
  <div class="band"><p class="gold">FHI Global · Recruitment</p><h1>${esc(root.name)} — downline</h1></div>
  <div class="meta">
    <span>Direct recruits: <strong>${childrenOf.get(root.id)?.length ?? 0}</strong></span>
    <span>Whole network: <strong>${rows.length}</strong> people across <strong>${levels}</strong> level${levels === 1 ? "" : "s"}</span>
    <span>Per level: <strong>${perLevel.join(" › ")}</strong></span>
    <span>Network validated sales: <strong>${rows.reduce((a, r) => a + r.p.deals, 0)} deals · ${esc(fmtAed(rows.reduce((a, r) => a + r.p.sales, 0)))}</strong></span>
    <span>Generated: <strong>${esc(new Date().toLocaleDateString("en-AE", { year: "numeric", month: "long", day: "numeric" }))}</strong></span>
  </div>
  <table>
    <thead><tr><th>Level</th><th>Name</th><th>Role</th><th>Status</th><th>Joined</th><th>Recruited by</th><th style="text-align:right">Validated sales</th></tr></thead>
    <tbody>${tr}</tbody>
  </table>
  <p class="foot">Each person is listed under the one who recruited them — indented one step per level · <b>fhiglobal.ae</b></p>
</body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 350)
  }

  const recruiters = useMemo(() => {
    return [...childrenOf.entries()]
      .map(([id, kids]) => ({
        person: byId.get(id) as RecruitmentPerson,
        total: kids.length,
        active: kids.filter((k) => k.status === "active").length,
        pending: kids.filter((k) => k.status === "pending").length,
        last30: kids.filter(recent).length,
        network: networkSize(id),
        ownSales: (byId.get(id) as RecruitmentPerson).sales,
        netSales: networkSales(id),
      }))
      .sort((a, b) => b.total - a.total || b.network - a.network || a.person.name.localeCompare(b.person.name))
  }, [childrenOf, byId, networkSize, networkSales, recent])

  const q = query.trim().toLowerCase()
  const match = (p: RecruitmentPerson) => {
    if (!q || p.name.toLowerCase().includes(q)) return true
    const inviterId = p.invitedBy ?? p.signupInviter
    return inviterId ? (byId.get(inviterId)?.name.toLowerCase().includes(q) ?? false) : false
  }

  const activate = async (p: RecruitmentPerson) => {
    setBusy((s) => new Set(s).add(p.id))
    setNotice(null)
    try {
      const res = await fetch(`/api/admin/users/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(json.error ?? `Couldn't activate (${res.status}).`)
      }
      setPeople((prev) => (prev ?? []).map((x) => (x.id === p.id ? { ...x, status: "active" } : x)))
      setNotice(`${p.name} is now active.`)
    } catch (e) {
      setNotice((e as Error).message)
    } finally {
      setBusy((s) => {
        const next = new Set(s)
        next.delete(p.id)
        return next
      })
    }
  }

  if (!allowed) return null

  const stats = people
    ? [
        { icon: Clock, label: "Waiting for approval", value: pending.length, tone: "text-amber-700 bg-amber-50 border-amber-200" },
        { icon: UserPlus, label: "Joined in the last 30 days", value: people.filter(recent).length, tone: "text-[#001f3f] bg-[#001f3f]/5 border-[#001f3f]/15" },
        { icon: Network, label: "Active recruiters", value: recruiters.length, tone: "text-[#8a6d2b] bg-[#d6b357]/15 border-[#d6b357]/40" },
        { icon: Users, label: "Active accounts", value: people.filter((p) => p.status === "active").length, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
      ]
    : []

  const tabBtn = (v: Tab, label: string, n?: number) => (
    <button
      type="button"
      onClick={() => {
        setTab(v)
        setQuery("")
      }}
      aria-pressed={tab === v}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${tab === v ? "bg-[#001f3f] text-white" : "text-[#374151] hover:bg-[#f3f4f6]"}`}
    >
      {label}
      {n !== undefined && <span className={`rounded-full px-1.5 text-[11px] ${tab === v ? "bg-white/15" : "bg-[#f3f4f6]"}`}>{n}</span>}
    </button>
  )

  const profileHref = (id: string) => `${base}/accounts/users?account=${id}`
  const root = rootId ? byId.get(rootId) ?? null : null

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-['Outfit'] text-2xl font-bold text-[#0d1117]">
            <UserPlus className="h-6 w-6 text-[#001f3f]" />
            Recruitment
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-[#6b7280]">
            Who is waiting for approval and who invited them, who recruits most, and each recruiter&apos;s downline — from the
            invite links people registered through.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setRefreshing(true)
            void load().finally(() => setRefreshing(false))
          }}
          disabled={refreshing || people === null}
          className="inline-flex items-center gap-1.5 self-start rounded-lg bg-[#f4f6f9] px-3 py-2 text-xs font-semibold text-[#6b7280] transition-colors hover:bg-[#e8eaed] hover:text-[#001f3f] disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* The numbers */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(people ? stats : Array.from({ length: 4 }, () => null)).map((s, i) =>
          s ? (
            <div key={s.label} className="rounded-2xl border border-[#e8eaed] bg-white px-4 py-4">
              <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${s.tone}`}>
                <s.icon className="h-4 w-4" />
              </span>
              <p className="mt-3 font-['Outfit'] text-3xl font-bold text-[#0d1117]">{s.value}</p>
              <p className="mt-0.5 text-xs font-semibold text-[#6b7280]">{s.label}</p>
            </div>
          ) : (
            <div key={i} className="h-[118px] animate-pulse rounded-2xl border border-[#e8eaed] bg-white" />
          ),
        )}
      </div>

      <div className="rounded-2xl border border-[#e8eaed] bg-white p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex flex-wrap gap-1 self-start rounded-xl border border-[#e5e7eb] bg-white p-1">
            {tabBtn("pending", "Waiting for approval", people ? pending.length : undefined)}
            {tabBtn("recruiters", "Top recruiters", people ? recruiters.length : undefined)}
            {tabBtn("downline", "Downline")}
            {tabBtn("direct", "Direct sign-ups", people ? direct.length : undefined)}
          </div>
          <div className="relative lg:w-80">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === "downline" ? "Find a recruiter…" : tab === "direct" ? "Search by name…" : "Search by name or inviter…"}
              className="w-full rounded-xl border border-[#e5e5e5] py-2.5 pl-10 pr-4 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#001f3f] focus:outline-none"
            />
          </div>
        </div>

        {notice && <p className="mt-4 rounded-lg bg-[#f4f6f9] px-3 py-2 text-xs font-semibold text-[#374151]">{notice}</p>}

        {people === null && !error ? (
          <p className="flex items-center gap-2 py-8 text-sm text-[#9ca3af]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading accounts…
          </p>
        ) : error ? (
          <p className="py-8 text-sm text-[#9ca3af]">Couldn&apos;t load the accounts right now. {error}</p>
        ) : tab === "pending" ? (
          <PendingList items={pending.filter(match)} byId={byId} busy={busy} onActivate={activate} profileHref={profileHref} empty={q ? "Nobody matches." : "Nobody is waiting — every account is approved."} />
        ) : tab === "direct" ? (
          <DirectList items={direct.filter(match)} profileHref={profileHref} empty={q ? "Nobody matches." : "Everyone came through an invite link."} />
        ) : tab === "recruiters" ? (
          <RecruiterTable
            rows={recruiters.filter((r) => match(r.person))}
            profileHref={profileHref}
            onDownline={(id) => {
              setRootId(id)
              setTab("downline")
              setQuery("")
            }}
            onOwnDeals={showOwnDeals}
            onNetworkDeals={showNetworkDeals}
          />
        ) : (
          <Downline
            root={root}
            candidates={q ? recruiters.filter((r) => r.person.name.toLowerCase().includes(q)).slice(0, 8).map((r) => r.person) : []}
            onPick={(id) => {
              setRootId(id)
              setQuery("")
            }}
            childrenOf={childrenOf}
            networkSize={networkSize}
            networkSales={networkSales}
            profileHref={profileHref}
            onExport={exportDownline}
            onOwnDeals={showOwnDeals}
            onNetworkDeals={showNetworkDeals}
          />
        )}
      </div>

      {dealsView && (
        <DealsPanel
          view={dealsView}
          deals={deals.filter((d) => dealsView.agentIds.has(d.agentId))}
          byId={byId}
          saleHref={(id) => `${base}/sales/${id}`}
          profileHref={profileHref}
          onClose={() => setDealsView(null)}
        />
      )}
    </div>
  )
}

// ─── The deals behind a figure ───────────────────────────────────────────────

function DealsPanel({
  view,
  deals,
  byId,
  saleHref,
  profileHref,
  onClose,
}: {
  view: { title: string; subtitle: string; level: Map<string, { level: number; via: string }> }
  deals: RecruitmentDeal[]
  byId: Map<string, RecruitmentPerson>
  saleHref: (id: string) => string
  profileHref: (id: string) => string
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])
  const sorted = [...deals].sort((a, b) => b.date.localeCompare(a.date))
  const th = "px-3 py-2 text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9ca3af]"
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={view.title}>
      <button type="button" className="absolute inset-0 bg-black/45 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#e8eaed] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 bg-[#001f3f] px-6 py-4 text-white">
          <div>
            <p className="font-['Outfit'] text-lg font-bold">{view.title}</p>
            <p className="text-xs text-white/70">{view.subtitle} · validated sales only, all time</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-auto">
          {sorted.length === 0 ? (
            <p className="px-6 py-10 text-sm text-[#9ca3af]">No validated sales here yet.</p>
          ) : (
            <table className="w-full min-w-[760px]">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-[#f0f2f5]">
                  <th className={th}>Date</th>
                  <th className={th}>Agent</th>
                  <th className={th}>Project</th>
                  <th className={`${th} text-right`}>Credited</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f2f5]">
                {sorted.map((d) => {
                  const agent = byId.get(d.agentId)
                  const lv = view.level.get(d.agentId)
                  return (
                    <tr key={`${d.saleId}-${d.agentId}`} className="hover:bg-[#fafbfc]">
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-[#374151]">{fmtDate(d.date)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          {agent && <Avatar p={agent} size="h-8 w-8 text-xs" />}
                          <div className="min-w-0">
                            {agent ? (
                              <Link href={profileHref(agent.id)} className="block truncate text-sm font-bold text-[#111827] hover:text-[#001f3f] hover:underline">{agent.name}</Link>
                            ) : (
                              <span className="block text-sm font-bold text-[#111827]">Unknown agent</span>
                            )}
                            {lv && <p className="text-[11px] text-[#6b7280]">Level {lv.level} · recruited by {lv.via}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-[#111827]">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-[#d6b357]" />
                          <span className="truncate">{d.project ?? (d.saleType ? d.saleType.replace(/_/g, " ") : "Sale")}</span>
                        </p>
                        <p className="text-[11px] text-[#6b7280]">{[d.developer, d.unit ? `Unit ${d.unit}` : null].filter(Boolean).join(" · ") || "—"}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-sm font-semibold tabular-nums text-[#111827]">
                        {fmtAed(d.value)}
                        {d.share !== 100 && <p className="text-[11px] font-normal text-[#6b7280]">{d.share}% of {fmtAed(d.price)}</p>}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link href={saleHref(d.saleId)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e5e5e5] px-2.5 text-xs font-bold text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f]">
                          <ExternalLink className="h-3.5 w-3.5" /> Open
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        {sorted.length > 0 && (
          <p className="border-t border-[#f0f2f5] px-6 py-3 text-right text-sm font-bold text-[#0d1117]">
            Total {fmtAed(sorted.reduce((a, d) => a + d.value, 0))}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Waiting for approval ────────────────────────────────────────────────────

function PendingList({
  items,
  byId,
  busy,
  onActivate,
  profileHref,
  empty,
}: {
  items: RecruitmentPerson[]
  byId: Map<string, RecruitmentPerson>
  busy: Set<string>
  onActivate: (p: RecruitmentPerson) => void
  profileHref: (id: string) => string
  empty: string
}) {
  if (items.length === 0) return <p className="py-8 text-sm text-[#9ca3af]">{empty}</p>
  return (
    <ul className="mt-4 divide-y divide-[#f0f2f5]">
      {items.map((p) => {
        const inviterId = p.invitedBy ?? p.signupInviter
        const inviter = inviterId ? byId.get(inviterId) : null
        return (
          <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
            <Avatar p={p} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#111827]">
                <span className="truncate">{p.name}</span>
                <span className="rounded-full bg-[#001f3f]/5 px-2 py-0.5 text-[10.5px] font-bold text-[#001f3f]">{roleToLabel(p.role)}</span>
                {p.unfinished && (
                  <span
                    className="rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold text-amber-700"
                    title="They entered their email code but never filled in their name — they stopped at Complete profile."
                  >
                    Didn&apos;t finish sign-up
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-[#6b7280]">
                {inviter ? (
                  <>
                    Invited by <span className="font-semibold text-[#374151]">{inviter.name}</span>
                  </>
                ) : (
                  <span className="text-[#9ca3af]">No inviter on record</span>
                )}
                <span className="mx-1.5 text-[#d1d5db]">·</span>
                Joined {fmtDate(p.joinedAt)}
              </p>
              {/* Where they said they live + their WhatsApp (Global Partner sign-up) — to check before approving. */}
              {(p.basedIn || p.whatsapp) && (
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-[#6b7280]">
                  {p.basedIn && (
                    <span>
                      {countryFlag(p.basedIn)} Based in <span className="font-semibold text-[#374151]">{p.basedIn}</span>
                    </span>
                  )}
                  {p.basedIn && p.whatsapp && <span className="text-[#d1d5db]">·</span>}
                  {p.whatsapp && (
                    <a
                      href={`https://wa.me/${p.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tabular-nums hover:text-[#166534] hover:underline"
                    >
                      WhatsApp {p.whatsapp}
                    </a>
                  )}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link href={profileHref(p.id)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e5e5e5] px-3 text-xs font-bold text-[#374151] transition-colors hover:border-[#001f3f] hover:text-[#001f3f]">
                <ExternalLink className="h-3.5 w-3.5" /> Profile
              </Link>
              <button
                type="button"
                onClick={() => onActivate(p)}
                disabled={busy.has(p.id)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
              >
                {busy.has(p.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Activate
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ─── Direct sign-ups ─────────────────────────────────────────────────────────

function DirectList({ items, profileHref, empty }: { items: RecruitmentPerson[]; profileHref: (id: string) => string; empty: string }) {
  if (items.length === 0) return <p className="py-8 text-sm text-[#9ca3af]">{empty}</p>
  return (
    <>
      <p className="mt-4 flex items-center gap-2 text-xs text-[#6b7280]">
        <UserRound className="h-3.5 w-3.5 text-[#b8913f]" /> Registered on the website without an invite link — nobody&apos;s recruits. An admin can set their inviter from the account editor.
      </p>
      <ul className="mt-2 divide-y divide-[#f0f2f5]">
        {items.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
            <Avatar p={p} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#111827]">
                <span className="truncate">{p.name}</span>
                <span className="rounded-full bg-[#001f3f]/5 px-2 py-0.5 text-[10.5px] font-bold text-[#001f3f]">{roleToLabel(p.role)}</span>
                <StatusChip status={p.status} />
              </p>
              <p className="mt-0.5 text-xs text-[#6b7280]">Joined {fmtDate(p.joinedAt)}</p>
            </div>
            <Link href={profileHref(p.id)} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#e5e5e5] px-3 text-xs font-bold text-[#374151] transition-colors hover:border-[#001f3f] hover:text-[#001f3f]">
              <ExternalLink className="h-3.5 w-3.5" /> Profile
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

// ─── Top recruiters ──────────────────────────────────────────────────────────

type RecruiterRow = { person: RecruitmentPerson; total: number; active: number; pending: number; last30: number; network: number; ownSales: number; netSales: { deals: number; value: number } }

function RecruiterTable({
  rows,
  profileHref,
  onDownline,
  onOwnDeals,
  onNetworkDeals,
}: {
  rows: RecruiterRow[]
  profileHref: (id: string) => string
  onDownline: (id: string) => void
  onOwnDeals: (p: RecruitmentPerson) => void
  onNetworkDeals: (p: RecruitmentPerson) => void
}) {
  if (rows.length === 0) return <p className="py-8 text-sm text-[#9ca3af]">No recruiters match.</p>
  const th = "px-3 py-2 text-left text-[10.5px] font-bold uppercase tracking-wide text-[#9ca3af]"
  const num = "px-3 py-3 text-right text-sm font-semibold tabular-nums text-[#111827]"
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[960px]">
        <thead>
          <tr className="border-b border-[#f0f2f5]">
            <th className={th}>#</th>
            <th className={th}>Recruiter</th>
            <th className={`${th} text-right`}>Recruits</th>
            <th className={`${th} text-right`}>Active</th>
            <th className={`${th} text-right`}>Pending</th>
            <th className={`${th} text-right`}>Last 30 days</th>
            <th className={`${th} text-right`}>Whole network</th>
            <th className={`${th} text-right`} title="The recruiter's own validated sales, all time">Own sales</th>
            <th className={`${th} text-right`} title="Validated sales of everyone in the network (not the recruiter's own), all time">Network sales</th>
            <th className={th} />
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f0f2f5]">
          {rows.map((r, i) => (
            <tr key={r.person.id} className="hover:bg-[#fafbfc]">
              <td className="px-3 py-3 text-sm font-bold tabular-nums text-[#d6b357]">{String(i + 1).padStart(2, "0")}</td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-3">
                  <Avatar p={r.person} size="h-8 w-8 text-xs" />
                  <div className="min-w-0">
                    <Link href={profileHref(r.person.id)} className="block truncate text-sm font-bold text-[#111827] hover:text-[#001f3f] hover:underline">
                      {r.person.name}
                    </Link>
                    <p className="text-[11px] text-[#6b7280]">{roleToLabel(r.person.role)}</p>
                  </div>
                </div>
              </td>
              <td className={num}>{r.total}</td>
              <td className={`${num} text-emerald-700`}>{r.active}</td>
              <td className={`${num} ${r.pending ? "text-amber-700" : "text-[#9ca3af]"}`}>{r.pending}</td>
              <td className={num}>{r.last30}</td>
              <td className={num}>{r.network}</td>
              <td className={num}>
                {r.ownSales ? (
                  <button type="button" onClick={() => onOwnDeals(r.person)} title={`${r.person.deals} validated deal${r.person.deals === 1 ? "" : "s"} · ${fmtAed(r.ownSales)} — click for the deals`} className="underline decoration-dotted underline-offset-4 hover:text-[#001f3f]">
                    {fmtAedShort(r.ownSales)}
                  </button>
                ) : (
                  <span className="text-[#9ca3af]" title="No validated sales">—</span>
                )}
              </td>
              <td className={num}>
                {r.netSales.value ? (
                  <button type="button" onClick={() => onNetworkDeals(r.person)} title={`${r.netSales.deals} validated deal${r.netSales.deals === 1 ? "" : "s"} across the network · ${fmtAed(r.netSales.value)} — click for who sold what`} className="text-[#001f3f] underline decoration-dotted underline-offset-4">
                    {fmtAedShort(r.netSales.value)}
                  </button>
                ) : (
                  <span className="text-[#9ca3af]" title="No validated sales in the network">—</span>
                )}
              </td>
              <td className="px-3 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onDownline(r.person.id)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e5e5e5] px-2.5 text-xs font-bold text-[#374151] transition-colors hover:border-[#001f3f] hover:text-[#001f3f]"
                >
                  <Network className="h-3.5 w-3.5" /> Downline
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Downline ────────────────────────────────────────────────────────────────

function Downline({
  root,
  candidates,
  onPick,
  childrenOf,
  networkSize,
  networkSales,
  profileHref,
  onExport,
  onOwnDeals,
  onNetworkDeals,
}: {
  root: RecruitmentPerson | null
  candidates: RecruitmentPerson[]
  onPick: (id: string) => void
  childrenOf: Map<string, RecruitmentPerson[]>
  networkSize: (id: string) => number
  networkSales: (id: string) => { deals: number; value: number }
  profileHref: (id: string) => string
  onExport: (root: RecruitmentPerson, kind: "csv" | "pdf") => void
  onOwnDeals: (p: RecruitmentPerson) => void
  onNetworkDeals: (p: RecruitmentPerson) => void
}) {
  return (
    <div className="mt-4">
      {candidates.length > 0 && (
        <ul className="mb-4 divide-y divide-[#f0f2f5] rounded-xl border border-[#e8eaed]">
          {candidates.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onPick(p.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-[#fafbfc]">
                <Avatar p={p} size="h-7 w-7 text-[11px]" />
                <span className="font-semibold text-[#111827]">{p.name}</span>
                <span className="ml-auto text-xs text-[#6b7280]">{childrenOf.get(p.id)?.length ?? 0} recruits · {networkSize(p.id)} in network</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!root ? (
        <p className="py-8 text-sm text-[#9ca3af]">Pick a recruiter — from the Top recruiters tab, or type a name above.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#001f3f] px-4 py-3 text-white">
            <Avatar p={root} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-['Outfit'] text-base font-bold">{root.name}</p>
              <p className="text-xs text-white/70">
                {childrenOf.get(root.id)?.length ?? 0} direct recruits · {networkSize(root.id)} people in the whole network
                {(() => {
                  const n = networkSales(root.id)
                  return n.value > 0 ? (
                    <>
                      {" · network sales "}
                      <button type="button" onClick={() => onNetworkDeals(root)} className="font-bold text-[#d6b357] underline decoration-dotted underline-offset-2 hover:text-white" title="Click for who sold what">
                        {fmtAed(n.value)}
                      </button>
                      {` (${n.deals} validated deal${n.deals === 1 ? "" : "s"})`}
                    </>
                  ) : (
                    " · no validated sales in the network yet"
                  )
                })()}
                {root.sales > 0 && (
                  <>
                    {" · own sales "}
                    <button type="button" onClick={() => onOwnDeals(root)} className="font-bold text-[#d6b357] underline decoration-dotted underline-offset-2 hover:text-white" title="Click for the deals">
                      {fmtAed(root.sales)}
                    </button>
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => onExport(root, "csv")}
                disabled={(childrenOf.get(root.id)?.length ?? 0) === 0}
                title="Download the whole downline as Excel (CSV)"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-300/50 bg-emerald-500/15 px-2.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-40"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
              </button>
              <button
                type="button"
                onClick={() => onExport(root, "pdf")}
                disabled={(childrenOf.get(root.id)?.length ?? 0) === 0}
                title="Print the whole downline as a PDF"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#d6b357]/50 bg-[#d6b357]/15 px-2.5 text-xs font-bold text-[#f0d890] hover:bg-[#d6b357]/25 disabled:opacity-40"
              >
                <FileText className="h-3.5 w-3.5" /> PDF
              </button>
              <Link href={profileHref(root.id)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/25 px-2.5 text-xs font-bold text-white hover:border-[#d6b357] hover:text-[#d6b357]">
                <ExternalLink className="h-3.5 w-3.5" /> Profile
              </Link>
            </div>
          </div>
          <ol className="mt-3">
            {(childrenOf.get(root.id) ?? []).map((c) => (
              <TreeNode key={c.id} p={c} depth={1} childrenOf={childrenOf} seen={new Set([root.id])} profileHref={profileHref} onOwnDeals={onOwnDeals} />
            ))}
          </ol>
          {(childrenOf.get(root.id)?.length ?? 0) === 0 && <p className="py-6 text-sm text-[#9ca3af]">No recruits yet.</p>}
        </>
      )}
    </div>
  )
}

function TreeNode({
  p,
  depth,
  childrenOf,
  seen,
  profileHref,
  onOwnDeals,
}: {
  p: RecruitmentPerson
  depth: number
  childrenOf: Map<string, RecruitmentPerson[]>
  seen: Set<string>
  profileHref: (id: string) => string
  onOwnDeals: (p: RecruitmentPerson) => void
}) {
  const kids = (childrenOf.get(p.id) ?? []).filter((k) => !seen.has(k.id))
  const [open, setOpen] = useState(depth < 2)
  const nextSeen = new Set(seen).add(p.id)
  return (
    <li>
      <div className="flex items-center gap-2.5 border-l border-[#e8eaed] py-2" style={{ marginLeft: (depth - 1) * 22, paddingLeft: 12 }}>
        {kids.length > 0 && depth < MAX_DEPTH ? (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Collapse" : "Expand"} className="rounded p-0.5 text-[#9ca3af] hover:bg-[#f4f6f9] hover:text-[#001f3f]">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <Avatar p={p} size="h-7 w-7 text-[11px]" />
        <Link href={profileHref(p.id)} className="truncate text-sm font-semibold text-[#111827] hover:text-[#001f3f] hover:underline">
          {p.name}
        </Link>
        <span className="hidden text-[11px] text-[#6b7280] sm:inline">{roleToLabel(p.role)}</span>
        <StatusChip status={p.status} />
        {kids.length > 0 && <span className="text-[11px] font-semibold text-[#6b7280]">{kids.length} recruit{kids.length === 1 ? "" : "s"}</span>}
        {p.sales > 0 && (
          <button type="button" onClick={() => onOwnDeals(p)} className="text-[11px] font-semibold text-emerald-700 underline decoration-dotted underline-offset-2 hover:text-emerald-900" title={`${p.deals} validated deal${p.deals === 1 ? "" : "s"} — click for the deals`}>
            {fmtAedShort(p.sales)}
          </button>
        )}
        <span className="ml-auto hidden text-[11px] text-[#9ca3af] md:inline">Joined {fmtDate(p.joinedAt)}</span>
      </div>
      {open && kids.length > 0 && depth < MAX_DEPTH && (
        <ol>
          {kids.map((k) => (
            <TreeNode key={k.id} p={k} depth={depth + 1} childrenOf={childrenOf} seen={nextSeen} profileHref={profileHref} onOwnDeals={onOwnDeals} />
          ))}
        </ol>
      )}
    </li>
  )
}
