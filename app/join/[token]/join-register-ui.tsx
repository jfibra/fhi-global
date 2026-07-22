"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Eye, EyeOff, Check, X, AlertCircle, Search, ChevronDown, CheckCircle2, ShieldCheck, ArrowRight, Loader2 } from "lucide-react"
import { DeveloperLogo } from "@/components/developers/developer-logo"
import { JoinGoogleButton } from "@/components/developers/join-google-button"
import type { InviteDeveloper } from "@/lib/developer-invites"

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:bg-white focus:ring-4 focus:ring-[#001f3f]/6 transition-all duration-200"

const PWD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "Contains a number", test: (p: string) => /\d/.test(p) },
  { label: "Contains an uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
]

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-[#374151]">{label}</label>
      {children}
      {error && (
        <p className="text-xs text-rose-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  )
}

function DeveloperPicker({
  developers,
  value,
  onChange,
}: {
  developers: InviteDeveloper[]
  value: InviteDeveloper | null
  onChange: (d: InviteDeveloper) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const filtered = useMemo(
    () => (q ? developers.filter((d) => d.name.toLowerCase().includes(q.toLowerCase())) : developers),
    [developers, q],
  )
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-[#f9fafb] text-left transition-all ${open ? "border-[#001f3f] ring-4 ring-[#001f3f]/6 bg-white" : "border-[#e5e7eb]"}`}
      >
        {value ? (
          <>
            <DeveloperLogo url={value.logo_url} name={value.name} size={32} />
            <span className="flex-1 text-sm font-semibold text-[#111827] truncate">{value.name}</span>
          </>
        ) : (
          <span className="flex-1 text-sm text-[#9ca3af]">Choose a developer…</span>
        )}
        <ChevronDown className={`w-4 h-4 text-[#9ca3af] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1.5 w-full bg-white rounded-2xl border border-[#e8eaed] shadow-xl overflow-hidden">
            <div className="p-2 border-b border-[#f0f2f5]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search developers"
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#e5e7eb] text-sm focus:outline-none focus:border-[#001f3f]"
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-[#9ca3af]">No developers found.</p>
              ) : (
                filtered.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => { onChange(d); setOpen(false); setQ("") }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#f9fafb] text-left"
                  >
                    <DeveloperLogo url={d.logo_url} name={d.name} size={32} />
                    <span className="flex-1 text-sm font-medium text-[#111827] truncate">{d.name}</span>
                    {d.is_verified && <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />}
                    {value?.id === d.id && <Check className="w-4 h-4 text-[#001f3f] shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function JoinRegisterUI({
  token,
  autoActivate,
  boundDeveloper,
  developers,
}: {
  token: string
  autoActivate: boolean
  boundDeveloper: InviteDeveloper | null
  developers: InviteDeveloper[]
}) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPwd, setShowPwd] = useState(false)
  const [chosen, setChosen] = useState<InviteDeveloper | null>(boundDeveloper)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const developer = boundDeveloper ?? chosen

  const submit = async () => {
    setError(null)
    if (!developer) return setError("Please choose a developer.")
    if (!firstName.trim() || !lastName.trim() || !email.trim()) return setError("All fields are required.")
    if (!PWD_RULES.every((r) => r.test(password))) return setError("Password doesn't meet the requirements.")
    if (password !== confirm) return setError("Passwords do not match.")

    setSubmitting(true)
    try {
      const res = await fetch("/api/developer-invite/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, developerId: developer.id, firstName, lastName, email, password }),
      })
      const json = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        setError(json.error ?? "Could not create your account.")
        setSubmitting(false)
        return
      }
      setSuccess(true)
    } catch {
      setError("Network error — please try again.")
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-[100dvh] bg-[#f4f6f9] flex items-center justify-center p-4">
        <div className="bg-white rounded-[24px] border border-[#e8eaed] shadow-[0_8px_48px_-8px_rgba(0,31,63,0.12)] p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-[#d6b357]/12 border-2 border-[#d6b357]/30 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-9 h-9 text-[#d6b357]" />
          </div>
          <h1 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] mb-2">Account created</h1>
          <p className="text-sm text-[#6b7280] mb-7 leading-relaxed">
            {autoActivate
              ? `You've joined ${developer?.name}. You can sign in now.`
              : `You've joined ${developer?.name}. An administrator will review and approve your access before you can sign in.`}
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-4 bg-[#001f3f] hover:bg-[#002952] text-white text-sm font-bold rounded-xl transition-colors"
          >
            Go to sign in <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-[#f4f6f9] flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="font-['Outfit'] text-2xl font-bold text-[#0d1117]">Join FHI Global</h1>
          <p className="text-sm text-[#6b7280] mt-1">
            {boundDeveloper
              ? `Create your account under ${boundDeveloper.name}.`
              : "Create your developer account — choose your company below."}
          </p>
        </div>

        <div className="bg-white rounded-[24px] border border-[#e8eaed] shadow-[0_8px_48px_-8px_rgba(0,31,63,0.12)] p-6 sm:p-8 space-y-5">
          {/* Developer */}
          <Field label="Developer">
            {boundDeveloper ? (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[#e8eaed] bg-[#f9fafb]">
                <DeveloperLogo url={boundDeveloper.logo_url} name={boundDeveloper.name} size={32} />
                <span className="flex-1 text-sm font-semibold text-[#111827] truncate">{boundDeveloper.name}</span>
                {boundDeveloper.is_verified && <ShieldCheck className="w-4 h-4 text-emerald-500" />}
              </div>
            ) : (
              <DeveloperPicker developers={developers} value={chosen} onChange={setChosen} />
            )}
          </Field>

          {/* Google one-click */}
          <JoinGoogleButton token={token} developerId={boundDeveloper ? null : chosen?.id ?? null} disabled={!developer} />

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#f0f0f0]" />
            <span className="text-[10px] text-[#bbb] uppercase tracking-widest font-semibold">Or with email</span>
            <div className="flex-1 h-px bg-[#f0f0f0]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ahmed" className={inputCls} autoComplete="given-name" />
            </Field>
            <Field label="Last name">
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Al Rashidi" className={inputCls} autoComplete="family-name" />
            </Field>
          </div>
          <Field label="Email address">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" className={inputCls} autoComplete="email" />
          </Field>
          <Field label="Password">
            <div className="relative">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPwd ? "text" : "password"}
                placeholder="Min. 8 characters"
                className={`${inputCls} pr-11`}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#001f3f]" aria-label="Toggle password">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {password && (
              <div className="mt-2 space-y-1">
                {PWD_RULES.map((r) => {
                  const ok = r.test(password)
                  return (
                    <div key={r.label} className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center ${ok ? "bg-emerald-500" : "bg-[#e5e7eb]"}`}>
                        {ok ? <Check className="w-2.5 h-2.5 text-white" /> : <X className="w-2 h-2 text-[#9ca3af]" />}
                      </span>
                      <span className={`text-xs ${ok ? "text-emerald-700" : "text-[#6b7280]"}`}>{r.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </Field>
          <Field label="Confirm password">
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type={showPwd ? "text" : "password"} placeholder="Re-enter password" className={inputCls} autoComplete="new-password" />
          </Field>

          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-[#001f3f] to-[#002a52] text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg disabled:opacity-60 transition-all"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </div>

        <p className="text-center text-xs text-[#9ca3af] mt-5">
          Already have an account?{" "}
          <Link href="/login" className="text-[#d6b357] font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
