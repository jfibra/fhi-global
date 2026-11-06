"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  CircleDot,
  ExternalLink,
  FilePlus2,
  FileX2,
  Handshake,
  PencilLine,
  Sparkles,
  Undo2,
  UserRoundPen,
  type LucideIcon,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { fetchSaleActivityLogs, type SaleActivityLog } from "@/lib/sales-service"
import { roleToLabel } from "@/lib/app-roles"
import {
  ACTIVITY_FILTERS,
  activityFile,
  activityKind,
  activityTitle,
  createdSummary,
  dayHeading,
  EMPTY_NAMES,
  fieldChanges,
  idsToResolve,
  matchesFilter,
  partnerRows,
  timeAgo,
  type ActivityFilter,
  type ActivityKind,
  type NameLookup,
} from "@/lib/sales-activity-format"
import { StatusBadge, toTitleCase } from "../sale-ui"

/**
 * A sale's activity history (admin only), as a timeline anyone can read: one
 * card per event, newest first and grouped by day, saying in plain words what
 * happened and — for an edit — exactly which fields changed from what to what.
 * It used to print the raw log as JSON, ids and all.
 */

const KIND_STYLE: Record<ActivityKind, { Icon: LucideIcon; ring: string }> = {
  created:    { Icon: Sparkles,      ring: "bg-[#001f3f] text-[#d6b357]" },
  edited:     { Icon: PencilLine,    ring: "bg-amber-50 text-amber-700 border border-amber-200" },
  client:     { Icon: UserRoundPen,  ring: "bg-amber-50 text-amber-700 border border-amber-200" },
  partners:   { Icon: Handshake,     ring: "bg-[#d6b357]/15 text-[#8a6d2a] border border-[#d6b357]/40" },
  status:     { Icon: CircleDot,     ring: "bg-sky-50 text-sky-700 border border-sky-200" },
  commission: { Icon: Banknote,      ring: "bg-violet-50 text-violet-700 border border-violet-200" },
  file:       { Icon: FilePlus2,     ring: "bg-slate-50 text-slate-600 border border-slate-200" },
  leader:     { Icon: BadgeCheck,    ring: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  other:      { Icon: CircleDot,     ring: "bg-slate-50 text-slate-600 border border-slate-200" },
}

function timeOfDay(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

/** Developer / project / unit names for the ids the entries mention — one query each. */
async function lookupNames(logs: SaleActivityLog[]): Promise<NameLookup> {
  const ids = idsToResolve(logs)
  const supabase = createClient()
  const [devs, projects, units] = await Promise.all([
    ids.developers.length ? supabase.from("developers").select("id, name").in("id", ids.developers) : null,
    ids.projects.length ? supabase.from("projects").select("id, name").in("id", ids.projects) : null,
    ids.units.length ? supabase.from("project_units").select("id, unit_type, layout_name").in("id", ids.units) : null,
  ])
  const map = <T extends { id: unknown }>(rows: T[] | null | undefined, label: (r: T) => string) =>
    Object.fromEntries((rows ?? []).map((r) => [String(r.id), label(r)]))
  return {
    developers: map(devs?.data as Array<{ id: string; name: string | null }> | undefined, (r) => toTitleCase(r.name) || "Developer"),
    projects: map(projects?.data as Array<{ id: number; name: string | null }> | undefined, (r) => toTitleCase(r.name) || "Project"),
    units: map(
      units?.data as Array<{ id: number; unit_type: string | null; layout_name: string | null }> | undefined,
      (r) => [r.unit_type, r.layout_name].filter(Boolean).join(" · ") || "Unit type",
    ),
  }
}

function Change({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <li className="grid grid-cols-1 gap-1 rounded-xl bg-white px-3 py-2 sm:grid-cols-[150px_1fr] sm:items-center">
      <span className="text-xs font-semibold text-[#6b7280]">{label}</span>
      <span className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="text-[#9ca3af] line-through decoration-[#d1d5db]">{before}</span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#9ca3af]" />
        <span className="font-semibold text-[#0d1117]">{after}</span>
      </span>
    </li>
  )
}

function EntryBody({ entry, names }: { entry: SaleActivityLog; names: NameLookup }) {
  const kind = activityKind(entry.action_type)

  if (kind === "edited" || kind === "client") {
    const changes = fieldChanges(entry, names)
    if (changes.length === 0) return <p className="text-xs text-[#9ca3af]">Saved — nothing changed.</p>
    return (
      <ul className="space-y-1.5">
        {changes.map((c) => <Change key={c.key} label={c.label} before={c.before} after={c.after} />)}
      </ul>
    )
  }

  if (kind === "status" || kind === "commission") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge value={String(entry.old_value ?? "pending")} type={kind === "status" ? "validation" : "commission"} />
        <ArrowRight className="h-4 w-4 text-[#9ca3af]" />
        <StatusBadge value={String(entry.new_value ?? "")} type={kind === "status" ? "validation" : "commission"} />
      </div>
    )
  }

  if (kind === "file") {
    const file = activityFile(entry)
    if (!file) return null
    const removed = entry.action_type === "attachment_deleted"
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2">
        {removed ? <FileX2 className="h-4 w-4 shrink-0 text-rose-500" /> : <FilePlus2 className="h-4 w-4 shrink-0 text-[#6b7280]" />}
        {file.url && !removed ? (
          <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 items-center gap-1 text-sm font-semibold text-[#001f3f] hover:underline"
          >
            <span className="truncate">{file.name}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </a>
        ) : (
          <span className={`truncate text-sm font-semibold ${removed ? "text-[#9ca3af] line-through" : "text-[#0d1117]"}`}>{file.name}</span>
        )}
        {file.isA2A && (
          <span className="rounded-full border border-[#d6b357]/40 bg-[#d6b357]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#8a6d2a]">A2A agreement</span>
        )}
        {file.type && <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[10px] font-bold uppercase text-[#6b7280]">{file.type}</span>}
      </div>
    )
  }

  if (kind === "partners") {
    const before = partnerRows(entry.old_value)
    const after = partnerRows(entry.new_value)
    const side = (title: string, rows: typeof after) => (
      <div className="min-w-0 rounded-xl bg-white px-3 py-2">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">{title}</p>
        {rows.length === 0 ? (
          <p className="text-sm text-[#6b7280]">Solo sale — no partners</p>
        ) : (
          <ul className="space-y-0.5">
            {rows.map((r) => (
              <li key={r.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-[#0d1117]">
                  {toTitleCase(r.name)} <span className="text-xs text-[#9ca3af]">· {r.role}</span>
                </span>
                <span className="shrink-0 font-mono font-semibold text-[#0d1117]">{r.share}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
    return (
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {side("Before", before)}
        {side("After", after)}
      </div>
    )
  }

  if (kind === "created") {
    const rows = createdSummary(entry, names)
    if (rows.length === 0) return null
    return (
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 rounded-xl bg-white px-3 py-2 text-sm sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="flex gap-2">
            <dt className="text-[#6b7280]">{r.label}</dt>
            <dd className="font-semibold text-[#0d1117]">{r.value}</dd>
          </div>
        ))}
      </dl>
    )
  }

  if (kind === "leader") return null
  return entry.description ? <p className="text-sm text-[#374151]">{entry.description}</p> : null
}

export function ActivityHistory({ saleId }: { saleId: string }) {
  const [logs, setLogs] = useState<SaleActivityLog[] | null>(null)
  const [names, setNames] = useState<NameLookup>(EMPTY_NAMES)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<ActivityFilter>("all")

  useEffect(() => {
    let active = true
    void fetchSaleActivityLogs(saleId).then(async ({ data, error: fetchError }) => {
      if (!active) return
      if (fetchError) { setError(fetchError); setLogs([]); return }
      const rows = data ?? []
      setLogs(rows)
      const looked = await lookupNames(rows)
      if (active) setNames(looked)
    })
    return () => { active = false }
  }, [saleId])

  const counts = useMemo(() => {
    const out: Record<ActivityFilter, number> = { all: 0, edits: 0, status: 0, files: 0 }
    for (const entry of logs ?? []) {
      const kind = activityKind(entry.action_type)
      for (const f of ACTIVITY_FILTERS) if (matchesFilter(kind, f.key)) out[f.key] += 1
    }
    return out
  }, [logs])

  const visible = (logs ?? []).filter((entry) => matchesFilter(activityKind(entry.action_type), filter))

  if (logs === null) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((item) => <div key={item} className="h-20 rounded-2xl bg-[#f3f4f6] animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="px-4 py-2.5 rounded-2xl bg-rose-50 border border-rose-100 text-xs text-rose-700">{error}</div>
      )}

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Show">
        {ACTIVITY_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              filter === f.key ? "bg-[#001f3f] text-white" : "bg-[#f3f4f6] text-[#374151] hover:bg-[#e9ecf0]"
            }`}
          >
            {f.label}
            <span className={`rounded-full px-1.5 text-[10px] ${filter === f.key ? "bg-white/15" : "bg-white text-[#6b7280]"}`}>{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="px-4 py-6 rounded-2xl border border-[#f0f2f5] text-sm text-[#6b7280] text-center">
          {logs.length === 0 ? "Nothing has happened on this sale yet." : "Nothing of this kind on this sale."}
        </div>
      ) : (
        <ol className="space-y-3">
          {visible.map((entry, i) => {
            const heading = dayHeading(entry.created_at)
            const newDay = i === 0 || dayHeading(visible[i - 1].created_at) !== heading
            const { Icon, ring } = KIND_STYLE[activityKind(entry.action_type)]
            const LeaderIcon = entry.action_type === "leader_confirmation_removed" ? Undo2 : Icon
            const actor = toTitleCase(entry.profiles?.fullname) || "Unnamed account"
            return (
              <Fragment key={entry.id}>
                {newDay && (
                  <li aria-hidden className="pt-1 text-[11px] font-bold uppercase tracking-wider text-[#9ca3af]">{heading}</li>
                )}
                <li className="flex gap-3">
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ring}`}>
                    <LeaderIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1 rounded-2xl border border-[#eef2f5] bg-[#f8fafc] p-3.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <p className="text-sm font-bold text-[#0d1117]">{activityTitle(entry)}</p>
                      <p className="text-[11px] text-[#9ca3af]" title={new Date(entry.created_at).toLocaleString("en-US")}>
                        {timeOfDay(entry.created_at)} · {timeAgo(entry.created_at)}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-[#6b7280]">
                      by <span className="font-semibold text-[#374151]">{actor}</span>
                      {entry.performed_role ? ` · ${roleToLabel(entry.performed_role)}` : ""}
                    </p>
                    <div className="mt-2.5">
                      <EntryBody entry={entry} names={names} />
                    </div>
                  </div>
                </li>
              </Fragment>
            )
          })}
        </ol>
      )}
    </div>
  )
}

