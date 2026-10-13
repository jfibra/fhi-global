"use client"

/**
 * Admin Genealogy (boss via Juliecor, 2026-10-13): pick any recruiter and see
 * their whole tree — the same chart and list agents get for their own, over
 * app/api/admin/genealogy. The biggest networks are one tap away as chips;
 * anyone else is a search away.
 */

import { useEffect, useMemo, useState } from "react"
import { GitBranch, Loader2, Search, X } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { isAdminStaffRole, roleToLabel } from "@/lib/app-roles"
import type { Recruiter } from "@/app/api/admin/genealogy/route"
import { GenealogyView } from "./page"

function Avatar({ r, size = "h-8 w-8" }: { r: Recruiter; size?: string }) {
  return r.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={r.photo} alt="" loading="lazy" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#001f3f] to-[#003366] text-xs font-bold text-white`}>{r.name.charAt(0).toUpperCase()}</span>
  )
}

export default function AdminGenealogyPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))
  const [recruiters, setRecruiters] = useState<Recruiter[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [picked, setPicked] = useState<Recruiter | null>(null)

  useEffect(() => {
    let cancelled = false
    const id = window.setTimeout(() => {
      fetch("/api/admin/genealogy", { cache: "no-store" })
        .then(async (res) => {
          const json = (await res.json().catch(() => ({}))) as { recruiters?: Recruiter[]; error?: string }
          if (!res.ok || !json.recruiters) throw new Error(json.error ?? `Request failed (${res.status}).`)
          if (!cancelled) {
            setRecruiters(json.recruiters)
            setPicked((cur) => cur ?? json.recruiters![0] ?? null)
          }
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load the recruiters.")
        })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return (recruiters ?? []).filter((r) => r.name.toLowerCase().includes(q)).slice(0, 8)
  }, [query, recruiters])
  const top = useMemo(() => (recruiters ?? []).slice(0, 8), [recruiters])

  if (!allowed) return null

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-['Outfit'] text-2xl font-bold text-[#0d1117]">
          <GitBranch className="h-6 w-6 text-[#001f3f]" /> Genealogy
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-[#6b7280]">
          Any recruiter&apos;s whole tree — everyone who joined through their link and everyone under them, level by level. Pick a person below.
        </p>
      </div>

      <div className="rounded-2xl border border-[#e8eaed] bg-white p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9ca3af]">Biggest networks</p>
            {recruiters === null && !error ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-[#9ca3af]"><Loader2 className="h-4 w-4 animate-spin" /> Loading recruiters…</p>
            ) : error ? (
              <p className="mt-2 text-sm text-rose-600">{error}</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {top.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setPicked(r)}
                    className={`inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs font-bold transition-colors ${picked?.id === r.id ? "border-[#001f3f] bg-[#001f3f] text-white" : "border-[#e5e7eb] text-[#374151] hover:border-[#d6b357]"}`}
                  >
                    <Avatar r={r} size="h-6 w-6" /> {r.name}
                    <span className={`rounded-full px-1.5 text-[10.5px] ${picked?.id === r.id ? "bg-white/20" : "bg-[#f3f4f6]"}`}>{r.network}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative lg:w-80">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a recruiter by name…"
              className="w-full rounded-xl border border-[#e5e5e5] py-2.5 pl-10 pr-9 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#001f3f] focus:outline-none"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#001f3f]">
                <X className="h-4 w-4" />
              </button>
            )}
            {query.trim() && (
              <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-lg">
                {matches.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-[#9ca3af]">No recruiter matches — only people with at least one recruit are listed.</li>
                ) : (
                  matches.map((r) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => { setPicked(r); setQuery("") }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[#fafbfc]">
                        <Avatar r={r} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[#111827]">{r.name}</span>
                          <span className="block text-[11px] text-[#6b7280]">{roleToLabel(r.role)} · {r.direct} direct · {r.network} in network</span>
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </div>
      </div>

      {picked && <GenealogyView key={picked.id} endpoint={`/api/admin/genealogy?id=${picked.id}`} heading={false} />}
    </div>
  )
}
