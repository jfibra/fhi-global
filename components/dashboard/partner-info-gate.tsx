"use client"

// Shown over the dashboard to a Global Partner who hasn't said where they live
// (boss, 2026-10-04): partners who joined before the invite asked "Where are
// you based?" answer it here once — the country they live in now and their
// WhatsApp (already filled in when their profile has one).
//
// Like the photo gate: not dismissible (no close, no Escape, no backdrop), but
// it offers Sign out, so it nudges rather than traps.

import { useEffect, useRef, useState } from "react"
import { Globe2, Loader2, LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { countryByIso, countryByName, countryForDial } from "@/lib/countries"
import { checkPartnerSignupInfo, type PartnerSignupInfo } from "@/lib/partner-signup"
import { PartnerLocationFields } from "@/components/auth/partner-location-fields"

export function PartnerInfoGate({
  displayName,
  whatsappCode,
  whatsappNumber,
  onSaved,
}: {
  displayName: string
  /** What their profile already holds ("+63" / "+1-CA"), to start from. */
  whatsappCode: string | null
  whatsappNumber: string | null
  /** Hands the saved answers back so the shell can drop the gate without a reload. */
  onSaved: (info: PartnerSignupInfo) => void
}) {
  const [country, setCountry] = useState("")
  const [waIso, setWaIso] = useState(() => countryForDial(whatsappCode)?.iso ?? "")
  const [waNumber, setWaNumber] = useState(whatsappNumber ?? "")
  // A WhatsApp already on the profile keeps its own code; otherwise the code follows the country.
  const hadWhatsapp = Boolean(whatsappNumber)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstName = displayName.trim().split(/\s+/)[0] ?? ""

  // Keep keyboard focus inside the dialog (the dashboard behind is off limits).
  const dialogRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const node = dialogRef.current
    if (!node) return
    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>("button:not([disabled]), select, input:not([disabled])")).filter(
        (el) => el.offsetParent !== null,
      )
    focusables()[0]?.focus()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      const items = focusables()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (!node.contains(active)) { e.preventDefault(); first.focus(); return }
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  const save = async () => {
    const checked = checkPartnerSignupInfo({ country, whatsappCode: countryByIso(waIso)?.dial ?? "", whatsappNumber: waNumber })
    if (!checked.ok) {
      setError(checked.error)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/account/partner-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checked.info),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; info?: PartnerSignupInfo }
      if (!res.ok || !data.info) {
        setError(data.error ?? "Couldn't save — please try again.")
        return
      }
      onSaved(data.info)
    } catch {
      setError("Couldn't save — check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    await createClient().auth.signOut()
    window.location.href = "/"
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-gate-title"
      ref={dialogRef}
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-[#001f3f]/75 backdrop-blur-sm"
    >
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden max-h-[94vh] flex flex-col">
        {/* Masthead — solid navy with the gold hairline, like the photo gate */}
        <div className="relative shrink-0 bg-[#001f3f] px-7 pt-7 pb-6">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-[#d6b357]" />
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6b357]">FHI Global · Global Partner</p>
          <h2 id="partner-gate-title" className="font-['Outfit'] text-2xl font-bold text-white mt-1.5">
            Where are you based{firstName ? `, ${firstName}` : ""}?
          </h2>
          <p className="text-sm text-[#b9c5d6] mt-1.5 leading-relaxed">
            Tell us the country you live in now and your WhatsApp number, so our team knows where our partners are.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
          className="flex-1 overflow-y-auto px-7 py-6 space-y-4"
          noValidate
        >
          <PartnerLocationFields
            idPrefix="partner-gate"
            country={country}
            onCountry={(name) => {
              setCountry(name)
              const c = countryByName(name)
              if (c && (!hadWhatsapp || !waIso)) setWaIso(c.iso)
              setError(null)
            }}
            waIso={waIso}
            onWaIso={(iso) => {
              setWaIso(iso)
              setError(null)
            }}
            waNumber={waNumber}
            onWaNumber={(value) => {
              setWaNumber(value)
              setError(null)
            }}
          />

          {error && (
            <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-lg bg-[#d6b357] text-[#001f3f] text-[15px] font-bold hover:bg-[#c8a544] transition-colors disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Globe2 className="w-5 h-5" />}
            Save and continue
          </button>

          <div className="pt-4 border-t border-[#f0f2f5] flex justify-center">
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9ca3af] hover:text-[#6b7280] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out instead
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
