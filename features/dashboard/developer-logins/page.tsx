"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Building2, Check, Clock, Copy, Eye, EyeOff, Info, KeyRound, Loader2, RefreshCw, Search, ShieldCheck, UserPlus, X } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { isAdminStaffRole } from "@/lib/app-roles"
import { SITE_URL } from "@/lib/seo"
import { STATUS_COLORS } from "@/lib/user-service"
import { DeveloperAccountDialog, type AccountPreset } from "@/features/dashboard/developers/developer-account-dialog"
import type { CompanyWithoutLogin, DeveloperLogin } from "@/lib/developer-logins"

/**
 * Admin → Developers Login: every developer partner's sign-in in one list —
 * the username (or email) they type, where they sign in, when they last did,
 * and when the password was last set (GET /api/admin/developer-logins).
 * "Set new password" makes one, saves it through the Account Directory's
 * POST /api/admin/users/[id]/password and hands over a copy-ready message.
 * Supabase Auth keeps only a one-way hash, so the app also keeps an encrypted
 * copy of every password an admin sets (lib/developer-login-secrets.ts) — the
 * row's Show button (POST /api/admin/developer-logins/[id]/reveal, logged on
 * every view). Passwords from before that existed, and ones developers chose
 * themselves, can't be shown. Active companies with no login yet sit
 * underneath, with the Developers page's Create Account dialog.
 */

type Method = DeveloperLogin["method"]
/** The login details an admin copies and sends to the developer. */
type Handover = { company: string; method: Method; login: string; password: string; saved: boolean }

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric" }) : "—"

const signInPath = (m: Method) => (m === "username" ? "/developers-login" : "/staff-login")
const signInUrl = (m: Method) => `${SITE_URL.replace(/\/$/, "")}${signInPath(m)}`

function handoverMessage(h: Handover): string {
  return [
    `FHI Global developer portal — ${h.company}`,
    `Sign in at: ${signInUrl(h.method)}`,
    `${h.method === "username" ? "Username" : "Email"}: ${h.login}`,
    `Password: ${h.password}`,
    "You can change the password any time in Profile Settings once you're signed in.",
  ].join("\n")
}

// No look-alikes (I/l/1, O/0) — developers read these off a message and type them.
const PW_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"

/** Three groups of four (≈69 bits), with an upper, a lower and a digit. */
function suggestPassword(): string {
  const limit = 256 - (256 % PW_ALPHABET.length) // keeps every character equally likely
  for (;;) {
    const chars: string[] = []
    const buf = new Uint8Array(24)
    while (chars.length < 12) {
      crypto.getRandomValues(buf)
      for (const b of buf) if (b < limit && chars.length < 12) chars.push(PW_ALPHABET[b % PW_ALPHABET.length])
    }
    const pw = [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8)].map((g) => g.join("")).join("-")
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw)) return pw
  }
}

type LoginsResponse = { accounts: DeveloperLogin[]; companiesWithoutLogin: CompanyWithoutLogin[] }

async function fetchLogins(): Promise<LoginsResponse> {
  const res = await fetch("/api/admin/developer-logins", { cache: "no-store" })
  const json = (await res.json().catch(() => ({}))) as Partial<LoginsResponse> & { error?: string }
  if (!res.ok || !json.accounts) throw new Error(json.error ?? `Request failed (${res.status}).`)
  return { accounts: json.accounts, companiesWithoutLogin: json.companiesWithoutLogin ?? [] }
}

function StatusChip({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.pending
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-bold capitalize ${c.bg} ${c.text} ${c.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {status}
    </span>
  )
}

function CompanyLogo({ name, logo }: { name: string; logo: string | null }) {
  return logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt="" className="h-10 w-10 shrink-0 rounded-xl border border-[#eef0f2] bg-white object-contain p-1" />
  ) : (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#001f3f] to-[#003366] text-sm font-bold text-white">
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

function CopyButton({ text, label, solid }: { text: string; label?: string; solid?: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      },
      () => {},
    )
  }
  if (solid) {
    return (
      <button
        type="button"
        onClick={copy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#001f3f] px-5 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#002b57]"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied — paste it to the developer" : label}
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label ?? "Copy"}
      title={label ?? "Copy"}
      className={`inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition-colors ${copied ? "bg-emerald-50 text-emerald-700" : "text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#001f3f]"}`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : null}
    </button>
  )
}

// Rendered only after a click, so document always exists here. `sticky` keeps a
// stray click outside from closing a window that shows a password still to copy.
function Modal({ onClose, sticky, children }: { onClose: () => void; sticky?: boolean; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={sticky ? undefined : onClose} aria-hidden />
      <div role="dialog" aria-modal="true" className="relative flex max-h-[95dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-w-[520px] sm:rounded-[28px]">
        {children}
      </div>
    </div>,
    document.body,
  )
}

function ModalHeader({ icon: Icon, tone, title, subtitle, onClose }: { icon: typeof KeyRound; tone: string; title: string; subtitle: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#f0f0f0] px-6 pb-4 pt-6">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tone}`}>
          <Icon className="h-5 w-5 text-white" />
        </span>
        <div className="min-w-0">
          <h3 className="truncate font-['Outfit'] text-lg font-bold text-[#0d1117]">{title}</h3>
          <p className="truncate text-xs text-[#6b7280]">{subtitle}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e5e5e5] text-[#6b7280] transition-all hover:border-[#0d1117] hover:text-[#0d1117]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

/** The details to send: each line copyable, plus the whole message in one go. */
function HandoverCard({ h }: { h: Handover }) {
  const rows = [
    { label: "Sign in at", value: signInUrl(h.method) },
    { label: h.method === "username" ? "Username" : "Email", value: h.login },
    { label: "Password", value: h.password },
  ]
  return (
    <div className="space-y-4">
      <div className="divide-y divide-[#eef0f2] rounded-2xl border border-[#eef0f2] bg-[#f9fafb]">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#9ca3af]">{r.label}</p>
              <p className="break-all font-mono text-sm font-semibold text-[#0d1117]">{r.value}</p>
            </div>
            <CopyButton text={r.value} label={`Copy ${r.label.toLowerCase()}`} />
          </div>
        ))}
      </div>
      <CopyButton solid text={handoverMessage(h)} label="Copy the whole message" />
      {h.saved ? (
        <p className="flex gap-2 rounded-xl bg-[#001f3f]/[0.04] px-3 py-2.5 text-xs font-medium text-[#374151]">
          <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#001f3f]" />
          Also saved, encrypted — press Show on this login in the list any time to see it again.
        </p>
      ) : (
        <p className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Copy it now — it couldn&apos;t be saved for Show, so it won&apos;t be shown again. If it gets lost, just set a new one.
        </p>
      )}
    </div>
  )
}

function SetPasswordDialog({ account, onClose, onSet }: { account: DeveloperLogin; onClose: () => void; onSet: () => void }) {
  const [password, setPassword] = useState(suggestPassword)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [saved, setSaved] = useState(false)
  const company = account.company?.name ?? account.name

  const save = async () => {
    const pw = password.trim()
    if (pw.length < 8) {
      setError("Use at least 8 characters.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${account.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string; saved?: boolean }
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status}).`)
      setPassword(pw)
      setSaved(json.saved === true)
      setDone(true)
      onSet()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <Modal onClose={onClose} sticky>
        <ModalHeader icon={Check} tone="bg-emerald-600" title="New password set" subtitle={`${company} · their old password no longer works`} onClose={onClose} />
        <div className="overflow-y-auto px-6 py-5">
          <HandoverCard h={{ company, method: account.method, login: account.login, password, saved }} />
        </div>
        <div className="flex justify-end border-t border-[#f0f0f0] px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-full border border-[#e5e5e5] px-6 py-3 text-sm font-semibold text-[#374151] transition-all hover:border-[#001f3f] hover:text-[#001f3f]">
            Done
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon={KeyRound} tone="bg-[#001f3f]" title="Set a new password" subtitle={`${company} · ${account.login}`} onClose={onClose} />
      <div className="space-y-4 overflow-y-auto px-6 py-5">
        <div>
          <label htmlFor="dev-new-password" className="mb-2 ml-1 block text-xs font-bold uppercase tracking-wider text-[#374151]">
            New password
          </label>
          <div className="flex gap-2">
            <input
              id="dev-new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 font-mono text-sm font-semibold tracking-wide text-[#0d1117] focus:border-[#001f3f] focus:outline-none focus:ring-4 focus:ring-[#001f3f]/5"
            />
            <button
              type="button"
              onClick={() => setPassword(suggestPassword())}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl border border-[#e5e5e5] px-3.5 text-xs font-semibold text-[#374151] transition-colors hover:border-[#001f3f] hover:text-[#001f3f]"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Another
            </button>
          </div>
          <p className="ml-1 mt-1.5 text-[11px] text-[#9ca3af]">A strong one is suggested — keep it, press Another, or type your own (8+ characters).</p>
        </div>
        <p className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Their current password stops working as soon as you save. Next you&apos;ll get the login details to copy and send.
        </p>
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700">{error}</p>}
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-[#f0f0f0] px-6 py-4">
        <button type="button" onClick={onClose} className="rounded-full border border-[#e5e5e5] px-6 py-3 text-sm font-semibold text-[#374151] transition-all hover:border-[#001f3f] hover:text-[#001f3f]">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="flex items-center gap-2 rounded-full bg-[#001f3f] px-7 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#002b57] disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {busy ? "Saving…" : "Set password"}
        </button>
      </div>
    </Modal>
  )
}

/** The Password column: dots, and Show for a password an admin set that the app kept. */
function PasswordCell({ account }: { account: DeveloperLogin }) {
  const [shown, setShown] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setShown(null)
  }

  const show = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/developer-logins/${account.id}/reveal`, { method: "POST", cache: "no-store" })
      const json = (await res.json().catch(() => ({}))) as { password?: string; error?: string }
      if (!res.ok || !json.password) throw new Error(json.error ?? `Request failed (${res.status}).`)
      setShown(json.password)
      // Back to dots after a minute, so it doesn't sit on screen.
      if (hideTimer.current) clearTimeout(hideTimer.current)
      hideTimer.current = setTimeout(() => setShown(null), 60_000)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (account.method === "google") return <p className="text-sm text-[#6b7280]">Signs in with Google — no password</p>

  return (
    <>
      <div className="flex min-w-0 items-center gap-1">
        {shown ? (
          <>
            <span className="truncate font-mono text-[13px] font-semibold text-[#0d1117]">{shown}</span>
            <CopyButton text={shown} label="Copy password" />
            <button
              type="button"
              onClick={hide}
              aria-label="Hide password"
              title="Hide"
              className="inline-flex h-7 shrink-0 items-center justify-center rounded-lg px-2 text-[#9ca3af] transition-colors hover:bg-[#f3f4f6] hover:text-[#001f3f]"
            >
              <EyeOff className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <span
              className="font-mono text-sm tracking-[0.2em] text-[#9ca3af]"
              aria-label="Hidden"
              title={
                account.savedPassword
                  ? undefined
                  : account.passwordSetBy === "the developer"
                    ? "Their own password — only they know it"
                    : "Can't be shown — press Set new password to see it here"
              }
            >
              ••••••••
            </span>
            {account.savedPassword && (
              <button
                type="button"
                onClick={() => void show()}
                disabled={busy}
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-[#001f3f] transition-colors hover:bg-[#001f3f]/5 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} Show
              </button>
            )}
          </>
        )}
      </div>
      {error && <p className="text-[11px] font-semibold text-rose-600">{error}</p>}
    </>
  )
}

export default function DeveloperLoginsPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))

  const [accounts, setAccounts] = useState<DeveloperLogin[] | null>(null)
  const [noLogin, setNoLogin] = useState<CompanyWithoutLogin[]>([])
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState("")
  const [resetFor, setResetFor] = useState<DeveloperLogin | null>(null)
  const [createFor, setCreateFor] = useState<AccountPreset>(null)
  const [created, setCreated] = useState<Handover | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const apply = useCallback((r: LoginsResponse) => {
    setAccounts(r.accounts)
    setNoLogin(r.companiesWithoutLogin)
    setError(null)
  }, [])
  const fail = useCallback((e: unknown) => setError((e as Error).message), [])
  const load = useCallback(() => fetchLogins().then(apply, fail), [apply, fail])

  useEffect(() => {
    if (!allowed) return
    fetchLogins().then(apply, fail)
  }, [allowed, apply, fail])

  const closeReset = useCallback(() => setResetFor(null), [])
  const closeCreated = useCallback(() => setCreated(null), [])
  const reload = useCallback(() => void load(), [load])

  const q = query.trim().toLowerCase()
  const shown = useMemo(
    () => (accounts ?? []).filter((a) => !q || [a.company?.name, a.name, a.login].some((v) => v?.toLowerCase().includes(q))),
    [accounts, q],
  )
  const shownNoLogin = useMemo(() => noLogin.filter((c) => !q || c.name.toLowerCase().includes(q)), [noLogin, q])

  if (!allowed) return null

  const stats = accounts
    ? [
        { icon: KeyRound, label: "Developer logins", value: accounts.length, tone: "text-[#001f3f] bg-[#001f3f]/5 border-[#001f3f]/15" },
        { icon: ShieldCheck, label: "Signed in themselves", value: accounts.filter((a) => a.lastSignInAt).length, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
        { icon: Clock, label: "Never signed in", value: accounts.filter((a) => !a.lastSignInAt).length, tone: "text-amber-700 bg-amber-50 border-amber-200" },
        { icon: Building2, label: "Companies with no login", value: noLogin.length, tone: "text-[#8a6d2b] bg-[#d6b357]/15 border-[#d6b357]/40" },
      ]
    : []

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 4000)
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-['Outfit'] text-2xl font-bold text-[#0d1117]">
            <KeyRound className="h-6 w-6 text-[#001f3f]" />
            Developers Login
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-[#6b7280]">
            Every developer partner&apos;s sign-in — the username or email they use, when they last signed in, and a new password whenever one is needed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setRefreshing(true)
            void load().finally(() => setRefreshing(false))
          }}
          disabled={refreshing || accounts === null}
          className="inline-flex items-center gap-1.5 self-start rounded-lg bg-[#f4f6f9] px-3 py-2 text-xs font-semibold text-[#6b7280] transition-colors hover:bg-[#e8eaed] hover:text-[#001f3f] disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="flex gap-3 rounded-2xl border border-[#001f3f]/10 bg-[#001f3f]/[0.03] px-4 py-3.5 text-sm text-[#374151]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#001f3f]" />
        <p>
          <span className="font-semibold text-[#0d1117]">Show</span> works for every password an admin sets from 2 Oct 2026 on — kept encrypted, visible to
          admins only, and every view goes into the Activity Logs. Older ones (John&apos;s from 5 Aug) can&apos;t be shown: press{" "}
          <span className="font-semibold text-[#0d1117]">Set new password</span> once and Show works from then on. A password a developer changes
          themselves stays private to them. Username logins sign in at{" "}
          <span className="font-mono text-[13px] font-semibold text-[#001f3f]">{signInUrl("username").replace(/^https?:\/\//, "")}</span>.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(accounts ? stats : Array.from({ length: 4 }, () => null)).map((s, i) =>
          s ? (
            <div key={s.label} className="rounded-2xl border border-[#e8eaed] bg-white px-4 py-4">
              <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${s.tone}`}>
                <s.icon className="h-4 w-4" />
              </span>
              <p className="mt-3 font-['Outfit'] text-3xl font-bold text-[#0d1117]">{s.value}</p>
              <p className="mt-0.5 text-xs font-semibold text-[#6b7280]">{s.label}</p>
            </div>
          ) : (
            <div key={i} className="h-[118px] animate-pulse rounded-2xl border border-[#e8eaed] bg-white" />
          ),
        )}
      </div>

      <div className="rounded-2xl border border-[#e8eaed] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#f0f0f0] p-5 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="font-['Outfit'] text-base font-bold text-[#0d1117]">Logins{accounts ? ` (${shown.length})` : ""}</h2>
          <div className="relative lg:w-80">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search company or username…"
              className="w-full rounded-xl border border-[#e5e5e5] py-2.5 pl-10 pr-4 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#001f3f] focus:outline-none"
            />
          </div>
        </div>

        {accounts === null && !error ? (
          <p className="flex items-center gap-2 px-5 py-8 text-sm text-[#9ca3af]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading developer logins…
          </p>
        ) : error ? (
          <p className="px-5 py-8 text-sm text-[#9ca3af]">Couldn&apos;t load the logins right now. {error}</p>
        ) : shown.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[#9ca3af]">{q ? "No login matches." : "No developer logins yet."}</p>
        ) : (
          <div>
            <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto] gap-4 border-b border-[#f0f0f0] px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-[#9ca3af] lg:grid">
              <span>Company</span>
              <span>Signs in with</span>
              <span>Last sign-in</span>
              <span>Password</span>
              <span className="w-[170px]" />
            </div>
            <ul className="divide-y divide-[#f0f0f0]">
              {shown.map((a) => {
                const company = a.company?.name ?? "No company linked"
                const sameName = a.name.toLowerCase().replace(/\s+/g, "") === company.toLowerCase().replace(/\s+/g, "")
                return (
                  <li key={a.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto] lg:items-center lg:gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <CompanyLogo name={company} logo={a.company?.logo ?? null} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[#0d1117]">{company}</p>
                        {!sameName && <p className="truncate text-xs text-[#6b7280]">{a.name}</p>}
                      </div>
                      {a.status !== "active" && <StatusChip status={a.status} />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1">
                        <span className="truncate font-mono text-[13px] font-semibold text-[#001f3f]">{a.login}</span>
                        <CopyButton text={a.login} label={a.method === "username" ? "Copy username" : "Copy email"} />
                      </div>
                      <p className="text-[11px] text-[#9ca3af]">
                        {a.method === "username" ? "Username" : a.method === "google" ? "Google account" : "Email"} · {signInPath(a.method)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#9ca3af] lg:hidden">Last sign-in</p>
                      {a.lastSignInAt ? (
                        <p className="text-sm text-[#374151]">{fmtDate(a.lastSignInAt)}</p>
                      ) : (
                        <p className="text-sm font-semibold text-amber-700">Never</p>
                      )}
                      {a.adminVisitAt && <p className="text-[11px] text-[#9ca3af]">An admin opened it {fmtDate(a.adminVisitAt)}</p>}
                    </div>

                    <div>
                      <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#9ca3af] lg:hidden">Password</p>
                      {/* Keyed on when it was set, so a new password never shows the old one. */}
                      <PasswordCell key={`${a.id}:${a.passwordSetAt ?? ""}`} account={a} />
                    </div>

                    <div className="lg:w-[170px] lg:text-right">
                      {a.method !== "google" && (
                        <button
                          type="button"
                          onClick={() => setResetFor(a)}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#001f3f]/20 px-3.5 py-2 text-xs font-bold text-[#001f3f] transition-colors hover:bg-[#001f3f] hover:text-white"
                        >
                          <KeyRound className="h-3.5 w-3.5" /> Set new password
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      {accounts && shownNoLogin.length > 0 && (
        <div className="rounded-2xl border border-[#e8eaed] bg-white p-5">
          <h2 className="font-['Outfit'] text-base font-bold text-[#0d1117]">Companies with no login yet ({shownNoLogin.length})</h2>
          <p className="mt-0.5 text-xs text-[#6b7280]">Active developer companies nobody can sign in for.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {shownNoLogin.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-[#eef0f2] px-3 py-2.5">
                <CompanyLogo name={c.name} logo={c.logo} />
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[#0d1117]">{c.name}</p>
                <button
                  type="button"
                  onClick={() => setCreateFor({ id: c.id, name: c.name })}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#001f3f]/20 px-3 py-1.5 text-xs font-bold text-[#001f3f] transition-colors hover:bg-[#001f3f] hover:text-white"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Create login
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {resetFor && <SetPasswordDialog key={resetFor.id} account={resetFor} onClose={closeReset} onSet={reload} />}

      <DeveloperAccountDialog
        open={createFor !== null}
        preset={createFor}
        onClose={() => setCreateFor(null)}
        onSaved={(username, password, saved) => {
          setCreated({ company: createFor?.name ?? "", method: "username", login: username, password, saved })
          setCreateFor(null)
          void load()
        }}
        onError={flash}
      />

      {created && (
        <Modal onClose={closeCreated} sticky>
          <ModalHeader icon={Check} tone="bg-emerald-600" title="Login created" subtitle={`${created.company} can sign in now`} onClose={closeCreated} />
          <div className="overflow-y-auto px-6 py-5">
            <HandoverCard h={created} />
          </div>
          <div className="flex justify-end border-t border-[#f0f0f0] px-6 py-4">
            <button type="button" onClick={closeCreated} className="rounded-full border border-[#e5e5e5] px-6 py-3 text-sm font-semibold text-[#374151] transition-all hover:border-[#001f3f] hover:text-[#001f3f]">
              Done
            </button>
          </div>
        </Modal>
      )}

      {toast &&
        createPortal(
          <div role="status" className="fixed bottom-6 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl bg-[#0d1117] px-4 py-3 text-center text-sm font-semibold text-white shadow-2xl">
            {toast}
          </div>,
          document.body,
        )}
    </div>
  )
}
