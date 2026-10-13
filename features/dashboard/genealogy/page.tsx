"use client"

/**
 * Genealogy (boss via Juliecor, 2026-10-13): the signed-in person's whole
 * recruitment tree — everyone who joined through their link and everyone
 * under those — as a collapsible tree, level by level. Michelle's network is
 * 214 → 258 → 17 (489 people), so the tree opens on the first level only and
 * expands on tap; search opens the branches that contain a match. Figures are
 * what the account already sees elsewhere: role, status, when they joined,
 * how many they recruited, validated deal counts (never amounts).
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, GitBranch, List, Loader2, Network, RefreshCw, Search, TrendingUp, UserPlus, Users } from "lucide-react"
import { TreeChart } from "./tree-chart"
import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { ROLES_ADMIN_STAFF, invitableRolesFor, roleInList, roleToLabel } from "@/lib/app-roles"
import { STATUS_COLORS } from "@/lib/user-service"
import type { GenealogyNode, GenealogyResponse } from "@/app/api/genealogy/route"

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Dubai" }) : "—"

async function load(endpoint: string): Promise<GenealogyResponse> {
  const res = await fetch(endpoint, { cache: "no-store" })
  const json = (await res.json().catch(() => ({}))) as GenealogyResponse & { error?: string }
  if (!res.ok || !json.nodes) throw new Error(json.error ?? `Request failed (${res.status}).`)
  return json
}

function Avatar({ name, photo, size = "h-10 w-10", ring = false }: { name: string; photo: string | null; size?: string; ring?: boolean }) {
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt="" loading="lazy" className={`${size} shrink-0 rounded-full object-cover ${ring ? "ring-2 ring-[#d6b357]" : ""}`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#001f3f] to-[#003366] text-sm font-bold text-white ${ring ? "ring-2 ring-[#d6b357]" : ""}`}>
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

function StatusChip({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.pending
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-bold capitalize ${c.bg} ${c.text} ${c.border}`}>{status}</span>
}

/** The recruiter's own page: the gate, then the shared view on the session-scoped API. */
export default function GenealogyPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(invitableRolesFor(role).length > 0 || roleInList(role, ROLES_ADMIN_STAFF))
  if (!allowed) return null
  return <GenealogyView endpoint="/api/genealogy" self />
}

/**
 * The tree itself — tiles, Chart | List, search. `self` = the signed-in person's
 * own tree (second-person copy); the admin page passes someone else's endpoint.
 */
export function GenealogyView({ endpoint, self = false, heading = true }: { endpoint: string; self?: boolean; heading?: boolean }) {
  const [data, setData] = useState<GenealogyResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [onlySelling, setOnlySelling] = useState(false)
  const [mode, setMode] = useState<"chart" | "list">("chart")
  const loadedOnce = useRef(false)

  const refresh = () => {
    setBusy(true)
    load(endpoint)
      .then((d) => {
        setData(d)
        setError(null)
        // First load: the first level open, so a big tree stays readable.
        if (!loadedOnce.current) {
          loadedOnce.current = true
          setOpen(new Set([d.root.id]))
        }
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load your genealogy."))
      .finally(() => setBusy(false))
  }
  // Deferred a tick so the effect never sets state synchronously.
  useEffect(() => {
    const id = window.setTimeout(refresh, 0)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint])

  const childrenOf = useMemo(() => {
    const m = new Map<string, GenealogyNode[]>()
    for (const n of data?.nodes ?? []) m.set(n.parentId, [...(m.get(n.parentId) ?? []), n])
    return m
  }, [data])
  const byId = useMemo(() => new Map((data?.nodes ?? []).map((n) => [n.id, n])), [data])

  // Search: the matches plus every ancestor, so the branch that holds a match is shown and opened.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q && !onlySelling) return null
    const keep = new Set<string>()
    for (const n of data?.nodes ?? []) {
      if ((q && !n.name.toLowerCase().includes(q)) || (onlySelling && n.deals === 0)) continue
      for (let cur: GenealogyNode | undefined = n; cur; cur = byId.get(cur.parentId)) keep.add(cur.id)
    }
    return keep
  }, [query, onlySelling, data, byId])
  const matches = useMemo(() => (visible ? (data?.nodes ?? []).filter((n) => visible.has(n.id) && (!query.trim() || n.name.toLowerCase().includes(query.trim().toLowerCase())) && (!onlySelling || n.deals > 0)).length : 0), [visible, data, query, onlySelling])

  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const expandAll = () => setOpen(new Set([data?.root.id ?? "", ...(data?.nodes ?? []).filter((n) => n.direct > 0).map((n) => n.id)]))
  const collapseAll = () => setOpen(new Set([data?.root.id ?? ""]))

  const Branch = ({ parentId, level }: { parentId: string; level: number }) => {
    const kids = (childrenOf.get(parentId) ?? []).filter((n) => !visible || visible.has(n.id))
    if (!kids.length) return null
    return (
      <ul className={level > 1 ? "ml-5 border-l border-[#e5e7eb] pl-3 sm:ml-7 sm:pl-5" : ""}>
        {kids.map((n) => {
          const isOpen = open.has(n.id) || Boolean(visible && (childrenOf.get(n.id) ?? []).some((c) => visible.has(c.id)))
          const hasKids = n.direct > 0
          return (
            <li key={n.id} className="relative">
              <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-[#f0f2f5] py-2.5 ${hasKids ? "cursor-pointer hover:bg-[#fafbfc]" : ""}`} onClick={hasKids ? () => toggle(n.id) : undefined}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${hasKids ? "bg-[#f1f3f6] text-[#001f3f]" : "text-transparent"}`} aria-hidden="true">
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                </span>
                <Avatar name={n.name} photo={n.photo} size="h-9 w-9" />
                <div className="min-w-0 flex-1 basis-40">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#111827]">
                    <span className="truncate">{n.name}</span>
                    <StatusChip status={n.status} />
                    <span className="text-[10.5px] font-semibold text-[#9ca3af]">{roleToLabel(n.role)} · L{n.level}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-[#6b7280]">Joined {fmtDate(n.joinedAt)}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                  {n.direct > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#001f3f]/15 bg-[#001f3f]/5 px-2 py-0.5 text-[#001f3f]">
                      <UserPlus className="h-3 w-3" /> {n.direct} direct{n.network > n.direct ? ` · ${n.network} total` : ""}
                    </span>
                  )}
                  {n.deals > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">
                      <TrendingUp className="h-3 w-3" /> {n.deals} deal{n.deals === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
              </div>
              {hasKids && isOpen && <Branch parentId={n.id} level={level + 1} />}
            </li>
          )
        })}
      </ul>
    )
  }

  const s = data?.summary
  const stats = s
    ? [
        { icon: UserPlus, label: "Direct recruits", value: s.direct, tone: "text-[#001f3f] bg-[#001f3f]/5 border-[#001f3f]/15" },
        { icon: GitBranch, label: "Whole network", value: s.network, hint: s.levels ? `${s.levels} level${s.levels === 1 ? "" : "s"} · ${s.perLevel.join(" → ")}` : undefined, tone: "text-[#8a6d2b] bg-[#d6b357]/15 border-[#d6b357]/40" },
        { icon: Users, label: "Active", value: s.active, hint: `${s.pending} waiting for approval`, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
        { icon: TrendingUp, label: "Selling", value: s.selling, hint: `${s.deals} validated deal${s.deals === 1 ? "" : "s"} between them`, tone: "text-amber-700 bg-amber-50 border-amber-200" },
      ]
    : []

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        {heading ? (
          <div>
            <h1 className="flex items-center gap-2 font-['Outfit'] text-2xl font-bold text-[#0d1117]">
              <GitBranch className="h-6 w-6 text-[#001f3f]" /> Genealogy
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-[#6b7280]">
              Everyone who joined through your invite link, and everyone under them, level by level. Tap a person to open their branch.
            </p>
          </div>
        ) : (
          <div />
        )}
        <button
          type="button"
          onClick={refresh}
          disabled={busy || data === null}
          className="inline-flex items-center gap-1.5 self-start rounded-lg bg-[#f4f6f9] px-3 py-2 text-xs font-semibold text-[#6b7280] transition-colors hover:bg-[#e8eaed] hover:text-[#001f3f] disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(data ? stats : Array.from({ length: 4 }, () => null)).map((st, i) =>
          st ? (
            <div key={st.label} className="rounded-2xl border border-[#e8eaed] bg-white px-4 py-4">
              <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${st.tone}`}>
                <st.icon className="h-4 w-4" />
              </span>
              <p className="mt-3 font-['Outfit'] text-3xl font-bold text-[#0d1117]">{st.value}</p>
              <p className="mt-0.5 text-xs font-semibold text-[#6b7280]">{st.label}</p>
              {st.hint && <p className="mt-0.5 text-[11px] text-[#9ca3af]">{st.hint}</p>}
            </div>
          ) : (
            <div key={i} className="h-[118px] animate-pulse rounded-2xl border border-[#e8eaed] bg-white" />
          ),
        )}
      </div>

      <div className="rounded-2xl border border-[#e8eaed] bg-white p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <div role="tablist" aria-label="View" className="mr-1 inline-flex rounded-lg border border-[#e5e7eb] p-0.5">
              {([["chart", "Chart", Network], ["list", "List", List]] as const).map(([k, label, Icon]) => (
                <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${mode === k ? "bg-[#001f3f] text-white" : "text-[#374151] hover:bg-[#f1f3f6]"}`}>
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
            {mode === "list" && (<>
            <button type="button" onClick={expandAll} disabled={!data} className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] px-2.5 py-1.5 text-xs font-bold text-[#374151] transition-colors hover:border-[#d6b357] disabled:opacity-50">
              <ChevronsUpDown className="h-3.5 w-3.5" /> Expand all
            </button>
            <button type="button" onClick={collapseAll} disabled={!data} className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] px-2.5 py-1.5 text-xs font-bold text-[#374151] transition-colors hover:border-[#d6b357] disabled:opacity-50">
              <ChevronsDownUp className="h-3.5 w-3.5" /> Collapse all
            </button>
            </>)}
            <button
              type="button"
              onClick={() => setOnlySelling((v) => !v)}
              disabled={!data}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${onlySelling ? "border-emerald-600 bg-emerald-600 text-white" : "border-[#e5e7eb] text-[#374151] hover:border-[#d6b357]"}`}
            >
              <TrendingUp className="h-3.5 w-3.5" /> Selling only
            </button>
          </div>
          {mode === "list" && (
          <div className="relative lg:w-80">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={self ? "Find someone in your network…" : "Find someone in this network…"}
              className="w-full rounded-xl border border-[#e5e5e5] py-2.5 pl-10 pr-4 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#001f3f] focus:outline-none"
            />
          </div>
          )}
        </div>

        {error ? (
          <p className="py-8 text-sm text-rose-600">{error}</p>
        ) : data === null ? (
          <p className="flex items-center gap-2 py-8 text-sm text-[#9ca3af]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your genealogy…
          </p>
        ) : data.nodes.length === 0 ? (
          <div className="py-10 text-center">
            <p className="font-['Outfit'] text-lg font-bold text-[#0d1117]">{self ? "Nobody has joined through your link yet." : `Nobody has joined through ${data.root.name}'s link yet.`}</p>
            {self && <p className="mt-1 text-sm text-[#6b7280]">Share your invite link from the Invite page — everyone who registers with it appears here, and so do the people they bring in.</p>}
          </div>
        ) : mode === "chart" ? (
          <div className="mt-5">
            <TreeChart data={data} selling={onlySelling} />
          </div>
        ) : (
          <div className="mt-5">
            {/* The root: the signed-in person. */}
            <div className="flex items-center gap-3 border-b-2 border-[#d6b357] pb-3">
              <Avatar name={data.root.name} photo={data.root.photo} size="h-12 w-12" ring />
              <div className="min-w-0">
                <p className="font-['Outfit'] text-lg font-bold leading-tight text-[#0d1117]">{data.root.name} {self && <span className="text-sm font-semibold text-[#9ca3af]">(you)</span>}</p>
                <p className="text-xs text-[#6b7280]">{roleToLabel(data.root.role)} · {data.summary.direct} direct · {data.summary.network} in {self ? "your" : "their"} network</p>
              </div>
            </div>
            {visible && (
              <p className="mt-3 text-xs font-semibold text-[#6b7280]">
                {matches} match{matches === 1 ? "" : "es"}{query.trim() ? ` for “${query.trim()}”` : ""}{onlySelling ? " with validated deals" : ""} — their branches are open.
              </p>
            )}
            {visible && matches === 0 ? (
              <p className="py-8 text-sm text-[#9ca3af]">Nobody in {self ? "your" : "this"} network matches.</p>
            ) : (
              <div className="mt-1">
                <Branch parentId={data.root.id} level={1} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
