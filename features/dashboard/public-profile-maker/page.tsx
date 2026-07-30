"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle, ArrowDown, ArrowUp, CheckCircle2, Globe, Link2, Loader2,
  Plus, Save, Trash2,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { roleToLabel } from "@/lib/app-roles"
import {
  CUSTOM_LINKS_MAX, LINK_LABEL_MAX, SOCIAL_PLATFORMS, TAGLINE_MAX,
  normalizeLinkLabel, normalizeLinkUrl, normalizeSocialUrl, normalizeTagline,
  readCustomLinks, readSocialLinks, readTagline,
  type CustomLink, type SocialLinks,
} from "@/lib/public-profile"
import { SOCIAL_ICONS } from "@/features/business-card/social-icons"
import { PublicProfile, type PublicProfileData } from "@/features/business-card/public-profile"
import { ShareProfileLink } from "./share-profile-link"

/**
 * Public Profile Maker — edits the one page an agent actually shares
 * (app/business-card/[id]) and previews it live.
 *
 * Only the social links are editable here. Name and photo come from Profile
 * settings, phone and card design from the Business Card page; duplicating those
 * inputs would give two places to change the same value and no way to tell which
 * one won.
 */

const DISPLAY = "font-[family-name:var(--font-outfit)]"
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

type SaveState = "idle" | "saving" | "success" | "error"

type ButtonRow = CustomLink & { rowId: string }

/** Monotonic, module-level: never reachable from render, so it stays pure. */
let rowSeq = 0
function newRowId(): string {
  rowSeq += 1
  return `row-${rowSeq}`
}
function toRow(link: CustomLink): ButtonRow {
  return { ...link, rowId: newRowId() }
}

export default function PublicProfileMakerPage() {
  const router = useRouter()
  const { user, profile } = useAuth()

  // Raw as typed — normalised on save (and again server-side, which is the
  // authority). Kept separate from the saved values so a half-typed handle never
  // has to be valid.
  //
  // Seeded lazily rather than from an effect: auth-context is populated from
  // server-passed props, so `profile` is already there on the first render.
  const [socials, setSocials] = useState<Record<string, string>>(
    () => readSocialLinks(profile?.metadata) as Record<string, string>,
  )
  const [tagline, setTagline] = useState(() => readTagline(profile?.metadata))

  // Buttons carry a client-side row id so an input keeps its identity while the
  // list is edited or reordered; only {label, url} is ever sent.
  const [buttons, setButtons] = useState<ButtonRow[]>(
    () => readCustomLinks(profile?.metadata).map(toRow),
  )
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [saveError, setSaveError] = useState("")

  // Clear the "Saved" chip on a timer rather than from the effect body.
  useEffect(() => {
    if (saveState !== "success") return
    const t = setTimeout(() => setSaveState("idle"), 3000)
    return () => clearTimeout(t)
  }, [saveState])

  const handleSave = useCallback(async () => {
    if (!user?.id) return
    setSaveState("saving")
    setSaveError("")
    try {
      // Normalise before sending. The route rejects the WHOLE payload on one
      // bad link, so posting raw input meant a half-typed handle also threw away
      // the tagline. Unrecognised values are dropped here and flagged in the
      // form instead — the save itself always goes through.
      const cleanSocials: Record<string, string> = {}
      for (const p of SOCIAL_PLATFORMS) {
        const url = normalizeSocialUrl(p.id, socials[p.id] ?? "")
        if (url) cleanSocials[p.id] = url
      }

      // Same reason as the socials: send only rows the server will keep, so a
      // half-typed button never costs the agent the rest of the save.
      const cleanLinks: CustomLink[] = []
      for (const b of buttons) {
        const label = normalizeLinkLabel(b.label)
        const url = normalizeLinkUrl(b.url)
        if (label && url) cleanLinks.push({ label, url })
      }

      const res = await fetch(`${API_BASE}/api/me/contact`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socials: cleanSocials, tagline, links: cleanLinks }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Error ${res.status}`)
      }
      setSaveState("success")
      router.refresh()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed")
      setSaveState("error")
    }
  }, [socials, tagline, buttons, user?.id, router])

  // ── Preview data ─────────────────────────────────────────────────────────
  const fullName = profile?.fullname ?? user?.email?.split("@")[0] ?? ""
  const rawAvatar = profile?.profile_url?.trim() ?? ""
  const meta = (profile?.metadata as Record<string, unknown> | null) ?? {}
  const countryCode = typeof meta.phone_country_code === "string" ? meta.phone_country_code : "+971"
  const phoneNumber = typeof meta.phone_number === "string" ? meta.phone_number : ""

  const previewData: PublicProfileData = useMemo(() => {
    // Preview only the links that would actually survive a save, so what is on
    // screen is what a visitor gets — not what was typed.
    const normalised: SocialLinks = {}
    for (const p of SOCIAL_PLATFORMS) {
      const url = normalizeSocialUrl(p.id, socials[p.id] ?? "")
      if (url) normalised[p.id] = url
    }
    return {
      id: user?.id ?? "",
      fullname: fullName,
      initials:
        [profile?.fname, profile?.lname]
          .map((p) => (p ?? "").trim().charAt(0).toUpperCase())
          .join("") || fullName.trim().charAt(0).toUpperCase(),
      roleLabel: roleToLabel(profile?.role),
      email: user?.email?.toLowerCase() ?? "",
      countryCode,
      phoneNumber,
      // Session-scoped same-origin proxy — the card canvas can't read S3/Google
      // avatars cross-origin.
      avatarUrl: rawAvatar ? (rawAvatar.startsWith("/") ? rawAvatar : `${API_BASE}/api/me/avatar`) : null,
      tagline: normalizeTagline(tagline),
      // Preview only rows that would survive a save.
      links: buttons.flatMap((b) => {
        const label = normalizeLinkLabel(b.label)
        const url = normalizeLinkUrl(b.url)
        return label && url ? [{ label, url }] : []
      }),
      socials: normalised,
    }
  }, [
    socials, tagline, buttons, fullName, rawAvatar, countryCode, phoneNumber,
    profile?.fname, profile?.lname, profile?.role, user?.id, user?.email,
  ])

  const filledCount = SOCIAL_PLATFORMS.filter((p) => (socials[p.id] ?? "").trim()).length
  const addButton = () =>
    setButtons((prev) =>
      prev.length >= CUSTOM_LINKS_MAX ? prev : [...prev, { rowId: newRowId(), label: "", url: "" }],
    )
  const updateButton = (rowId: string, patch: Partial<CustomLink>) =>
    setButtons((prev) => prev.map((b) => (b.rowId === rowId ? { ...b, ...patch } : b)))
  const removeButton = (rowId: string) =>
    setButtons((prev) => prev.filter((b) => b.rowId !== rowId))
  /** Order on this list is order on the page, so it has to be changeable. */
  const moveButton = (index: number, delta: number) =>
    setButtons((prev) => {
      const to = index + delta
      if (to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const [row] = next.splice(index, 1)
      next.splice(to, 0, row)
      return next
    })

  const invalidPlatforms = SOCIAL_PLATFORMS.filter((p) => {
    const typed = (socials[p.id] ?? "").trim()
    return Boolean(typed) && !normalizeSocialUrl(p.id, typed)
  })
  const inputBase =
    "w-full px-4 py-3 rounded-xl border text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:ring-4 transition-all duration-200 border-[#e5e7eb] bg-[#f9fafb] focus:border-[#001f3f] focus:bg-white focus:ring-[#001f3f]/6"

  return (
    <>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="mb-7">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#001f3f] flex items-center justify-center">
            <Globe className="w-5 h-5 text-[#d6b357]" />
          </div>
          <div>
            <h1 className={`${DISPLAY} text-xl font-bold text-[#0d1117]`}>Public Profile Maker</h1>
            <p className="text-sm text-[#9ca3af]">
              Build the one link you share — your photo, contact details, social accounts and business card, on a single page
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-6">

        {/* ══ LEFT – link + editor ═════════════════════════════════════════ */}
        <div className="space-y-5 min-w-0">

          <ShareProfileLink profileId={user?.id ?? null} />

          {/* Tagline */}
          <div className="bg-white rounded-2xl border border-[#e4e7ec] shadow-[0_2px_16px_-4px_rgba(0,31,63,0.08)] overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-[#f0f2f5]">
              <h2 className={`${DISPLAY} text-base font-bold text-[#0d1117]`}>Tagline</h2>
              <p className="text-xs text-[#9ca3af] mt-0.5">
                One line under your name. What you do, and who you do it for.
              </p>
            </div>
            <div className="px-6 py-5 space-y-2">
              <textarea
                id="tagline"
                rows={2}
                maxLength={TAGLINE_MAX}
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Helping families find their first home in Dubai."
                aria-label="Your tagline"
                className={`${inputBase} resize-none leading-snug`}
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-[#9ca3af]">
                  Leave it blank to show just your name.
                </p>
                <span
                  className={`text-[11px] font-semibold tabular-nums shrink-0 ${
                    tagline.length > TAGLINE_MAX - 20 ? "text-amber-600" : "text-[#9ca3af]"
                  }`}
                >
                  {tagline.length} / {TAGLINE_MAX}
                </span>
              </div>
            </div>
          </div>

          {/* Custom buttons */}
          <div className="bg-white rounded-2xl border border-[#e4e7ec] shadow-[0_2px_16px_-4px_rgba(0,31,63,0.08)] overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-[#f0f2f5] flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div>
                <h2 className={`${DISPLAY} text-base font-bold text-[#0d1117]`}>Buttons</h2>
                <p className="text-xs text-[#9ca3af] mt-0.5">
                  Your own links, in this order, above the built-in ones. Anything you&apos;d send a
                  client — a listing, a brochure, a booking form.
                </p>
              </div>
              <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-[#6b7280] bg-[#f0f2f5] rounded-full px-2.5 py-1">
                {buttons.length} of {CUSTOM_LINKS_MAX}
              </span>
            </div>

            <div className="px-6 py-5 space-y-3">
              {buttons.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#d1d5db] px-4 py-8 text-center">
                  <span className="w-10 h-10 rounded-xl bg-[#001f3f]/5 text-[#001f3f] flex items-center justify-center mx-auto mb-2.5">
                    <Link2 className="w-5 h-5" />
                  </span>
                  <p className="text-sm text-[#6b7280]">No buttons yet. Add your first one below.</p>
                </div>
              )}

              {buttons.map((b, i) => {
                const labelOk = Boolean(normalizeLinkLabel(b.label))
                const urlTyped = b.url.trim()
                const urlOk = Boolean(normalizeLinkUrl(b.url))
                const urlBad = Boolean(urlTyped) && !urlOk
                return (
                  <div key={b.rowId} className="rounded-xl border border-[#e5e7eb] bg-[#fcfcfd] p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0 space-y-2">
                        <input
                          type="text"
                          value={b.label}
                          maxLength={LINK_LABEL_MAX}
                          onChange={(e) => updateButton(b.rowId, { label: e.target.value })}
                          placeholder="Button label — e.g. Browse my listings"
                          aria-label={`Button ${i + 1} label`}
                          className={`${inputBase} !bg-white`}
                        />
                        <input
                          type="text"
                          inputMode="url"
                          autoComplete="off"
                          spellCheck={false}
                          value={b.url}
                          onChange={(e) => updateButton(b.rowId, { url: e.target.value })}
                          placeholder="fhiglobal.ae/buy"
                          aria-label={`Button ${i + 1} link`}
                          aria-invalid={urlBad}
                          className={
                            urlBad
                              ? `${inputBase} !border-rose-300 !bg-rose-50 focus:!border-rose-500 focus:!ring-rose-500/10`
                              : `${inputBase} !bg-white`
                          }
                        />
                      </div>

                      {/* Reorder + remove */}
                      <div className="shrink-0 flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => moveButton(i, -1)}
                          disabled={i === 0}
                          aria-label={`Move button ${i + 1} up`}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#6b7280] hover:bg-[#eef1f5] hover:text-[#001f3f] disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveButton(i, 1)}
                          disabled={i === buttons.length - 1}
                          aria-label={`Move button ${i + 1} down`}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#6b7280] hover:bg-[#eef1f5] hover:text-[#001f3f] disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeButton(b.rowId)}
                          aria-label={`Remove button ${i + 1}`}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#9ca3af] hover:bg-rose-50 hover:text-rose-600 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {urlBad && (
                      <p className="mt-2 text-[11px] text-rose-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        Enter a web address, like fhiglobal.ae/buy
                      </p>
                    )}
                    {!labelOk && urlOk && (
                      <p className="mt-2 text-[11px] text-amber-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        Give it a label so it has something to say
                      </p>
                    )}
                  </div>
                )
              })}

              <button
                type="button"
                onClick={addButton}
                disabled={buttons.length >= CUSTOM_LINKS_MAX}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-[#c4c9d4] text-sm font-semibold text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] hover:bg-[#f8faff] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[#c4c9d4] disabled:hover:bg-transparent transition-all"
              >
                <Plus className="w-4 h-4" />
                {buttons.length >= CUSTOM_LINKS_MAX ? `That's all ${CUSTOM_LINKS_MAX}` : "Add a button"}
              </button>
            </div>
          </div>

          {/* Social links */}
          <div className="bg-white rounded-2xl border border-[#e4e7ec] shadow-[0_2px_16px_-4px_rgba(0,31,63,0.08)] overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-[#f0f2f5] flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div>
                <h2 className={`${DISPLAY} text-base font-bold text-[#0d1117]`}>Social Accounts</h2>
                <p className="text-xs text-[#9ca3af] mt-0.5">
                  These become the icon row at the bottom of your page. A username is enough — leave the rest blank.
                </p>
              </div>
              <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-[#6b7280] bg-[#f0f2f5] rounded-full px-2.5 py-1">
                {filledCount} of {SOCIAL_PLATFORMS.length}
              </span>
            </div>

            <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SOCIAL_PLATFORMS.map((p) => {
                const Icon = SOCIAL_ICONS[p.id]
                const typed = (socials[p.id] ?? "").trim()
                const resolved = typed ? normalizeSocialUrl(p.id, typed) : null
                const bad = Boolean(typed) && !resolved
                return (
                  <div key={p.id} className="space-y-1.5">
                    <label
                      htmlFor={`social-${p.id}`}
                      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#374151]"
                    >
                      <Icon className="w-3.5 h-3.5 text-[#6b7280]" />
                      {p.label}
                    </label>
                    <input
                      id={`social-${p.id}`}
                      type="text"
                      inputMode="url"
                      autoComplete="off"
                      spellCheck={false}
                      value={socials[p.id] ?? ""}
                      onChange={(e) => setSocials((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      placeholder={p.placeholder}
                      aria-invalid={bad}
                      className={
                        bad
                          ? `${inputBase} !border-rose-300 !bg-rose-50 focus:!border-rose-500 focus:!ring-rose-500/10`
                          : inputBase
                      }
                    />
                    {bad && (
                      <p className="text-[11px] text-rose-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        Use your username, or a full {p.label} URL
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

          </div>

          {/* One save for both sections above. */}
          <div className="bg-white rounded-2xl border border-[#e4e7ec] shadow-[0_2px_16px_-4px_rgba(0,31,63,0.08)] px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
            {saveState === "success" && (
              invalidPlatforms.length > 0 ? (
                <span className="text-sm text-amber-700 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Saved, but {invalidPlatforms.map((p) => p.label).join(" and ")} wasn&apos;t recognised
                </span>
              ) : (
                <span className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Saved — your page is live
                </span>
              )
            )}
            {saveState === "error" && (
              <span className="text-sm text-rose-600 flex items-center gap-1.5 min-w-0 truncate">
                <AlertCircle className="w-4 h-4 shrink-0" /> {saveError}
              </span>
            )}
            {(saveState === "idle" || saveState === "saving") && (
              <span className="text-xs text-[#9ca3af]">
                {invalidPlatforms.length > 0
                  ? `Everything else saves — fix the highlighted ${invalidPlatforms.length === 1 ? "field" : "fields"} to include ${invalidPlatforms.length === 1 ? "it" : "them"}.`
                  : "Changes go live the moment you save."}
              </span>
            )}

            <button
              onClick={handleSave}
              disabled={saveState === "saving"}
              className="ml-auto flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#001f3f] hover:bg-[#002952] text-white text-sm font-bold shadow-[0_4px_12px_-2px_rgba(0,31,63,0.35)] hover:shadow-[0_6px_18px_-2px_rgba(0,31,63,0.45)] hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none transition-all duration-200"
            >
              {saveState === "saving"
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                : <><Save className="w-4 h-4" /> Save Changes</>
              }
            </button>
          </div>
        </div>

        {/* ══ RIGHT – live preview ═════════════════════════════════════════ */}
        <div className="space-y-3">
         

          {/* Phone frame. The preview is the real page component, not a mock. */}
          <div className="mx-auto w-full max-w-[390px] rounded-[2.25rem] bg-[#0d1117] p-3 shadow-[0_18px_50px_-16px_rgba(0,31,63,0.55)]">
            <div className="relative h-[680px] rounded-[1.75rem] overflow-y-auto overscroll-contain bg-[#001f3f]">
              {user?.id ? (
                <PublicProfile data={previewData} embedded />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-[#d6b357] animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
