"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Eye, EyeOff, Check, X, AlertCircle, Search, ChevronDown, CheckCircle2,
  ShieldCheck, ArrowRight, ArrowLeft, Loader2, Building2, Layers, Images, Plus, Sparkles,
} from "lucide-react"
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

/** Developer selector for generic links: search existing, or create a new one. */
function DeveloperPicker({
  developers,
  value,
  pendingNewName,
  onSelectExisting,
  onCreateNew,
}: {
  developers: InviteDeveloper[]
  value: InviteDeveloper | null
  pendingNewName: string | null
  onSelectExisting: (d: InviteDeveloper) => void
  onCreateNew: (name: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"list" | "create">("list")
  const [q, setQ] = useState("")
  const [newName, setNewName] = useState("")
  const filtered = useMemo(
    () => (q ? developers.filter((d) => d.name.toLowerCase().includes(q.toLowerCase())) : developers),
    [developers, q],
  )

  const close = () => {
    setOpen(false)
    setMode("list")
    setQ("")
    setNewName("")
  }

  const submitNew = () => {
    const name = newName.trim()
    if (name.length < 2) return
    onCreateNew(name)
    close()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-[#f9fafb] text-left transition-all ${open ? "border-[#001f3f] ring-4 ring-[#001f3f]/6 bg-white" : "border-[#e5e7eb]"}`}
      >
        {value ? (
          <>
            <DeveloperLogo url={value.logo_url} name={value.name} size={32} />
            <span className="flex-1 text-sm font-semibold text-[#111827] truncate">{value.name}</span>
            {value.is_verified && <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />}
          </>
        ) : pendingNewName ? (
          <>
            <span className="w-8 h-8 rounded-xl bg-[#001f3f]/8 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-[#001f3f]" />
            </span>
            <span className="flex-1 text-sm font-semibold text-[#111827] truncate">{pendingNewName}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#b48a2c] bg-[#d6b357]/15 px-2 py-0.5 rounded-full shrink-0">New</span>
          </>
        ) : (
          <span className="flex-1 text-sm text-[#9ca3af]">Choose a developer…</span>
        )}
        <ChevronDown className={`w-4 h-4 text-[#9ca3af] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40" aria-label="Close" onClick={close} />
          <div className="absolute z-50 mt-1.5 w-full bg-white rounded-2xl border border-[#e8eaed] shadow-xl overflow-hidden">
            {mode === "list" ? (
              <>
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
                <div className="max-h-56 overflow-y-auto py-1">
                  {filtered.length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs text-[#9ca3af]">No developers match “{q}”.</p>
                  ) : (
                    filtered.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => { onSelectExisting(d); close() }}
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
                {/* Create-new footer */}
                <button
                  type="button"
                  onClick={() => { setNewName(q); setMode("create") }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 border-t border-[#f0f2f5] bg-[#fbfcfd] hover:bg-[#f4f6f9] text-left"
                >
                  <span className="w-7 h-7 rounded-full bg-[#001f3f] flex items-center justify-center shrink-0">
                    <Plus className="w-4 h-4 text-white" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[#001f3f]">Can&apos;t find your developer?</span>
                    <span className="block text-[11px] text-[#9ca3af]">Create a new one</span>
                  </span>
                </button>
              </>
            ) : (
              /* Create mode */
              <div className="p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setMode("list")} className="p-1 rounded-lg text-[#9ca3af] hover:bg-[#f4f6f9]" aria-label="Back">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <p className="text-sm font-bold text-[#0d1117]">New developer</p>
                </div>
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitNew() } }}
                  maxLength={120}
                  placeholder="e.g. EMAAR Properties"
                  className="w-full h-10 px-3 rounded-lg border border-[#e5e7eb] text-sm focus:outline-none focus:border-[#001f3f]"
                />
                <p className="text-[11px] text-[#9ca3af] leading-relaxed">
                  We&apos;ll create this company and an administrator will verify it. Your account is still created right away.
                </p>
                <button
                  type="button"
                  onClick={submitNew}
                  disabled={newName.trim().length < 2}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#002952] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" /> Add developer
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/** Right-panel hero when the link is bound to a specific developer. */
function BoundHero({ developer }: { developer: InviteDeveloper }) {
  return (
    <div className="max-w-md mx-auto text-center">
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/12 border border-white/25 rounded-full text-xs font-semibold text-white/90 backdrop-blur-md mb-9">
        <Sparkles className="w-3.5 h-3.5 text-[#d6b357]" />
        You&apos;ve been invited
      </div>

      <div className="relative w-28 h-28 mx-auto mb-6">
        <div className="w-full h-full rounded-3xl bg-white ring-4 ring-[#d6b357] shadow-[0_18px_50px_-12px_rgba(0,10,30,0.7)] flex items-center justify-center overflow-hidden">
          <DeveloperLogo url={developer.logo_url} name={developer.name} size={96} />
        </div>
        {developer.is_verified && (
          <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-[#d6b357] ring-4 ring-[#001f3f] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-[#001f3f]" />
          </div>
        )}
      </div>

      <p className="text-white/70 text-sm font-medium drop-shadow-[0_2px_8px_rgba(0,10,30,0.8)]">You&apos;re creating your developer account with</p>
      <h2 className="font-['Outfit'] text-4xl xl:text-[42px] font-bold text-white leading-tight drop-shadow-[0_2px_16px_rgba(0,10,30,0.7)] mt-1 mb-8">
        {developer.name}
      </h2>

      <div className="flex items-start gap-3 text-left bg-white/10 border border-white/20 rounded-2xl backdrop-blur-md p-5">
        <div className="w-9 h-9 rounded-full bg-[#d6b357] flex items-center justify-center shrink-0">
          <Check className="w-4 h-4 text-[#001f3f]" />
        </div>
        <p className="text-sm text-white/85 leading-relaxed">
          Complete your sign-up and your account will be linked to{" "}
          <span className="font-bold text-white">{developer.name}</span>&apos;s team on FHI Global.
        </p>
      </div>
    </div>
  )
}

/** Right-panel hero for a generic link (registrant picks / creates a developer). */
function MarketingHero() {
  const features = [
    { title: "Developer network", desc: "Manage your Dubai developer profile and team.", icon: Building2 },
    { title: "Create projects", desc: "Publish and manage the projects in your development.", icon: Layers },
    { title: "Project media", desc: "Add photos, floor plans, and media to each project.", icon: Images },
  ]
  return (
    <div className="max-w-xl mx-auto text-center">
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/12 border border-white/25 rounded-full text-xs font-semibold text-white/90 backdrop-blur-md mb-5">
        <span className="w-2 h-2 rounded-full bg-[#d6b357]" />
        Developer registration
      </div>

      <h1 className="font-['Outfit'] text-4xl xl:text-5xl font-bold text-white drop-shadow-[0_2px_16px_rgba(0,10,30,0.6)] mb-4 leading-tight tracking-tight">
        Join FHI Global{" "}
        <span className="relative inline-block">
          <span className="relative z-10">as a developer</span>
          <span className="absolute -bottom-0.5 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-[#d6b357] to-[#f0d890]" aria-hidden />
        </span>
      </h1>

      <p className="text-white/85 drop-shadow-[0_1px_8px_rgba(0,10,30,0.7)] text-base leading-relaxed mb-8 max-w-lg mx-auto">
        Create your developer account to publish the projects in your development, manage their media, and reach buyers on FHI Global — Dubai&apos;s real-estate platform.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
        {features.map(({ title, desc, icon: Icon }) => (
          <div key={title} className="flex flex-col gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#d6b357] flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-[#001f3f]" />
              </div>
              <span className="text-sm font-bold text-white">{title}</span>
            </div>
            <p className="text-xs text-white/75 leading-relaxed pl-8">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Shared split-screen shell: navy form panel (left) + photo hero (right). */
function SplitLayout({ hero, children }: { hero: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen font-sans">
      <div className="w-full lg:w-[430px] xl:w-[470px] shrink-0 bg-gradient-to-b from-[#00274f] via-[#001f3f] to-[#00142a] lg:h-screen lg:overflow-y-auto">
        <div className="min-h-full flex flex-col px-6 sm:px-8 lg:px-10 py-7">
          <Link href="/" className="shrink-0 inline-block w-fit" aria-label="Go to homepage">
            <Image src="/FHI_Branding_White.png" alt="FHI Global Property Dubai" width={200} height={80} priority className="h-12 w-auto object-contain" />
          </Link>
          <div className="flex-1 flex flex-col justify-center py-8">
            <div className="w-full max-w-sm mx-auto">{children}</div>
          </div>
          <div className="shrink-0 flex items-center justify-between gap-4 text-sm">
            <Link href="/" className="text-white/70 hover:text-white font-semibold transition-colors">← Homepage</Link>
            <p className="text-white/70">
              Already have an account?{" "}
              <Link href="/login" className="text-[#d6b357] font-semibold hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </div>

      <div className="hidden lg:block relative flex-1 overflow-hidden">
        <Image src="/background/developers.webp" alt="Dubai skyline" fill priority sizes="60vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#00122a]/80 via-[#001f3f]/35 to-[#001f3f]/40" />
        <div className="relative z-10 h-full flex flex-col justify-center px-10 xl:px-16 py-12">{hero}</div>
      </div>
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
  const [chosen, setChosen] = useState<InviteDeveloper | null>(null)
  const [newName, setNewName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // What the registrant will join with: a bound developer, a chosen existing
  // one, or a to-be-created one (name only, created server-side on submit).
  const hasSelection = !!boundDeveloper || !!chosen || !!newName
  const selectionName = boundDeveloper?.name ?? chosen?.name ?? newName ?? ""
  const hero = boundDeveloper ? <BoundHero developer={boundDeveloper} /> : <MarketingHero />

  const submit = async () => {
    setError(null)
    if (!hasSelection) return setError("Please choose your developer.")
    if (!firstName.trim() || !lastName.trim() || !email.trim()) return setError("All fields are required.")
    if (!PWD_RULES.every((r) => r.test(password))) return setError("Password doesn't meet the requirements.")
    if (password !== confirm) return setError("Passwords do not match.")

    setSubmitting(true)
    try {
      const res = await fetch("/api/developer-invite/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          developerId: boundDeveloper ? null : chosen?.id ?? null,
          newDeveloperName: boundDeveloper ? null : newName,
          firstName,
          lastName,
          email,
          password,
        }),
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
      <SplitLayout hero={hero}>
        <div className="bg-white rounded-[20px] border border-[#e8eaed] shadow-[0_18px_50px_-24px_rgba(0,10,30,0.35)] overflow-hidden text-center">
          <div className="px-8 py-10">
            <div className="w-20 h-20 rounded-full bg-[#d6b357]/12 border-2 border-[#d6b357]/30 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-[#d6b357]" />
            </div>
            <h2 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] mb-3">Account created</h2>
            <p className="text-[#6b7280] text-sm mb-8 leading-relaxed">
              {autoActivate
                ? `You've joined ${selectionName}. You can sign in now.`
                : `You've joined ${selectionName}. An administrator will review and approve your access before you can sign in.`}
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-4 bg-[#001f3f] hover:bg-[#002952] text-white text-sm font-bold rounded-xl shadow-[0_4px_16px_-2px_rgba(0,31,63,0.35)] hover:-translate-y-0.5 transition-all duration-200"
            >
              Go to sign in <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </SplitLayout>
    )
  }

  return (
    <SplitLayout hero={hero}>
      <div className="bg-white rounded-[20px] border border-[#e8eaed] shadow-[0_18px_50px_-24px_rgba(0,10,30,0.35)] p-6 space-y-4">
        <div className="mb-1">
          <h2 className="font-['Outfit'] text-2xl font-bold text-[#0d1117]">Sign up</h2>
          <p className="text-sm text-[#6b7280] mt-1">
            {boundDeveloper ? `Create your account under ${boundDeveloper.name}.` : "Create your developer account — choose your company."}
          </p>
        </div>

        {/* Developer */}
        <Field label="Developer">
          {boundDeveloper ? (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[#e8eaed] bg-[#f9fafb]">
              <DeveloperLogo url={boundDeveloper.logo_url} name={boundDeveloper.name} size={32} />
              <span className="flex-1 text-sm font-semibold text-[#111827] truncate">{boundDeveloper.name}</span>
              {boundDeveloper.is_verified && <ShieldCheck className="w-4 h-4 text-emerald-500" />}
            </div>
          ) : (
            <DeveloperPicker
              developers={developers}
              value={chosen}
              pendingNewName={newName}
              onSelectExisting={(d) => { setChosen(d); setNewName(null) }}
              onCreateNew={(name) => { setNewName(name); setChosen(null) }}
            />
          )}
        </Field>

        {/* Google one-click — disabled until a developer is selected */}
        <JoinGoogleButton
          token={token}
          developerId={boundDeveloper ? null : chosen?.id ?? null}
          newDeveloperName={boundDeveloper ? null : newName}
          disabled={!hasSelection}
        />

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
          className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 bg-[#001f3f] hover:bg-[#002952] text-white text-sm font-bold rounded-xl shadow-[0_4px_14px_-2px_rgba(0,31,63,0.40)] hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 transition-all duration-200"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {submitting ? "Creating account…" : "Create account"}
          {!submitting && <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    </SplitLayout>
  )
}
