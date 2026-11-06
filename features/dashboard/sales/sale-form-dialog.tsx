"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  Building2,
  Calendar,
  Handshake,
  DollarSign,
  Eye,
  FileText,
  Layers,
  MapPin,
  Paperclip,
  Pencil,
  Phone,
  Trash2,
  Upload,
  User,
  X,
  ExternalLink,
  ArrowLeft,
  ArrowRight,
} from "lucide-react"
import {
  canEditSaleForRole,
  canManageSaleAttachmentsForRole,
  createSale,
  notifySaleEvent,
  partnersChanged,
  updateSale,
  updateSaleAsLeader,
  validateSaleFormData,
  validateSalePartners,
  fetchDevelopersForSale,
  fetchProjectsForDeveloper,
  fetchUnitsForProject,
  SALE_PROPERTY_TYPES,
  SALE_TYPE_LABELS,
  type SaleRecord,
  type SaleFormData,
  type DeveloperOption,
  type ProjectOption,
  type ProjectUnitOption,
  type CommissionStatus,
  type ValidationStatus,
  type SaleAttachment,
  type SaleAttachmentCategory,
  type SalePartner,
  fetchSaleAttachments,
  uploadSaleProofFile,
  deleteSaleAttachment,
} from "@/lib/sales-service"
import { isAdminStaffRole } from "@/lib/app-roles"
import { DeveloperCombobox } from "@/components/developers/developer-combobox"
import { ChoiceCard, PartnerSharesEditor, type PartnerAgentInfo } from "./encode/partner-step"
import { toTitleCase } from "./sale-ui"

// ─── Portal ───────────────────────────────────────────────────────────────────

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <label className="text-xs font-bold uppercase tracking-wider text-[#374151] ml-1 mb-2 block">
      {text}{required && " *"}
    </label>
  )
}

function SectionTitle({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-xl bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-white" />
      </div>
      <h3 className="font-['Outfit'] text-sm font-bold text-[#0d1117] uppercase tracking-wider">{title}</h3>
    </div>
  )
}

const iconCls = "absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none z-10"

// ─── Constants ────────────────────────────────────────────────────────────────

const COMMISSION_STATUSES: CommissionStatus[] = ["pending", "processing", "approved", "released", "rejected"]
const VALIDATION_STATUSES: ValidationStatus[] = ["pending", "under_review", "validated", "invalid_sale"]
const GENDERS = ["Male", "Female", "Other", "Prefer not to say"]

const STATUS_LABEL: Record<string, string> = {
  pending:      "Pending",
  processing:   "Processing",
  approved:     "Approved",
  released:     "Released",
  rejected:     "Rejected",
  under_review: "Under Review",
  validated:    "Validated",
  invalid_sale: "Invalid Sale",
}

const EMPTY_CLIENT = {
  first_name: "", middle_name: "", last_name: "",
  email: "", phone: "", age: "", gender: "",
  occupation: "", street: "", city: "", state_province: "", country: "",
}

const EMPTY_FORM: SaleFormData = {
  sale_type: "project",
  developer_id: "", project_id: "", project_unit_id: "",
  unit_number: "", block_number: "", lot_number: "",
  property_type: "", property_address: "",
  client: EMPTY_CLIENT,
  contract_price: "", reservation_date: "",
  payment_plan: "", payment_terms: "",
  price_per_sqft: "", total_area_sqft: "",
  remarks: "",
  commission_status: "pending",
  validation_status: "pending",
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SaleFormDialog({
  open,
  viewMode,
  editSale,
  currentUserId,
  currentRole,
  onClose,
  onSaved,
  onError,
  leaderMode = null,
  performerName = null,
}: {
  open: boolean
  viewMode: boolean
  editSale: SaleRecord | null
  currentUserId: string
  currentRole: string
  onClose: () => void
  onSaved: (sale: SaleRecord, isEdit: boolean) => void
  onError: (message: string) => void
  /**
   * A team leader editing a team sale (migration 084): the save goes through
   * app/api/team/sales/[id] and keeps the sale's status; `canConfirm` offers to
   * confirm it for the admin in the same save.
   */
  leaderMode?: { canConfirm: boolean } | null
  /** The editor's display name, for the "Edited by" stamp. */
  performerName?: string | null
}) {
  const isEdit = Boolean(editSale)
  // Primitives, not the object: the populate effect depends on them, and an
  // inline `leaderMode={{…}}` would otherwise reset the form on every render.
  const leaderCanEdit = Boolean(leaderMode)
  const leaderCanConfirm = Boolean(leaderMode?.canConfirm)
  const canEditCurrentSale = canEditSaleForRole(currentRole, editSale, { leaderCanEdit })
  const canManageAttachments = canManageSaleAttachmentsForRole(currentRole, editSale, currentUserId)
  // A team leader may add files (the signed A2A after adding a partner) but
  // never remove them — /api/sales/attachments checks the same on the server.
  const canUploadAttachments = canManageAttachments || leaderCanEdit
  const disabled = viewMode || (isEdit && !canEditCurrentSale)
  const isAdmin = isAdminStaffRole(currentRole)
  const confirmable =
    leaderCanConfirm &&
    Boolean(editSale) &&
    editSale!.agent_id !== currentUserId &&
    !editSale!.leader_confirmed_at &&
    (editSale!.validation_status === "pending" || editSale!.validation_status === "under_review")

  // ─── All state declarations (must precede derived values) ────────────────
  const [activeTab, setActiveTab] = useState<"property"|"client"|"contract"|"partners"|"workflow"|"attachments">("property")
  const [form, setForm] = useState<SaleFormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [saving, setSaving] = useState(false)
  const [developers, setDevelopers] = useState<DeveloperOption[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [units, setUnits] = useState<ProjectUnitOption[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loadingUnits, setLoadingUnits] = useState(false)
  // attachment state (edit mode live-upload)
  const [attachments, setAttachments] = useState<SaleAttachment[]>([])
  const [attLoading, setAttLoading] = useState(false)
  const [attUploading, setAttUploading] = useState(false)
  const [attError, setAttError] = useState<string | null>(null)
  const [attDragOver, setAttDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // staged files for CREATE mode (uploaded after sale is saved)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const pendingInputRef = useRef<HTMLInputElement>(null)
  // What an edit-mode upload is: proof of transaction, or the signed A2A.
  const [attCategory, setAttCategory] = useState<SaleAttachmentCategory>("proof")
  // Partnership split (edit only). `partners` is kept while "Solo" is picked,
  // so switching back restores it.
  const [shared, setShared] = useState(false)
  const [partners, setPartners] = useState<SalePartner[]>([])
  const [partnerInfo, setPartnerInfo] = useState<Record<string, PartnerAgentInfo>>({})
  const [partnerErrors, setPartnerErrors] = useState<Record<string, string>>({})
  // A team leader's "also confirm it" box, on by default.
  const [confirmToo, setConfirmToo] = useState(true)

  // ─── Tab configuration (derived after state) ─────────────────────────────
  type TabId = "property" | "client" | "contract" | "partners" | "workflow" | "attachments"
  const tabForErrorKey = (key: string): TabId => {
    if (key.startsWith("partner")) return "partners"
    if (["developer_id", "project_id", "unit_information"].includes(key)) return "property"
    if (key.startsWith("client.") || key === "client_address") return "client"
    if (["contract_price", "reservation_date", "payment_plan", "payment_terms"].includes(key)) return "contract"
    return "property"
  }
  const allTabs: { id: TabId; label: string }[] = [
    { id: "property",    label: "Property" },
    { id: "client",      label: "Client" },
    { id: "contract",    label: "Contract" },
    ...(isEdit && !viewMode ? [{ id: "partners" as TabId, label: "Partners" }] : []),
    ...(isAdmin ? [{ id: "workflow" as TabId, label: "Workflow" }] : []),
    ...(!viewMode ? [{ id: "attachments" as TabId, label: pendingFiles.length > 0 ? `Attachments (${pendingFiles.length})` : (isEdit ? "Attachments" : "Attachments *") }] : []),
  ]

  // Load developers on mount
  useEffect(() => {
    fetchDevelopersForSale().then(({ data }) => {
      if (data) setDevelopers(data)
    })
  }, [])

  // Populate form on open
  useEffect(() => {
    if (!open) return
    if (editSale && !canEditSaleForRole(currentRole, editSale, { leaderCanEdit })) {
      onError("You can't edit this sale")
      onClose()
      return
    }
    setErrors({})
    setPendingFiles([])
    setAttachments([])
    setAttError(null)
    setAttCategory("proof")
    setShared(Boolean(editSale && editSale.partners.length > 0))
    setPartners(editSale?.partners ?? [])
    setPartnerInfo({})
    setPartnerErrors({})
    setConfirmToo(true)

    if (editSale) {
      const client = editSale.clients
      const prefilledForm: SaleFormData = {
        sale_type:         editSale.sale_type,
        developer_id:      editSale.developer_id,
        project_id:        editSale.project_id ? String(editSale.project_id) : "",
        project_unit_id:   editSale.project_unit_id != null ? String(editSale.project_unit_id) : "",
        unit_number:       editSale.unit_number ?? "",
        block_number:      editSale.block_number ?? "",
        lot_number:        editSale.lot_number ?? "",
        property_type:     editSale.property_type ?? "",
        property_address:  editSale.property_address ?? "",
        client: {
          first_name:     client?.first_name ?? "",
          middle_name:    client?.middle_name ?? "",
          last_name:      client?.last_name ?? "",
          email:          client?.email ?? "",
          phone:          client?.phone ?? "",
          age:            client?.age != null ? String(client.age) : "",
          gender:         client?.gender ?? "",
          occupation:     client?.occupation ?? "",
          street:         client?.street ?? "",
          city:           client?.city ?? "",
          state_province: client?.state_province ?? "",
          country:        client?.country ?? "",
        },
        contract_price:     String(editSale.contract_price),
        reservation_date:   editSale.reservation_date ?? "",
        payment_plan:       editSale.payment_plan ?? "",
        payment_terms:      editSale.payment_terms ?? "",
        price_per_sqft:      editSale.price_per_sqft != null ? String(editSale.price_per_sqft) : "",
        total_area_sqft:     editSale.total_area_sqft != null ? String(editSale.total_area_sqft) : "",
        remarks:            editSale.remarks ?? "",
        commission_status:  editSale.commission_status,
        validation_status:  editSale.validation_status,
      }
      setForm(prefilledForm)
      // load projects/units for developer
      if (editSale.developer_id) {
        void fetchProjectsForDeveloper(editSale.developer_id).then(({ data }) => {
          if (data) setProjects(data)
        })
      }
      if (editSale.project_id) {
        void fetchUnitsForProject(editSale.project_id).then(({ data }) => {
          if (data) setUnits(data)
        })
      }
      const firstErrorKey = Object.keys(validateSaleFormData(prefilledForm))[0]
      setActiveTab(firstErrorKey ? tabForErrorKey(firstErrorKey) : "property")
    } else {
      setForm(EMPTY_FORM)
      setProjects([])
      setUnits([])
      const firstErrorKey = Object.keys(validateSaleFormData(EMPTY_FORM))[0]
      setActiveTab(firstErrorKey ? tabForErrorKey(firstErrorKey) : "property")
    }
  }, [open, editSale, currentRole, leaderCanEdit, onClose, onError])

  // Load attachments when Attachments tab becomes active (edit mode only)
  useEffect(() => {
    if (activeTab === "attachments" && editSale?.id) {
      void loadAttachments(editSale.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, editSale?.id])

  // Load projects when developer changes
  const handleDeveloperChange = async (developerId: string) => {
    setForm((prev) => ({ ...prev, developer_id: developerId, project_id: "", project_unit_id: "" }))
    setProjects([])
    setUnits([])
    if (!developerId) return
    setLoadingProjects(true)
    const { data } = await fetchProjectsForDeveloper(developerId)
    setProjects(data ?? [])
    setLoadingProjects(false)
  }

  // Load units when project changes
  const handleProjectChange = async (projectId: string) => {
    setForm((prev) => ({ ...prev, project_id: projectId, project_unit_id: "" }))
    setUnits([])
    if (!projectId) return
    setLoadingUnits(true)
    const { data } = await fetchUnitsForProject(Number(projectId))
    setUnits(data ?? [])
    setLoadingUnits(false)
  }

  // ─── Attachment handlers ───────────────────────────────────────────────────
  const loadAttachments = async (saleId: string) => {
    setAttLoading(true)
    setAttError(null)
    try {
      const { data, error } = await fetchSaleAttachments(saleId)
      if (error) { setAttError(error); return }
      setAttachments(data ?? [])
    } finally {
      setAttLoading(false)
    }
  }

  // Through the service-role route (uploadSaleProofFile), which is the
  // authority on who may attach what — and records the A2A's category.
  const uploadAttachmentFile = async (file: File, saleId: string) => {
    if (!canUploadAttachments) {
      setAttError("You can only manage attachments when validation is Invalid Sale or Under Review")
      return
    }
    setAttError(null)
    setAttUploading(true)
    try {
      const { data, error } = await uploadSaleProofFile(file, saleId, attCategory)
      if (error) { setAttError(error); return }
      setAttachments((prev) => [data!, ...prev])
    } finally {
      setAttUploading(false)
    }
  }

  const handleDeleteAttachment = async (att: SaleAttachment) => {
    if (!canManageAttachments) {
      setAttError("You can only manage attachments when validation is Invalid Sale or Under Review")
      return
    }
    if (!window.confirm(`Remove "${att.file_name}"?`)) return
    const { error } = await deleteSaleAttachment(att.id, currentUserId, currentRole)
    if (error) { setAttError(error); return }
    setAttachments((prev) => prev.filter((a) => a.id !== att.id))
  }

  const set = <K extends keyof SaleFormData>(key: K, value: SaleFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({
      ...prev,
      [key]: undefined,
      ...(key === "project_unit_id" || key === "unit_number" || key === "block_number" || key === "lot_number"
        ? { unit_information: undefined }
        : {}),
    }))
  }

  const setClient = (key: keyof typeof EMPTY_CLIENT, value: string) => {
    setForm((prev) => ({ ...prev, client: { ...prev.client, [key]: value } }))
    setErrors((prev) => ({
      ...prev,
      [`client.${key}`]: undefined,
      ...(key === "street" || key === "city" || key === "state_province" || key === "country"
        ? { client_address: undefined }
        : {}),
    }))
  }

  const validate = () => validateSaleFormData(form)
  const focusInvalidField = (key: string) => {
    if (typeof document === "undefined") return
    setTimeout(() => {
      const element = document.querySelector<HTMLElement>(`[data-error-key="${key}"]`)
      if (!element) return
      element.scrollIntoView({ behavior: "smooth", block: "center" })
      element.focus()
    }, 50)
  }

  // ─── Step-by-step: Next through the tabs, Save on the last ─────────────────
  // Non-technical users missed fields on tabs they never opened; Next walks
  // them through every tab and checks each one before moving on. The tabs
  // stay clickable for anyone who wants to jump.
  const bodyRef = useRef<HTMLDivElement>(null)
  const tabIndex = Math.max(0, allTabs.findIndex((t) => t.id === activeTab))
  const isLastTab = tabIndex === allTabs.length - 1
  const goToTab = (id: TabId) => {
    setActiveTab(id)
    bodyRef.current?.scrollTo({ top: 0 })
  }
  const goNext = () => {
    const tabErrors = Object.fromEntries(
      Object.entries(validate()).filter(([key]) => tabForErrorKey(key) === activeTab),
    )
    if (Object.keys(tabErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...tabErrors }))
      focusInvalidField(Object.keys(tabErrors)[0])
      return
    }
    if (activeTab === "partners" && editSale && shared && partnersChanged(editSale.partners, partners)) {
      const perrs = validateSalePartners(partners, editSale.agent_id, { editing: true })
      setPartnerErrors(perrs)
      if (Object.keys(perrs).length > 0) return
    }
    const next = allTabs[tabIndex + 1]
    if (next) goToTab(next.id)
  }
  const goBack = () => {
    const prev = allTabs[tabIndex - 1]
    if (prev) goToTab(prev.id)
  }

  const handleSubmit = async () => {
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      const firstErrorKey = Object.keys(errs)[0]
      const nextTab = tabForErrorKey(firstErrorKey)
      setActiveTab(nextTab)
      focusInvalidField(firstErrorKey)
      return
    }

    // Proof of transaction is mandatory when encoding a new sale.
    if (!isEdit && pendingFiles.length === 0) {
      setActiveTab("attachments")
      onError("Attach at least one proof of transaction before encoding the sale.")
      return
    }

    // The split, when it changed: [] = back to solo, null = leave it alone.
    let partnersToSave: SalePartner[] | null = null
    if (isEdit && editSale) {
      const next = shared ? partners : []
      if (partnersChanged(editSale.partners, next)) partnersToSave = next
      if (partnersToSave && partnersToSave.length > 0) {
        const perrs = validateSalePartners(partnersToSave, editSale.agent_id, { editing: true })
        setPartnerErrors(perrs)
        if (Object.keys(perrs).length > 0) {
          setActiveTab("partners")
          return
        }
      }
    }

    setSaving(true)
    try {
      if (isEdit && editSale && leaderCanEdit && !isAdmin) {
        const { data, error } = await updateSaleAsLeader(editSale.id, form, partnersToSave, confirmable && confirmToo)
        if (error) { onError(error); return }
        onSaved(data!, true)
      } else if (isEdit && editSale) {
        const { data, error } = await updateSale(editSale.id, form, currentUserId, currentRole, partnersToSave, performerName)
        if (error) { onError(error); return }
        // Email the agent about any status an admin changed through the form.
        if (data!.validation_status !== editSale.validation_status) notifySaleEvent(editSale.id, "validation")
        if (data!.commission_status !== editSale.commission_status) notifySaleEvent(editSale.id, "commission")
        onSaved(data!, true)
      } else {
        const { data, error } = await createSale(form, currentUserId, currentRole)
        if (error) { onError(error); return }
        notifySaleEvent(data!.id, "encoded")
        // Upload staged proof after the sale exists. Routed through the
        // service-role helper so it works while the sale is still pending.
        for (const file of pendingFiles) {
          await uploadSaleProofFile(file, data!.id)
        }
        onSaved(data!, false)
      }
    } finally {
      setSaving(false)
    }
  }

  const inp = (key: string, extraCls = "") =>
    `w-full pl-11 pr-4 py-3 rounded-2xl border bg-white text-sm text-[#0d1117] placeholder:text-[#9ca3af]
    focus:outline-none focus:ring-4 focus:ring-[#001f3f]/5 transition-all disabled:bg-[#f8fafc] disabled:cursor-default
    ${errors[key] ? "border-rose-400 focus:border-rose-400" : "border-[#e5e5e5] focus:border-[#001f3f]"} ${extraCls}`

  const inpNoIcon = (key: string) =>
    `w-full px-4 py-3 rounded-2xl border bg-white text-sm text-[#0d1117] placeholder:text-[#9ca3af]
    focus:outline-none focus:ring-4 focus:ring-[#001f3f]/5 transition-all disabled:bg-[#f8fafc] disabled:cursor-default
    ${errors[key] ? "border-rose-400" : "border-[#e5e5e5] focus:border-[#001f3f]"}`

  const sel = (key: string) =>
    `w-full px-4 py-3 rounded-2xl border bg-white text-sm text-[#0d1117]
    focus:outline-none focus:ring-4 focus:ring-[#001f3f]/5 transition-all disabled:bg-[#f8fafc] disabled:cursor-default cursor-pointer
    ${errors[key] ? "border-rose-400" : "border-[#e5e5e5] focus:border-[#001f3f]"}`

  if (!open) return null

  const title = viewMode ? "View Sale" : isEdit ? "Edit Sale" : "Record Sale"

  return (
    <Portal>
      <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {/* XL on a desktop; the whole screen on a phone, where a floating card
          leaves too little room for the form and the keyboard. */}
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-5xl bg-white sm:rounded-[28px] shadow-2xl flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative shrink-0 px-4 pt-5 pb-4 sm:px-7 sm:pt-7 sm:pb-5">
            <div
              className="absolute top-0 left-0 right-0 h-[3px] sm:rounded-t-[28px]"
              style={{ background: "linear-gradient(to bottom, #0a3d6b, #001f3f)" }}
            />
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="w-10 h-10 shrink-0 rounded-2xl bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] flex items-center justify-center shadow-md">
                  {viewMode ? <Eye className="w-5 h-5 text-white" /> : isEdit ? <Pencil className="w-5 h-5 text-white" /> : <DollarSign className="w-5 h-5 text-white" />}
                </div>
                <div className="min-w-0">
                  <h2 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">{title}</h2>
                  <p className="text-xs sm:text-sm text-[#9ca3af] mt-0.5">
                    {viewMode
                      ? "View sale details"
                      : isEdit && leaderCanEdit && !isAdmin
                        ? `Recorded by ${toTitleCase(editSale?.profiles?.fullname) || "your team"} — your changes keep the sale's status and are saved with your name and the date.`
                        : isEdit ? "Update transaction record" : "Record a new property sale transaction"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full hover:bg-[#f3f4f6] text-[#9ca3af] hover:text-[#374151] transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="mx-4 sm:mx-7 h-px bg-[#f0f2f5]" />

          {/* Tab navigation — scrolls sideways on a phone instead of squeezing six labels */}
          {!viewMode && (
            <div className="shrink-0 px-4 sm:px-7 pt-4 pb-0">
              <div className="flex gap-1 overflow-x-auto bg-[#f3f4f6] p-1 rounded-2xl [scrollbar-width:none]">
                {allTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => goToTab(tab.id)}
                    className={`flex-none sm:flex-1 whitespace-nowrap py-2 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                      activeTab === tab.id
                        ? "bg-white text-[#001f3f] shadow-sm"
                        : "text-[#6b7280] hover:text-[#374151]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Scrollable body */}
          <div ref={bodyRef} className="flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-6">

            {/* === Property Information === */}
            {(viewMode || activeTab === "property") && (
            <div>
              <SectionTitle icon={Building2} title="Property Information" />
              {form.sale_type !== "project" && (
                <p className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#d6b357]/15 border border-[#d6b357]/40 text-[#8a6d2a] text-xs font-bold">
                  {SALE_TYPE_LABELS[form.sale_type]} — no developer or project on this deal
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {form.sale_type === "project" ? (
                <>
                <div>
                  <FieldLabel text="Developer" required />
                  <div data-error-key="developer_id">
                    <DeveloperCombobox
                      developers={developers}
                      value={form.developer_id}
                      onChange={(id) => void handleDeveloperChange(id)}
                      disabled={disabled}
                    />
                  </div>
                  {errors.developer_id && <p className="text-xs text-rose-500 mt-1 ml-1">{errors.developer_id}</p>}
                </div>

                <div>
                  <FieldLabel text="Project" required />
                  <select
                    value={form.project_id}
                    onChange={(e) => void handleProjectChange(e.target.value)}
                    disabled={disabled || !form.developer_id}
                    className={sel("project_id")}
                    data-error-key="project_id"
                  >
                    <option value="">
                      {loadingProjects ? "Loading projects…" : "Select project…"}
                    </option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {errors.project_id && <p className="text-xs text-rose-500 mt-1 ml-1">{errors.project_id}</p>}
                </div>

                <div>
                  <FieldLabel text="Project Unit" required />
                  <select
                    value={form.project_unit_id}
                    onChange={(e) => set("project_unit_id", e.target.value)}
                    disabled={disabled || !form.project_id}
                    className={sel("project_unit_id")}
                    data-error-key="unit_information"
                  >
                    <option value="">
                      {loadingUnits ? "Loading units…" : "Select unit type…"}
                    </option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.unit_type}{u.layout_name ? ` — ${u.layout_name}` : ""}{u.bedrooms != null ? ` (${u.bedrooms}BR)` : ""}
                      </option>
                    ))}
                  </select>
                  {errors.unit_information && <p className="text-xs text-rose-500 mt-1 ml-1">{errors.unit_information}</p>}
                </div>
                </>
                ) : (
                <>
                <div>
                  <FieldLabel text="Property Type" required />
                  <select
                    value={form.property_type}
                    onChange={(e) => set("property_type", e.target.value)}
                    disabled={disabled}
                    className={sel("property_type")}
                    data-error-key="property_type"
                  >
                    <option value="">Select property type…</option>
                    {SALE_PROPERTY_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  {errors.property_type && <p className="text-xs text-rose-500 mt-1 ml-1">{errors.property_type}</p>}
                </div>

                <div>
                  <FieldLabel text="Property Address" />
                  <input
                    type="text"
                    value={form.property_address}
                    onChange={(e) => set("property_address", e.target.value)}
                    disabled={disabled}
                    placeholder="Building / community, street, city…"
                    className={inp("property_address")}
                    data-error-key="unit_information"
                  />
                  {errors.unit_information && <p className="text-xs text-rose-500 mt-1 ml-1">{errors.unit_information}</p>}
                </div>
                </>
                )}

                <div>
                  <FieldLabel text="Unit Number" />
                  <div className="relative">
                    <Layers className={iconCls} />
                    <input
                      type="text"
                      value={form.unit_number}
                      onChange={(e) => set("unit_number", e.target.value)}
                      disabled={disabled}
                      placeholder="e.g. 2401"
                      className={inp("unit_number")}
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel text="Block Number" />
                  <div className="relative">
                    <Layers className={iconCls} />
                    <input
                      type="text"
                      value={form.block_number}
                      onChange={(e) => set("block_number", e.target.value)}
                      disabled={disabled}
                      placeholder="e.g. A"
                      className={inp("block_number")}
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel text="Lot Number" />
                  <div className="relative">
                    <Layers className={iconCls} />
                    <input
                      type="text"
                      value={form.lot_number}
                      onChange={(e) => set("lot_number", e.target.value)}
                      disabled={disabled}
                      placeholder="e.g. 12"
                      className={inp("lot_number")}
                    />
                  </div>
                </div>
              </div>
            </div>
            )} {/* end property tab */}

            {/* === Client Information === */}
            {(viewMode || activeTab === "client") && (
            <div>
              <SectionTitle icon={User} title="Client Information" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <FieldLabel text="First Name" required />
                  <div className="relative">
                    <User className={iconCls} />
                    <input
                      type="text"
                      value={form.client.first_name}
                      onChange={(e) => setClient("first_name", e.target.value)}
                      disabled={disabled}
                      placeholder="First name"
                      className={inp("client.first_name")}
                      data-error-key="client.first_name"
                    />
                  </div>
                  {errors["client.first_name"] && <p className="text-xs text-rose-500 mt-1 ml-1">{errors["client.first_name"]}</p>}
                </div>

                <div>
                  <FieldLabel text="Middle Name" />
                  <div className="relative">
                    <User className={iconCls} />
                    <input
                      type="text"
                      value={form.client.middle_name}
                      onChange={(e) => setClient("middle_name", e.target.value)}
                      disabled={disabled}
                      placeholder="Middle name"
                      className={inp("client.middle_name")}
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel text="Last Name" required />
                  <div className="relative">
                    <User className={iconCls} />
                    <input
                      type="text"
                      value={form.client.last_name}
                      onChange={(e) => setClient("last_name", e.target.value)}
                      disabled={disabled}
                      placeholder="Last name"
                      className={inp("client.last_name")}
                      data-error-key="client.last_name"
                    />
                  </div>
                  {errors["client.last_name"] && <p className="text-xs text-rose-500 mt-1 ml-1">{errors["client.last_name"]}</p>}
                </div>

                <div>
                  <FieldLabel text="Email" />
                  <div className="relative">
                    <User className={iconCls} />
                    <input
                      type="email"
                      value={form.client.email}
                      onChange={(e) => setClient("email", e.target.value)}
                      disabled={disabled}
                      placeholder="client@example.com"
                      className={inp("client.email")}
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel text="Phone Number" required />
                  <div className="relative">
                    <Phone className={iconCls} />
                    <input
                      type="tel"
                      value={form.client.phone}
                      onChange={(e) => setClient("phone", e.target.value)}
                      disabled={disabled}
                      placeholder="+971 50 000 0000"
                      className={inp("client.phone")}
                      data-error-key="client.phone"
                    />
                  </div>
                  {errors["client.phone"] && <p className="text-xs text-rose-500 mt-1 ml-1">{errors["client.phone"]}</p>}
                </div>

                <div>
                  <FieldLabel text="Age" />
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={form.client.age}
                    onChange={(e) => setClient("age", e.target.value)}
                    disabled={disabled}
                    placeholder="Age"
                    className={inpNoIcon("client.age")}
                  />
                </div>

                <div>
                  <FieldLabel text="Gender" />
                  <select
                    value={form.client.gender}
                    onChange={(e) => setClient("gender", e.target.value)}
                    disabled={disabled}
                    className={sel("client.gender")}
                  >
                    <option value="">Select gender…</option>
                    {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <FieldLabel text="Occupation" />
                  <div className="relative">
                    <User className={iconCls} />
                    <input
                      type="text"
                      value={form.client.occupation}
                      onChange={(e) => setClient("occupation", e.target.value)}
                      disabled={disabled}
                      placeholder="e.g. Business Owner"
                      className={inp("client.occupation")}
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <FieldLabel text="Street" required />
                  <div className="relative">
                    <MapPin className={iconCls} />
                    <input
                      type="text"
                      value={form.client.street}
                      onChange={(e) => setClient("street", e.target.value)}
                      disabled={disabled}
                      placeholder="Street address"
                      className={inp("client.street")}
                      data-error-key="client_address"
                    />
                  </div>
                  {errors.client_address && <p className="text-xs text-rose-500 mt-1 ml-1">{errors.client_address}</p>}
                </div>
                <div>
                  <FieldLabel text="City" />
                  <input type="text" value={form.client.city} onChange={(e) => setClient("city", e.target.value)} disabled={disabled} placeholder="City" className={inpNoIcon("client.city")} />
                </div>
                <div>
                  <FieldLabel text="State / Province" />
                  <input type="text" value={form.client.state_province} onChange={(e) => setClient("state_province", e.target.value)} disabled={disabled} placeholder="State or province" className={inpNoIcon("client.state_province")} />
                </div>
                <div>
                  <FieldLabel text="Country" />
                  <input type="text" value={form.client.country} onChange={(e) => setClient("country", e.target.value)} disabled={disabled} placeholder="Country" className={inpNoIcon("client.country")} />
                </div>
              </div>
            </div>
            )} {/* end client tab */}

            {/* === Contract Information === */}
            {(viewMode || activeTab === "contract") && (
            <div>
              <SectionTitle icon={DollarSign} title="Contract Information" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <FieldLabel text="Contract Price (AED)" required />
                  <div className="relative">
                    <DollarSign className={iconCls} />
                    <input
                      type="number"
                      min={0}
                      value={form.contract_price}
                      onChange={(e) => set("contract_price", e.target.value)}
                      disabled={disabled}
                      placeholder="e.g. 2500000"
                      className={inp("contract_price")}
                      data-error-key="contract_price"
                    />
                  </div>
                  {errors.contract_price && <p className="text-xs text-rose-500 mt-1 ml-1">{errors.contract_price}</p>}
                </div>

                <div>
                  <FieldLabel text="Reservation Date" required />
                  <div className="relative">
                    <Calendar className={iconCls} />
                    <input
                      type="date"
                      value={form.reservation_date}
                      onChange={(e) => set("reservation_date", e.target.value)}
                      disabled={disabled}
                      className={inp("reservation_date")}
                      data-error-key="reservation_date"
                    />
                  </div>
                  {errors.reservation_date && <p className="text-xs text-rose-500 mt-1 ml-1">{errors.reservation_date}</p>}
                </div>

                <div>
                  <FieldLabel text="Price per SQFT" />
                  <div className="relative">
                    <DollarSign className={iconCls} />
                    <input
                      type="number"
                      min={0}
                      value={form.price_per_sqft}
                      onChange={(e) => set("price_per_sqft", e.target.value)}
                      disabled={disabled}
                      placeholder="e.g. 15000"
                      className={inp("price_per_sqft")}
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel text="Total Area (SQFT)" />
                  <input
                    type="number"
                    min={0}
                    value={form.total_area_sqft}
                    onChange={(e) => set("total_area_sqft", e.target.value)}
                    disabled={disabled}
                    placeholder="e.g. 120"
                    className={inpNoIcon("total_area_sqft")}
                  />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel text="Payment Plan" required />
                  <input
                    type="text"
                    value={form.payment_plan}
                    onChange={(e) => set("payment_plan", e.target.value)}
                    disabled={disabled}
                    placeholder="e.g. 20/50/30"
                    className={inpNoIcon("payment_plan")}
                    data-error-key="payment_plan"
                  />
                  {errors.payment_plan && <p className="text-xs text-rose-500 mt-1 ml-1">{errors.payment_plan}</p>}
                </div>

                <div className="md:col-span-2">
                  <FieldLabel text="Payment Terms" required />
                  <textarea
                    value={form.payment_terms}
                    onChange={(e) => set("payment_terms", e.target.value)}
                    disabled={disabled}
                    placeholder="Describe payment terms…"
                    rows={2}
                    data-error-key="payment_terms"
                    className={`w-full px-4 py-3 rounded-2xl border bg-white text-sm text-[#0d1117] placeholder:text-[#9ca3af] focus:outline-none focus:ring-4 focus:ring-[#001f3f]/5 transition-all disabled:bg-[#f8fafc] resize-none ${errors.payment_terms ? "border-rose-400" : "border-[#e5e5e5] focus:border-[#001f3f]"}`}
                  />
                  {errors.payment_terms && <p className="text-xs text-rose-500 mt-1 ml-1">{errors.payment_terms}</p>}
                </div>

                <div className="md:col-span-2">
                  <FieldLabel text="Remarks" />
                  <textarea
                    value={form.remarks}
                    onChange={(e) => set("remarks", e.target.value)}
                    disabled={disabled}
                    placeholder="Optional notes or remarks…"
                    rows={2}
                    className="w-full px-4 py-3 rounded-2xl border border-[#e5e5e5] bg-white text-sm text-[#0d1117] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 transition-all disabled:bg-[#f8fafc] resize-none"
                  />
                </div>
              </div>
            </div>
            )} {/* end contract tab */}

            {/* === Partnership split — edit only (admin, or the team leader) === */}
            {isEdit && editSale && activeTab === "partners" && !viewMode && (
            <div className="space-y-5">
              <SectionTitle icon={Handshake} title="Partnership" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ChoiceCard
                  selected={!shared}
                  icon={User}
                  title="Solo sale"
                  desc={`Only ${toTitleCase(editSale.profiles?.fullname) || "the recording agent"} — they get 100% of it.`}
                  onClick={() => { setShared(false); setPartnerErrors({}) }}
                />
                <ChoiceCard
                  selected={shared}
                  icon={Handshake}
                  title="Shared sale"
                  desc="Add the partner agents and each one's share of the deal."
                  onClick={() => {
                    setShared(true)
                    setPartnerErrors({})
                    // A sale turning shared starts from its recording agent at 100%.
                    if (partners.length === 0) {
                      setPartners([{
                        agent_id: editSale.agent_id,
                        name: toTitleCase(editSale.profiles?.fullname) || "Agent",
                        role: "lead",
                        share: 100,
                        brn: null,
                      }])
                    }
                  }}
                />
              </div>
              {shared && (
                <PartnerSharesEditor
                  agents={partners}
                  onAgentsChange={(next) => { setPartners(next); setPartnerErrors({}) }}
                  info={partnerInfo}
                  onAgentInfo={(agentId, value) => setPartnerInfo((prev) => ({ ...prev, [agentId]: value }))}
                  ownerId={editSale.agent_id}
                  ownerTag="recorded this sale"
                  errors={partnerErrors}
                  // A team leader editing a member's sale may be the partner who is missing.
                  includeSelfInSearch={editSale.agent_id !== currentUserId}
                />
              )}
              <p className="text-xs text-[#6b7280]">
                Each agent&apos;s totals count their share. After adding a partner, attach the signed A2A agreement in the Attachments tab.
              </p>
            </div>
            )} {/* end partners tab */}

            {/* === Commission & Validation — Admin only === */}
            {isAdmin && (viewMode || activeTab === "workflow") && (
            <div>
              <SectionTitle icon={DollarSign} title="Workflow Status" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <FieldLabel text="Commission Status" />
                  <select
                    value={form.commission_status}
                    onChange={(e) => set("commission_status", e.target.value as CommissionStatus)}
                    disabled={disabled}
                    className={sel("commission_status")}
                  >
                    {COMMISSION_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s] ?? s.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <FieldLabel text="Validation Status" />
                  <select
                    value={form.validation_status}
                    onChange={(e) => set("validation_status", e.target.value as ValidationStatus)}
                    disabled={disabled}
                    className={sel("validation_status")}
                  >
                    {VALIDATION_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s] ?? s.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            )} {/* end workflow tab */}

            {/* === Attachments tab === */}
            {activeTab === "attachments" && !viewMode && (
              <div className="space-y-4">
                {isEdit ? (
                  /* ── EDIT MODE: live upload to S3 ── */
                  <>
                    {canUploadAttachments && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-[#6b7280]">This file is:</span>
                        {([
                          { value: "proof", label: "Proof of transaction" },
                          { value: "partnership_agreement", label: "Signed A2A agreement" },
                        ] as const).map((o) => (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => setAttCategory(o.value)}
                            aria-pressed={attCategory === o.value}
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                              attCategory === o.value
                                ? "border-[#001f3f] bg-[#001f3f] text-white"
                                : "border-[#e5e5e5] bg-white text-[#374151] hover:border-[#001f3f]/40"
                            }`}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <div
                      onDragOver={(e) => {
                        if (!canUploadAttachments) return
                        e.preventDefault()
                        setAttDragOver(true)
                      }}
                      onDragLeave={() => setAttDragOver(false)}
                      onDrop={async (e) => {
                        if (!canUploadAttachments) return
                        e.preventDefault()
                        setAttDragOver(false)
                        const file = e.dataTransfer.files?.[0]
                        if (file && editSale?.id) await uploadAttachmentFile(file, editSale.id)
                      }}
                      className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                        attDragOver
                          ? "border-[#001f3f]/40 bg-[#001f3f]/5"
                          : "border-[#e5e5e5] hover:border-[#001f3f]/25 hover:bg-[#fafbfc]"
                      }`}
                      onClick={() => {
                        if (!canUploadAttachments) return
                        fileInputRef.current?.click()
                      }}
                    >
                      {attUploading ? (
                        <div className="flex items-center gap-2 text-sm text-[#6b7280]">
                          <div className="w-4 h-4 border-2 border-[#001f3f]/20 border-t-[#001f3f] rounded-full animate-spin" />
                          Uploading…
                        </div>
                      ) : (
                        <>
                          <div className="w-10 h-10 rounded-2xl bg-[#f0f2f5] flex items-center justify-center">
                            <Upload className="w-5 h-5 text-[#9ca3af]" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-semibold text-[#374151]">
                              {canUploadAttachments ? "Click to upload or drag & drop" : "Attachments are read-only for this validation status"}
                            </p>
                            <p className="text-xs text-[#9ca3af] mt-0.5">
                              {canUploadAttachments ? "PDF, Word, Excel, images — max 25 MB" : "Set validation to Invalid Sale or Under Review to manage files"}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.gif,.txt"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (file && editSale?.id) await uploadAttachmentFile(file, editSale.id)
                        if (fileInputRef.current) fileInputRef.current.value = ""
                      }}
                    />
                    {attError && (
                      <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-100 rounded-2xl text-sm text-rose-700">
                        <span aria-hidden>{"\u26A0\uFE0F"}</span> {attError}
                      </div>
                    )}
                    {attLoading ? (
                      <div className="space-y-2">
                        {[1,2,3].map((i) => <div key={i} className="h-14 rounded-2xl bg-[#f3f4f6] animate-pulse" />)}
                      </div>
                    ) : attachments.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-6 text-[#9ca3af]">
                        <FileText className="w-8 h-8 opacity-40" />
                        <p className="text-sm">No attachments yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {attachments.map((att) => (
                          <div key={att.id} className="flex items-center gap-3 p-3 bg-[#f8fafc] rounded-2xl border border-[#f0f2f5] hover:border-[#e5e5e5] transition-all group">
                            <Paperclip className="w-4 h-4 text-[#9ca3af] shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[#0d1117] truncate">{att.file_name}</p>
                              <p className="text-xs text-[#9ca3af] mt-0.5 uppercase">{att.file_type ?? "file"}</p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button type="button" title="View file" onClick={() => window.open(att.file_url, "_blank")}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-sky-50 text-[#9ca3af] hover:text-sky-500 transition-all">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                              {canManageAttachments && (
                                <button type="button" title="Delete" onClick={() => void handleDeleteAttachment(att)}
                                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-rose-50 text-[#9ca3af] hover:text-rose-500 transition-all">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  /* ── CREATE MODE: stage files locally; uploaded after sale is saved ── */
                  <>
                    <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-2xl text-sm text-amber-800">
                      <span>📎</span>
                      <p><strong>Proof of transaction is required.</strong> Files added here upload automatically after the sale is saved.</p>
                    </div>
                    <div
                      onDragOver={(e) => { e.preventDefault(); setAttDragOver(true) }}
                      onDragLeave={() => setAttDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault()
                        setAttDragOver(false)
                        const files = Array.from(e.dataTransfer.files)
                        setPendingFiles((prev) => [...prev, ...files])
                      }}
                      className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                        attDragOver
                          ? "border-[#001f3f]/40 bg-[#001f3f]/5"
                          : "border-[#e5e5e5] hover:border-[#001f3f]/25 hover:bg-[#fafbfc]"
                      }`}
                      onClick={() => pendingInputRef.current?.click()}
                    >
                      <div className="w-10 h-10 rounded-2xl bg-[#f0f2f5] flex items-center justify-center">
                        <Upload className="w-5 h-5 text-[#9ca3af]" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-[#374151]">Click to add files or drag & drop</p>
                        <p className="text-xs text-[#9ca3af] mt-0.5">PDF, Word, Excel, images — max 25 MB each</p>
                        <p className="text-xs text-[#9ca3af] mt-1 italic">e.g. Reservation Agreement, Payment Receipt, Contract</p>
                      </div>
                    </div>
                    <input
                      ref={pendingInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.gif,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? [])
                        setPendingFiles((prev) => [...prev, ...files])
                        if (pendingInputRef.current) pendingInputRef.current.value = ""
                      }}
                    />
                    {pendingFiles.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-2 text-[#9ca3af]">
                        <FileText className="w-7 h-7 opacity-40" />
                        <p className="text-xs">No files staged yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {pendingFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-3 bg-[#f8fafc] rounded-2xl border border-[#f0f2f5] group">
                            <Paperclip className="w-4 h-4 text-[#9ca3af] shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[#0d1117] truncate">{file.name}</p>
                              <p className="text-xs text-[#9ca3af] mt-0.5">
                                {file.type || "file"} · {(file.size / 1024).toFixed(0)} KB
                              </p>
                            </div>
                            <button
                              type="button"
                              title="Remove"
                              onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
                              className="w-8 h-8 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-rose-50 text-[#9ca3af] hover:text-rose-500 transition-all"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )} {/* end attachments tab */}
          </div>

          {/* Footer — Next through the tabs; Save only on the last one */}
          {!viewMode && (
            <>
              <div className="mx-4 sm:mx-7 h-px bg-[#f0f2f5]" />
              <div className="shrink-0 px-4 py-4 sm:px-7 sm:py-5 flex flex-wrap items-center gap-3">
                {isEdit && confirmable && isLastTab && (
                  <label className="w-full inline-flex cursor-pointer items-center gap-2 text-sm text-[#374151]">
                    <input
                      type="checkbox"
                      checked={confirmToo}
                      onChange={(e) => setConfirmToo(e.target.checked)}
                      className="h-4 w-4 rounded border-[#d1d5db] accent-[#001f3f]"
                    />
                    Also confirm this sale for the admin
                  </label>
                )}
                <p className="hidden sm:block text-xs text-[#9ca3af]">
                  Step {tabIndex + 1} of {allTabs.length} · <span className="font-semibold text-[#6b7280]">{allTabs[tabIndex]?.label}</span>
                </p>
                <div className="flex w-full sm:w-auto sm:ml-auto items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 sm:flex-none px-5 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:bg-[#f3f4f6] transition-all"
                  >
                    Cancel
                  </button>
                  {tabIndex > 0 && (
                    <button
                      type="button"
                      onClick={goBack}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:bg-[#f3f4f6] transition-all"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                  )}
                  {isLastTab ? (
                    <button
                      type="button"
                      onClick={() => void handleSubmit()}
                      disabled={saving}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] text-white px-7 py-2.5 rounded-2xl text-sm font-semibold shadow-md hover:translate-y-[-1px] hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {saving
                        ? (pendingFiles.length > 0 && !isEdit ? "Saving & uploading…" : "Saving…")
                        : isEdit
                        ? "Save Changes"
                        : pendingFiles.length > 0
                        ? `Record Sale + ${pendingFiles.length} file${pendingFiles.length > 1 ? "s" : ""}`
                        : "Record Sale"
                      }
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={goNext}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] text-white px-7 py-2.5 rounded-2xl text-sm font-semibold shadow-md hover:translate-y-[-1px] hover:shadow-lg transition-all"
                    >
                      Next
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Portal>
  )
}
