// The existing A2A Collaboration Agreement (lib/a2a-agreement.ts +
// features/dashboard/a2a-agreement/a2a-form.tsx), filled in from a shared sale.
// Record Your Sale asks whether the agents already have a signed A2A; if not,
// they fill and sign the same A2A form right in the flow, and the PDF built
// here is attached to the sale as its partnership agreement.
//
// The A2A is a two-party form, so a sale with two partners gets one agreement
// per partner (you ↔ that partner). Each shows the two agents' shares of the
// WHOLE deal, which is how the sale records them. Names, shares and BRNs always
// come from the sale's partner table; everything else is what was typed.

import { buildA2APdfBlob, downloadA2APdf, type A2AInput, type A2AParty, type A2AScope } from "@/lib/a2a-agreement"
import { todayLocal } from "@/features/dashboard/a2a-agreement/a2a-form"
import type { SalePartner } from "@/lib/sales-service"

export const A2A_AGENCY = "FHI Global Property"

/** What one agent has typed on an agreement beyond the sale's own data. */
export type A2APartyDraft = Pick<A2AParty, "agency" | "phone" | "email" | "signedName" | "signatureDataUrl">

/** One partner's agreement as typed so far. Party fields are keyed by agent_id,
 *  so changing who is Lead (Party A) never mixes up whose details are whose. */
export type A2APairDraft = {
  date: string
  scope: A2AScope | ""
  propertyRef: string
  clientName: string
  noticePeriodDays: string
  validUntil: string
  parties: Record<string, Partial<A2APartyDraft>>
}

export const newPairDraft = (): A2APairDraft => ({
  date: todayLocal(),
  scope: "",
  propertyRef: "",
  clientName: "",
  noticePeriodDays: "30",
  validUntil: "",
  parties: {},
})

/** Party A is the "Introducing / Listing Agent": the Lead when they are in this pair, else the owner. */
export function pairOrder(owner: SalePartner, partner: SalePartner): [SalePartner, SalePartner] {
  return partner.role === "lead" ? [partner, owner] : [owner, partner]
}

/**
 * The A2AInput for one pair. `forPdf` fills blank reference boxes from the sale
 * (the form shows those as placeholders) and stamps the signing date.
 */
export function composeA2A(opts: {
  owner: SalePartner
  partner: SalePartner
  draft: A2APairDraft
  /** Pre-fill for an agent's contact details (their profile phone, your email). */
  defaults: (agentId: string) => { phone: string; email: string }
  sale: { propertyRef: string; clientName: string }
  forPdf?: boolean
}): { input: A2AInput; fileName: string } {
  const { owner, partner, draft, defaults, sale, forPdf } = opts
  const [a, b] = pairOrder(owner, partner)
  const date = draft.date || todayLocal()
  const party = (agent: SalePartner): A2AParty => {
    const typed = draft.parties[agent.agent_id] ?? {}
    const d = defaults(agent.agent_id)
    return {
      fullName: agent.name,
      agency: typed.agency ?? A2A_AGENCY,
      brn: agent.brn ?? "",
      phone: typed.phone ?? d.phone,
      email: typed.email ?? d.email,
      signatureDataUrl: typed.signatureDataUrl,
      signedName: typed.signedName ?? "",
      signedDate: forPdf ? date : "",
    }
  }
  return {
    input: {
      date,
      partyA: party(a),
      partyB: party(b),
      scope: draft.scope,
      propertyRef: forPdf ? draft.propertyRef.trim() || sale.propertyRef : draft.propertyRef,
      clientName: forPdf ? draft.clientName.trim() || sale.clientName : draft.clientName,
      splitA: String(a.share),
      splitB: String(b.share),
      noticePeriodDays: draft.noticePeriodDays,
      validUntil: draft.validUntil,
    },
    fileName: `A2A-Agreement-${a.name.replace(/\s+/g, "-")}-${b.name.replace(/\s+/g, "-")}.pdf`,
  }
}

/** The signed agreement as a File, ready to upload with the sale. */
export async function partnerA2AFile(built: { input: A2AInput; fileName: string }): Promise<File> {
  const blob = await buildA2APdfBlob(built.input)
  return new File([blob], built.fileName, { type: "application/pdf" })
}

export function downloadPartnerA2A(built: { input: A2AInput; fileName: string }): Promise<void> {
  return downloadA2APdf(built.input, built.fileName)
}
