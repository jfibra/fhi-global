"use client"

/**
 * My Team → one member, in a slide-over (boss via Juliecor, 2026-10-14): who
 * they are, who recruited them, every deal credited to them (the selected
 * period's deals edged in gold) and their own direct recruits. Tapping the
 * recruiter or a recruit opens that person on top, with Back to return —
 * walking the tree without leaving the page. Everything comes from the data
 * the page already holds; nothing new is fetched.
 */

import { useEffect, useMemo, useRef } from "react"
import { ArrowLeft, ChevronRight, X } from "lucide-react"
import { roleToLabel } from "@/lib/app-roles"
import type { MyTeamResponse } from "@/app/api/my-team/route"
import { AED, Avatar, Level, StatusChip, fmtDate, inRange, plural, short } from "./ui"

type Props = {
  data: MyTeamResponse
  id: string
  canGoBack: boolean
  /** The signed-in leader's own team ("you") or an admin looking at someone's. */
  self: boolean
  period: { from: string | null; to: string | null; label: string }
  onOpen: (id: string) => void
  onBack: () => void
  onClose: () => void
}

export default function MemberPanel({ data, id, canGoBack, self, period, onOpen, onBack, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const byId = useMemo(() => new Map(data.members.map((m) => [m.id, m])), [data])
  const m = byId.get(id)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow }
  }, [onClose])
  useEffect(() => { closeRef.current?.focus() }, [id])

  const deals = useMemo(
    () =>
      data.sales
        .flatMap((s) => {
          const c = s.credits.find((x) => x.memberId === id)
          if (!c) return []
          const others = [...s.credits.filter((x) => x.memberId !== id).map((x) => x.name), ...s.outside.map((n) => (n === "you" && !self ? data.root.name : n))]
          return [{ s, c, others, inPeriod: inRange(s.date, period.from, period.to) }]
        })
        .sort((a, b) => b.s.date.localeCompare(a.s.date)),
    [data, id, self, period.from, period.to],
  )
  const recruits = useMemo(() => data.members.filter((x) => x.parentId === id).sort((a, b) => b.validatedValue - a.validatedValue || b.deals - a.deals || a.name.localeCompare(b.name)), [data, id])
  if (!m) return null

  const inPeriod = deals.filter((d) => d.inPeriod && d.s.status === "validated")
  const periodValue = inPeriod.reduce((a, d) => a + d.c.value, 0)
  const recruiter = byId.get(m.parentId)
  const recruitedByRoot = m.parentId === data.root.id

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true" aria-label={`${m.name} — details`}>
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default bg-[#0d1117]/45 backdrop-blur-[2px] animate-in fade-in duration-200" />
      <aside key={id} className="relative flex h-full w-full max-w-[460px] flex-col bg-[#f4f6f9] shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Who they are */}
        <header className="relative overflow-hidden bg-[#001f3f] px-5 pb-5 pt-4 text-white">
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full border border-[#d6b357]/25" aria-hidden="true" />
          <div className="relative flex items-center justify-between">
            {canGoBack ? (
              <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[12px] font-semibold text-white/80 hover:bg-white/10 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back</button>
            ) : <span className="text-[10.5px] font-bold uppercase tracking-[0.24em] text-[#f0d89b]">Team member</span>}
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
          </div>
          <div className="relative mt-4 flex items-center gap-4">
            <Avatar name={m.name} photo={m.photo} size="h-[72px] w-[72px]" ring={m.validated ? "ring-[3px] ring-[#d6b357]" : "ring-2 ring-white/25"} />
            <div className="min-w-0">
              <h2 className="font-['Outfit'] text-[22px] font-bold leading-tight">{m.name}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-white/70">
                <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10.5px] font-bold text-white">L{m.level}</span>
                <StatusChip status={m.status} />
                <span>{roleToLabel(m.role)}</span>
              </p>
              <p className="mt-1 text-[12px] text-white/55">Joined {fmtDate(m.joinedAt)}</p>
            </div>
          </div>
          <dl className="relative mt-5 grid grid-cols-3 gap-3 border-t border-white/15 pt-4">
            <div>
              <dd className="font-['Outfit'] text-[20px] font-bold leading-none text-[#f0d89b]">{m.validatedValue ? `AED ${short(m.validatedValue)}` : "—"}</dd>
              <dt className="mt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white/55">{plural(m.validated, "deal")} · all time</dt>
            </div>
            <div>
              <dd className="font-['Outfit'] text-[20px] font-bold leading-none">{periodValue ? `AED ${short(periodValue)}` : "—"}</dd>
              <dt className="mt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white/55">{plural(inPeriod.length, "deal")} · {period.label}</dt>
            </div>
            <div>
              <dd className="font-['Outfit'] text-[20px] font-bold leading-none">{m.network}</dd>
              <dt className="mt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white/55">{m.direct} direct · network</dt>
            </div>
          </dl>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {/* Who recruited them */}
          <section className="rounded-2xl border border-[#e8eaed] bg-white p-4">
            <h3 className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#9ca3af]">Recruited by</h3>
            {recruiter ? (
              <button type="button" onClick={() => onOpen(recruiter.id)} className="mt-2 flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition-colors hover:bg-[#f4f6f9]">
                <Avatar name={recruiter.name} photo={recruiter.photo} size="h-9 w-9" />
                <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 text-sm font-semibold text-[#111827]"><span className="truncate">{recruiter.name}</span><Level n={recruiter.level} /></span><span className="text-[11px] text-[#6b7280]">{roleToLabel(recruiter.role)}</span></span>
                <ChevronRight className="h-4 w-4 text-[#c5ccd6]" />
              </button>
            ) : (
              <div className="mt-2 flex items-center gap-3 p-1.5">
                <Avatar name={data.root.name} photo={data.root.photo} size="h-9 w-9" ring="ring-2 ring-[#d6b357]" />
                <span className="text-sm font-semibold text-[#111827]">{recruitedByRoot && self ? "You" : data.root.name}{recruitedByRoot && <span className="ml-1.5 text-[11px] font-normal text-[#9ca3af]">direct recruit</span>}</span>
              </div>
            )}
          </section>

          {/* Their deals */}
          <section className="rounded-2xl border border-[#e8eaed] bg-white p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#9ca3af]">Deals · {deals.length}</h3>
              {deals.some((d) => d.inPeriod) && <span className="inline-flex items-center gap-1.5 text-[11px] text-[#9ca3af]"><span className="h-2 w-2 rounded-full bg-[#d6b357]" /> {period.label}</span>}
            </div>
            {deals.length === 0 ? (
              <p className="mt-3 text-sm text-[#9ca3af]">No deals recorded yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {deals.map(({ s, c, others, inPeriod: hot }) => (
                  <li key={s.id} className={`rounded-xl border p-3 ${hot ? "border-[#d6b357]/60 bg-[#fffcf3]" : "border-[#eef0f3]"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#111827]">{s.project}</p>
                        <p className="text-[11px] text-[#6b7280]">{[fmtDate(s.date), s.developer, s.unit].filter(Boolean).join(" · ")}</p>
                      </div>
                      <StatusChip status={s.status} />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between gap-2">
                      <span className="text-[11px] text-[#9ca3af]">{others.length ? `${c.share}% share · with ${others.join(", ")}` : `Contract ${AED(s.price)}`}</span>
                      <span className="shrink-0 font-['Outfit'] text-[14px] font-bold tabular-nums text-[#001f3f]">{AED(c.value)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Their own recruits */}
          <section className="rounded-2xl border border-[#e8eaed] bg-white p-4">
            <h3 className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#9ca3af]">Their recruits · {m.direct}{m.network > m.direct ? ` direct, ${m.network} in network` : ""}</h3>
            {recruits.length === 0 ? (
              <p className="mt-3 text-sm text-[#9ca3af]">Nobody has joined through {m.name.split(" ")[0]}&rsquo;s link yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-[#f0f2f5]">
                {recruits.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => onOpen(r.id)} className="flex w-full items-center gap-3 rounded-lg px-1.5 py-2 text-left transition-colors hover:bg-[#f4f6f9]">
                      <Avatar name={r.name} photo={r.photo} size="h-8 w-8" ring={r.validated ? "ring-2 ring-[#d6b357]" : ""} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-[#111827]">{r.name}</span>
                        <span className="text-[11px] text-[#6b7280]">{r.validated ? <b className="text-emerald-700">{plural(r.validated, "deal")} · AED {short(r.validatedValue)}</b> : "no sales yet"}{r.network ? ` · ${r.network} in network` : ""}</span>
                      </span>
                      <StatusChip status={r.status} />
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#c5ccd6]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  )
}
