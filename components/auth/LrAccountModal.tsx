"use client"

import { BadgeCheck, Building2, Loader2, MapPin, ShieldCheck, Users, X } from "lucide-react"
import type { NormalizedLrAgent } from "@/lib/lr/lr-api"

export type GoogleIdentityLite = {
  email: string
  name: string | null
  picture: string | null
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-7 h-7 rounded-lg bg-[#001f3f]/5 text-[#001f3f] flex items-center justify-center shrink-0">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] leading-none mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-[#111827] truncate">{value}</p>
      </div>
    </div>
  )
}

export default function LrAccountModal({
  google,
  lr,
  mappedRoleLabel,
  loading,
  error,
  onConfirm,
  onCancel,
}: {
  google: GoogleIdentityLite
  lr: NormalizedLrAgent | null
  mappedRoleLabel: string
  loading: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}) {
  const isVerified =
    (lr?.verification ?? "").toLowerCase() === "verified" || (lr?.status ?? "").toLowerCase() === "active"

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#001428]/60 backdrop-blur-sm"
        aria-label="Close"
        onClick={loading ? undefined : onCancel}
      />
      <div className="relative bg-white rounded-[24px] border border-[#e8eaed] shadow-2xl w-full max-w-md overflow-hidden">
        {/* Navy header */}
        <div className="relative bg-gradient-to-br from-[#001f3f] to-[#002a52] px-6 pt-6 pb-5">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#d6b357]/70 to-transparent" />
          <button
            type="button"
            onClick={loading ? undefined : onCancel}
            disabled={loading}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <h2 className="font-['Outfit'] text-lg font-bold text-white pr-8">
            {lr ? "We noticed your Leuterio Realty account" : "Set up your FHI Global account"}
          </h2>
          <p className="text-white/55 text-xs mt-1 leading-relaxed">
            {lr
              ? "We imported your agent details below. Confirm to finish setting up your FHI Global portal."
              : "No Leuterio Realty agent record was found for this email. You'll be set up as a member — an administrator will review your access before you can sign in."}
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Google identity */}
          <div className="flex items-center gap-3">
            {google.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={google.picture} alt="" className="w-11 h-11 rounded-full border border-[#e8eaed]" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-[#001f3f]/8 flex items-center justify-center text-[#001f3f] font-bold">
                {(google.name ?? google.email).charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#111827] truncate">{google.name ?? google.email}</p>
              <p className="text-xs text-[#6b7280] truncate">{google.email}</p>
            </div>
          </div>

          {/* LR details */}
          {lr && (
            <div className="rounded-2xl border border-[#e8eaed] bg-[#f9fafb] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">
                  Imported from Leuterio Realty
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isVerified
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}
                >
                  <BadgeCheck className="w-3 h-3" />
                  {isVerified ? "Verified" : "Pending verification"}
                </span>
              </div>
              <div className="grid gap-2.5">
                {lr.roleLabel && <DetailRow icon={<ShieldCheck className="w-3.5 h-3.5" />} label="LR Role" value={lr.roleLabel} />}
                {lr.teamName && <DetailRow icon={<Users className="w-3.5 h-3.5" />} label="Team" value={lr.teamName} />}
                {lr.uplineName && <DetailRow icon={<Building2 className="w-3.5 h-3.5" />} label="Upline" value={lr.uplineName} />}
                {lr.state && <DetailRow icon={<MapPin className="w-3.5 h-3.5" />} label="Location" value={lr.state} />}
              </div>
            </div>
          )}

          {/* Mapped FHI role */}
          <div className="flex items-center gap-2.5 rounded-xl bg-[#001f3f]/[0.04] border border-[#001f3f]/10 px-4 py-3">
            <span className="w-8 h-8 rounded-lg bg-[#d6b357]/15 text-[#b48a2c] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <p className="text-sm text-[#374151]">
              You&apos;ll be set up as{" "}
              <span className="font-bold text-[#001f3f]">{mappedRoleLabel}</span>
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 py-3 rounded-xl border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:bg-[#f5f5f5] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#001f3f] to-[#002a52] text-white text-sm font-semibold shadow-md hover:shadow-lg disabled:opacity-60 transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Setting up…" : "Continue to FHI Global"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
