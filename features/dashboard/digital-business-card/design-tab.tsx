"use client"

import { useRef, useState } from "react"
import { Check, ImagePlus, Link2, Loader2, Palette, X } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { compressImageForUpload } from "@/lib/upload/compress-image"
import {
  BACKDROP_LIBRARY_MAX, BUTTON_STYLES, CONTACT_DESIGNS, DEFAULT_BUTTON_STYLE,
  DEFAULT_CONTACT_DESIGN, DEFAULT_ICON_STYLE, ICON_STYLES, PROFILE_THEMES,
  SIZE_LIMITS, STOCK_BACKDROPS, readBackdropLibrary, resolveTheme, verticalGradient,
  type ButtonStyleId, type ContactDesignId, type CustomBackground,
  type IconStyleId, type SizeKey, type ThemeChoice,
} from "@/lib/profile-themes"

/**
 * Template picker for the public profile.
 *
 * Each swatch is painted from the same tokens the real page renders with, so a
 * new template in lib/profile-themes.ts appears here automatically and can never
 * preview as something it isn't.
 */

const DISPLAY = "font-[family-name:var(--font-outfit)]"

/** Six accents worth offering; any hex still works through the colour input. */
const ACCENT_PRESETS = ["#d6b357", "#e8a33d", "#3f8cd6", "#38a169", "#c0466f", "#7c5cd6"]

/** Backgrounds that read well behind white pills, plus two light options. */
const BG_PRESETS = ["#0b1220", "#001f3f", "#14141c", "#123b2e", "#3b1d2e", "#f4f1ea"]

/** Surfaces that hold a white QR bed and read well with either ink. */
const CARD_BG_PRESETS = ["#0d2340", "#0b0b10", "#123b2e", "#3b1d2e", "#faf7f1", "#ffffff"]

/** Inks that hold up over both dark and light backdrops. */
const TEXT_PRESETS = ["#ffffff", "#f5f2ea", "#ffe9a8", "#12233c", "#0b0b10", "#3b1d2e"]

/** Rough luminance check, only for choosing the swatch's preview ink. */
function isDarkHex(hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) || 0)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 <= 0.45
}

function Swatch({ choice }: { choice: ThemeChoice }) {
  const t = resolveTheme(choice)
  return (
    <div
      className="relative h-24 rounded-xl overflow-hidden"
      style={{
        // The photo sits under the scrim exactly as it does on the page.
        backgroundImage: t.image ? `url(${t.image}), ${t.scrim}` : t.scrim,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {t.image && <div className="absolute inset-0" style={{ background: t.scrim }} />}
      <div className="relative h-full flex flex-col items-center justify-center gap-1.5 px-3">
        <span
          className="w-6 h-6 rounded-full border-2"
          style={{ borderColor: t.accent, background: t.panel }}
        />
        <span className="h-1.5 w-14 rounded-full" style={{ background: t.ink, opacity: 0.85 }} />
        <span
          className="mt-0.5 h-4 w-full max-w-[104px]"
          style={{ background: t.pillBg, borderRadius: t.pillRadius, border: t.pillBorder }}
        />
        <span
          className="h-4 w-full max-w-[104px]"
          style={{ background: t.pillBg, borderRadius: t.pillRadius, border: t.pillBorder, opacity: 0.75 }}
        />
      </div>
    </div>
  )
}

/** One labelled range, with its live value and a reset once it's been touched. */
function Slider({
  label,
  sizeKey,
  value,
  suffix,
  onChange,
  onReset,
}: {
  label: string
  sizeKey: SizeKey
  value: number
  suffix: string
  onChange: (n: number) => void
  onReset: () => void
}) {
  const { min, max, step, def } = SIZE_LIMITS[sizeKey]
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={`slider-${sizeKey}`} className="text-[11px] font-bold uppercase tracking-wider text-[#374151]">
          {label}
        </label>
        <span className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[#6b7280] tabular-nums">
            {value}
            {suffix}
          </span>
          {value !== def && (
            <button
              type="button"
              onClick={onReset}
              className="text-[10px] font-semibold text-[#9ca3af] hover:text-[#001f3f] underline"
            >
              reset
            </button>
          )}
        </span>
      </div>
      <input
        id={`slider-${sizeKey}`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-[#001f3f] cursor-pointer"
      />
    </div>
  )
}

export function DesignTab({
  value,
  onChange,
}: {
  value: ThemeChoice
  onChange: (next: ThemeChoice) => void
}) {
  // Every override is optional, so the picker shows the template's own value
  // until the agent replaces it.
  const resolved = resolveTheme(value)
  const background: CustomBackground = value.background ?? { type: "color", color: "#0b1220" }
  const accent: string = value.accent ?? resolved.accent
  const buttons: ButtonStyleId = value.buttons ?? DEFAULT_BUTTON_STYLE
  const icons: IconStyleId = value.icons ?? DEFAULT_ICON_STYLE
  const contact: ContactDesignId = value.contact ?? DEFAULT_CONTACT_DESIGN
  const bgMode: "default" | "color" | "image" = value.background?.type ?? "default"
  const sizeOf = (k: SizeKey) => value[k] ?? SIZE_LIMITS[k].def
  const bgColor = background.type === "color" ? background.color : "#0b1220"
  const bgUrl = background.type === "image" ? background.url : ""

  const { profile } = useAuth()
  // The agent's own uploads. Persisted the moment one lands rather than with
  // Save Changes — a file already in S3 that nobody recorded is just litter.
  const [library, setLibrary] = useState<string[]>(() => readBackdropLibrary(profile?.metadata))
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const saveLibrary = async (next: string[]) => {
    const before = library
    setLibrary(next)
    try {
      const res = await fetch("/api/me/contact", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backdrops: next }),
      })
      if (!res.ok) throw new Error(`Could not save your uploads (${res.status})`)
    } catch (err) {
      setLibrary(before)
      setUploadError(err instanceof Error ? err.message : "Could not save your uploads")
    }
  }

  const removeFromLibrary = async (url: string) => {
    // Selecting a backdrop you just deleted would leave a broken page.
    if (background.type === "image" && background.url === url) {
      setCustom({ background: { type: "image", url: STOCK_BACKDROPS[0].url } })
    }
    await saveLibrary(library.filter((u) => u !== url))
  }

  /** Patch the choice, keeping the template and the other overrides. */
  const setCustom = (patch: Partial<ThemeChoice>) => onChange({ ...value, ...patch })

  const onPickFile = async (file: File) => {
    setUploading(true)
    setUploadError(null)
    try {
      // Same in-browser compression every upload uses, so an 8MP phone photo
      // does not travel full size just to become a backdrop.
      const compressed = await compressImageForUpload(file)
      const fd = new FormData()
      fd.append("file", compressed.file, compressed.file.name)
      const res = await fetch("/api/upload/profile-backdrop", { method: "POST", body: fd })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? `Upload failed (${res.status})`)
      // Newest first, and never past the cap.
      await saveLibrary([data.url, ...library.filter((u) => u !== data.url)].slice(0, BACKDROP_LIBRARY_MAX))
      setCustom({ background: { type: "image", url: data.url } })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e4e7ec] shadow-[0_2px_16px_-4px_rgba(0,31,63,0.08)] overflow-hidden">
      <div className="px-6 pt-6 pb-4 border-b border-[#f0f2f5] flex items-start gap-2.5">
        <span className="w-8 h-8 shrink-0 rounded-xl bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] flex items-center justify-center">
          <Palette className="w-4 h-4 text-[#d6b357]" />
        </span>
        <div>
          <h2 className={`${DISPLAY} text-base font-bold text-[#0d1117]`}>Select a design</h2>
          <p className="text-xs text-[#9ca3af] mt-0.5">
            Changes the whole page — background, buttons and accents. The preview updates as you pick.
          </p>
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 items-stretch">
        {PROFILE_THEMES.map((t) => {
          const selected = value.id === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange({ id: t.id })}
              aria-pressed={selected}
              className={`relative flex h-full flex-col text-left rounded-2xl border-2 p-2 transition-all duration-200 ${
                selected
                  ? "border-[#d6b357] bg-[#fffdf3] shadow-[0_4px_16px_-4px_rgba(214,179,87,0.45)]"
                  : "border-[#e4e7ec] bg-white hover:border-[#c4c9d4] hover:shadow-[0_2px_12px_-4px_rgba(0,31,63,0.15)]"
              }`}
            >
              {/* Previewed with the agent's overrides, so the grid shows what each
                  template would actually look like for them. */}
              <Swatch choice={{ ...value, id: t.id }} />
              {/* Fixed rows for the label and the blurb, so a one-line blurb and a
                  two-line one still leave the cells the same height. */}
              <p className={`mt-2 text-xs font-bold leading-4 ${selected ? "text-[#8a6a10]" : "text-[#374151]"}`}>
                {t.name}
              </p>
              <p className="text-[10px] text-[#9ca3af] leading-[1.2] line-clamp-2 min-h-[2.4em]">{t.blurb}</p>
              {selected && (
                <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#d6b357] flex items-center justify-center shadow">
                  <Check className="w-3.5 h-3.5 text-white" />
                </span>
              )}
            </button>
          )
        })}

        {/* Custom */}
        <button
          type="button"
          onClick={() => onChange({ ...value, id: "custom" })}
          aria-pressed={value.id === "custom"}
          className={`relative flex h-full flex-col text-left rounded-2xl border-2 p-2 transition-all duration-200 ${
            value.id === "custom"
              ? "border-[#d6b357] bg-[#fffdf3] shadow-[0_4px_16px_-4px_rgba(214,179,87,0.45)]"
              : "border-dashed border-[#c4c9d4] bg-white hover:border-[#001f3f]"
          }`}
        >
          <Swatch choice={{ ...value, id: "custom" }} />
          <p className={`mt-2 text-xs font-bold leading-4 ${value.id === "custom" ? "text-[#8a6a10]" : "text-[#374151]"}`}>
            Custom
          </p>
          <p className="text-[10px] text-[#9ca3af] leading-[1.2] line-clamp-2 min-h-[2.4em]">
            Your own accent and background
          </p>
          {value.id === "custom" && (
            <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#d6b357] flex items-center justify-center shadow">
              <Check className="w-3.5 h-3.5 text-white" />
            </span>
          )}
        </button>
      </div>

      {/* Overrides. These apply to whichever template is selected — a stock
          look can still carry the agent's own photo, accent and button shape. */}
      <div className="px-6 pb-6 pt-4 space-y-5 border-t border-[#f0f2f5]">
          {/* Colour or image */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#374151] mb-2">Background</p>
            <div className="inline-flex rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-1">
              {(["default", "color", "image"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() =>
                    setCustom({
                      background:
                        mode === "default"
                          ? undefined
                          : mode === "color"
                            ? { type: "color", color: background.type === "color" ? background.color : "#0b1220" }
                            : {
                                type: "image",
                                url: background.type === "image" ? background.url : STOCK_BACKDROPS[0].url,
                              },
                    })
                  }
                  aria-pressed={bgMode === mode}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    bgMode === mode
                      ? "bg-white text-[#001f3f] shadow-sm"
                      : "text-[#6b7280] hover:text-[#374151]"
                  }`}
                >
                  {mode === "default" ? "Template" : mode === "color" ? "Colour" : "Image"}
                </button>
              ))}
            </div>
            {bgMode === "default" && (
              <p className="text-[11px] text-[#9ca3af] mt-2">
                Using {resolved.name}&apos;s own background. Pick Colour or Image to override it —
                that works on every template, not just Custom.
              </p>
            )}
          </div>

          {bgMode === "color" ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#374151] mb-2">
                Background colour
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {BG_PRESETS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setCustom({ background: { type: "color", color: hex } })}
                    aria-label={`Background ${hex}`}
                    aria-pressed={bgColor.toLowerCase() === hex}
                    className={`w-9 h-9 rounded-xl border-2 transition-transform hover:scale-110 ${
                      bgColor.toLowerCase() === hex ? "border-[#0d1117]" : "border-white shadow"
                    }`}
                    style={{ background: hex }}
                  />
                ))}
                <label className="inline-flex items-center gap-2 ml-1 text-xs text-[#6b7280]">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setCustom({ background: { type: "color", color: e.target.value } })}
                    aria-label="Pick any background colour"
                    className="w-9 h-9 rounded-lg border border-[#e5e7eb] bg-white p-0.5 cursor-pointer"
                  />
                  any colour
                </label>
              </div>
              <p className="text-[11px] text-[#9ca3af] mt-2">
                Text switches between dark and light automatically, whichever stays readable on it.
              </p>
            </div>
          ) : bgMode === "image" ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#374151] mb-2">
                Background image
              </p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1.5">
                Stock
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {STOCK_BACKDROPS.map((b) => {
                  const on = bgUrl === b.url
                  return (
                    <button
                      key={b.url}
                      type="button"
                      onClick={() => setCustom({ background: { type: "image", url: b.url } })}
                      aria-pressed={on}
                      className={`relative h-16 rounded-xl overflow-hidden border-2 transition-all ${
                        on ? "border-[#d6b357]" : "border-transparent hover:border-[#c4c9d4]"
                      }`}
                    >
                      {/* Plain <img>: these are picker thumbnails, not page content. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.url} alt={b.name} className="w-full h-full object-cover" />
                      {on && (
                        <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#d6b357] flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* The agent's own uploads, newest first. */}
              {library.length > 0 && (
                <>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mt-3 mb-1.5">
                    Your uploads
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {library.map((url) => {
                      const on = bgUrl === url
                      return (
                        <div key={url} className="relative group">
                          <button
                            type="button"
                            onClick={() => setCustom({ background: { type: "image", url } })}
                            aria-pressed={on}
                            aria-label="Use this backdrop"
                            className={`block w-full h-16 rounded-xl overflow-hidden border-2 transition-all ${
                              on ? "border-[#d6b357]" : "border-transparent hover:border-[#c4c9d4]"
                            }`}
                          >
                            {/* Plain <img>: picker thumbnails, not page content. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          </button>
                          {on && (
                            <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-[#d6b357] flex items-center justify-center pointer-events-none">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => void removeFromLibrary(url)}
                            aria-label="Remove this upload"
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-rose-600 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ""
                  if (f) void onPickFile(f)
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || library.length >= BACKDROP_LIBRARY_MAX}
                className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-[#c4c9d4] text-xs font-bold text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] hover:bg-[#f8faff] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                {uploading
                  ? "Uploading…"
                  : library.length >= BACKDROP_LIBRARY_MAX
                    ? `You can keep ${BACKDROP_LIBRARY_MAX} uploads — remove one first`
                    : "Upload your own"}
              </button>
              {uploadError && (
                <p className="mt-1.5 text-[11px] text-rose-600" role="alert">{uploadError}</p>
              )}
              <div className="mt-4">
                <Slider
                  label="Overlay"
                  sizeKey="overlay"
                  suffix={sizeOf("overlay") === 0 ? "% · photo only" : "%"}
                  value={sizeOf("overlay")}
                  onChange={(n) => setCustom({ overlay: n })}
                  onReset={() => setCustom({ overlay: undefined })}
                />
              </div>

              <p className="text-[11px] text-[#9ca3af] mt-2">
                The overlay is the dark wash between your photo and the text. Turn it down to show
                more of the picture — but check the preview, because your name has to stay readable
                on it. Your uploads are kept here, so you can switch between them any time.
              </p>
            </div>
          ) : null}

          {/* Buttons */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#374151] mb-2">Button design</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-stretch">
              {BUTTON_STYLES.map((b) => {
                // Each chip previews the shape against the CURRENT look.
                const preview = resolveTheme({ ...value, buttons: b.id })
                const on = buttons === b.id
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setCustom({ buttons: b.id })}
                    aria-pressed={on}
                    className={`flex h-full flex-col rounded-xl border-2 p-2 transition-all ${
                      on ? "border-[#d6b357] bg-[#fffdf3]" : "border-[#e4e7ec] bg-white hover:border-[#c4c9d4]"
                    }`}
                  >
                    <span
                      className="block h-9 rounded-xl"
                      // A scrim is always a gradient, so this is backgroundImage
                      // rather than the `background` shorthand — React warns when a
                      // shorthand and a longhand for the same value are both set.
                      style={{ backgroundImage: preview.scrim }}
                    >
                      <span className="flex h-full items-center justify-center px-2">
                        <span
                          className="block h-4 w-full"
                          style={{
                            background: preview.pillBg,
                            borderRadius: preview.pillRadius,
                            border: preview.pillBorder,
                          }}
                        />
                      </span>
                    </span>
                    <span
                      className={`mt-1.5 block text-[10px] font-bold leading-4 ${on ? "text-[#8a6a10]" : "text-[#6b7280]"}`}
                    >
                      {b.name}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Gradient. Applies to the buttons and to the contact card together,
                because they are the two solid surfaces on the page. */}
            <button
              type="button"
              onClick={() => setCustom({ gradient: value.gradient ? undefined : true })}
              aria-pressed={Boolean(value.gradient)}
              className={`mt-3 w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                value.gradient ? "border-[#d6b357] bg-[#fffdf3]" : "border-[#e5e7eb] bg-[#f9fafb] hover:border-[#c4c9d4]"
              }`}
            >
              <span
                className="h-8 w-12 shrink-0 rounded-lg"
                style={{ background: verticalGradient(resolved.pillBg), border: resolved.pillBorder }}
              />
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-bold text-[#0d1117]">Gradient</span>
                <span className="block text-[11px] text-[#6b7280]">
                  Lighter at the top, deeper at the foot — on the buttons and the contact card
                </span>
              </span>
              <span
                className={`w-10 h-5.5 shrink-0 rounded-full p-0.5 transition-colors ${
                  value.gradient ? "bg-[#d6b357]" : "bg-[#d1d5db]"
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    value.gradient ? "translate-x-[18px]" : ""
                  }`}
                />
              </span>
            </button>

            {/* The sliders live with the chips they refine, rather than in a
                separate block where it was not obvious what they applied to. */}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
              <Slider
                label="Button size"
                sizeKey="buttonSize"
                suffix="%"
                value={sizeOf("buttonSize")}
                onChange={(n) => setCustom({ buttonSize: n })}
                onReset={() => setCustom({ buttonSize: undefined })}
              />
              <Slider
                label="Button radius"
                sizeKey="buttonRadius"
                suffix={sizeOf("buttonRadius") >= SIZE_LIMITS.buttonRadius.max ? "px · round" : "px"}
                value={sizeOf("buttonRadius")}
                onChange={(n) => setCustom({ buttonRadius: n })}
                onReset={() => setCustom({ buttonRadius: undefined })}
              />
            </div>
          </div>

          {/* Icon design */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#374151] mb-2">Icon design</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 items-stretch">
              {ICON_STYLES.map((st) => {
                // Previewed against the CURRENT look, tile shape included.
                const pv = resolveTheme({ ...value, icons: st.id })
                const on = icons === st.id
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setCustom({ icons: st.id })}
                    aria-pressed={on}
                    className={`flex h-full flex-col rounded-xl border-2 p-2 transition-all ${
                      on ? "border-[#d6b357] bg-[#fffdf3]" : "border-[#e4e7ec] bg-white hover:border-[#c4c9d4]"
                    }`}
                  >
                    <span
                      className="flex h-9 items-center justify-center rounded-xl"
                      style={{ background: pv.pillBg, border: pv.pillBorder }}
                    >
                      {pv.showIcon ? (
                        <span
                          className="flex items-center justify-center"
                          style={{
                            width: 22,
                            height: 22,
                            background: pv.tile,
                            border: pv.tileBorder,
                            borderRadius: Math.min(pv.tileRadius, 11),
                            color: pv.tileInk,
                          }}
                        >
                          <Link2 className="w-3 h-3" />
                        </span>
                      ) : (
                        // Label-only, which is what None produces.
                        <span
                          className="block h-1.5 w-10 rounded-full"
                          style={{ background: pv.pillInk, opacity: 0.5 }}
                        />
                      )}
                    </span>
                    <span
                      className={`mt-1.5 block text-[10px] font-bold leading-4 ${on ? "text-[#8a6a10]" : "text-[#6b7280]"}`}
                    >
                      {st.name}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
              <Slider
                label="Icon size"
                sizeKey="iconSize"
                suffix={sizeOf("iconSize") === 0 ? "px · no tile" : "px"}
                value={sizeOf("iconSize")}
                onChange={(n) => setCustom({ iconSize: n })}
                onReset={() => setCustom({ iconSize: undefined })}
              />
              <Slider
                label="Icon radius"
                sizeKey="iconRadius"
                suffix="px"
                value={sizeOf("iconRadius")}
                onChange={(n) => setCustom({ iconRadius: n })}
                onReset={() => setCustom({ iconRadius: undefined })}
              />
            </div>
          </div>

          {/* Contact card */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#374151] mb-2">Contact card</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-stretch">
              {CONTACT_DESIGNS.map((c) => {
                const on = contact === c.id
                // The last three have no card surface — the rows are the page's
                // own buttons — so their swatches sit on the page background.
                const glass = c.id === "panel"
                // A chosen background applies to whichever design is picked, so
                // the swatch previews it rather than the design's own surface.
                const chosen = value.contactBg
                const dark = chosen ? isDarkHex(chosen) : c.id === "navy"
                const surface = chosen ?? (c.id === "navy" ? "#0d2340" : "#faf7f1")
                const gold = resolved.accent
                const ink = dark ? "#ffffff" : "#12233c"

                const pip = (
                  <span
                    className="h-1.5 w-1.5 shrink-0"
                    style={{ background: resolved.tile, borderRadius: Math.min(resolved.tileRadius, 3) }}
                  />
                )
                const line = (op: number, tone = ink) => (
                  <span className="flex items-center gap-1">
                    {resolved.showIcon && pip}
                    <span className="h-[3px] flex-1 rounded-full" style={{ background: tone, opacity: op }} />
                  </span>
                )
                const qrBed = (size: number, border = gold) => (
                  <span
                    className="shrink-0 rounded bg-white"
                    style={{ width: size, height: size, border: `1.5px solid ${border}` }}
                  />
                )
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCustom({ contact: c.id })}
                    aria-pressed={on}
                    title={c.hint}
                    className={`flex h-full flex-col rounded-xl border-2 p-2 text-left transition-all ${
                      on ? "border-[#d6b357] bg-[#fffdf3]" : "border-[#e4e7ec] bg-white hover:border-[#c4c9d4]"
                    }`}
                  >
                    <span
                      className="relative flex h-16 flex-col justify-center overflow-hidden rounded-lg p-1.5"
                      style={
                        glass && !chosen
                          ? { backgroundImage: resolved.scrim, backgroundSize: "cover" }
                          : { background: surface }
                      }
                    >
                      {c.id === "ivory" && (
                        <>
                          <span className="absolute -top-2 -right-2 h-6 w-9 rotate-[20deg]" style={{ background: `linear-gradient(115deg, ${gold}, transparent 70%)`, borderBottomLeftRadius: "100%" }} />
                          <span className="absolute -bottom-2 -left-2 h-6 w-9 rotate-[20deg]" style={{ background: `linear-gradient(295deg, ${gold}, transparent 70%)`, borderTopRightRadius: "100%" }} />
                        </>
                      )}

                      {/* QR, a gold rule, then the lines. Panel draws its own
                          translucent tile over the backdrop; a chosen colour
                          makes it a solid card like the others. */}
                      <span
                        className={`relative flex items-center gap-1.5 ${glass && !chosen ? "rounded-md p-1" : ""}`}
                        style={
                          glass && !chosen
                            ? { background: resolved.panel, border: `1px solid ${resolved.panelBorder}` }
                            : undefined
                        }
                      >
                        {qrBed(glass ? 24 : 28)}
                        <span className="h-7 w-px shrink-0" style={{ background: `${gold}66` }} />
                        <span className="flex-1 min-w-0 space-y-1">
                          {line(0.85, glass && !chosen ? resolved.ink : ink)}
                          {line(0.5, glass && !chosen ? resolved.ink : ink)}
                          {line(0.5, glass && !chosen ? resolved.ink : ink)}
                        </span>
                      </span>
                    </span>
                    <span className={`mt-1.5 block text-[10px] font-bold leading-4 ${on ? "text-[#8a6a10]" : "text-[#374151]"}`}>
                      {c.name}
                    </span>
                    <span className="block text-[10px] leading-[1.2] text-[#9ca3af] line-clamp-2 min-h-[2.4em]">
                      {c.hint}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Card background. Overrides whichever design is selected; the card's
                text flips between dark and light to stay readable on it. */}
            <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-[#374151]">
              Card background
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCustom({ contactBg: undefined })}
                aria-pressed={!value.contactBg}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                  !value.contactBg
                    ? "border-[#001f3f] bg-[#001f3f] text-white"
                    : "border-[#e5e7eb] bg-[#f9fafb] text-[#374151] hover:border-[#c4c9d4]"
                }`}
              >
                Design default
              </button>
              {CARD_BG_PRESETS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setCustom({ contactBg: hex })}
                  aria-label={`Card background ${hex}`}
                  aria-pressed={value.contactBg?.toLowerCase() === hex}
                  className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                    value.contactBg?.toLowerCase() === hex ? "border-[#0d1117]" : "border-white shadow"
                  }`}
                  style={{ background: hex }}
                />
              ))}
              <label className="inline-flex items-center gap-2 ml-1 text-[11px] text-[#6b7280]">
                <input
                  type="color"
                  value={value.contactBg ?? "#0d2340"}
                  onChange={(e) => setCustom({ contactBg: e.target.value })}
                  aria-label="Pick any card background"
                  className="w-8 h-8 rounded-lg border border-[#e5e7eb] bg-white p-0.5 cursor-pointer"
                />
                any colour
              </label>
            </div>
          </div>

          {/* Accent */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#374151] mb-2">Accent</p>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setCustom({ accent: hex })}
                  aria-label={`Accent ${hex}`}
                  aria-pressed={accent.toLowerCase() === hex}
                  className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                    accent.toLowerCase() === hex ? "border-[#0d1117]" : "border-white shadow"
                  }`}
                  style={{ background: hex }}
                />
              ))}
              <label className="inline-flex items-center gap-2 ml-1 text-xs text-[#6b7280]">
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setCustom({ accent: e.target.value })}
                  aria-label="Pick any accent colour"
                  className="w-8 h-8 rounded-lg border border-[#e5e7eb] bg-white p-0.5 cursor-pointer"
                />
                any colour
              </label>
            </div>
            {value.accent && (
              <button
                type="button"
                onClick={() => setCustom({ accent: undefined })}
                className="mt-2 text-[11px] font-semibold text-[#6b7280] hover:text-[#001f3f] underline"
              >
                Reset to {resolved.name}&apos;s accent
              </button>
            )}
          </div>

          {/* Text colour */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#374151] mb-2">Text colour</p>
            <div className="flex flex-wrap items-center gap-2">
              {TEXT_PRESETS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setCustom({ textColor: hex })}
                  aria-label={`Text colour ${hex}`}
                  aria-pressed={value.textColor?.toLowerCase() === hex}
                  className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                    value.textColor?.toLowerCase() === hex ? "border-[#0d1117]" : "border-[#e5e7eb] shadow"
                  }`}
                  style={{ background: hex }}
                />
              ))}
              <label className="inline-flex items-center gap-2 ml-1 text-xs text-[#6b7280]">
                <input
                  type="color"
                  value={value.textColor ?? resolved.ink}
                  onChange={(e) => setCustom({ textColor: e.target.value })}
                  aria-label="Pick any text colour"
                  className="w-8 h-8 rounded-lg border border-[#e5e7eb] bg-white p-0.5 cursor-pointer"
                />
                any colour
              </label>
            </div>
            <p className="mt-2 text-[11px] text-[#9ca3af]">
              Your name, tagline and the details over the background. Buttons keep their own text
              colour, which is picked against the button rather than the page.
            </p>
            {value.textColor && (
              <button
                type="button"
                onClick={() => setCustom({ textColor: undefined })}
                className="mt-1.5 text-[11px] font-semibold text-[#6b7280] hover:text-[#001f3f] underline"
              >
                Reset to {resolved.name}&apos;s text colour
              </button>
            )}
          </div>
        </div>
    </div>
  )
}
