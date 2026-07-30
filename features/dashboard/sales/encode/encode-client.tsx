"use client"

/**
 * Encode Sale — full-page stepper (deliberately not a modal). The agent first
 * picks the deal type on three cards:
 *   · Project Sale  — developer → project → unit (the classic flow)
 *   · Brokerage     — no developer/project; property type + address instead
 *   · Rental        — same shape as brokerage
 * then walks Property → Client → Contract → Review. Validation reuses
 * lib/sales-service rules; submission goes through the same createSale used
 * by the admin dialog, so workflow statuses behave identically.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, ChevronDown,
  ClipboardList, Handshake, KeyRound, Loader2, Paperclip, Sparkles, X,
} from "lucide-react"
import {
  createSale,
  fetchDevelopersForSale,
  fetchProjectsForDeveloper,
  fetchUnitsForProject,
  uploadSaleProofFile,
  validateSaleFormData,
  SALE_PROPERTY_TYPES,
  SALE_TYPE_LABELS,
  type DeveloperOption,
  type ProjectOption,
  type ProjectUnitOption,
  type SaleFormData,
  type SaleType,
} from "@/lib/sales-service"
import { DeveloperCombobox } from "@/components/developers/developer-combobox"
import { getDashboardRouteByRole } from "@/lib/auth"

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
    price_per_sqm: "", total_area_sqm: "",
    remarks: "",
    commission_status: "pending",
    validation_status: "pending",
  }
}

const TYPE_CARDS: Array<{
  type: SaleType
  icon: typeof Building2
  title: string
  desc: string
}> = [
  {
    type: "project",
    icon: Building2,
    title: "Project Sale / Off-Plan",
    desc: "A unit in a developer's project — pick the developer, project and unit.",
  },
  {
    type: "brokerage",
    icon: Handshake,
    title: "Brokerage / Ready Unit",
    desc: "A resale / private-owner deal — no developer, just the property details.",
  },
  {
    type: "rental",
    icon: KeyRound,
    title: "Rental",
    desc: "A rental transaction — property details and the lease contract.",
  },
]

// Which validation keys belong to which step (for per-step gating).
const STEP_KEYS: string[][] = [
  ["developer_id", "project_id", "property_type", "unit_information"],
  ["client.first_name", "client.last_name", "client.phone", "client_address"],
  ["contract_price", "reservation_date", "payment_plan", "payment_terms"],
]

const STEP_TITLES = ["Property", "Client", "Contract", "Review"]

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-[#e5e5e5] bg-white text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 transition-all"
const labelCls = "block text-xs font-bold uppercase tracking-wide text-[#6b7280] mb-1.5"

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className={labelCls}>
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  )
}

function SelectShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
    </div>
  )
}

export function EncodeSaleClient({
  currentUserId,
  currentRole,
}: {
  currentUserId: string
  currentRole: string
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
    setSubmitting(true)
    setSubmitError(null)
    try {
      const { data, error } = await createSale(form, currentUserId, currentRole)
      if (error || !data) {
        setSubmitError(error ?? "Failed to record the sale")
        return
      }
      // Upload staged proof files — the sale is already saved, so failures
      // here never lose the sale; they just get reported for a manual retry
      // (and the login prompt will nudge again until proof is attached).
      let failed = 0
      for (const file of files) {
        const { error: uploadError } = await uploadSaleProofFile(file, data.id)
        if (uploadError) failed++
      }
      setUploadNote(
        failed === 0
          ? `${files.length} file${files.length > 1 ? "s" : ""} attached.`
          : failed === files.length
            ? "Sale saved, but the proof upload failed — please add it from your sales list."
            : `${files.length - failed} of ${files.length} files attached — add the rest from the sales list.`,
      )
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
          <h1 className="font-['Outfit'] text-3xl sm:text-4xl font-bold text-[#0d1117]">Encode a Sale</h1>
          <span className="block w-16 h-1 rounded-full bg-[#d6b357] mt-4 mb-5" aria-hidden="true" />
          <p className="text-base text-[#6b7280]">
            What kind of deal are you recording? Choose one to start.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TYPE_CARDS.map(({ type, icon: Icon, title, desc }) => (
            <button
              key={type}
              type="button"
              onClick={() => pickType(type)}
              className="group text-left bg-white rounded-2xl border border-[#eceef1] p-8 shadow-[0_2px_12px_rgba(15,30,50,0.05)] hover:shadow-[0_18px_48px_-16px_rgba(0,20,40,0.22)] hover:-translate-y-1 hover:border-[#d6b357]/60 transition-all duration-300"
            >
              <span className="w-20 h-20 rounded-full bg-[#f4f5f7] group-hover:bg-[#d6b357]/10 flex items-center justify-center mb-7 transition-colors">
                <Icon className="w-9 h-9 text-[#b8913f]" strokeWidth={1.5} />
              </span>
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
          <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-bold text-[#0d1117]">Encode a Sale</h1>
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
        {/* ── Step 1: Property ── */}
        {step === 0 && (
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

        {/* ── Step 2: Client ── */}
        {step === 1 && (
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

        {/* ── Step 3: Contract ── */}
        {step === 2 && (
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
                <Field label="Price per sqm (AED)">
                  <input className={inputCls} inputMode="decimal" value={form.price_per_sqm} onChange={(e) => setField("price_per_sqm", e.target.value.replace(/[^0-9.]/g, ""))} />
                </Field>
                <Field label="Total area (sqm)">
                  <input className={inputCls} inputMode="decimal" value={form.total_area_sqm} onChange={(e) => setField("total_area_sqm", e.target.value.replace(/[^0-9.]/g, ""))} />
                </Field>
              </div>
            )}
            <Field label="Remarks">
              <textarea className={`${inputCls} resize-none`} rows={3} value={form.remarks} onChange={(e) => setField("remarks", e.target.value)} placeholder="Anything the validation team should know…" />
            </Field>
          </div>
        )}

        {/* ── Step 4: Review ── */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">Review before submitting</h2>
            <dl className="divide-y divide-[#f0f2f5] text-sm">
              {[
                ["Deal type", SALE_TYPE_LABELS[saleType]],
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
                  <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f4f6f9] border border-[#e5e5e5] text-xs font-semibold text-[#374151]">
                    <span className="max-w-[180px] truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-[#9ca3af] hover:text-rose-600"
                      aria-label={`Remove ${f.name}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
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
              disabled={submitting || files.length === 0}
              title={files.length === 0 ? "Attach a proof of transaction first" : undefined}
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
