"use client"

/**
 * Public Agents (admin, boss 2026-10-08): admin staff choose which agents and
 * team leaders appear on the public /agents page — the About page's agent
 * photos and count follow the same list (profiles.show_on_agents_page,
 * migration 077). Everyone starts hidden; each switch saves on its own and
 * the public pages refresh right away.
 */

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Camera, ExternalLink, Eye, EyeOff, Globe, Loader2, RefreshCw, Search, TrendingUp, UserX, Users } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { isAdminStaffRole } from "@/lib/app-roles"
import { getDashboardRouteByRole } from "@/lib/auth"
import type { PublicAgentRow } from "@/app/api/admin/public-agents/route"

type Filter = "all" | "shown" | "hidden" | "sales"

async function fetchAgents(): Promise<PublicAgentRow[]> {
  const res = await fetch("/api/admin/public-agents", { cache: "no-store" })
  const json = (await res.json().catch(() => ({}))) as { agents?: PublicAgentRow[]; error?: string }
  if (!res.ok || !json.agents) throw new Error(json.error ?? `Request failed (${res.status}).`)
  return json.agents
}

function Avatar({ a }: { a: PublicAgentRow }) {
  return a.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={a.photo} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#001f3f] to-[#003366] text-sm font-bold text-white">
      {(a.name || "?").charAt(0).toUpperCase()}
    </span>
  )
}

export default function PublicAgentsPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))
  const base = getDashboardRouteByRole(role)

  const [agents, setAgents] = useState<PublicAgentRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null)

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load the agents.")
  const load = (list: PublicAgentRow[]) => {
    setAgents(list)
    setError(null)
  }

  useEffect(() => {
    fetchAgents().then(load, fail)
  }, [])

  // Alphabetical and stable — a row never jumps when it's switched.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (agents ?? [])
      .filter((a) => filter === "all" || (filter === "sales" ? (a.sales ?? 0) > 0 : filter === "shown" ? a.shown : !a.shown))
      .filter((a) => !q || [a.name, a.website].some((v) => v?.toLowerCase().includes(q)))
      .sort((x, y) => (x.name || "~").localeCompare(y.name || "~"))
  }, [agents, query, filter])

  // One request for one agent or many; the switches flip back if it fails.
  const setShown = async (list: PublicAgentRow[], show: boolean) => {
    const ids = list.map((a) => a.id)
    const was = new Map(list.map((a) => [a.id, a.shown]))
    setNotice(null)
    setSaving((s) => new Set([...s, ...ids]))
    setAgents((prev) => (prev ?? []).map((x) => (was.has(x.id) ? { ...x, shown: show } : x)))
    try {
      const res = await fetch("/api/admin/public-agents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, show }),
      })
      const json = (await res.json().catch(() => ({}))) as { updated?: string[]; error?: string }
      const updated = new Set(json.updated ?? [])
      if (!res.ok || ids.some((id) => !updated.has(id))) throw new Error(json.error ?? "Couldn't save the change.")
      const who = list.length === 1 ? list[0].name || "This agent" : `${list.length} agents`
      const are = list.length === 1 ? "is" : "are"
      setNotice({ text: show ? `${who} ${are} now on the public Agents page.` : `${who} ${are} hidden from the public site.` })
    } catch (e) {
      setAgents((prev) => (prev ?? []).map((x) => (was.has(x.id) ? { ...x, shown: was.get(x.id) === true } : x)))
      setNotice({ text: e instanceof Error ? e.message : "Couldn't save the change.", bad: true })
    } finally {
      setSaving((s) => new Set([...s].filter((id) => !was.has(id))))
    }
  }

  const showAllWithSales = (list: PublicAgentRow[]) => {
    if (!list.length) return
    if (!window.confirm(`Show ${list.length} agent${list.length === 1 ? "" : "s"} with sales on the public Agents page?`)) return
    void setShown(list, true)
  }

  if (!allowed) return null

  const shown = (agents ?? []).filter((a) => a.shown)
  const withSales = (agents ?? []).filter((a) => (a.sales ?? 0) > 0)
  const salesHidden = withSales.filter((a) => !a.shown)
  const stats = agents
    ? [
        { icon: Eye, label: "On the public page", value: shown.length, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
        { icon: EyeOff, label: "Hidden", value: agents.length - shown.length, tone: "text-[#6b7280] bg-[#f4f6f9] border-[#e5e7eb]" },
        { icon: Users, label: "Agents & team leaders", value: agents.length, tone: "text-[#001f3f] bg-[#001f3f]/5 border-[#001f3f]/15" },
        { icon: Camera, label: "Shown without a photo", value: shown.filter((a) => !a.photo).length, tone: "text-amber-700 bg-amber-50 border-amber-200" },
      ]
    : []
  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: agents?.length ?? 0 },
    { key: "shown", label: "On the page", count: shown.length },
    { key: "hidden", label: "Hidden", count: (agents?.length ?? 0) - shown.length },
    { key: "sales", label: "With sales", count: withSales.length },
  ]

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-['Outfit'] text-2xl font-bold text-[#0d1117]">
            <Eye className="h-6 w-6 text-[#001f3f]" />
            Public Agents
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-[#6b7280]">
            Choose who appears on the public Agents page. The About page&apos;s agent photos and count follow the same list. Only active
            agents and team leaders are listed; new agents start hidden until you switch them on.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          {salesHidden.length > 0 && (
            <button
              type="button"
              onClick={() => showAllWithSales(salesHidden)}
              disabled={saving.size > 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#001f3f] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#00356b] disabled:opacity-50"
            >
              <TrendingUp className="h-3.5 w-3.5" /> Show all with sales ({salesHidden.length})
            </button>
          )}
          <a
            href="/agents"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#f4f6f9] px-3 py-2 text-xs font-semibold text-[#6b7280] transition-colors hover:bg-[#e8eaed] hover:text-[#001f3f]"
          >
            <ExternalLink className="h-3.5 w-3.5" /> View the public page
          </a>
          <button
            type="button"
            onClick={() => {
              setRefreshing(true)
              fetchAgents()
                .then(load, fail)
                .finally(() => setRefreshing(false))
            }}
            disabled={refreshing || agents === null}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#f4f6f9] px-3 py-2 text-xs font-semibold text-[#6b7280] transition-colors hover:bg-[#e8eaed] hover:text-[#001f3f] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* The numbers */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(agents ? stats : Array.from({ length: 4 }, () => null)).map((s, i) =>
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
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter agents">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={filter === t.key}
                onClick={() => setFilter(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                  filter === t.key ? "border-[#001f3f] bg-[#001f3f] text-white" : "border-[#e5e7eb] text-[#374151] hover:border-[#d6b357]"
                }`}
              >
                {t.label}
                <span className={`rounded-full px-1.5 text-[11px] ${filter === t.key ? "bg-white/20" : "bg-[#f3f4f6]"}`}>{t.count}</span>
              </button>
            ))}
          </div>
          <div className="relative lg:w-80">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or website…"
              className="w-full rounded-xl border border-[#e5e5e5] py-2.5 pl-10 pr-4 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#001f3f] focus:outline-none"
            />
          </div>
        </div>

        {notice && (
          <p className={`mt-4 rounded-lg px-3 py-2 text-xs font-semibold ${notice.bad ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800"}`}>
            {notice.text}
          </p>
        )}

        {error ? (
          <p className="py-8 text-sm text-rose-600">{error}</p>
        ) : agents === null ? (
          <p className="flex items-center gap-2 py-8 text-sm text-[#9ca3af]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading agents…
          </p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-sm text-[#9ca3af]">
            {query ? "Nobody matches." : filter === "shown" ? "Nobody is on the public page yet — switch agents on from All." : "No agents here."}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[#f0f2f5]">
            {rows.map((a) => {
              const busy = saving.has(a.id)
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <Avatar a={a} />
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#111827]">
                      <span className="truncate">{a.name || "No name on profile"}</span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${
                          a.leader ? "border-[#d6b357]/50 bg-[#d6b357]/15 text-[#8a6d2b]" : "border-[#001f3f]/15 bg-[#001f3f]/5 text-[#001f3f]"
                        }`}
                      >
                        {a.leader ? "Team leader" : "Agent"}
                      </span>
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[#6b7280]">
                      {a.sales === null ? null : a.sales > 0 ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <TrendingUp className="h-3 w-3" /> {a.sales} {a.sales === 1 ? "sale" : "sales"}
                        </span>
                      ) : (
                        <span className="text-[#9ca3af]">No sales yet</span>
                      )}
                      {a.website ? (
                        <a
                          href={`/website/${a.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-[#374151] hover:text-[#001f3f] hover:underline"
                        >
                          <Globe className="h-3 w-3" /> Website
                        </a>
                      ) : (
                        <span className="text-[#9ca3af]">No website</span>
                      )}
                      {!a.name ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-rose-600">
                          <UserX className="h-3 w-3" /> Can&apos;t appear until they add a name
                        </span>
                      ) : !a.photo ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                          <Camera className="h-3 w-3" /> No photo — shows a placeholder card
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <Link
                    href={`${base}/accounts/users?account=${a.id}`}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#e5e5e5] px-3 text-xs font-bold text-[#374151] transition-colors hover:border-[#001f3f] hover:text-[#001f3f]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Profile
                  </Link>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={a.shown}
                    aria-label={`${a.shown ? "Hide" : "Show"} ${a.name || "this agent"} on the public site`}
                    onClick={() => void setShown([a], !a.shown)}
                    disabled={busy}
                    className="inline-flex w-[116px] shrink-0 items-center justify-between gap-2 rounded-lg border border-[#e5e5e5] px-3 py-2 text-xs font-bold transition-colors hover:border-[#001f3f] disabled:opacity-60"
                  >
                    <span className={`whitespace-nowrap ${a.shown ? "text-emerald-700" : "text-[#6b7280]"}`}>{a.shown ? "Shown" : "Hidden"}</span>
                    <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${a.shown ? "bg-emerald-600" : "bg-[#d1d5db]"}`}>
                      {busy ? (
                        <Loader2 className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" />
                      ) : (
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${a.shown ? "left-[18px]" : "left-0.5"}`} />
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
