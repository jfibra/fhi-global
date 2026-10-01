// The existing A2A Collaboration Agreement (lib/a2a-agreement.ts +
// features/dashboard/a2a-agreement/a2a-form.tsx), filled in from a shared sale.
// Record Your Sale asks whether the agents already have a signed A2A; if not,
// they fill and sign the same A2A form right in the flow, and the PDF built
// here is attached to the sale as its partnership agreement.
//
// ONE agreement names every agent on the deal: Party A is the Lead (the client
// source), Party B the next agent, Party C the third when the sale has two
// partners. Each party's share is their share of the WHOLE deal, exactly as the
// sale records it. Names, shares and BRNs always come from the sale's partner
// table; everything else is what was typed.

import { buildA2APdfBlob, downloadA2APdf, type A2AInput, type A2AParty, type A2AScope } from "@/lib/a2a-agreement"
import { todayLocal } from "@/features/dashboard/a2a-agreement/a2a-form"
import type { SalePartner } from "@/lib/sales-service"

export const A2A_AGENCY = "FHI Global Property"

/** What one agent has typed on the agreement beyond the sale's own data. */
export type A2APartyDraft = Pick<A2AParty, "agency" | "phone" | "email" | "signedName" | "signatureDataUrl">

/** The agreement as typed so far. Party fields are keyed by agent_id, so
 *  changing who is Lead (Party A) never mixes up whose details are whose. */
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

/** The parties in agreement order: Party A is the Lead ("Introducing / Listing
 *  Agent"), then the recording agent if they aren't the Lead, then the rest in
 *  table order. At most three (the sale allows two partners). */
export function agreementOrder(owner: SalePartner, partners: SalePartner[]): SalePartner[] {
  const all = [owner, ...partners.filter((p) => p.agent_id !== owner.agent_id)]
  const lead = all.find((a) => a.role === "lead") ?? owner
  return [lead, ...all.filter((a) => a.agent_id !== lead.agent_id)].slice(0, 3)
}

/**
 * The A2AInput for the whole deal. `forPdf` fills blank reference boxes from
 * the sale (the form shows those as placeholders) and stamps the signing date.
 */
export function composeA2A(opts: {
  owner: SalePartner
  partners: SalePartner[]
  draft: A2APairDraft
  /** Pre-fill for an agent's contact details (their profile phone, your email). */
  defaults: (agentId: string) => { phone: string; email: string }
  sale: { propertyRef: string; clientName: string }
  forPdf?: boolean
}): { input: A2AInput; fileName: string; order: SalePartner[] } {
  const { owner, partners, draft, defaults, sale, forPdf } = opts
  const order = agreementOrder(owner, partners)
  const [a, b, c] = order
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
    order,
    input: {
      date,
      partyA: party(a),
      partyB: party(b),
      ...(c ? { partyC: party(c), splitC: String(c.share) } : {}),
      scope: draft.scope,
      propertyRef: forPdf ? draft.propertyRef.trim() || sale.propertyRef : draft.propertyRef,
      clientName: forPdf ? draft.clientName.trim() || sale.clientName : draft.clientName,
      splitA: String(a.share),
      splitB: String(b.share),
      noticePeriodDays: draft.noticePeriodDays,
      validUntil: draft.validUntil,
    },
    fileName: `A2A-Agreement-${order.map((p) => p.name.replace(/\s+/g, "-")).join("-")}.pdf`,
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
