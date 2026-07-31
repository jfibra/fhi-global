"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle, ArrowDown, ArrowUp, CheckCircle2, ChevronLeft, ChevronRight,
  Loader2, Lock, Palette, Plus, Save, Star, SlidersHorizontal, Trash2,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { roleToLabel } from "@/lib/app-roles"
import {
  CUSTOM_LINKS_MAX, FIXED_BUTTONS, LINK_LABEL_MAX, SOCIAL_PLATFORMS, TAGLINE_MAX,
  normalizeLinkLabel, normalizeLinkUrl, normalizeSocialUrl, normalizeTagline,
  readCustomLinks, readFixedButtonLabels, readSocialLinks, readTagline,
  type CustomLink, type FeaturedItem, type FixedButtonKey, type SocialLinks,
} from "@/lib/public-profile"
import { SOCIAL_ICONS } from "@/features/business-card/social-icons"
import { PublicProfile, type PublicProfileData } from "@/features/business-card/public-profile"
import { ShareProfileLink } from "./share-profile-link"
import { FeaturedPanel } from "./featured-panel"
import { DesignTab } from "./design-tab"
import {
  readThemeChoice, resolveTheme, type ThemeChoice,
} from "@/lib/profile-themes"

/**
 * Business Profile Maker — edits the one page an agent actually shares
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

type TabKey = "design" | "forms" | "featured"

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "design", label: "Design", icon: Palette },
  { key: "forms", label: "Forms", icon: SlidersHorizontal },
  { key: "featured", label: "Featured", icon: Star },
]

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
  const [tab, setTab] = useState<TabKey>("design")
  const [theme, setTheme] = useState<ThemeChoice>(() => readThemeChoice(profile?.metadata))
  const [tagline, setTagline] = useState(() => readTagline(profile?.metadata))
  // Wording for the three buttons whose destination is fixed.
  const [fixedLabels, setFixedLabels] = useState<Record<FixedButtonKey, string>>(
    () => readFixedButtonLabels(profile?.metadata),
  )

  // Buttons carry a client-side row id so an input keeps its identity while the
  // list is edited or reordered; only {label, url} is ever sent.
  const [buttons, setButtons] = useState<ButtonRow[]>(
    () => readCustomLinks(profile?.metadata).map(toRow),
  )
  // Reported by the Featured panel, which already has the rows loaded.
  const [featured, setFeatured] = useState<{ listings: FeaturedItem[]; projects: FeaturedItem[] }>({
    listings: [],
    projects: [],
  })
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [saveError, setSaveError] = useState("")

  // Clear the "Saved" chip on a timer rather than from the effect body.
  useEffect(() => {
    if (saveState !== "success") return
    const t = setTimeout(() => setSaveState("idle"), 3000)
    return () => clearTimeout(t)
  }, [saveState])

  /**
   * Everything Save sends, as one comparable string. Compared against the last
   * saved copy so the button can say whether there is anything to save — the
   * page previously offered Save at all times with no way to tell.
   *
   * Recomputed each render rather than memoised: it is a handful of short
   * fields, and a useMemo here would be manual memoization the compiler then
   * has to preserve.
   */
  const snapshot = JSON.stringify({
    tagline,
    socials,
    // rowId is a client-side key, not part of the saved value.
    buttons: buttons.map((b) => ({ label: b.label, url: b.url })),
    fixedLabels,
    theme,
  })
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot)
  const dirty = snapshot !== savedSnapshot

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
        body: JSON.stringify({
          socials: cleanSocials,
          tagline,
          links: cleanLinks,
          fixed_button_labels: fixedLabels,
          theme,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Error ${res.status}`)
      }
      setSavedSnapshot(snapshot)
      setSaveState("success")
      router.refresh()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed")
      setSaveState("error")
    }
  }, [socials, tagline, buttons, fixedLabels, theme, snapshot, user?.id, router])

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
      listings: featured.listings,
      projects: featured.projects,
      // Preview only rows that would survive a save.
      links: buttons.flatMap((b) => {
        const label = normalizeLinkLabel(b.label)
        const url = normalizeLinkUrl(b.url)
        return label && url ? [{ label, url }] : []
      }),
      socials: normalised,
      // Preview the fallback when a field is blank, exactly as the page will.
      buttonLabels: FIXED_BUTTONS.reduce((acc, b) => {
        acc[b.key] = normalizeLinkLabel(fixedLabels[b.key]) || b.fallback
        return acc
      }, {} as Record<FixedButtonKey, string>),
      theme: resolveTheme(theme),
    }
  }, [
    socials, tagline, buttons, featured, fixedLabels, theme, fullName, rawAvatar, countryCode, phoneNumber,
    profile?.fname, profile?.lname, profile?.role, user?.id, user?.email,
  ])

  // Tab order is the sequence the nav walks, so TABS stays the single source.
  const tabIndex = TABS.findIndex((tb) => tb.key === tab)
  const prevTab = tabIndex > 0 ? TABS[tabIndex - 1] : null
  const nextTab = tabIndex < TABS.length - 1 ? TABS[tabIndex + 1] : null

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
    // items-start is what lets the preview column be sticky: a stretched grid
    // item is already as tall as the row, so it would have nothing to stick to.
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start">

        {/* ══ LEFT – link + editor ═════════════════════════════════════════ */}
        <div className="space-y-5 min-w-0">

          <ShareProfileLink profileId={user?.id ?? null} />

          {/* Tabs. Underlined-active rather than a pill group: the sections are
              peers of one editor, not separate destinations. */}
          <div className="border-b border-[#e4e7ec]" role="tablist" aria-label="Profile editor sections">
            {/* No overflow-x-auto: three short tabs always fit, and a scroll
                container here also clipped the active underline, which sits at
                -bottom-px to straddle the row's border. Wraps instead, on the
                off chance a label ever gets long. */}
            <div className="flex flex-wrap items-center gap-1">
              {TABS.map((tb) => {
                const on = tab === tb.key
                return (
                  <button
                    key={tb.key}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setTab(tb.key)}
                    className={`relative inline-flex items-center gap-2 px-3.5 py-3 text-sm font-semibold transition-colors ${
                      on ? "text-[#001f3f]" : "text-[#6b7280] hover:text-[#374151]"
                    }`}
                  >
                    <tb.icon className="w-4 h-4" />
                    {tb.label}
                    <span
                      className={`absolute left-2 right-2 -bottom-px h-0.5 rounded-full transition-opacity ${
                        on ? "bg-[#001f3f] opacity-100" : "opacity-0"
                      }`}
                    />
                  </button>
                )
              })}
            </div>
          </div>

          {tab === "design" && <DesignTab value={theme} onChange={setTheme} />}

          {tab === "forms" && (
            <>
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

            {/* Buttons */}
          <div className="bg-white rounded-2xl border border-[#e4e7ec] shadow-[0_2px_16px_-4px_rgba(0,31,63,0.08)] overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-[#f0f2f5] flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div>
                <h2 className={`${DISPLAY} text-base font-bold text-[#0d1117]`}>Buttons</h2>
                <p className="text-xs text-[#9ca3af] mt-0.5">
                  A label and a link each. The three at the bottom always go where they say, so
                  those take a label only.
                </p>
              </div>
              <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-[#6b7280] bg-[#f0f2f5] rounded-full px-2.5 py-1">
                {buttons.length} of {CUSTOM_LINKS_MAX}
              </span>
            </div>

            <div className="px-6 py-5 space-y-2">
              {buttons.length === 0 && (
                <p className="rounded-xl border border-dashed border-[#d1d5db] px-4 py-6 text-center text-xs text-[#6b7280]">
                  No buttons of your own yet.
                </p>
              )}

              {buttons.map((b, i) => {
                const labelOk = Boolean(normalizeLinkLabel(b.label))
                const urlTyped = b.url.trim()
                const urlOk = Boolean(normalizeLinkUrl(b.url))
                const urlBad = Boolean(urlTyped) && !urlOk
                return (
                  <div key={b.rowId}>
                    {/* One line: label, link, controls. */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <input
                        type="text"
                        value={b.label}
                        maxLength={LINK_LABEL_MAX}
                        onChange={(e) => updateButton(b.rowId, { label: e.target.value })}
                        placeholder="Label"
                        aria-label={`Button ${i + 1} label`}
                        className={`${inputBase} sm:flex-1 sm:min-w-0`}
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
                            ? `${inputBase} sm:flex-1 sm:min-w-0 !border-rose-300 !bg-rose-50 focus:!border-rose-500 focus:!ring-rose-500/10`
                            : `${inputBase} sm:flex-1 sm:min-w-0`
                        }
                      />
                      <span className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveButton(i, -1)}
                          disabled={i === 0}
                          aria-label={`Move button ${i + 1} up`}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#9ca3af] hover:bg-[#eef1f5] hover:text-[#001f3f] disabled:opacity-25 disabled:hover:bg-transparent transition-all"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveButton(i, 1)}
                          disabled={i === buttons.length - 1}
                          aria-label={`Move button ${i + 1} down`}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#9ca3af] hover:bg-[#eef1f5] hover:text-[#001f3f] disabled:opacity-25 disabled:hover:bg-transparent transition-all"
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
                      </span>
                    </div>

                    {urlBad && (
                      <p className="mt-1.5 text-[11px] text-rose-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        Enter a web address, like fhiglobal.ae/buy
                      </p>
                    )}
                    {!labelOk && urlOk && (
                      <p className="mt-1.5 text-[11px] text-amber-600 flex items-center gap-1">
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
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-[#c4c9d4] text-sm font-semibold text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] hover:bg-[#f8faff] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[#c4c9d4] disabled:hover:bg-transparent transition-all"
              >
                <Plus className="w-4 h-4" />
                {buttons.length >= CUSTOM_LINKS_MAX ? `That's all ${CUSTOM_LINKS_MAX}` : "Add a button"}
              </button>
            </div>

            {/* Fixed buttons — one input each, because the label is the only
                part that is the agent's to change. */}
            <div className="px-6 pb-6 pt-4 border-t border-[#f0f2f5] space-y-2">
              {FIXED_BUTTONS.map((b) => (
                <div key={b.key} className="flex flex-col sm:flex-row sm:items-center gap-x-3 gap-y-1">
                  <span className="sm:w-40 shrink-0 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#9ca3af]">
                    <Lock className="w-3 h-3 shrink-0" />
                    {b.destination}
                  </span>
                  <input
                    type="text"
                    value={fixedLabels[b.key]}
                    maxLength={LINK_LABEL_MAX}
                    onChange={(e) => setFixedLabels((prev) => ({ ...prev, [b.key]: e.target.value }))}
                    placeholder={b.fallback}
                    aria-label={`${b.fallback} button label`}
                    className={`${inputBase} flex-1 min-w-0`}
                  />
                </div>
              ))}
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
                      {bad ? (
                        <p className="text-[11px] text-rose-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          Use your username, or a full {p.label} URL
                        </p>
                      ) : (
                        // A bare handle is encouraged, so show where it actually
                        // lands rather than leaving the agent to guess.
                        resolved && (
                          <p className="text-[11px] text-[#9ca3af] truncate" title={resolved}>
                            {resolved.replace(/^https:\/\//, "")}
                          </p>
                        )
                      )}
                    </div>
                  )
                })}
              </div>

            </div>

              </>
          )}

          {/* Mounted always so the preview keeps mirroring the pins, hidden when
              another tab is showing. */}
          <div className={tab === "featured" ? "" : "hidden"}>
            <FeaturedPanel onSelectionChange={setFeatured} />
          </div>

          {/* One save for every tab — the theme is edited under Design while the
              fields are under Forms, so keeping it inside Forms left Design with
              no visible Save. Sticky, because it otherwise sat below ~250 lines
              of form and you had to scroll back down to use it. */}
          <div className="sticky bottom-0 z-10 -mx-1 px-1 pb-1 pt-2 bg-gradient-to-t from-[#f4f6f9] via-[#f4f6f9] to-transparent">
            <div className="bg-white rounded-2xl border border-[#e4e7ec] shadow-[0_-2px_16px_-4px_rgba(0,31,63,0.12)] px-5 py-3.5 flex items-center justify-between gap-4 flex-wrap">
              {saveState === "success" && !dirty ? (
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
              ) : saveState === "error" ? (
                <span className="text-sm text-rose-600 flex items-center gap-1.5 min-w-0 truncate">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {saveError}
                </span>
              ) : dirty ? (
                <span className="text-xs font-semibold text-[#8a6a10] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d6b357]" aria-hidden />
                  Unsaved changes
                  {invalidPlatforms.length > 0 &&
                    ` · fix the highlighted ${invalidPlatforms.length === 1 ? "field" : "fields"} to include ${invalidPlatforms.length === 1 ? "it" : "them"}`}
                </span>
              ) : (
                <span className="text-xs text-[#9ca3af]">Everything here is saved.</span>
              )}

              {/* Step through the tabs without scrolling back up to the bar.
                  Each button names where it goes, so the destination is known
                  before the click. */}
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => prevTab && setTab(prevTab.key)}
                  disabled={!prevTab}
                  title={prevTab ? `Back to ${prevTab.label}` : undefined}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-[#e4e7ec] bg-white text-xs font-bold text-[#374151] hover:text-[#001f3f] hover:border-[#c4c9d4] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{prevTab ? prevTab.label : "Back"}</span>
                </button>
                <span className="text-[11px] text-[#9ca3af] tabular-nums whitespace-nowrap">
                  {tabIndex + 1} / {TABS.length}
                </span>
                <button
                  type="button"
                  onClick={() => nextTab && setTab(nextTab.key)}
                  disabled={!nextTab}
                  title={nextTab ? `Next: ${nextTab.label}` : undefined}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-[#e4e7ec] bg-white text-xs font-bold text-[#374151] hover:text-[#001f3f] hover:border-[#c4c9d4] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <span className="hidden sm:inline">{nextTab ? nextTab.label : "Next"}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={handleSave}
                disabled={saveState === "saving" || !dirty}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#001f3f] hover:bg-[#002952] text-white text-sm font-bold shadow-[0_4px_12px_-2px_rgba(0,31,63,0.35)] hover:shadow-[0_6px_18px_-2px_rgba(0,31,63,0.45)] hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none transition-all duration-200"
              >
                {saveState === "saving"
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  : <><Save className="w-4 h-4" /> Save Changes</>
                }
              </button>
            </div>
          </div>
        </div>

        {/* ══ RIGHT – live preview ═════════════════════════════════════════ */}
        {/* Sticks to the top of the dashboard's scroll area, so the phone stays
            in view however far down the editor you are. Falls back to normal
            flow on narrow screens, where the column is stacked anyway. */}
        <div className="xl:sticky xl:top-0">
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
  )
}
