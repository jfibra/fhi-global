"use client"

/**
 * Step 1 of Record Your Sale: "Do you have a partner with this sale?"
 *
 * No → the sale is recorded exactly as before. Yes → the agent searches FHI
 * agents by name (suggestions as they type), then sets each agent's role —
 * one Lead Agent (the client source), the rest Co-Agents — and share, which
 * must total 100%. The recording agent is always the first row. Under the
 * table the parent asks about the A2A agreement (./partner-a2a-form).
 */

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { CheckCircle2, Handshake, Loader2, Search, Star, User, X } from "lucide-react"
import {
  MAX_SALE_PARTNERS,
  SALE_DEAL_ROLE_LABELS,
  searchPartnerAgents,
  totalPartnerShare,
  type PartnerAgentOption,
  type SalePartner,
} from "@/lib/sales-service"
import { Field, initials, inputCls, labelCls } from "./encode-ui"

/** Display details for an agent row that the sale itself doesn't store. */
export type PartnerAgentInfo = { avatar: string | null; roleLabel: string; phone: string | null }

/** Equal shares that total exactly 100 — the first row takes the rounding cent. */
export function evenlySplit(agents: SalePartner[]): SalePartner[] {
  const n = agents.length
  if (n === 0) return agents
  const base = Math.floor((100 / n) * 100) / 100
  const first = Math.round((100 - base * (n - 1)) * 100) / 100
  return agents.map((a, i) => ({ ...a, share: i === 0 ? first : base }))
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  return src ? (
    <Image src={src} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-[#d6b357]/40" />
  ) : (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#001f3f] text-xs font-bold text-[#d6b357]">
      {initials(name) || <User className="h-4 w-4" />}
    </span>
  )
}

export function ChoiceCard({
  selected,
  icon: Icon,
  title,
  desc,
  onClick,
}: {
  selected: boolean
  icon: typeof User
  title: string
  desc: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`group flex items-start gap-4 rounded-2xl border-2 p-5 text-left transition-all ${
        selected
          ? "border-[#001f3f] bg-[#001f3f]/[0.03] shadow-sm"
          : "border-[#e8eaed] bg-white hover:border-[#d6b357]/70"
      }`}
    >
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors ${
          selected ? "bg-[#001f3f] text-[#d6b357]" : "bg-[#f4f5f7] text-[#b8913f] group-hover:bg-[#d6b357]/10"
        }`}
      >
        <Icon className="h-6 w-6" strokeWidth={1.6} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 font-['Outfit'] text-base font-bold text-[#0d1117]">
          {title}
          {selected && <CheckCircle2 className="h-4 w-4 text-[#001f3f]" />}
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-[#6b7280]">{desc}</span>
      </span>
    </button>
  )
}

/** Name box with FHI-agent suggestions — pick one to add them as a partner. */
function PartnerSearch({
  excludeIds,
  onPick,
}: {
  excludeIds: string[]
  onPick: (agent: PartnerAgentOption) => void
}) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState<PartnerAgentOption[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const inflight = useRef<AbortController | null>(null)

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      inflight.current?.abort()
    },
    [],
  )

  const visible = results.filter((a) => !excludeIds.includes(a.id))

  const lookup = (value: string) => {
    clearTimeout(timer.current)
    inflight.current?.abort()
    const term = value.trim()
    if (term.length < 2) {
      setResults([])
      setOpen(false)
      setLoading(false)
      setSearched(false)
      return
    }
    setLoading(true)
    timer.current = setTimeout(async () => {
      const ctrl = new AbortController()
      inflight.current = ctrl
      try {
        const agents = await searchPartnerAgents(term, ctrl.signal)
        if (ctrl.signal.aborted) return
        setResults(agents)
        setSearched(true)
        setOpen(true)
        setHighlight(-1)
      } catch {
        // Aborted by a newer keystroke, or offline — suggestions are best-effort.
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, 200)
  }

  const pick = (agent: PartnerAgentOption) => {
    onPick(agent)
    setQ("")
    setResults([])
    setOpen(false)
    setSearched(false)
    setHighlight(-1)
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          lookup(e.target.value)
        }}
        onFocus={() => searched && setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!open || visible.length === 0) return
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setHighlight((h) => (h + 1) % visible.length)
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setHighlight((h) => (h <= 0 ? visible.length - 1 : h - 1))
          } else if (e.key === "Enter" && highlight >= 0) {
            e.preventDefault()
            pick(visible[highlight])
          } else if (e.key === "Escape") {
            setOpen(false)
          }
        }}
        placeholder="Type your partner agent's name…"
        maxLength={60}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="partner-agent-suggestions"
        className={`${inputCls} pl-11 pr-10`}
      />
      {loading && <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#9ca3af]" />}
      {open && (
        <ul
          id="partner-agent-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-[#e5e7eb] bg-white py-1 shadow-lg"
        >
          {visible.length === 0 ? (
            <li className="px-4 py-3 text-sm text-[#6b7280]">
              {loading ? "Searching…" : <>No active FHI agent matches &ldquo;{q.trim()}&rdquo;.</>}
            </li>
          ) : (
            visible.map((agent, i) => (
              <li
                key={agent.id}
                role="option"
                aria-selected={i === highlight}
                // mousedown (not click) so the pick lands before the input's blur closes the list
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(agent)
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${
                  i === highlight ? "bg-[#001f3f]/6 text-[#001f3f]" : "text-[#374151]"
                }`}
              >
                <Avatar name={agent.name} src={agent.avatar} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{agent.name}</span>
                  <span className="block truncate text-xs text-[#9ca3af]">{agent.role_label}</span>
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

export function PartnerStep({
  hasPartner,
  onHasPartner,
  agents,
  onAgentsChange,
  info,
  onAgentInfo,
  ownerId,
  errors,
  children,
}: {
  hasPartner: boolean | null
  onHasPartner: (value: boolean) => void
  /** Every agent on the deal, the owner first. Empty until "Yes". */
  agents: SalePartner[]
  onAgentsChange: (next: SalePartner[]) => void
  info: Record<string, PartnerAgentInfo>
  onAgentInfo: (agentId: string, value: PartnerAgentInfo) => void
  ownerId: string
  errors: Record<string, string>
  /** The A2A question, shown under the table once a partner is added. */
  children?: React.ReactNode
}) {
  // Share boxes keep what was typed ("33.") until blur; the number is pushed up
  // on every keystroke so validation always sees the latest value.
  const [shareDrafts, setShareDrafts] = useState<Record<string, string>>({})

  const partnerCount = agents.filter((a) => a.agent_id !== ownerId).length
  const total = totalPartnerShare(agents)
  const totalOk = Number.isFinite(total) && Math.abs(total - 100) <= 0.01

  const patch = (agentId: string, change: Partial<SalePartner>) =>
    onAgentsChange(agents.map((a) => (a.agent_id === agentId ? { ...a, ...change } : a)))

  const makeLead = (agentId: string) =>
    onAgentsChange(agents.map((a) => ({ ...a, role: a.agent_id === agentId ? "lead" : "co_agent" })))

  const addPartner = (agent: PartnerAgentOption) => {
    if (agents.some((a) => a.agent_id === agent.id) || partnerCount >= MAX_SALE_PARTNERS) return
    onAgentInfo(agent.id, { avatar: agent.avatar, roleLabel: agent.role_label, phone: agent.phone })
    setShareDrafts({})
    onAgentsChange(evenlySplit([...agents, { agent_id: agent.id, name: agent.name, role: "co_agent", share: 0, brn: null }]))
  }

  const removePartner = (agentId: string) => {
    const rest = agents.filter((a) => a.agent_id !== agentId)
    // Removing the lead would leave nobody as client source — hand it back to the owner.
    const withLead = rest.some((a) => a.role === "lead")
      ? rest
      : rest.map((a) => ({ ...a, role: a.agent_id === ownerId ? ("lead" as const) : a.role }))
    setShareDrafts({})
    onAgentsChange(evenlySplit(withLead))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-['Outfit'] text-xl font-bold text-[#0d1117]">Do you have a partner with this sale?</h2>
        <p className="mt-1 text-sm text-[#6b7280]">
          A partner is another FHI agent who worked this client and deal with you.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ChoiceCard
          selected={hasPartner === false}
          icon={User}
          title="No, it's just me"
          desc="Go straight to the property details."
          onClick={() => onHasPartner(false)}
        />
        <ChoiceCard
          selected={hasPartner === true}
          icon={Handshake}
          title="Yes, I have a partner"
          desc="Add your partner agent and each agent's share of the deal."
          onClick={() => onHasPartner(true)}
        />
      </div>
      {errors.has_partner && <p className="-mt-3 text-xs text-rose-600">{errors.has_partner}</p>}

      {hasPartner && (
        <div className="space-y-5 border-t border-[#f0f2f5] pt-6">
          {partnerCount < MAX_SALE_PARTNERS ? (
            <Field
              label={partnerCount === 0 ? "Partner agent" : "Add another partner (optional)"}
              required={partnerCount === 0}
              error={errors.partners}
            >
              <PartnerSearch excludeIds={agents.map((a) => a.agent_id)} onPick={addPartner} />
              <p className="mt-1.5 text-[11px] text-[#9ca3af]">
                Active FHI agents only — up to {MAX_SALE_PARTNERS} partners on one sale.
              </p>
            </Field>
          ) : (
            <p className="rounded-xl border border-[#e5e5e5] bg-[#f8fafc] px-4 py-3 text-xs text-[#6b7280]">
              A sale can have up to {MAX_SALE_PARTNERS} partner agents — remove one to add someone else.
            </p>
          )}

          {partnerCount > 0 && (
            <div>
              <p className={labelCls}>
                Agents and work-effort share <span className="text-rose-500">*</span>
              </p>
              <div className="space-y-3">
                {agents.map((a) => {
                  const isOwner = a.agent_id === ownerId
                  const meta = info[a.agent_id]
                  return (
                    <div key={a.agent_id} className="rounded-2xl border border-[#e8eaed] bg-white p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <Avatar name={a.name} src={meta?.avatar ?? null} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-[#0d1117]">
                            {a.name}
                            {isOwner && <span className="ml-1.5 font-semibold text-[#9ca3af]">(you)</span>}
                          </p>
                          {meta?.roleLabel && <p className="truncate text-xs text-[#9ca3af]">{meta.roleLabel}</p>}
                        </div>
                        {a.role === "lead" ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#d6b357]/50 bg-[#d6b357]/15 px-3 py-1 text-xs font-bold text-[#8a6d2a]">
                            <Star className="h-3 w-3 fill-current" />
                            {SALE_DEAL_ROLE_LABELS.lead}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => makeLead(a.agent_id)}
                            title="Make this agent the Lead Agent (the client source)"
                            className="inline-flex items-center gap-1 rounded-full border border-[#e5e5e5] px-3 py-1 text-xs font-semibold text-[#6b7280] transition-colors hover:border-[#d6b357] hover:text-[#8a6d2a]"
                          >
                            {SALE_DEAL_ROLE_LABELS.co_agent} · make lead
                          </button>
                        )}
                        {!isOwner && (
                          <button
                            type="button"
                            onClick={() => removePartner(a.agent_id)}
                            aria-label={`Remove ${a.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-[#9ca3af] transition-colors hover:bg-rose-50 hover:text-rose-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-md">
                        <div>
                          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">Share (%)</label>
                          <div className="relative">
                            <input
                              className={`${inputCls} pr-9`}
                              inputMode="decimal"
                              value={shareDrafts[a.agent_id] ?? (Number.isFinite(a.share) ? String(a.share) : "")}
                              onChange={(e) => {
                                const v = e.target.value.replace(/[^0-9.]/g, "")
                                setShareDrafts((d) => ({ ...d, [a.agent_id]: v }))
                                patch(a.agent_id, { share: v === "" ? Number.NaN : Number(v) })
                              }}
                              onBlur={() =>
                                setShareDrafts((d) => {
                                  const next = { ...d }
                                  delete next[a.agent_id]
                                  return next
                                })
                              }
                              aria-label={`${a.name} share in percent`}
                            />
                            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-[#9ca3af]">%</span>
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">BRN No. (optional)</label>
                          <input
                            className={inputCls}
                            value={a.brn ?? ""}
                            onChange={(e) => patch(a.agent_id, { brn: e.target.value.slice(0, 40) })}
                            placeholder="e.g. 12345"
                            aria-label={`${a.name} BRN number`}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div
                className={`mt-3 flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-bold ${
                  totalOk ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                <span>Total share</span>
                <span>{Number.isFinite(total) ? `${total}%` : "—"} {totalOk ? "✓" : "— must equal 100%"}</span>
              </div>
              {errors.partner_lead && <p className="mt-1 text-xs text-rose-600">{errors.partner_lead}</p>}
              {errors.partner_share && <p className="mt-1 text-xs text-rose-600">{errors.partner_share}</p>}
            </div>
          )}

          {/* "Do you already have a signed A2A?" — rendered by the parent once a partner is added. */}
          {partnerCount > 0 && children}
        </div>
      )}
    </div>
  )
}
