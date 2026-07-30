"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  CheckCircle2,
  Loader2,
  LogOut,
  Paperclip,
  ShieldAlert,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole, isSalesPipelineRole } from "@/lib/app-roles"
import {
  fetchMySalesMissingProof,
  uploadSaleProofFile,
  type SaleMissingProof,
} from "@/lib/sales-service"

/**
 * Login-time enforcement of the "every sale needs a proof of transaction" rule.
 *
 * Mounted once inside the dashboard shell. On login it looks up the signed-in
 * user's OWN sales that still have no attachment and, if any exist, shows a
 * blocking modal that only clears once each one has proof uploaded. New sales
 * can no longer be encoded without proof, so this only ever surfaces legacy
 * sales recorded before the requirement existed. A Sign-out button is the sole
 * escape hatch, so a backend hiccup can never trap someone on the overlay.
 */

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value) + " AED"
}

function formatDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

type RowState = { uploading: boolean; error: string | null; done: boolean }

export function RequiredSaleProofGate() {
  const { user, role } = useAuth()
  const eligible = isAdminStaffRole(role) || isSalesPipelineRole(role)

  const [sales, setSales] = useState<SaleMissingProof[] | null>(null)
  const [rowState, setRowState] = useState<Record<string, RowState>>({})
  const [dismissed, setDismissed] = useState(false)
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    if (!eligible || !user?.id) return
    let active = true
    void (async () => {
      const { data } = await fetchMySalesMissingProof(user.id)
      if (!active) return
      if (data && data.length > 0) setSales(data)
    })()
    return () => {
      active = false
    }
  }, [eligible, user?.id])

  if (dismissed || !sales || sales.length === 0 || typeof document === "undefined") return null

  const remaining = sales.filter((s) => !rowState[s.id]?.done).length
  const allDone = remaining === 0

  const handleFiles = async (saleId: string, fileList: FileList | null) => {
    const files = Array.from(fileList ?? [])
    if (files.length === 0) return
    setRowState((prev) => ({ ...prev, [saleId]: { uploading: true, error: null, done: false } }))
    let uploaded = 0
    let lastError: string | null = null
    for (const file of files) {
      const { error } = await uploadSaleProofFile(file, saleId)
      if (error) lastError = error
      else uploaded += 1
    }
    setRowState((prev) => ({
      ...prev,
      [saleId]:
        uploaded > 0
          ? { uploading: false, error: null, done: true }
          : { uploading: false, error: lastError ?? "Upload failed", done: false },
    }))
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="shrink-0 px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#f4f6f9] flex items-center justify-center shrink-0">
              <ShieldAlert className="w-[18px] h-[18px] text-[#001f3f]" />
            </div>
            <div>
              <h2 className="font-['Outfit'] text-base font-bold text-[#0d1117]">
                Proof of transaction required
              </h2>
              <p className="text-xs text-[#6b7280] mt-0.5">
                {allDone
                  ? "All set — thanks for keeping your records complete."
                  : `${remaining} of your sale${remaining > 1 ? "s are" : " is"} missing a proof of transaction. Please attach it to continue.`}
              </p>
            </div>
          </div>
        </div>

        {/* Sales list */}
        <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-2.5">
          {sales.map((sale) => {
            const state = rowState[sale.id]
            const done = Boolean(state?.done)
            return (
              <div
                key={sale.id}
                className={`rounded-lg border p-3.5 transition-colors ${
                  done ? "border-emerald-200 bg-emerald-50/50" : "border-[#eceef1] bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0d1117] truncate">{sale.client_name}</p>
                    <p className="text-xs text-[#6b7280] truncate">{sale.location}</p>
                    <p className="text-xs text-[#9ca3af] mt-1">
                      {formatCurrency(sale.contract_price)} · {formatDate(sale.reservation_date)}
                    </p>
                  </div>

                  {done ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-semibold shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                      Proof attached
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => inputsRef.current[sale.id]?.click()}
                        disabled={state?.uploading}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#00356b] transition-colors disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
                      >
                        {state?.uploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Paperclip className="w-4 h-4" />
                        )}
                        {state?.uploading ? "Uploading…" : "Add proof"}
                      </button>
                      <input
                        ref={(el) => {
                          inputsRef.current[sale.id] = el
                        }}
                        type="file"
                        multiple
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => {
                          void handleFiles(sale.id, e.target.files)
                          e.target.value = ""
                        }}
                      />
                    </>
                  )}
                </div>
                {state?.error && (
                  <p className="mt-2 text-xs text-rose-600 font-medium">{state.error}</p>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 pt-3 pb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="inline-flex items-center gap-2 px-2 py-2 text-sm font-medium text-[#6b7280] hover:text-rose-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            disabled={!allDone}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#00356b] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue to dashboard
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
