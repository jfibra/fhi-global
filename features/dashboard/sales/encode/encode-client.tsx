"use client"

/**
 * Record Your Sale — full-page stepper (deliberately not a modal). The agent first
 * picks the deal type on three cards:
 *   · Project Sale  — developer → project → unit (the classic flow)
 *   · Brokerage     — no developer/project; property type + address instead
 *   · Rental        — same shape as brokerage
 * then walks Partner → Property → Client → Contract → Review. Partner asks
 * "Do you have a partner with this sale?" (see ./partner-step); a shared sale
 * also needs the A2A agreement — uploaded on Review if they already have it,
 * or filled and signed right on the Partner step. Validation reuses
 * lib/sales-service rules; submission goes through the same createSale used
 * by the admin dialog, so workflow statuses behave identically.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { TileMockup } from "@/components/dashboard/hub-tile-mockups"
import Link from "next/link"
import {
  ArrowLeft, ArrowRight, Building2, Check, CheckCircle2,
  ClipboardList, Download, FileSignature, Handshake, KeyRound, Loader2, Paperclip, Sparkles, X,
} from "lucide-react"
import {
  createSale,
  notifySaleEvent,
  fetchDevelopersForSale,
  fetchProjectsForDeveloper,
  fetchUnitsForProject,
  uploadSaleProofFile,
  validateSaleFormData,
  validateSalePartners,
  SALE_DEAL_ROLE_LABELS,
  SALE_PROPERTY_TYPES,
  SALE_TYPE_LABELS,
  type DeveloperOption,
  type ProjectOption,
  type ProjectUnitOption,
  type SaleFormData,
  type SalePartner,
  type SaleType,
} from "@/lib/sales-service"
import { DeveloperCombobox } from "@/components/developers/developer-combobox"
import { getDashboardRouteByRole } from "@/lib/auth"
import { Field, SelectShell, inputCls, labelCls } from "./encode-ui"
import { PartnerStep, type PartnerAgentInfo } from "./partner-step"
import { PartnerA2ASection, type A2AMode } from "./partner-a2a-form"
import {
  composeA2A,
  downloadPartnerA2A,
  newPairDraft,
  pairOrder,
  partnerA2AFile,
  type A2APairDraft,
} from "./partner-a2a"

const EMPTY_CLIENT = {
  first_name: "", middle_name: "", last_name: "",
  email: "", phone: "", age: "", gender: "",
  occupation: "", street: "", city: "", state_province: "", country: "",
}

function emptyForm(saleType: SaleType): SaleFormData {
  return {
    sale_type: saleType,
    developer_id: "", project_id: "", project_unit_id: "",
    unit_number: "", block_number: "", lot_number: "",
    property_type: "", property_address: "",
    client: { ...EMPTY_CLIENT },
    contract_price: "", reservation_date: "",
    payment_plan: "", payment_terms: "",
    price_per_sqft: "", total_area_sqft: "",
    remarks: "",
    commission_status: "pending",
    validation_status: "pending",
  }
}

const TYPE_CARDS: Array<{
  type: SaleType
  mock: string
  icon: typeof Building2
  title: string
  desc: string
}> = [
  {
    type: "project",
    mock: "sale-project",
    icon: Building2,
    title: "Project Sale / Off-Plan",
    desc: "A unit in a developer's project — pick the developer, project and unit.",
  },
  {
    type: "brokerage",
    mock: "sale-brokerage",
    icon: Handshake,
    title: "Brokerage / Ready Unit",
    desc: "A resale / private-owner deal — no developer, just the property details.",
  },
  {
    type: "rental",
    mock: "sale-rental",
    icon: KeyRound,
    title: "Rental",
    desc: "A rental transaction — property details and the lease contract.",
  },
]

// Which validation keys belong to which step (for per-step gating). The
// Partner step has its own rules (validateSalePartners), not the sale's.
const STEP_KEYS: string[][] = [
  [],
  ["developer_id", "project_id", "property_type", "unit_information"],
  ["client.first_name", "client.last_name", "client.phone", "client_address"],
  ["contract_price", "reservation_date", "payment_plan", "payment_terms"],
]

const STEP_TITLES = ["Partner", "Property", "Client", "Contract", "Review"]
const STEP = { partner: 0, property: 1, client: 2, contract: 3, review: 4 } as const

/** A file chip with a remove button, for the staged uploads on Review. */
function FileChip({ file, onRemove }: { file: File; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f4f6f9] border border-[#e5e5e5] text-xs font-semibold text-[#374151]">
      <span className="max-w-[180px] truncate">{file.name}</span>
      <button
        type="button"
        onClick={onRemove}
        className="text-[#9ca3af] hover:text-rose-600"
        aria-label={`Remove ${file.name}`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </span>
  )
}

export function EncodeSaleClient({
  currentUserId,
  currentRole,
  currentUserName,
  currentUserEmail,
  currentUserPhone,
  currentUserAvatar,
}: {
  currentUserId: string
  currentRole: string
  /** Shown as "you" on the partner table and pre-filled on the A2A. */
  currentUserName: string
  currentUserEmail: string | null
  currentUserPhone: string | null
  currentUserAvatar: string | null
}) {
  const basePath = getDashboardRouteByRole(currentRole)

  const [saleType, setSaleType] = useState<SaleType | null>(null)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<SaleFormData>(emptyForm("project"))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Proof-of-transaction files staged on the Review step; uploaded right
  // after the sale row is created (same flow as the admin dialog).
  const [files, setFiles] = useState<File[]>([])
  const [uploadNote, setUploadNote] = useState<string | null>(null)

  // Partner step. null = not answered yet. `agents` is every agent on a
  // shared sale, the current user first; empty for a solo sale.
  const [hasPartner, setHasPartner] = useState<boolean | null>(null)
  const [agents, setAgents] = useState<SalePartner[]>([])
  const [agentInfo, setAgentInfo] = useState<Record<string, PartnerAgentInfo>>({})
  // The A2A: "have" = they upload the signed copy on Review (staged like the
  // proof); "fill" = the A2A form filled and signed on the Partner step, one
  // per partner (keyed by the partner's agent_id), built into PDFs on submit.
  const [a2aMode, setA2aMode] = useState<A2AMode | null>(null)
  const [a2aDrafts, setA2aDrafts] = useState<Record<string, A2APairDraft>>({})
  const [agreementFiles, setAgreementFiles] = useState<File[]>([])
  const [a2aBusyFor, setA2aBusyFor] = useState<string | null>(null)
  const [a2aError, setA2aError] = useState<string | null>(null)
  const partners = agents.filter((a) => a.agent_id !== currentUserId)
  const isShared = hasPartner === true

  const owner = agents.find((a) => a.agent_id === currentUserId) ?? null
  // Pre-fill for an agent's contact boxes on the A2A: their profile phone, your email.
  const a2aDefaults = (agentId: string) => ({
    phone: (agentId === currentUserId ? currentUserPhone : agentInfo[agentId]?.phone) ?? "",
    email: (agentId === currentUserId ? currentUserEmail : null) ?? "",
  })

  // Option lists (project sales only)
  const [developers, setDevelopers] = useState<DeveloperOption[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [units, setUnits] = useState<ProjectUnitOption[]>([])

  useEffect(() => {
    if (saleType !== "project") return
    void fetchDevelopersForSale().then(({ data }) => setDevelopers(data ?? []))
  }, [saleType])

  const pickType = (t: SaleType) => {
    setSaleType(t)
    setForm(emptyForm(t))
    setStep(0)
    setErrors({})
    setSubmitError(null)
    setFiles([])
    setUploadNote(null)
    setHasPartner(null)
    setAgents([])
    setAgentInfo({})
    setAgreementFiles([])
    setA2aError(null)
    setA2aMode(null)
    setA2aDrafts({})
  }

  // "No" moves straight on to Property; "Yes" opens the partner table with
  // the current user as the Lead until they say otherwise.
  const choosePartner = (value: boolean) => {
    setHasPartner(value)
    setErrors({})
    if (!value) {
      setAgents([])
      setAgreementFiles([])
      setStep(STEP.property)
      return
    }
    setAgentInfo((prev) => ({
      ...prev,
      [currentUserId]: { avatar: currentUserAvatar, roleLabel: "", phone: currentUserPhone },
    }))
    setAgents((prev) =>
      prev.length > 0
        ? prev
        : [{ agent_id: currentUserId, name: currentUserName || "You", role: "lead", share: 100, brn: null }],
    )
  }

  // Sequence tokens: a slower response for a previously selected developer/
  // project must not overwrite the options of the current selection.
  const projectsReqRef = useRef(0)
  const unitsReqRef = useRef(0)

  const onDeveloperChange = async (developerId: string) => {
    setForm((prev) => ({ ...prev, developer_id: developerId, project_id: "", project_unit_id: "" }))
    setProjects([])
    setUnits([])
    const token = ++projectsReqRef.current
    if (!developerId) return
    const { data } = await fetchProjectsForDeveloper(developerId)
    if (token === projectsReqRef.current) setProjects(data ?? [])
  }

  const onProjectChange = async (projectId: string) => {
    setForm((prev) => ({ ...prev, project_id: projectId, project_unit_id: "" }))
    setUnits([])
    const token = ++unitsReqRef.current
    if (!projectId) return
    const { data } = await fetchUnitsForProject(Number(projectId))
    if (token === unitsReqRef.current) setUnits(data ?? [])
  }

  const setField = <K extends keyof SaleFormData>(key: K, value: SaleFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }
  const setClient = (key: keyof typeof EMPTY_CLIENT, value: string) => {
    setForm((prev) => ({ ...prev, client: { ...prev.client, [key]: value } }))
  }

  // Per-step validation: run the full rule set, keep only this step's keys.
  const stepErrors = (s: number): Record<string, string> => {
    if (s === STEP.partner) {
      if (hasPartner === null) return { has_partner: "Choose No or Yes to continue" }
      if (!hasPartner) return {}
      const errs = validateSalePartners(agents, currentUserId)
      if (errs.partners) return errs
      if (!a2aMode) errs.a2a_mode = "Tell us if you already have a signed A2A agreement"
      if (a2aMode === "fill" && owner) {
        for (const p of partners) {
          const draft = a2aDrafts[p.agent_id] ?? newPairDraft()
          if (!draft.scope) errs[`a2a_scope_${p.agent_id}`] = `A2A with ${p.name}: choose the scope of collaboration`
          const unsigned = pairOrder(owner, p).filter((a) => !draft.parties[a.agent_id]?.signatureDataUrl)
          if (unsigned.length) {
            errs[`a2a_sign_${p.agent_id}`] = `A2A with ${p.name}: still to sign — ${unsigned
              .map((a) => (a.agent_id === currentUserId ? "you" : a.name))
              .join(" and ")}`
          }
        }
      }
      return errs
    }
    const all = validateSaleFormData(form)
    const keys = STEP_KEYS[s] ?? []
    const filtered: Record<string, string> = {}
    for (const k of keys) if (all[k]) filtered[k] = all[k]
    return filtered
  }

  const next = () => {
    const errs = stepErrors(step)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    setStep((s) => Math.min(s + 1, STEP_TITLES.length - 1))
  }

  const back = () => {
    setErrors({})
    setSubmitError(null)
    if (step === 0) {
      setSaleType(null)
      return
    }
    setStep((s) => s - 1)
  }

  const submit = async () => {
    // Proof of transaction is mandatory — never record a sale without it.
    if (files.length === 0) {
      setSubmitError("Attach at least one proof of transaction before submitting.")
      return
    }
    // A shared sale is only as good as the agreement behind it.
    if (isShared && a2aMode === "have" && agreementFiles.length === 0) {
      setSubmitError("Upload the signed A2A agreement with your partner before submitting.")
      return
    }
    // Re-check the Partner step here too (shares, A2A choice, signatures): the
    // step can't change on Review, but this keeps a bad share from ever
    // reaching the database trigger.
    const partnerError = isShared ? Object.values(stepErrors(STEP.partner))[0] : undefined
    if (partnerError) {
      setSubmitError(partnerError)
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      // Filled here → build the signed PDFs BEFORE saving, so a PDF failure
      // can never leave a shared sale without its agreement.
      let agreements = isShared && a2aMode === "have" ? agreementFiles : []
      if (isShared && a2aMode === "fill") {
        try {
          agreements = await Promise.all(
            partners.flatMap((p) => {
              const built = a2aBuiltFor(p)
              return built ? [partnerA2AFile(built)] : []
            }),
          )
        } catch (err) {
          setSubmitError(`Couldn't build the A2A agreement: ${(err as Error).message || "unknown error"}`)
          return
        }
      }
      const { data, error } = await createSale(form, currentUserId, currentRole, isShared ? agents : [])
      if (error || !data) {
        setSubmitError(error ?? "Failed to record the sale")
        return
      }
      notifySaleEvent(data.id, "encoded")
      // Upload staged proof files — the sale is already saved, so failures
      // here never lose the sale; they just get reported for a manual retry
      // (and the login prompt will nudge again until proof is attached).
      let failed = 0
      for (const file of files) {
        const { error: uploadError } = await uploadSaleProofFile(file, data.id)
        if (uploadError) failed++
      }
      let agreementFailed = 0
      for (const file of agreements) {
        const { error: uploadError } = await uploadSaleProofFile(file, data.id, "partnership_agreement")
        if (uploadError) agreementFailed++
      }
      const proofNote =
        failed === 0
          ? `${files.length} file${files.length > 1 ? "s" : ""} attached.`
          : failed === files.length
            ? "Sale saved, but the proof upload failed — please add it from your sales list."
            : `${files.length - failed} of ${files.length} files attached — add the rest from the sales list.`
      const agreementNote = !isShared
        ? ""
        : agreementFailed === 0
          ? " Signed A2A agreement attached."
          : " The signed A2A agreement didn't upload — send it to the admin team so they can attach it."
      setUploadNote(proofNote + agreementNote)
      setDone(true)
    } finally {
      setSubmitting(false)
    }
  }

  const developerName = developers.find((d) => d.id === form.developer_id)?.name ?? "—"
  const projectName = projects.find((p) => String(p.id) === form.project_id)?.name ?? "—"
  const unitLabel = useMemo(() => {
    const u = units.find((u) => String(u.id) === form.project_unit_id)
    return u?.unit_type ?? null
  }, [units, form.project_unit_id])

  // What the sale fills the A2A's reference boxes with when they're left blank.
  const unitBits = [form.unit_number && `Unit ${form.unit_number}`, form.block_number, form.lot_number && `Lot ${form.lot_number}`]
  const saleRef = {
    propertyRef: (
      saleType === "project"
        ? [projectName !== "—" ? projectName : "", unitLabel, ...unitBits]
        : [form.property_type, form.property_address, ...unitBits]
    )
      .map((v) => String(v ?? "").trim())
      .filter(Boolean)
      .join(" · "),
    clientName: [form.client.first_name, form.client.middle_name, form.client.last_name]
      .map((v) => v.trim())
      .filter(Boolean)
      .join(" "),
  }

  // The finished agreement for one partner (you ↔ them), ready to build.
  const a2aBuiltFor = (partner: SalePartner) =>
    owner
      ? composeA2A({
          owner,
          partner,
          draft: a2aDrafts[partner.agent_id] ?? newPairDraft(),
          defaults: a2aDefaults,
          sale: saleRef,
          forPdf: true,
        })
      : null

  const downloadA2A = async (partner: SalePartner) => {
    const built = a2aBuiltFor(partner)
    if (!built) return
    setA2aBusyFor(partner.agent_id)
    setA2aError(null)
    try {
      await downloadPartnerA2A(built)
    } catch (err) {
      setA2aError((err as Error).message || "Could not build the agreement PDF.")
    } finally {
      setA2aBusyFor(null)
    }
  }


  // ── Success screen ──
  if (done && saleType) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <span className="mx-auto w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-600" />
        </span>
        <h1 className="font-['Outfit'] text-3xl font-bold text-[#0d1117] mb-3">Sale encoded! 🎉</h1>
        <p className="text-[#6b7280] leading-relaxed mb-4">
          Your {SALE_TYPE_LABELS[saleType].toLowerCase()} has been recorded and is now{" "}
          <span className="font-semibold text-[#0d1117]">pending validation</span> by the admin team.
          {isShared && partners.length > 0 && (
            <> It&apos;s shared with <span className="font-semibold text-[#0d1117]">{partners.map((p) => p.name).join(" and ")}</span>, who can view it in their sales list — each of you is credited your share in your totals.</>
          )}
        </p>
        {uploadNote && (
          <p className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#f4f6f9] border border-[#e5e5e5] text-sm font-semibold text-[#374151] mb-8">
            <Paperclip className="w-4 h-4 text-[#b8913f]" />
            {uploadNote}
          </p>
        )}
        {!uploadNote && <span className="block mb-4" />}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setDone(false)
              setSaleType(null)
              setStep(0)
            }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#001f3f] text-white text-sm font-bold hover:bg-[#00356b] transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Encode another sale
          </button>
          <Link
            href={`${basePath}/sales`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-[#e5e5e5] text-sm font-bold text-[#374151] hover:border-[#001f3f] transition-colors"
          >
            <ClipboardList className="w-4 h-4" />
            View my sales
          </Link>
        </div>
      </div>
    )
  }

  // ── Type picker (three cards) ──
  if (!saleType) {
    return (
      <div className="w-full max-w-5xl mx-auto">
        <div className="mb-12">
          <h1 className="font-['Outfit'] text-3xl sm:text-4xl font-bold text-[#0d1117]">Record Your Sale</h1>
          <span className="block w-16 h-1 rounded-full bg-[#d6b357] mt-4 mb-5" aria-hidden="true" />
          <p className="text-base text-[#6b7280]">
            What kind of deal are you recording? Choose one to start.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TYPE_CARDS.map(({ type, mock, icon: Icon, title, desc }) => (
            <button
              key={type}
              type="button"
              onClick={() => pickType(type)}
              className="group text-left bg-white rounded-2xl border border-[#eceef1] p-8 shadow-[0_2px_12px_rgba(15,30,50,0.05)] hover:shadow-[0_18px_48px_-16px_rgba(0,20,40,0.22)] hover:-translate-y-1 hover:border-[#d6b357]/60 transition-all duration-300"
            >
              <div className="flex items-start justify-between gap-3 mb-7">
                <span className="w-20 h-20 rounded-full bg-[#f4f5f7] group-hover:bg-[#d6b357]/10 flex items-center justify-center transition-colors">
                  <Icon className="w-9 h-9 text-[#b8913f]" strokeWidth={1.5} />
                </span>
                {/* Miniature of this deal type. */}
                <TileMockup kind={mock} />
              </div>
              <h2 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] mb-3">{title}</h2>
              <p className="text-[15px] text-[#6b7280] leading-relaxed mb-7">{desc}</p>
              <ArrowRight className="w-6 h-6 text-[#b8913f] group-hover:translate-x-1.5 transition-transform duration-300" />
            </button>
          ))}
        </div>
      </div>
    )
  }

  const isProject = saleType === "project"

  // ── Stepper ──
  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header + type badge */}
      <div className="flex items-center justify-between gap-3 mb-7">
        <div>
          <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-bold text-[#0d1117]">Record Your Sale</h1>
          <p className="text-sm text-[#6b7280] mt-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#d6b357]/15 border border-[#d6b357]/40 text-[#8a6d2a] text-xs font-bold">
              {SALE_TYPE_LABELS[saleType]}
            </span>
            <button
              type="button"
              onClick={() => setSaleType(null)}
              className="ml-2 text-xs font-semibold text-[#6b7280] hover:text-[#001f3f] underline underline-offset-2"
            >
              change type
            </button>
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {STEP_TITLES.map((title, i) => (
          <div key={title} className={`flex items-center ${i < STEP_TITLES.length - 1 ? "flex-1" : ""}`}>
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                  i < step
                    ? "bg-[#d6b357] border-[#d6b357] text-[#001428]"
                    : i === step
                      ? "bg-[#001f3f] border-[#001f3f] text-white"
                      : "bg-white border-[#e5e5e5] text-[#9ca3af]"
                }`}
              >
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </span>
              <span className={`text-[11px] font-bold uppercase tracking-wide ${i <= step ? "text-[#0d1117]" : "text-[#b6bdc7]"}`}>
                {title}
              </span>
            </div>
            {i < STEP_TITLES.length - 1 && (
              <div
                className={`flex-1 h-[3px] mx-2 -mt-5 rounded-full ${
                  i < step ? "bg-[#d6b357]" : i === step ? "bg-[#001f3f]" : "bg-[#e8eaed]"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[24px] border border-[#e8eaed] shadow-sm p-6 sm:p-8">
        {/* ── Step 1: Partner ── */}
        {step === STEP.partner && (
          <PartnerStep
            hasPartner={hasPartner}
            onHasPartner={choosePartner}
            agents={agents}
            onAgentsChange={(next) => {
              setAgents(next)
              setErrors({})
            }}
            info={agentInfo}
            onAgentInfo={(id, value) => setAgentInfo((prev) => ({ ...prev, [id]: value }))}
            ownerId={currentUserId}
            errors={errors}
          >
            {owner && (
              <PartnerA2ASection
                mode={a2aMode}
                onMode={(m) => {
                  setA2aMode(m)
                  setErrors({})
                }}
                owner={owner}
                partners={partners}
                drafts={a2aDrafts}
                onDraft={(partnerId, next) => {
                  setA2aDrafts((prev) => ({ ...prev, [partnerId]: next }))
                  setErrors({})
                }}
                onAgentBrn={(agentId, brn) =>
                  setAgents((prev) => prev.map((a) => (a.agent_id === agentId ? { ...a, brn: brn.slice(0, 40) } : a)))
                }
                defaults={a2aDefaults}
                sale={saleRef}
                errors={errors}
              />
            )}
          </PartnerStep>
        )}

        {/* ── Step 2: Property ── */}
        {step === STEP.property && (
          <div className="space-y-5">
            {isProject ? (
              <>
                <Field label="Developer" required error={errors.developer_id}>
                  <DeveloperCombobox
                    developers={developers}
                    value={form.developer_id}
                    onChange={(id) => void onDeveloperChange(id)}
                  />
                </Field>
                <Field label="Project" required error={errors.project_id}>
                  <SelectShell>
                    <select
                      className={`${inputCls} appearance-none cursor-pointer pr-10`}
                      value={form.project_id}
                      onChange={(e) => void onProjectChange(e.target.value)}
                      disabled={!form.developer_id}
                    >
                      <option value="">{form.developer_id ? "Select project…" : "Pick a developer first"}</option>
                      {projects.map((p) => (
                        <option key={p.id} value={String(p.id)}>{p.name}</option>
                      ))}
                    </select>
                  </SelectShell>
                </Field>
                <Field label="Unit type (from project)">
                  <SelectShell>
                    <select
                      className={`${inputCls} appearance-none cursor-pointer pr-10`}
                      value={form.project_unit_id}
                      onChange={(e) => setField("project_unit_id", e.target.value)}
                      disabled={!form.project_id}
                    >
                      <option value="">{form.project_id ? "Select unit type (optional)…" : "Pick a project first"}</option>
                      {units.map((u) => (
                        <option key={u.id} value={String(u.id)}>{u.unit_type ?? `Unit ${u.id}`}</option>
                      ))}
                    </select>
                  </SelectShell>
                </Field>
              </>
            ) : (
              <>
                <Field label="Property type" required error={errors.property_type}>
                  <SelectShell>
                    <select
                      className={`${inputCls} appearance-none cursor-pointer pr-10`}
                      value={form.property_type}
                      onChange={(e) => setField("property_type", e.target.value)}
                    >
                      <option value="">Select property type…</option>
                      {SALE_PROPERTY_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </SelectShell>
                </Field>
                <Field label="Property address" error={errors.unit_information}>
                  <input
                    className={inputCls}
                    value={form.property_address}
                    onChange={(e) => setField("property_address", e.target.value)}
                    placeholder="Building / community, street, city…"
                    maxLength={300}
                  />
                </Field>
              </>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Unit number" error={isProject ? errors.unit_information : undefined}>
                <input className={inputCls} value={form.unit_number} onChange={(e) => setField("unit_number", e.target.value)} placeholder="e.g. 1204" />
              </Field>
              <Field label="Block / tower">
                <input className={inputCls} value={form.block_number} onChange={(e) => setField("block_number", e.target.value)} placeholder="e.g. Tower B" />
              </Field>
              <Field label="Lot number">
                <input className={inputCls} value={form.lot_number} onChange={(e) => setField("lot_number", e.target.value)} placeholder="e.g. 17" />
              </Field>
            </div>
          </div>
        )}

        {/* ── Step 3: Client ── */}
        {step === STEP.client && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="First name" required error={errors["client.first_name"]}>
                <input className={inputCls} value={form.client.first_name} onChange={(e) => setClient("first_name", e.target.value)} />
              </Field>
              <Field label="Middle name">
                <input className={inputCls} value={form.client.middle_name} onChange={(e) => setClient("middle_name", e.target.value)} />
              </Field>
              <Field label="Last name" required error={errors["client.last_name"]}>
                <input className={inputCls} value={form.client.last_name} onChange={(e) => setClient("last_name", e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Phone" required error={errors["client.phone"]}>
                <input className={inputCls} value={form.client.phone} onChange={(e) => setClient("phone", e.target.value)} placeholder="+971 50 000 0000" />
              </Field>
              <Field label="Email">
                <input className={inputCls} type="email" value={form.client.email} onChange={(e) => setClient("email", e.target.value)} placeholder="client@email.com" />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Age">
                <input className={inputCls} inputMode="numeric" value={form.client.age} onChange={(e) => setClient("age", e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Field label="Gender">
                <SelectShell>
                  <select className={`${inputCls} appearance-none cursor-pointer pr-10`} value={form.client.gender} onChange={(e) => setClient("gender", e.target.value)}>
                    <option value="">Select…</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </SelectShell>
              </Field>
              <Field label="Occupation">
                <input className={inputCls} value={form.client.occupation} onChange={(e) => setClient("occupation", e.target.value)} />
              </Field>
            </div>
            <div>
              <p className={labelCls}>
                Address <span className="text-rose-500">*</span>
                {errors.client_address && <span className="ml-2 normal-case font-normal text-rose-600">{errors.client_address}</span>}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input className={inputCls} value={form.client.street} onChange={(e) => setClient("street", e.target.value)} placeholder="Street" />
                <input className={inputCls} value={form.client.city} onChange={(e) => setClient("city", e.target.value)} placeholder="City" />
                <input className={inputCls} value={form.client.state_province} onChange={(e) => setClient("state_province", e.target.value)} placeholder="State / province" />
                <input className={inputCls} value={form.client.country} onChange={(e) => setClient("country", e.target.value)} placeholder="Country" />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Contract ── */}
        {step === STEP.contract && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={saleType === "rental" ? "Contract value (AED)" : "Contract price (AED)"} required error={errors.contract_price}>
                <input className={inputCls} inputMode="decimal" value={form.contract_price} onChange={(e) => setField("contract_price", e.target.value.replace(/[^0-9.]/g, ""))} placeholder="e.g. 1500000" />
              </Field>
              <Field label={saleType === "rental" ? "Contract start date" : "Reservation date"} required error={errors.reservation_date}>
                <input className={inputCls} type="date" value={form.reservation_date} onChange={(e) => setField("reservation_date", e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Payment plan" required error={errors.payment_plan}>
                <input className={inputCls} value={form.payment_plan} onChange={(e) => setField("payment_plan", e.target.value)} placeholder={saleType === "rental" ? "e.g. 4 cheques" : "e.g. 60/40, cash"} />
              </Field>
              <Field label="Payment terms" required error={errors.payment_terms}>
                <input className={inputCls} value={form.payment_terms} onChange={(e) => setField("payment_terms", e.target.value)} placeholder={saleType === "rental" ? "e.g. yearly, upfront" : "e.g. 5 years post-handover"} />
              </Field>
            </div>
            {isProject && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Price per sqft (AED)">
                  <input className={inputCls} inputMode="decimal" value={form.price_per_sqft} onChange={(e) => setField("price_per_sqft", e.target.value.replace(/[^0-9.]/g, ""))} />
                </Field>
                <Field label="Total area (sqft)">
                  <input className={inputCls} inputMode="decimal" value={form.total_area_sqft} onChange={(e) => setField("total_area_sqft", e.target.value.replace(/[^0-9.]/g, ""))} />
                </Field>
              </div>
            )}
            <Field label="Remarks">
              <textarea className={`${inputCls} resize-none`} rows={3} value={form.remarks} onChange={(e) => setField("remarks", e.target.value)} placeholder="Anything the validation team should know…" />
            </Field>
          </div>
        )}

        {/* ── Step 5: Review ── */}
        {step === STEP.review && (
          <div className="space-y-5">
            <h2 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">Review before submitting</h2>
            <dl className="divide-y divide-[#f0f2f5] text-sm">
              {[
                ["Deal type", SALE_TYPE_LABELS[saleType]],
                [
                  "Partner",
                  isShared
                    ? agents
                        .map((a) => `${a.agent_id === currentUserId ? "You" : a.name} — ${SALE_DEAL_ROLE_LABELS[a.role]}, ${a.share}%`)
                        .join(" · ")
                    : "None — solo sale",
                ],
                ...(isShared
                  ? [["A2A agreement", a2aMode === "fill" ? "Filled in & signed here" : "Uploading a signed copy"]]
                  : []),
                ...(isProject
                  ? [
                      ["Developer", developerName],
                      ["Project", projectName],
                      ...(unitLabel ? [["Unit type", unitLabel]] : []),
                    ]
                  : [
                      ["Property type", form.property_type || "—"],
                      ["Property address", form.property_address || "—"],
                    ]),
                ["Unit / block / lot", [form.unit_number, form.block_number, form.lot_number].filter(Boolean).join(" · ") || "—"],
                ["Client", `${form.client.first_name} ${form.client.last_name}`.trim() || "—"],
                ["Client phone", form.client.phone || "—"],
                [
                  "Client address",
                  [form.client.street, form.client.city, form.client.state_province, form.client.country]
                    .map((v) => v.trim())
                    .filter(Boolean)
                    .join(", ") || "—",
                ],
                [saleType === "rental" ? "Contract value" : "Contract price", form.contract_price ? `AED ${Number(form.contract_price).toLocaleString("en-AE")}` : "—"],
                [saleType === "rental" ? "Start date" : "Reservation date", form.reservation_date || "—"],
                ["Payment plan", form.payment_plan || "—"],
                ["Payment terms", form.payment_terms || "—"],
                ...(form.remarks.trim() ? [["Remarks", form.remarks.trim()]] : []),
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-6 py-2.5">
                  <dt className="text-[#6b7280] font-medium shrink-0">{label}</dt>
                  <dd className="text-[#111827] font-semibold text-right">{value}</dd>
                </div>
              ))}
            </dl>
            {/* A2A filled in on the Partner step — built and attached on submit. */}
            {isShared && a2aMode === "fill" && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
                <p className={labelCls}>A2A agreement</p>
                <p className="mb-3 flex items-start gap-2 text-sm text-[#374151]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    Filled in and signed on the Partner step —{" "}
                    {partners.length > 1 ? "one agreement per partner is" : "it's"} attached to the sale automatically when you submit.
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {partners.map((p) => (
                    <button
                      key={p.agent_id}
                      type="button"
                      onClick={() => void downloadA2A(p)}
                      disabled={a2aBusyFor !== null}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#e5e5e5] bg-white text-sm font-semibold text-[#374151] hover:border-[#001f3f] transition-colors disabled:opacity-60"
                    >
                      {a2aBusyFor === p.agent_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Download a copy — you &amp; {p.name}
                    </button>
                  ))}
                </div>
                {a2aError && <p className="mt-2 text-xs text-rose-600">{a2aError}</p>}
              </div>
            )}

            {/* Signed A2A they already have — required; the admin checks it when validating. */}
            {isShared && a2aMode === "have" && (
              <div className={`rounded-2xl border border-dashed p-4 ${agreementFiles.length === 0 ? "border-rose-300 bg-rose-50/40" : "border-[#d1d5db]"}`}>
                <p className={labelCls}>
                  Signed A2A agreement <span className="text-rose-500">*</span>
                </p>
                <p className="mb-3 text-xs text-[#6b7280]">
                  Upload the signed A2A you have with {partners.map((p) => p.name).join(" and ")}
                  {partners.length > 1 ? " — one per partner" : ""}.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#00356b] transition-colors cursor-pointer">
                    <FileSignature className="w-4 h-4" />
                    Upload signed copy
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const picked = Array.from(e.target.files ?? [])
                        if (picked.length) setAgreementFiles((prev) => [...prev, ...picked])
                        e.target.value = ""
                      }}
                    />
                  </label>
                  {agreementFiles.map((f, i) => (
                    <FileChip
                      key={`${f.name}-${i}`}
                      file={f}
                      onRemove={() => setAgreementFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    />
                  ))}
                </div>
                <p className={`mt-2 text-[11px] ${agreementFiles.length === 0 ? "text-rose-600 font-semibold" : "text-[#9ca3af]"}`}>
                  {agreementFiles.length === 0
                    ? "The signed A2A is required to submit a shared sale — a scan or photo (image or PDF)."
                    : partners.length > agreementFiles.length
                      ? `Tip: one signed agreement per partner — ${partners.length} partners on this sale.`
                      : "Signed agreement ready — it uploads with the sale."}
                </p>
                <div className="mt-3 border-t border-[#eef0f3] pt-3">
                  <p className="mb-2 text-[11px] text-[#6b7280]">Need to print one to sign on paper? Download it pre-filled from this sale:</p>
                  <div className="flex flex-wrap gap-2">
                    {partners.map((p) => (
                      <button
                        key={p.agent_id}
                        type="button"
                        onClick={() => void downloadA2A(p)}
                        disabled={a2aBusyFor !== null}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#e5e5e5] bg-white text-xs font-semibold text-[#374151] hover:border-[#001f3f] transition-colors disabled:opacity-60"
                      >
                        {a2aBusyFor === p.agent_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        A2A — you &amp; {p.name}
                      </button>
                    ))}
                  </div>
                </div>
                {a2aError && <p className="mt-2 text-xs text-rose-600">{a2aError}</p>}
              </div>
            )}

            {/* Proof of transaction attachments — required */}
            <div className={`rounded-2xl border border-dashed p-4 ${files.length === 0 ? "border-rose-300 bg-rose-50/40" : "border-[#d1d5db]"}`}>
              <p className={labelCls}>
                Proof of transaction <span className="text-rose-500">*</span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] transition-colors cursor-pointer">
                  <Paperclip className="w-4 h-4" />
                  Add files
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const picked = Array.from(e.target.files ?? [])
                      if (picked.length) setFiles((prev) => [...prev, ...picked])
                      e.target.value = ""
                    }}
                  />
                </label>
                {files.map((f, i) => (
                  <FileChip
                    key={`${f.name}-${i}`}
                    file={f}
                    onRemove={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  />
                ))}
              </div>
              <p className={`mt-2 text-[11px] ${files.length === 0 ? "text-rose-600 font-semibold" : "text-[#9ca3af]"}`}>
                {files.length === 0
                  ? "At least one proof file is required to submit — receipts, contracts, cheques (images or PDF)."
                  : "Receipts, contracts, cheques — images or PDF. Add as many as you need."}
              </p>
            </div>

            <p className="text-xs text-[#9ca3af] leading-relaxed">
              The sale is recorded as <strong>pending validation</strong> by the admin team.
            </p>
            {submitError && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{submitError}</p>
            )}
          </div>
        )}

        {/* ── Navigation ── */}
        <div className="flex items-center justify-between gap-3 mt-8 pt-6 border-t border-[#f0f2f5]">
          <button
            type="button"
            onClick={back}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#e5e5e5] text-sm font-bold text-[#374151] hover:border-[#001f3f] transition-colors disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4" />
            {step === 0 ? "Change type" : "Back"}
          </button>
          {step < STEP_TITLES.length - 1 ? (
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-2 px-7 py-2.5 rounded-xl bg-[#001f3f] text-white text-sm font-bold hover:bg-[#00356b] transition-colors"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting || files.length === 0 || (isShared && a2aMode === "have" && agreementFiles.length === 0)}
              title={
                isShared && a2aMode === "have" && agreementFiles.length === 0
                  ? "Upload the signed A2A agreement first"
                  : files.length === 0
                    ? "Attach a proof of transaction first"
                    : undefined
              }
              className="inline-flex items-center gap-2 px-7 py-2.5 rounded-xl bg-gradient-to-r from-[#d6b357] to-[#b8913f] text-[#001428] text-sm font-bold shadow-md hover:shadow-lg transition-shadow disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {submitting ? "Submitting…" : "Submit sale"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
