"use client"

// AI Photo Studio — virtual staging for property photos. Upload a photo of
// an empty house, room or garden, pick edits (add people, furnish, landscape,
// fix the sky…), and the AI edits the ACTUAL photo. Results are stored in S3
// and shown next to the original for an honest before/after.

import { useEffect, useRef, useState } from "react"
import {
  ChevronsLeftRight, Download, ImagePlus, Loader2, MapPin, RotateCcw, Sofa, Sun, Sparkles, Trees, Users, Wand2, X,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { compressImageForUpload } from "@/lib/upload/compress-image"

type PresetKey = "people" | "furnish" | "garden" | "sky" | "clean"

const PRESETS: Array<{ key: PresetKey; icon: typeof Users; label: string; hint: string }> = [
  { key: "people", icon: Users, label: "Add People", hint: "Bring the space to life" },
  { key: "furnish", icon: Sofa, label: "Furnish the Space", hint: "Stage an empty room" },
  { key: "garden", icon: Trees, label: "Landscape the Garden", hint: "Greenery and lawn" },
  { key: "sky", icon: Sun, label: "Golden-Hour Sky", hint: "Warm, inviting light" },
  { key: "clean", icon: Sparkles, label: "Clean & Declutter", hint: "Market-ready finish" },
]

/** Each preset becomes one clear instruction sentence for the model. */
function presetInstruction(key: PresetKey, people: number): string {
  switch (key) {
    case "people":
      return `Add ${people} realistic ${people === 1 ? "person" : "people"} naturally enjoying the space — relaxed poses, correct scale, matching the scene's lighting and perspective`
    case "furnish":
      return "Furnish the space with tasteful modern furniture and decor suited to a premium Dubai property"
    case "garden":
      return "Landscape the outdoor area with lush greenery, plants and a manicured lawn"
    case "sky":
      return "Replace the sky with a warm golden-hour sky and adjust the overall lighting to match"
    case "clean":
      return "Remove clutter and imperfections so the space looks clean, bright and market-ready"
  }
}

/**
 * The reveal. The BEFORE photo is the base; the AFTER lies on top, clipped
 * at the slider position, so the staging wipes in from the left. When a
 * result first arrives the line sweeps itself across — a slow left-to-right
 * unveiling, a beat on the full AFTER, then it eases back to the middle and
 * hands over to manual dragging (mouse, touch or arrow keys — an invisible
 * range input drives it). Any touch cancels the show; reduced-motion users
 * skip straight to the middle.
 */
function CompareSlider({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(0) // % of AFTER shown, from the left
  const cancelRef = useRef(false)

  useEffect(() => {
    cancelRef.current = false
    const timers: ReturnType<typeof setTimeout>[] = []
    let raf = 0

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      timers.push(setTimeout(() => setPos(100), 0))
      return () => timers.forEach(clearTimeout)
    }

    const tween = (from: number, to: number, ms: number, then?: () => void) => {
      const t0 = performance.now()
      const step = (t: number) => {
        if (cancelRef.current) return
        const k = Math.min(1, (t - t0) / ms)
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
        setPos(from + (to - from) * e)
        if (k < 1) raf = requestAnimationFrame(step)
        else then?.()
      }
      raf = requestAnimationFrame(step)
    }

    // Beat of BEFORE → sweep the staging in, then STAY on the full result;
    // the visitor drags back whenever they want the comparison.
    timers.push(setTimeout(() => tween(0, 100, 3800), 600))
    return () => {
      cancelRef.current = true
      cancelAnimationFrame(raf)
      timers.forEach(clearTimeout)
    }
  }, [after])

  return (
    <div className="relative w-full select-none overflow-hidden border border-[#e5e8ec] bg-[#0b1622]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={before} alt="Before staging" draggable={false} className="block w-full" />
      <div
        className="absolute inset-0"
        style={{ clipPath: "inset(0 " + (100 - pos) + "% 0 0)" }}
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt="" draggable={false} className="h-full w-full object-cover" />
      </div>

      {/* Divider + handle */}
      <div
        className="pointer-events-none absolute inset-y-0 z-10 w-[2px] bg-white shadow-[0_0_8px_rgba(0,0,0,0.6)]"
        style={{ left: "calc(" + pos + "% - 1px)" }}
        aria-hidden="true"
      >
        <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#d6b357] shadow-lg ring-2 ring-white">
          <ChevronsLeftRight className="h-4 w-4 text-[#001f3f]" />
        </span>
      </div>

      {/* The engine: an invisible slider covering the whole image */}
      <input
        type="range"
        min={0}
        max={100}
        step={0.1}
        value={pos}
        onPointerDown={() => { cancelRef.current = true }}
        onKeyDown={() => { cancelRef.current = true }}
        onChange={(e) => { cancelRef.current = true; setPos(Number(e.target.value)) }}
        aria-label="Reveal the staged photo"
        className="absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  )
}

const BUSY_LINES = [
  "Editing your photo…",
  "Matching light and perspective…",
  "Blending the additions in…",
  "Almost there — final touches…",
]

export default function PhotoStudioPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [picked, setPicked] = useState<Set<PresetKey>>(new Set(["people"]))
  const [people, setPeople] = useState(2)
  const [custom, setCustom] = useState("")
  const [quality, setQuality] = useState<"medium" | "high">("medium")
  const [busy, setBusy] = useState(false)
  const [busyLine, setBusyLine] = useState(0)
  const [result, setResult] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Rotate the status line while generating, so the 30–60s wait feels alive.
  useEffect(() => {
    if (!busy) return
    const t = setInterval(() => setBusyLine((i) => (i + 1) % BUSY_LINES.length), 6000)
    return () => clearInterval(t)
  }, [busy])

  // Object URLs leak without revocation.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  if (!allowed) return null

  const pickFile = (f: File | null) => {
    if (!f) return
    if (preview) URL.revokeObjectURL(preview)
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setResult(null)
    setError(null)
  }

  const togglePreset = (key: PresetKey) => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const buildPrompt = (): string => {
    const parts = [...picked].map((k) => presetInstruction(k, people))
    if (custom.trim()) parts.push(custom.trim())
    if (parts.length === 0) return ""
    return (
      `Edit this property photo. ${parts.join(". ")}. ` +
      "Keep the original architecture, layout, camera angle and everything not mentioned unchanged. " +
      "The result must look like a real photograph — photorealistic, naturally lit, no artistic filters."
    )
  }

  const downloadResult = async () => {
    if (!result || downloading) return
    setDownloading(true)
    try {
      const res = await fetch("/api/image-proxy?url=" + encodeURIComponent(result))
      if (!res.ok) throw new Error("download failed")
      const blob = await res.blob()
      const href = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = href
      a.download = "fhi-ai-staging-" + (result.split("/").pop() ?? "photo.webp")
      a.click()
      URL.revokeObjectURL(href)
    } catch {
      // Fall back to opening it — the visitor can still save from the tab.
      window.open(result, "_blank", "noopener")
    } finally {
      setDownloading(false)
    }
  }

  const generate = async () => {
    if (!file || busy) return
    const prompt = buildPrompt()
    if (!prompt) {
      setError("Pick at least one edit, or describe your own.")
      return
    }
    setBusy(true)
    setBusyLine(0)
    setError(null)
    try {
      // Shrink in the browser first — a 12 MB phone photo edits just as well
      // at 2 MB and uploads far faster.
      const { file: toSend } = await compressImageForUpload(file)
      const fd = new FormData()
      fd.append("image", toSend, toSend.name)
      fd.append("prompt", prompt)
      fd.append("quality", quality)
      const res = await fetch("/api/ai/photo-studio", { method: "POST", body: fd })
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? "Generation failed — try again.")
      setResult(data.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed — try again.")
    } finally {
      setBusy(false)
    }
  }

  const pillCls = (active: boolean) =>
    `flex items-start gap-3 border p-3.5 text-left transition-colors ${
      active
        ? "border-[#d6b357] bg-[#faf7ee]"
        : "border-[#e5e5e5] bg-white hover:border-[#c4c9d4]"
    }`

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] flex items-center gap-2">
          <Wand2 className="w-6 h-6 text-[#001f3f]" />
          AI Photo Studio
        </h1>
        <p className="text-sm text-[#6b7280] mt-1">
          Virtual staging for your listing photos — add people, furniture or landscaping to an
          empty space. The AI edits your actual photo; nothing else changes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
        {/* ── Controls ── */}
        <div className="space-y-5 bg-white border border-[#e5e8ec] p-5">
          {/* Photo */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#6b7280] mb-2">1 · Photo</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => { pickFile(e.target.files?.[0] ?? null); e.target.value = "" }}
            />
            {preview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Your photo" className="w-full max-h-56 object-contain bg-[#f4f5f7] border border-[#e5e5e5]" />
                <button
                  type="button"
                  onClick={() => { if (preview) URL.revokeObjectURL(preview); setFile(null); setPreview(null); setResult(null) }}
                  aria-label="Remove photo"
                  className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-[#001f3f] text-white hover:bg-[#0a3d6b] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 border border-dashed border-[#c9ced6] bg-[#fafbfc] py-10 text-[#6b7280] hover:border-[#001f3f] hover:text-[#001f3f] transition-colors"
              >
                <ImagePlus className="w-7 h-7" />
                <span className="text-sm font-semibold">Upload a property photo</span>
                <span className="text-xs text-[#9ca3af]">Empty room, house or garden · JPG, PNG or WebP</span>
              </button>
            )}
          </div>

          {/* Edits */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#6b7280] mb-2">
              2 · Edits <span className="font-normal normal-case text-[#9ca3af]">· pick any</span>
            </p>
            <div className="space-y-2">
              {PRESETS.map(({ key, icon: Icon, label, hint }) => {
                const active = picked.has(key)
                return (
                  <button key={key} type="button" onClick={() => togglePreset(key)} className={`w-full ${pillCls(active)}`}>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center ${active ? "bg-[#d6b357]" : "bg-[#f4f5f7]"}`}>
                      <Icon className={`w-4.5 h-4.5 ${active ? "text-[#001f3f]" : "text-[#8a93a0]"}`} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-[#0d1117]">{label}</span>
                      <span className="block text-xs text-[#8a93a0]">{hint}</span>
                    </span>
                    {key === "people" && active && (
                      <span
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        role="group"
                        aria-label="How many people"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setPeople(n)}
                            aria-pressed={people === n}
                            className={`h-7 w-7 text-xs font-bold transition-colors ${
                              people === n ? "bg-[#001f3f] text-white" : "bg-white border border-[#e5e5e5] text-[#6b7280] hover:border-[#001f3f]"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <textarea
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Or describe your own edit — e.g. “add a family having breakfast on the terrace”"
              className="mt-2 w-full border border-[#e5e5e5] px-3 py-2.5 text-sm text-[#111827] placeholder:text-[#9ca3af] resize-none focus:outline-none focus:border-[#001f3f]"
            />
          </div>

          {/* Quality */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#6b7280] mb-2">3 · Quality</p>
            <div className="inline-flex border border-[#e5e5e5]">
              {([["medium", "Standard"], ["high", "High"]] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setQuality(value)}
                  className={`px-4 py-2 text-sm font-bold transition-colors ${
                    quality === value ? "bg-[#001f3f] text-white" : "bg-white text-[#374151] hover:bg-[#f3f4f6]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#9ca3af] mt-1.5">
              High takes a little longer and gives extra detail for print.
            </p>
          </div>

          {error && (
            <p className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
          )}

          <button
            type="button"
            onClick={() => void generate()}
            disabled={busy || !file}
            className="w-full flex items-center justify-center gap-2 bg-[#d6b357] py-3.5 text-sm font-bold text-[#001f3f] hover:bg-[#c8a544] transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {busy ? BUSY_LINES[busyLine] : result ? "Generate Again" : "Generate"}
          </button>
          {busy && (
            <p className="text-[11px] text-[#9ca3af] text-center -mt-2">
              This usually takes 30–60 seconds — stay on this page.
            </p>
          )}
        </div>

        {/* ── Result ── */}
        <div className="bg-white border border-[#e5e8ec] p-5 min-h-[420px]">
          {result && preview ? (
            <div>
              <CompareSlider before={preview} after={result} />
              <p className="mt-2 text-center text-[11px] text-[#9ca3af]">
                Drag the gold handle to compare before and after.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void downloadResult()}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 bg-[#001f3f] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0a3d6b] transition-colors disabled:opacity-60"
                >
                  {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {downloading ? "Saving…" : "Download"}
                </button>
                <a
                  href={result}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 border border-[#e5e5e5] px-5 py-2.5 text-sm font-semibold text-[#374151] hover:border-[#001f3f] transition-colors"
                >
                  Open Full Size
                </a>
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="inline-flex items-center gap-2 border border-[#e5e5e5] px-5 py-2.5 text-sm font-semibold text-[#374151] hover:border-[#001f3f] transition-colors"
                >
                  <RotateCcw className="w-4 h-4" /> Tweak & Retry
                </button>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#9ca3af]">
                <MapPin className="w-3.5 h-3.5" />
                AI-edited image — check details before publishing; results can vary between runs.
              </p>
            </div>
          ) : (
            <div className="h-full min-h-[380px] flex flex-col items-center justify-center gap-3 text-center px-6">
              {busy ? (
                <>
                  <Loader2 className="w-8 h-8 animate-spin text-[#b8913f]" />
                  <p className="text-sm font-semibold text-[#374151]">{BUSY_LINES[busyLine]}</p>
                </>
              ) : (
                <>
                  <span className="flex h-14 w-14 items-center justify-center bg-[#001f3f]/5">
                    <Sparkles className="w-7 h-7 text-[#001f3f]/30" />
                  </span>
                  <p className="font-['Outfit'] text-sm font-semibold text-[#0d1117]">Your edited photo appears here</p>
                  <p className="text-xs text-[#6b7280] max-w-xs">
                    Upload a photo, pick the edits, and generate — you get the original and the
                    staged version side by side.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
