"use client"

// AI Photo Studio — virtual staging for property photos. Upload a photo of
// an empty house, room or garden, pick edits (add people, furnish, landscape,
// fix the sky…), and the AI edits the ACTUAL photo. Results are stored in S3
// and shown next to the original for an honest before/after.

import { useEffect, useRef, useState } from "react"
import {
  ChevronsLeftRight, Download, ImagePlus, Images, Loader2, MapPin, Pencil, RotateCcw, Sofa, Sun, Sparkles, Trash2, Trees, Users, Wand2, X,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { compressImageForUpload } from "@/lib/upload/compress-image"

type PresetKey = "people" | "furnish" | "garden" | "sky" | "clean"
type FurnishStyle = "modern" | "luxury" | "minimalist" | "majlis"

const FURNISH_STYLES: Array<{ key: FurnishStyle; label: string }> = [
  { key: "modern", label: "Modern" },
  { key: "luxury", label: "Luxury" },
  { key: "minimalist", label: "Minimalist" },
  { key: "majlis", label: "Majlis" },
]

const FURNISH_WORDING: Record<FurnishStyle, string> = {
  modern: "tasteful modern furniture and decor",
  luxury: "high-end luxury furniture, rich textures and elegant statement decor",
  minimalist: "clean minimalist furniture in light tones with uncluttered styling",
  majlis: "an elegant Arabic majlis arrangement — low seating, rich fabrics, traditional patterns and warm ambient lighting",
}

const PRESETS: Array<{ key: PresetKey; icon: typeof Users; label: string; hint: string }> = [
  { key: "people", icon: Users, label: "Add People", hint: "Bring the space to life" },
  { key: "furnish", icon: Sofa, label: "Furnish the Space", hint: "Stage an empty room" },
  { key: "garden", icon: Trees, label: "Landscape the Garden", hint: "Greenery and lawn" },
  { key: "sky", icon: Sun, label: "Golden-Hour Sky", hint: "Warm, inviting light" },
  { key: "clean", icon: Sparkles, label: "Clean & Declutter", hint: "Market-ready finish" },
]

/** Each preset becomes one clear instruction sentence for the model. */
function presetInstruction(key: PresetKey, people: number, style: FurnishStyle): string {
  switch (key) {
    case "people":
      return `Add ${people} realistic ${people === 1 ? "person" : "people"} naturally enjoying the space — relaxed poses, correct scale, matching the scene's lighting and perspective`
    case "furnish":
      return "Furnish the space with " + FURNISH_WORDING[style] + ", suited to a premium Dubai property"
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

type EditRow = {
  id: string
  result_url: string
  source_url: string | null
  prompt: string
  quality: string
  created_at: string
}

function whenLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return (
    d.toLocaleDateString("en-AE", { month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-AE", { hour: "numeric", minute: "2-digit" })
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
  const [furnishStyle, setFurnishStyle] = useState<FurnishStyle>("modern")
  // When editing an earlier result, its URL is the source of record.
  const [chainSource, setChainSource] = useState<string | null>(null)
  const [history, setHistory] = useState<EditRow[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [rowBusy, setRowBusy] = useState<string | null>(null)
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

  // The results gallery — everything this user generated before.
  useEffect(() => {
    let alive = true
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/ai/photo-studio", { cache: "no-store" })
        const data = (await res.json().catch(() => ({}))) as { rows?: EditRow[] }
        if (alive) setHistory(data.rows ?? [])
      } finally {
        if (alive) setHistoryLoaded(true)
      }
    }, 0)
    return () => { alive = false; clearTimeout(t) }
  }, [])

  if (!allowed) return null

  const pickFile = (f: File | null) => {
    if (!f) return
    if (preview) URL.revokeObjectURL(preview)
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setChainSource(null)
    setResult(null)
    setError(null)
  }

  /** Save any stored image to disk (cross-origin links will not download). */
  const downloadUrl = async (url: string) => {
    try {
      const res = await fetch("/api/image-proxy?url=" + encodeURIComponent(url))
      if (!res.ok) throw new Error("download failed")
      const blob = await res.blob()
      const href = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = href
      a.download = "fhi-ai-staging-" + (url.split("/").pop() ?? "photo.webp")
      a.click()
      URL.revokeObjectURL(href)
    } catch {
      window.open(url, "_blank", "noopener")
    }
  }

  /** Chained editing: pull a result back in as the next round's photo. */
  const editResult = async (url: string) => {
    setError(null)
    try {
      const res = await fetch("/api/image-proxy?url=" + encodeURIComponent(url))
      if (!res.ok) throw new Error("load failed")
      const blob = await res.blob()
      if (preview) URL.revokeObjectURL(preview)
      setFile(new File([blob], "staged.webp", { type: blob.type || "image/webp" }))
      setPreview(URL.createObjectURL(blob))
      setChainSource(url)
      setResult(null)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch {
      setError("Could not load that result for editing — try again.")
    }
  }

  /** Delete a gallery result — the record and the file in storage. */
  const deleteRow = async (row: EditRow) => {
    if (!window.confirm("Delete this image? The file is removed from storage permanently.")) return
    setRowBusy(row.id)
    try {
      const res = await fetch("/api/ai/photo-studio/" + row.id, { method: "DELETE" })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Delete failed.")
      setHistory((rs) => rs.filter((r) => r.id !== row.id))
      if (result === row.result_url) setResult(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.")
    } finally {
      setRowBusy(null)
    }
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
    const parts = [...picked].map((k) => presetInstruction(k, people, furnishStyle))
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
      await downloadUrl(result)
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
      if (chainSource) fd.append("sourceUrl", chainSource)
      const res = await fetch("/api/ai/photo-studio", { method: "POST", body: fd })
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? "Generation failed — try again.")
      setResult(data.url)
      // Refresh the gallery so the new result appears at the top.
      void fetch("/api/ai/photo-studio", { cache: "no-store" })
        .then((r) => r.json())
        .then((d: { rows?: EditRow[] }) => setHistory(d.rows ?? []))
        .catch(() => {})
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
            <p className="text-xs font-bold uppercase tracking-wide text-[#6b7280] mb-2">
              1 · Photo
              {chainSource && (
                <span className="ml-2 normal-case tracking-normal font-bold text-[#b8913f]">
                  · editing a previous result
                </span>
              )}
            </p>
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
                    {key === "furnish" && active && (
                      <span
                        className="flex flex-wrap items-center justify-end gap-1 shrink-0 max-w-[150px]"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        role="group"
                        aria-label="Furnishing style"
                      >
                        {FURNISH_STYLES.map(({ key: fs, label: fl }) => (
                          <button
                            key={fs}
                            type="button"
                            onClick={() => setFurnishStyle(fs)}
                            aria-pressed={furnishStyle === fs}
                            className={"px-2 py-1 text-[11px] font-bold transition-colors " + (
                              furnishStyle === fs
                                ? "bg-[#001f3f] text-white"
                                : "bg-white border border-[#e5e5e5] text-[#6b7280] hover:border-[#001f3f]"
                            )}
                          >
                            {fl}
                          </button>
                        ))}
                      </span>
                    )}
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
                  onClick={() => result && void editResult(result)}
                  className="inline-flex items-center gap-2 border border-[#d6b357] px-5 py-2.5 text-sm font-bold text-[#8a6d2a] hover:bg-[#faf7ee] transition-colors"
                >
                  <Pencil className="w-4 h-4" /> Edit This Result
                </button>
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

      {/* ── Results gallery — every generation, with download/edit/delete ── */}
      {historyLoaded && history.length > 0 && (
        <div className="bg-white border border-[#e5e8ec] p-5">
          <h2 className="font-['Outfit'] text-lg font-bold text-[#0d1117] flex items-center gap-2">
            <Images className="w-5 h-5 text-[#b8913f]" />
            My Results
            <span className="text-sm font-semibold text-[#9ca3af]">{history.length}</span>
          </h2>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {history.map((row) => (
              <figure key={row.id} className="group border border-[#eceef1] overflow-hidden">
                <button
                  type="button"
                  onClick={() => void editResult(row.result_url)}
                  title="Open this result for another edit"
                  className="relative block aspect-[4/3] w-full overflow-hidden bg-[#f4f5f7]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={row.result_url}
                    alt={row.prompt.slice(0, 60)}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                  />
                </button>
                <figcaption className="px-2.5 py-2">
                  <p className="text-[11px] text-[#9ca3af]">{whenLabel(row.created_at)}</p>
                  <p className="text-xs text-[#374151] line-clamp-1" title={row.prompt}>{row.prompt}</p>
                  <div className="mt-1.5 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void downloadUrl(row.result_url)}
                      title="Download"
                      aria-label="Download this result"
                      className="p-1.5 text-[#001f3f] hover:bg-[#001f3f]/10 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void editResult(row.result_url)}
                      title="Edit this result again"
                      aria-label="Edit this result again"
                      className="p-1.5 text-[#b8913f] hover:bg-[#d6b357]/15 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteRow(row)}
                      disabled={rowBusy === row.id}
                      title="Delete permanently"
                      aria-label="Delete this result permanently"
                      className="ml-auto p-1.5 text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                    >
                      {rowBusy === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
