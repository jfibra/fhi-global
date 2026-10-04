"use client"

/**
 * Global Partners (admin, boss 2026-10-04): every Global Partner grouped by the
 * country they live in now (metadata.residence_country — asked by the partner
 * invite since 10/4, and by the dashboard pop-up for partners who joined
 * before). Those who haven't answered yet come last, with their nationality as
 * a hint, and can be emailed a reminder — one request each, so every send
 * stands on its own.
 */

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Clock, ExternalLink, Globe2, Loader2, Mail, MapPin, RefreshCw, Search, Users } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { isAdminStaffRole } from "@/lib/app-roles"
import { getDashboardRouteByRole } from "@/lib/auth"
import { STATUS_COLORS } from "@/lib/user-service"
import { countryFlag } from "@/lib/countries"
import { nationalityFlag } from "@/lib/nationalities"
import type { GlobalPartnerRow } from "@/app/api/admin/global-partners/route"

/** The group of partners who haven't said where they live yet. */
const NOT_GIVEN = "__not_given"
/** A reminder isn't sent to the same partner again within this many days. */
const REMIND_AGAIN_AFTER_DAYS = 7
const DAY_MS = 86_400_000

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Dubai" }) : "—"
const anchorOf = (key: string) => `country-${key.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`

async function fetchPartners(): Promise<GlobalPartnerRow[]> {
  const res = await fetch("/api/admin/global-partners", { cache: "no-store" })
  const json = (await res.json().catch(() => ({}))) as { partners?: GlobalPartnerRow[]; error?: string }
  if (!res.ok || !json.partners) throw new Error(json.error ?? `Request failed (${res.status}).`)
  return json.partners
}

function Avatar({ p }: { p: GlobalPartnerRow }) {
  return p.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.photo} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#001f3f] to-[#003366] text-sm font-bold text-white">
      {p.name.charAt(0).toUpperCase()}
    </span>
  )
}

function StatusChip({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.pending
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-bold capitalize ${c.bg} ${c.text} ${c.border}`}>
      {status}
    </span>
  )
}

export default function GlobalPartnersPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))
  const base = getDashboardRouteByRole(role)

  const [partners, setPartners] = useState<GlobalPartnerRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState("")
  const [notice, setNotice] = useState<string | null>(null)
  const [sending, setSending] = useState<{ done: number; total: number } | null>(null)
  // When the list was loaded — "reminded in the last week" is measured from here, so the memos stay pure.
  const [loadedAt, setLoadedAt] = useState(0)

  const apply = (list: GlobalPartnerRow[]) => {
    setPartners(list)
    setLoadedAt(Date.now())
    setError(null)
  }
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load the partners.")

  useEffect(() => {
    fetchPartners().then(apply, fail)
  }, [])

  // Grouped by country, biggest first; "haven't said yet" last.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = (partners ?? []).filter(
      (p) => !q || [p.name, p.email, p.basedIn, p.nationality, p.invitedBy?.name, p.whatsapp].some((v) => v?.toLowerCase().includes(q)),
    )
    const byKey = new Map<string, GlobalPartnerRow[]>()
    for (const p of list) {
      const key = p.basedIn ?? NOT_GIVEN
      byKey.set(key, [...(byKey.get(key) ?? []), p])
    }
    return [...byKey.entries()]
      .sort(([a, x], [b, y]) => (a === NOT_GIVEN ? 1 : b === NOT_GIVEN ? -1 : y.length - x.length || a.localeCompare(b)))
      .map(([key, rows]) => ({ key, rows: [...rows].sort((m, n) => m.name.localeCompare(n.name)) }))
  }, [partners, query])

  // A reminder goes to active partners who haven't answered and weren't reminded this past week.
  const waiting = useMemo(() => (partners ?? []).filter((p) => p.status === "active" && !p.basedIn), [partners])
  const remindable = useMemo(
    () => waiting.filter((p) => !p.remindedAt || loadedAt - Date.parse(p.remindedAt) > REMIND_AGAIN_AFTER_DAYS * DAY_MS),
    [waiting, loadedAt],
  )

  const sendReminders = async () => {
    const targets = remindable
    if (!targets.length) return
    if (
      !window.confirm(
        `Email ${targets.length} Global Partner${targets.length === 1 ? "" : "s"}? Each gets one email asking them to sign in and say where they're based.`,
      )
    )
      return
    setNotice(null)
    setSending({ done: 0, total: targets.length })
    let failed = 0
    for (const [i, p] of targets.entries()) {
      try {
        const res = await fetch("/api/admin/global-partners/remind", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: p.id }),
        })
        const json = (await res.json().catch(() => ({}))) as { remindedAt?: string }
        if (!res.ok || !json.remindedAt) throw new Error("failed")
        setPartners((prev) => (prev ?? []).map((x) => (x.id === p.id ? { ...x, remindedAt: json.remindedAt! } : x)))
      } catch {
        failed += 1
      }
      setSending({ done: i + 1, total: targets.length })
    }
    setSending(null)
    const sent = targets.length - failed
    setNotice(
      failed
        ? `Sent ${sent} reminder${sent === 1 ? "" : "s"} — ${failed} couldn't be sent (System Logs has the reason).`
        : `Sent ${sent} reminder${sent === 1 ? "" : "s"}.`,
    )
  }

  if (!allowed) return null

  const countries = new Set((partners ?? []).map((p) => p.basedIn).filter(Boolean)).size
  const stats = partners
    ? [
        { icon: Users, label: "Global Partners", value: partners.length, tone: "text-[#001f3f] bg-[#001f3f]/5 border-[#001f3f]/15" },
        { icon: Globe2, label: "Countries", value: countries, tone: "text-[#8a6d2b] bg-[#d6b357]/15 border-[#d6b357]/40" },
        { icon: MapPin, label: "Haven't said where yet", value: partners.filter((p) => !p.basedIn).length, tone: "text-rose-700 bg-rose-50 border-rose-200" },
        { icon: Clock, label: "Waiting for approval", value: partners.filter((p) => p.status === "pending").length, tone: "text-amber-700 bg-amber-50 border-amber-200" },
      ]
    : []

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-['Outfit'] text-2xl font-bold text-[#0d1117]">
            <Globe2 className="h-6 w-6 text-[#001f3f]" />
            Global Partners
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-[#6b7280]">
            Every Global Partner, grouped by the country they live in. Partners who joined before we asked are listed last —
            they&apos;re asked when they next sign in, and you can email them a reminder.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setRefreshing(true)
            fetchPartners()
              .then(apply, fail)
              .finally(() => setRefreshing(false))
          }}
          disabled={refreshing || partners === null}
          className="inline-flex items-center gap-1.5 self-start rounded-lg bg-[#f4f6f9] px-3 py-2 text-xs font-semibold text-[#6b7280] transition-colors hover:bg-[#e8eaed] hover:text-[#001f3f] disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* The numbers */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(partners ? stats : Array.from({ length: 4 }, () => null)).map((s, i) =>
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
          {/* Jump to a country */}
          <div className="flex flex-wrap gap-1.5">
            {groups.map((g) => (
              <a
                key={g.key}
                href={`#${anchorOf(g.key)}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] px-2.5 py-1.5 text-xs font-bold text-[#374151] transition-colors hover:border-[#d6b357]"
              >
                {g.key === NOT_GIVEN ? <span className="text-[#9ca3af]">Not given yet</span> : <>{countryFlag(g.key)} {g.key}</>}
                <span className="rounded-full bg-[#f3f4f6] px-1.5 text-[11px]">{g.rows.length}</span>
              </a>
            ))}
          </div>
          <div className="relative lg:w-80">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, country, inviter, WhatsApp…"
              className="w-full rounded-xl border border-[#e5e5e5] py-2.5 pl-10 pr-4 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#001f3f] focus:outline-none"
            />
          </div>
        </div>

        {notice && <p className="mt-4 rounded-lg bg-[#f4f6f9] px-3 py-2 text-xs font-semibold text-[#374151]">{notice}</p>}

        {error ? (
          <p className="py-8 text-sm text-rose-600">{error}</p>
        ) : partners === null ? (
          <p className="flex items-center gap-2 py-8 text-sm text-[#9ca3af]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading partners…
          </p>
        ) : groups.length === 0 ? (
          <p className="py-8 text-sm text-[#9ca3af]">{query ? "Nobody matches." : "No Global Partners yet."}</p>
        ) : (
          <div className="mt-5 space-y-6">
            {groups.map((g) => {
              const notGiven = g.key === NOT_GIVEN
              const pendingCount = g.rows.filter((p) => p.status === "pending").length
              return (
                <section key={g.key} id={anchorOf(g.key)} className="scroll-mt-24">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef0f3] pb-2.5">
                    <h2 className="flex flex-wrap items-center gap-2 font-['Outfit'] text-lg font-bold text-[#0d1117]">
                      {notGiven ? (
                        <>
                          <MapPin className="h-5 w-5 text-rose-500" /> Haven&apos;t said where yet
                        </>
                      ) : (
                        <>
                          <span className="text-xl leading-none">{countryFlag(g.key)}</span> {g.key}
                        </>
                      )}
                      <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-xs font-bold text-[#374151]">{g.rows.length}</span>
                      {pendingCount > 0 && (
                        <span className="text-xs font-semibold text-amber-700">{pendingCount} waiting for approval</span>
                      )}
                    </h2>
                    {notGiven && (
                      <div className="flex flex-col items-start gap-1 sm:items-end">
                        <button
                          type="button"
                          onClick={() => void sendReminders()}
                          disabled={sending !== null || remindable.length === 0}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#001f3f] px-3.5 text-xs font-bold text-white transition-colors hover:bg-[#00356b] disabled:opacity-50"
                        >
                          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                          {sending ? `Sending ${sending.done} of ${sending.total}…` : `Email reminder (${remindable.length})`}
                        </button>
                        <p className="text-[11px] text-[#9ca3af]">
                          {waiting.length - remindable.length > 0
                            ? `${waiting.length - remindable.length} reminded this past week are skipped · `
                            : ""}
                          Pending partners can&apos;t sign in yet, so they&apos;re skipped.
                        </p>
                      </div>
                    )}
                  </div>

                  <ul className="divide-y divide-[#f0f2f5]">
                    {g.rows.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                        <Avatar p={p} />
                        <div className="min-w-0 flex-1 basis-56">
                          <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#111827]">
                            <span className="truncate">{p.name}</span>
                            <StatusChip status={p.status} />
                          </p>
                          <p className="mt-0.5 truncate text-xs text-[#6b7280]">{p.email ?? "No email"}</p>
                        </div>
                        <div className="min-w-0 basis-44 text-xs text-[#6b7280]">
                          {p.invitedBy ? (
                            <>
                              Invited by <span className="font-semibold text-[#374151]">{p.invitedBy.name}</span>
                            </>
                          ) : (
                            <span className="text-[#9ca3af]">No inviter on record</span>
                          )}
                          <p className="mt-0.5">Joined {fmtDate(p.joinedAt)}</p>
                        </div>
                        <div className="min-w-0 basis-44 text-xs text-[#6b7280]">
                          {p.whatsapp ? (
                            <a
                              href={`https://wa.me/${p.whatsapp.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="tabular-nums font-semibold text-[#374151] hover:text-[#166534] hover:underline"
                            >
                              WhatsApp {p.whatsapp}
                            </a>
                          ) : (
                            <span className="text-[#9ca3af]">No WhatsApp yet</span>
                          )}
                          {notGiven && (
                            <p className="mt-0.5">
                              {p.nationality ? (
                                <>
                                  Nationality: {nationalityFlag(p.nationality)} {p.nationality}
                                </>
                              ) : (
                                "No nationality on profile"
                              )}
                              {p.remindedAt && <> · Reminded {fmtDate(p.remindedAt)}</>}
                            </p>
                          )}
                        </div>
                        <Link
                          href={`${base}/accounts/users?account=${p.id}`}
                          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#e5e5e5] px-3 text-xs font-bold text-[#374151] transition-colors hover:border-[#001f3f] hover:text-[#001f3f]"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Profile
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
