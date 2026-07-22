"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Check, Pencil, Plus, Tag, X } from "lucide-react"
import {
  createPurchaseCategory,
  updatePurchaseCategory,
  type PurchaseCategory,
  type PurchaseCategoryFormData,
} from "@/lib/purchase-category-service"
import { isSuperAdminRole } from "@/lib/app-roles"

// ─── Portal helper ────────────────────────────────────────────────────────────

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

// ─── Shared field label ───────────────────────────────────────────────────────

function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <label className="text-xs font-bold uppercase tracking-wider text-[#374151] ml-1 mb-2 block">
      {text}
      {required && " *"}
    </label>
  )
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_FORM: PurchaseCategoryFormData = {
  category_name: "",
  category_type: "custom",
  is_active: true,
}

const iconCls = "absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none"

// ─── Component ────────────────────────────────────────────────────────────────

export function PurchaseCategoryFormDialog({
  open,
  editCategory,
  currentRole,
  currentUserId,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean
  editCategory: PurchaseCategory | null
  currentRole: string
  currentUserId: string
  onClose: () => void
  onSaved: (category: PurchaseCategory, isEdit: boolean) => void
  onError: (message: string) => void
}) {
  const isEdit = Boolean(editCategory)
  const [form, setForm] = useState<PurchaseCategoryFormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof PurchaseCategoryFormData, string>>>({})
  const [saving, setSaving] = useState(false)

  // Populate form on edit open
  useEffect(() => {
    if (!open) return
    if (editCategory) {
      setForm({
        category_name: editCategory.category_name,
        category_type: editCategory.category_type,
        is_active: editCategory.is_active,
      })
    } else {
      setForm({
        ...EMPTY_FORM,
        // Admins can only create custom; super_admin can pick either
        category_type: "custom",
      })
    }
    setErrors({})
  }, [open, editCategory])

  const set = <K extends keyof PurchaseCategoryFormData>(key: K, value: PurchaseCategoryFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validate = () => {
    const errs: typeof errors = {}
    if (!form.category_name.trim()) errs.category_name = "Category name is required"
    return errs
  }

  const handleSubmit = async () => {
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    setSaving(true)
    try {
      if (isEdit && editCategory) {
        const { data, error } = await updatePurchaseCategory(editCategory.id, {
          category_name: form.category_name,
          is_active: form.is_active,
        })
        if (error) { onError(error); return }
        onSaved(data!, true)
      } else {
        const { data, error } = await createPurchaseCategory(form, currentUserId)
        if (error) { onError(error); return }
        onSaved(data!, false)
      }
    } finally {
      setSaving(false)
    }
  }

  const inp = (hasError: boolean) =>
    `w-full pl-11 pr-4 py-3 rounded-2xl border bg-white text-sm text-[#0d1117] placeholder:text-[#9ca3af]
    focus:outline-none focus:ring-4 focus:ring-[#001f3f]/5 transition-all
    ${hasError ? "border-rose-400 focus:border-rose-400" : "border-[#e5e5e5] focus:border-[#001f3f]"}`

  const isSuperAdmin = isSuperAdminRole(currentRole)

  if (!open) return null

  return (
    <Portal>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-md bg-white rounded-[28px] shadow-2xl flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative shrink-0 px-7 pt-7 pb-5">
            <div
              className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[28px]"
              style={{ background: "linear-gradient(to right, #001f3f, #d6b357)" }}
            />
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#001f3f] to-[#d6b357] flex items-center justify-center shadow-md">
                  {isEdit ? (
                    <Pencil className="w-4.5 h-4.5 text-white" />
                  ) : (
                    <Plus className="w-4.5 h-4.5 text-white" />
                  )}
                </div>
                <div>
                  <h2 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">
                    {isEdit ? "Edit Category" : "Add Category"}
                  </h2>
                  <p className="text-xs text-[#9ca3af] mt-0.5">
                    {isEdit
                      ? "Update name or status"
                      : "Create a new purchase category"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f3f4f6] text-[#9ca3af] hover:text-[#374151] transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-7 h-px bg-[#f0f2f5]" />

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5">

            {/* Category Name */}
            <div>
              <FieldLabel text="Category Name" required />
              <div className="relative">
                <Tag className={iconCls} />
                <input
                  type="text"
                  value={form.category_name}
                  onChange={(e) => set("category_name", e.target.value)}
                  placeholder="e.g. Marketing, Legal, Travel"
                  className={inp(Boolean(errors.category_name))}
                  maxLength={100}
                />
              </div>
              {errors.category_name && (
                <p className="text-xs text-rose-500 mt-1.5 ml-1">{errors.category_name}</p>
              )}
            </div>

            {/* Category Type — only shown on create */}
            {!isEdit && (
              <div>
                <FieldLabel text="Category Type" required />
                <div className="grid grid-cols-2 gap-3">
                  {(["custom", "default"] as const).map((type) => {
                    const isDisabled = type === "default" && !isSuperAdmin
                    const isSelected = form.category_type === type

                    return (
                      <div
                        key={type}
                        onClick={() => !isDisabled && set("category_type", type)}
                        className={`flex items-center gap-3 p-4 rounded-xl border transition-all
                          ${isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
                          ${isSelected && !isDisabled
                            ? "bg-white border-[#001f3f]/20 shadow-sm"
                            : "bg-[#fafbfc] border-[#f0f2f5]"
                          }`}
                      >
                        {/* Radio circle */}
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
                            ${isSelected && !isDisabled
                              ? "border-[#001f3f] bg-[#001f3f]"
                              : "border-[#d1d5db] bg-white"
                            }`}
                        >
                          {isSelected && !isDisabled && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#0d1117] capitalize">{type}</p>
                          <p className="text-[11px] text-[#9ca3af]">
                            {type === "default" ? "System default" : "User-created"}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {!isSuperAdmin && (
                  <p className="text-xs text-[#9ca3af] mt-2 ml-1">
                    Only Super Admins can create default categories.
                  </p>
                )}
              </div>
            )}

            {/* Read-only type badge on edit */}
            {isEdit && (
              <div>
                <FieldLabel text="Category Type" />
                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#f8fafc] border border-[#f0f2f5]">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
                      ${editCategory?.category_type === "default"
                        ? "bg-sky-50 text-sky-700 border border-sky-200"
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                  >
                    {editCategory?.category_type === "default" ? "Default" : "Custom"}
                  </span>
                  <span className="text-xs text-[#9ca3af]">Cannot be changed after creation</span>
                </div>
              </div>
            )}

            {/* Active toggle */}
            <div>
              <FieldLabel text="Status" />
              <div
                onClick={() => set("is_active", !form.is_active)}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer
                  ${form.is_active
                    ? "bg-white border-[#001f3f]/20 shadow-sm"
                    : "bg-[#fafbfc] border-[#f0f2f5]"
                  }`}
              >
                {/* Track */}
                <div
                  className={`relative w-11 h-6 rounded-full transition-all duration-200 shrink-0
                    ${form.is_active
                      ? "bg-gradient-to-r from-[#001f3f] to-[#d6b357]"
                      : "bg-[#d1d5db]"
                    }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200
                      ${form.is_active ? "translate-x-5" : "translate-x-0.5"}`}
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0d1117]">
                    {form.is_active ? "Active" : "Inactive"}
                  </p>
                  <p className="text-[11px] text-[#9ca3af]">
                    {form.is_active
                      ? "Category is available for purchase records"
                      : "Category will be hidden from purchase forms"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 px-7 pb-7 pt-4">
            <div className="mx-[-28px] mb-4 h-px bg-[#f0f2f5] mx-0" />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-5 py-3 rounded-2xl border border-[#e5e5e5] text-sm font-semibold text-[#374151] bg-white hover:bg-[#f8fafc] transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-md transition-all hover:translate-y-[-1px] hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
                style={{ background: "linear-gradient(to right, #001f3f, #d6b357)" }}
              >
                {saving ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Category"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  )
}
