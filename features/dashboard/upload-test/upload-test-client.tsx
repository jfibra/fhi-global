"use client"

import { useCallback, useRef, useState } from "react"
import { ImagePlus, Loader2, UploadCloud } from "lucide-react"

// Admin-only test bench for the server-side upload-compression pipeline
// (lib/upload/compress-image.ts, POST /api/upload/test-compress). Throws
// whatever image you pick at the exact same compress step every real upload
// route runs, and shows the before/after numbers side by side — no listing,
// avatar, or logo record needed to see how a photo actually compresses.
// Both the original and the result get uploaded to S3 under
// FHI_GLOBAL/_dev-upload-test/ so you can open either at full resolution.

const DISPLAY = "font-[family-name:var(--font-outfit)]"

type Side = {
  url: string
  bytes: number
  contentType: string
  width: number | null
  height: number | null
}

type Result = {
  compressed: boolean
  original: Side
  result: Side
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

function Panel({ title, side }: { title: string; side: Side }) {
  return (
    <div className="rounded-2xl border border-[#e6eaf1] bg-white overflow-hidden">
      <div className="relative h-56 bg-[#eef1f5]">
        {/* Test tool only — a plain <img> avoids next/image's remote-pattern
            allowlist friction and keeps this page fully self-contained. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={side.url} alt={title} className="h-full w-full object-contain" />
      </div>
      <div className="p-4 space-y-1.5">
        <p className={`${DISPLAY} text-sm font-bold text-[#0d1117]`}>{title}</p>
        <p className="text-2xl font-bold text-[#0d1117] tabular-nums">{formatBytes(side.bytes)}</p>
        <p className="text-xs text-[#6b7280]">
          {side.width && side.height ? `${side.width}×${side.height} · ` : ""}
          {side.contentType}
        </p>
        <a
          href={side.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs font-semibold text-[#001f3f] hover:underline"
        >
          Open full size &rarr;
        </a>
      </div>
    </div>
  )
}

export function UploadTestClient() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const runUpload = useCallback(async (file: File) => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload/test-compress", { method: "POST", body: fd })
      const data = (await res.json()) as Result & { error?: string }
      if (!res.ok) {
        setError(data.error ?? "Upload failed")
        return
      }
      setResult(data)
    } catch {
      setError("Network error — try again.")
    } finally {
      setBusy(false)
    }
  }, [])

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (file) void runUpload(file)
  }

  const reduction =
    result && result.original.bytes > 0
      ? Math.round((1 - result.result.bytes / result.original.bytes) * 100)
      : null

  return (
    <div className="space-y-5">
      <div>
        <h1 className={`${DISPLAY} text-2xl font-bold text-[#0d1117]`}>Upload compression test</h1>
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] text-white text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
        {busy ? "Uploading…" : "Choose an image"}
      </button>

      {error && (
        <p className="text-sm text-rose-600 font-medium" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#e6eaf1] bg-white px-5 py-4 flex flex-wrap items-center gap-x-8 gap-y-2">
            <div>
              <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider">Compressed</p>
              <p className={`${DISPLAY} text-lg font-bold ${result.compressed ? "text-emerald-600" : "text-[#9ca3af]"}`}>
                {result.compressed ? "Yes" : "No — passed through unchanged"}
              </p>
            </div>
            {reduction != null && result.compressed && (
              <div>
                <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider">Size reduction</p>
                <p className={`${DISPLAY} text-lg font-bold text-emerald-600 tabular-nums`}>{reduction}%</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Panel title="Original" side={result.original} />
            <Panel title="Result" side={result.result} />
          </div>
        </div>
      )}

      {!result && !busy && !error && (
        <div className="rounded-2xl border border-dashed border-[#d1d5db] bg-white/60 p-12 text-center">
          <span className="w-12 h-12 rounded-2xl bg-[#001f3f]/5 text-[#001f3f] flex items-center justify-center mx-auto mb-3">
            <ImagePlus className="w-6 h-6" />
          </span>
          <p className="text-sm text-[#6b7280]">Choose an image above to see it compressed.</p>
        </div>
      )}
    </div>
  )
}
