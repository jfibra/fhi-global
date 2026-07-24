"use client"

import { useEffect, useMemo, useState } from "react"
import { X, Eye, EyeOff, User, Mail, Lock, Globe, Shield, CheckCircle, UserPlus, Search, Edit3 } from "lucide-react"
import type { UserRecord, CreateUserPayload, UpdateUserPayload } from "@/lib/user-service"
import { ROLE_OPTIONS, STATUS_OPTIONS, TIMEZONES, getUserDisplayName, roleToLabel } from "@/lib/user-service"
import { UserAvatar } from "@/components/user-avatar"
import { PhoneCountrySelect } from "@/components/phone-country-select"

type Mode = "create" | "edit"

type FormField = {
  label: string
  key: string
  type?: string
  required?: boolean
  options?: Array<{ value: string; label: string }>
  span?: boolean
}

type BannerType = "success" | "error"
type DeveloperOption = { id: string; name: string; slug: string }
type ReferrerOption = { id: string; fullname: string; role: string }

// ─── Shared input styling ──────────────────────────────────────────────────────
const INPUT = "w-full px-4 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm text-[#0d1117] bg-white focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 placeholder:text-[#9ca3af] disabled:bg-[#f9fafb] disabled:text-[#9ca3af]"
const LABEL = "block text-[11px] font-bold uppercase tracking-wider text-[#6b7280] mb-1.5 ml-1"
const SELECT = `${INPUT} cursor-pointer appearance-none`

// ─── UserForm ──────────────────────────────────────────────────────────────────
export function UserForm({
  editUser,
  onClose,
  onSaved,
  onBanner,
  initialReadOnly = false,
}: {
  editUser: UserRecord | null
  onClose: () => void
  onSaved: () => void
  onBanner: (type: BannerType, msg: string) => void
  // Opens the edit form in read-only "view" mode with an Edit toggle.
  initialReadOnly?: boolean
}) {
  const mode: Mode = editUser ? "edit" : "create"
  // Read-only view only applies to existing users (edit mode).
  const [readOnly, setReadOnly] = useState(initialReadOnly && !!editUser)

  // Create-mode state
  const [create, setCreate] = useState<CreateUserPayload>({
    email:    "",
    password: "",
    fname:    "",
    mname:    "",
    lname:    "",
    role:     "member",
    developer_id: null,
    timezone: "Asia/Dubai",
    status:   "active",
  })

  // Edit-mode state (mirrors UpdateUserPayload + metadata fields)
  const [edit, setEdit] = useState<UpdateUserPayload & {
    phone_country_code?: string
    phone_number?: string
    whatsapp_country_code?: string
    whatsapp_number?: string
  }>(() => {
    if (!editUser) return {}
    const m = editUser.metadata ?? {}
    const s = (k: string) => (typeof m[k] === "string" ? (m[k] as string) : "")
    return {
      fname:                editUser.fname ?? "",
      mname:                editUser.mname ?? "",
      lname:                editUser.lname ?? "",
      birthday:             editUser.birthday ?? "",
      gender:               editUser.gender ?? "",
      timezone:             editUser.timezone ?? "Asia/Dubai",
      role:                 editUser.role ?? "member",
      developer_id:         s("developer_id") || null,
      status:               editUser.status ?? "active",
      phone_country_code:   s("phone_country_code") || "+971",
      phone_number:         s("phone_number"),
      whatsapp_country_code:s("whatsapp_country_code") || "+971",
      whatsapp_number:      s("whatsapp_number"),
      invited_by:           s("invited_by") || null,
    }
  })

  const [showPwd, setShowPwd] = useState(false)
  const [busy, setBusy] = useState(false)
  const [developers, setDevelopers] = useState<DeveloperOption[]>([])
  const [referrers, setReferrers] = useState<ReferrerOption[]>([])

  useEffect(() => {
    const loadDevelopers = async () => {
      const res = await fetch("/api/admin/developers")
      if (!res.ok) return
      const data = await res.json().catch(() => ({ developers: [] })) as { developers?: DeveloperOption[] }
      setDevelopers(data.developers ?? [])
    }

    void loadDevelopers()
  }, [])

  // Referrer options power the "Referred by" picker (edit mode only). Pass the
  // current referrer id so it's always selectable even if their role changed.
  useEffect(() => {
    if (!editUser) return
    const currentRef = typeof editUser.metadata?.invited_by === "string" ? editUser.metadata.invited_by : ""
    const loadReferrers = async () => {
      const url = currentRef
        ? `/api/admin/users/referrers?include=${encodeURIComponent(currentRef)}`
        : "/api/admin/users/referrers"
      const res = await fetch(url)
      if (!res.ok) return
      const data = await res.json().catch(() => ({ referrers: [] })) as { referrers?: ReferrerOption[] }
      setReferrers((data.referrers ?? []).filter((r) => r.id !== editUser.id))
    }

    void loadReferrers()
  }, [editUser])

  // ── Create handler ───────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!create.email.trim() || !create.password || !create.fname.trim() || !create.lname.trim()) {
      onBanner("error", "Email, password, first name, and last name are required.")
      return
    }
    if (create.role === "developer" && !create.developer_id) {
      onBanner("error", "Please link a developer company for developer role.")
      return
    }
    setBusy(true)
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(create),
    })
    setBusy(false)
    if (res.ok) {
      onSaved()
    } else {
      const data = await res.json().catch(() => ({}))
      onBanner("error", (data as { error?: string }).error ?? "Failed to create user.")
    }
  }

  // ── Edit handler ─────────────────────────────────────────────────────────────
  const handleEdit = async () => {
    if (!editUser) return
    if (edit.role === "developer" && !edit.developer_id) {
      onBanner("error", "Please link a developer company for developer role.")
      return
    }
    setBusy(true)
    const res = await fetch(`/api/admin/users/${editUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edit),
    })
    setBusy(false)
    if (res.ok) {
      onSaved()
    } else {
      const data = await res.json().catch(() => ({}))
      onBanner("error", (data as { error?: string }).error ?? "Failed to update user.")
    }
  }

  const isEdit = mode === "edit"
  const displayName = editUser ? getUserDisplayName(editUser) : ""

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={!busy ? onClose : undefined} />

      <div className="relative z-10 w-full max-w-2xl bg-white/95 backdrop-blur-2xl rounded-[32px] border border-white/60 shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-5 border-b border-[#f0f2f5] shrink-0">
          <div className="flex items-center gap-3">
            {isEdit && (
              <UserAvatar name={displayName} imageUrl={editUser?.profile_url} size={40} />
            )}
            <div>
              <h3 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">
                {readOnly ? "View User" : isEdit ? "Edit User" : "Create New User"}
              </h3>
              <p className="text-xs text-[#9ca3af] mt-0.5">
                {isEdit ? displayName : "Fill in the details to create an account"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#f4f6f9] hover:bg-[#e8eaed] text-[#6b7280] transition-all disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — a disabled fieldset makes every control read-only in view mode */}
        <div className="overflow-y-auto px-7 py-6 space-y-6 flex-1">
          <fieldset disabled={readOnly} className="contents">

          {/* ── Name section ── */}
          <div>
            <SectionLabel icon={User} label="Name" />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={LABEL}>First Name *</label>
                <input
                  type="text"
                  className={INPUT}
                  placeholder="James"
                  value={isEdit ? (edit.fname ?? "") : create.fname}
                  onChange={(e) => isEdit
                    ? setEdit((p) => ({ ...p, fname: e.target.value }))
                    : setCreate((p) => ({ ...p, fname: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className={LABEL}>Middle Name</label>
                <input
                  type="text"
                  className={INPUT}
                  placeholder="K."
                  value={isEdit ? (edit.mname ?? "") : (create.mname ?? "")}
                  onChange={(e) => isEdit
                    ? setEdit((p) => ({ ...p, mname: e.target.value }))
                    : setCreate((p) => ({ ...p, mname: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className={LABEL}>Last Name *</label>
                <input
                  type="text"
                  className={INPUT}
                  placeholder="Smith"
                  value={isEdit ? (edit.lname ?? "") : create.lname}
                  onChange={(e) => isEdit
                    ? setEdit((p) => ({ ...p, lname: e.target.value }))
                    : setCreate((p) => ({ ...p, lname: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          {/* ── Account fields (create only) ── */}
          {!isEdit && (
            <div>
              <SectionLabel icon={Mail} label="Account Credentials" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Email *</label>
                  <input
                    type="email"
                    className={INPUT}
                    placeholder="user@example.com"
                    value={create.email}
                    onChange={(e) => setCreate((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={LABEL}>Password *</label>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      className={`${INPUT} pr-10`}
                      placeholder="Min. 8 characters"
                      value={create.password}
                      onChange={(e) => setCreate((p) => ({ ...p, password: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#6b7280] transition-colors"
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Personal info (edit only) ── */}
          {isEdit && (
            <div>
              <SectionLabel icon={User} label="Personal Information" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Birthday</label>
                  <input
                    type="date"
                    className={INPUT}
                    value={edit.birthday ?? ""}
                    onChange={(e) => setEdit((p) => ({ ...p, birthday: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={LABEL}>Gender</label>
                  <select
                    className={SELECT}
                    value={edit.gender ?? ""}
                    onChange={(e) => setEdit((p) => ({ ...p, gender: e.target.value }))}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ── Phone (edit only) ── */}
          {isEdit && (
            <div>
              <SectionLabel icon={Globe} label="Contact Numbers" />
              <div className="grid grid-cols-2 gap-3">
                <PhoneField
                  label="Phone"
                  countryCode={edit.phone_country_code ?? "+971"}
                  number={edit.phone_number ?? ""}
                  onCountryChange={(v) => setEdit((p) => ({ ...p, phone_country_code: v }))}
                  onNumberChange={(v) => setEdit((p) => ({ ...p, phone_number: v }))}
                />
                <PhoneField
                  label="WhatsApp"
                  countryCode={edit.whatsapp_country_code ?? "+971"}
                  number={edit.whatsapp_number ?? ""}
                  onCountryChange={(v) => setEdit((p) => ({ ...p, whatsapp_country_code: v }))}
                  onNumberChange={(v) => setEdit((p) => ({ ...p, whatsapp_number: v }))}
                />
              </div>
            </div>
          )}

          {/* ── Role & access ── */}
          <div>
            <SectionLabel icon={Shield} label="Role & Access" />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={LABEL}>Role</label>
                <select
                  className={SELECT}
                  value={isEdit ? (edit.role ?? "member") : create.role}
                  onChange={(e) => isEdit
                    ? setEdit((p) => ({ ...p, role: e.target.value, developer_id: e.target.value === "developer" ? (p.developer_id ?? null) : null }))
                    : setCreate((p) => ({ ...p, role: e.target.value, developer_id: e.target.value === "developer" ? (p.developer_id ?? null) : null }))
                  }
                >
                  {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Status</label>
                <select
                  className={SELECT}
                  value={isEdit ? (edit.status ?? "active") : create.status}
                  onChange={(e) => isEdit
                    ? setEdit((p) => ({ ...p, status: e.target.value }))
                    : setCreate((p) => ({ ...p, status: e.target.value }))
                  }
                >
                  {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Timezone</label>
                <select
                  className={SELECT}
                  value={isEdit ? (edit.timezone ?? "Asia/Dubai") : create.timezone}
                  onChange={(e) => isEdit
                    ? setEdit((p) => ({ ...p, timezone: e.target.value }))
                    : setCreate((p) => ({ ...p, timezone: e.target.value }))
                  }
                >
                  {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            {(isEdit ? (edit.role ?? "member") : create.role) === "developer" && (
              <div className="mt-3">
                <label className={LABEL}>Linked Developer Company *</label>
                <select
                  className={SELECT}
                  value={isEdit ? (edit.developer_id ?? "") : (create.developer_id ?? "")}
                  onChange={(e) => isEdit
                    ? setEdit((p) => ({ ...p, developer_id: e.target.value || null }))
                    : setCreate((p) => ({ ...p, developer_id: e.target.value || null }))
                  }
                >
                  <option value="">Select developer</option>
                  {developers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.slug})</option>
                  ))}
                </select>
                <p className="text-[11px] text-[#9ca3af] mt-1 ml-1">
                  Required when role is developer.
                </p>
              </div>
            )}
          </div>

          {/* ── Referred by / Invite attribution (edit only) ── */}
          {isEdit && (
            <div>
              <SectionLabel icon={UserPlus} label="Referred By" />
              <ReferrerPicker
                value={edit.invited_by ?? null}
                referrers={referrers}
                onChange={(v) => setEdit((p) => ({ ...p, invited_by: v }))}
              />
              <p className="text-[11px] text-[#9ca3af] mt-2 ml-1">
                Who invited this user (their invite/referral). Set this for people who
                registered directly instead of through an agent&apos;s invite link — they
                then appear under that agent&apos;s <span className="font-semibold">My Recruits</span>.
              </p>
            </div>
          )}
          </fieldset>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex gap-3 px-7 py-5 border-t border-[#f0f2f5]">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-full font-semibold text-sm border border-[#e5e5e5] bg-white/50 text-[#4b5563] hover:bg-white hover:border-[#001f3f] transition-all disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            {readOnly ? "Close" : "Cancel"}
          </button>
          {readOnly ? (
            <button
              type="button"
              onClick={() => setReadOnly(false)}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-5 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-lg shadow-md"
            >
              <Edit3 className="w-4 h-4" />
              Edit
            </button>
          ) : (
            <button
              type="button"
              onClick={isEdit ? handleEdit : handleCreate}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-5 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-lg shadow-md disabled:opacity-70 disabled:translate-y-0"
            >
              {busy ? (
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              {busy ? "Saving…" : isEdit ? "Save Changes" : "Create User"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-6 h-6 rounded-lg bg-[#f4f6f9] flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-[#001f3f]" />
      </div>
      <span className="text-xs font-bold uppercase tracking-wider text-[#374151]">{label}</span>
    </div>
  )
}

function ReferrerPicker({
  value,
  referrers,
  onChange,
}: {
  value: string | null
  referrers: ReferrerOption[]
  onChange: (v: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const selected = value ? referrers.find((r) => r.id === value) ?? null : null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? referrers.filter(
          (r) => r.fullname.toLowerCase().includes(q) || roleToLabel(r.role).toLowerCase().includes(q),
        )
      : referrers
    return list.slice(0, 50)
  }, [query, referrers])

  // Selected chip with a clear button.
  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-[#e5e5e5] bg-[#f9fafb] px-3.5 py-2.5">
        <UserAvatar name={selected.fullname} size={28} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#0d1117]">{selected.fullname}</p>
          <p className="text-[11px] text-[#9ca3af]">{roleToLabel(selected.role)}</p>
        </div>
        <button
          type="button"
          onClick={() => { onChange(null); setQuery(""); setOpen(false) }}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#6b7280] transition-colors hover:bg-[#fde8e8] hover:text-rose-600"
          aria-label="Remove referrer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  // Search + inline dropdown (inline avoids clipping inside the scrollable modal).
  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
        <input
          type="text"
          className={`${INPUT} pl-10`}
          placeholder="Search an agent, team leader, or admin…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && (
        <div className="mt-1.5 max-h-48 overflow-y-auto rounded-2xl border border-[#e5e5e5] bg-white shadow-sm">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[#9ca3af]">No matching users.</p>
          ) : (
            filtered.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => { onChange(r.id); setOpen(false); setQuery("") }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-[#f4f6f9]"
              >
                <UserAvatar name={r.fullname} size={26} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#0d1117]">{r.fullname}</p>
                  <p className="text-[11px] text-[#9ca3af]">{roleToLabel(r.role)}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function PhoneField({
  label,
  countryCode,
  number,
  onCountryChange,
  onNumberChange,
}: {
  label: string
  countryCode: string
  number: string
  onCountryChange: (v: string) => void
  onNumberChange: (v: string) => void
}) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <div className="flex gap-1.5">
        <PhoneCountrySelect
          value={countryCode}
          onChange={onCountryChange}
          ariaLabel={`${label} country calling code`}
          className="pl-2.5 pr-1 py-2.5 w-24"
        />
        <input
          type="tel"
          placeholder="50 123 4567"
          value={number}
          onChange={(e) => onNumberChange(e.target.value)}
          className={`${INPUT} flex-1`}
        />
      </div>
    </div>
  )
}
