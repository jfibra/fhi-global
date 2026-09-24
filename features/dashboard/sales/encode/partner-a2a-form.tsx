"use client"

/**
 * The A2A part of the Partner step: "Do you already have a signed A2A
 * agreement?" Yes → they upload the signed copy on Review. No → they fill and
 * sign the SAME A2A form as the A2A Agreement page, right here (many agents
 * don't know where that page is); the PDF is built on submit and attached to
 * the sale as its partnership agreement. Names and shares are locked to the
 * partner table; property and client come from the later steps when left blank.
 */

import { FilePlus2, FileSignature } from "lucide-react"
import { A2AFormFields } from "@/features/dashboard/a2a-agreement/a2a-form"
import type { A2AInput } from "@/lib/a2a-agreement"
import type { SalePartner } from "@/lib/sales-service"
import { ChoiceCard } from "./partner-step"
import { composeA2A, newPairDraft, pairOrder, type A2APairDraft } from "./partner-a2a"

export type A2AMode = "have" | "fill"

/** Top-level agreement fields that belong to the draft (names/shares are the sale's). */
const PAIR_FIELDS = ["date", "scope", "propertyRef", "clientName", "noticePeriodDays", "validUntil"] as const

export function PartnerA2ASection({
  mode,
  onMode,
  owner,
  partners,
  drafts,
  onDraft,
  onAgentBrn,
  defaults,
  sale,
  errors,
}: {
  mode: A2AMode | null
  onMode: (mode: A2AMode) => void
  owner: SalePartner
  partners: SalePartner[]
  /** One agreement per partner, keyed by the partner's agent_id. */
  drafts: Record<string, A2APairDraft>
  onDraft: (partnerId: string, next: A2APairDraft) => void
  /** BRN lives on the partner table, so an edit here goes back there. */
  onAgentBrn: (agentId: string, brn: string) => void
  defaults: (agentId: string) => { phone: string; email: string }
  /** What the sale will fill the reference boxes with, shown as placeholders. */
  sale: { propertyRef: string; clientName: string }
  errors: Record<string, string>
}) {
  return (
    <div className="space-y-5 border-t border-[#f0f2f5] pt-6">
      <div>
        <h3 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">
          Do you already have a signed A2A agreement with {partners.map((p) => p.name).join(" and ")}?
        </h3>
        <p className="mt-1 text-sm text-[#6b7280]">
          The Agent-to-Agent (A2A) Collaboration Agreement is the proof of your partnership — the admin checks it when validating the sale.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ChoiceCard
          selected={mode === "have"}
          icon={FileSignature}
          title="Yes, I already have it"
          desc="Skip this — just upload the signed copy on the Review step."
          onClick={() => onMode("have")}
        />
        <ChoiceCard
          selected={mode === "fill"}
          icon={FilePlus2}
          title="No, fill it in here"
          desc="The A2A form, pre-filled from this sale. You both sign on screen and it's attached to the sale for you."
          onClick={() => onMode("fill")}
        />
      </div>
      {errors.a2a_mode && <p className="-mt-3 text-xs text-rose-600">{errors.a2a_mode}</p>}

      {mode === "fill" &&
        partners.map((p) => {
          const draft = drafts[p.agent_id] ?? newPairDraft()
          const { input } = composeA2A({ owner, partner: p, draft, defaults, sale })
          const [a, b] = pairOrder(owner, p)
          const you = (agent: SalePartner) => (agent.agent_id === owner.agent_id ? " (you)" : "")
          const scopeError = errors[`a2a_scope_${p.agent_id}`]
          const signError = errors[`a2a_sign_${p.agent_id}`]

          const onChange = (patch: Partial<A2AInput>) => {
            const next = { ...draft }
            for (const key of PAIR_FIELDS) {
              if (patch[key] !== undefined) (next as Record<string, unknown>)[key] = patch[key]
            }
            onDraft(p.agent_id, next)
          }

          return (
            <div key={p.agent_id} className="space-y-5 rounded-2xl bg-[#f4f6f9] p-4 sm:p-5">
              <div className="bg-[#001f3f] px-5 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6b357]">A2A Agreement</p>
                <p className="font-['Outfit'] text-lg font-bold text-white">You &amp; {p.name}</p>
              </div>
              <A2AFormFields
                value={input}
                onChange={onChange}
                onPartyChange={(which, patch) => {
                  const agent = which === "A" ? a : b
                  // Name is the sale's and the date is stamped on build; BRN goes to the table.
                  const typed = { ...patch }
                  delete typed.fullName
                  delete typed.signedDate
                  delete typed.brn
                  if (patch.brn !== undefined) onAgentBrn(agent.agent_id, patch.brn)
                  if (Object.keys(typed).length > 0) {
                    onDraft(p.agent_id, {
                      ...draft,
                      parties: { ...draft.parties, [agent.agent_id]: { ...draft.parties[agent.agent_id], ...typed } },
                    })
                  }
                }}
                fieldErrors={scopeError ? new Set(["scope"] as const) : undefined}
                lockNamesAndSplits
                lockedNote="Names and shares come from the partner table above — change them there. Leave the property and client boxes blank to fill them from the next steps."
                partyNameSuffix={{ A: you(a), B: you(b) }}
                referencePlaceholders={{
                  propertyRef: sale.propertyRef || "Filled in from the Property step",
                  clientName: sale.clientName || "Filled in from the Client step",
                }}
                signatureNote="Both agents sign here with a finger, stylus or mouse — the signed agreement is attached to the sale for you. Partner not with you? Choose “Yes, I already have it”; the Review step lets you download this agreement pre-filled to sign on paper."
              />
              {(scopeError || signError) && (
                <div className="space-y-1 border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                  {scopeError && <p>{scopeError}</p>}
                  {signError && <p>{signError}</p>}
                </div>
              )}
            </div>
          )
        })}
    </div>
  )
}
