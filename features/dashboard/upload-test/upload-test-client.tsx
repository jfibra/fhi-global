"use client"

import { useCallback, useRef, useState } from "react"
import { ImagePlus, Loader2, UploadCloud } from "lucide-react"
import { compressImageForUpload } from "@/lib/upload/compress-image"

// Admin-only test bench for the upload-compression pipeline
// (lib/upload/compress-image.ts). Compression runs in THIS BROWSER — the same
// code path every real upload takes — so the numbers below are what your users
// actually get. Both files are then stored under FHI_GLOBAL/_dev-upload-test/
// so either can be opened at full resolution.

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
  compressMs: number
  uploadMs: number
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

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider">{label}</p>
      <p className={`${DISPLAY} text-lg font-bold tabular-nums ${accent ? "text-emerald-600" : "text-[#0d1117]"}`}>
        {value}
      </p>
    </div>
  )
}

export function UploadTestClient() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const runUpload = useCallback(async (picked: File) => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      // 1. Compress locally — this is the part that used to happen on the server.
      const t0 = performance.now()
      const compressedResult = await compressImageForUpload(picked)
      const compressMs = Math.round(performance.now() - t0)

      // 2. Send BOTH so they can be compared side by side. Note a real upload
      //    only ever sends the compressed one — this page is deliberately
      //    heavier than production so it can show you the original too.
      const t1 = performance.now()
      const fd = new FormData()
      fd.append("original", picked, picked.name)
      fd.append("result", compressedResult.file, compressedResult.file.name)

      const res = await fetch("/api/upload/test-compress", { method: "POST", body: fd })
      const data = (await res.json()) as { originalUrl?: string; resultUrl?: string; error?: string }
      const uploadMs = Math.round(performance.now() - t1)

      if (!res.ok || !data.originalUrl || !data.resultUrl) {
        setError(data.error ?? "Upload failed")
        return
      }

      setResult({
        compressed: compressedResult.compressed,
        compressMs,
        uploadMs,
        original: {
          url: data.originalUrl,
          bytes: compressedResult.originalBytes,
          contentType: picked.type,
          width: null,
          height: null,
        },
        result: {
          url: data.resultUrl,
          bytes: compressedResult.bytes,
          contentType: compressedResult.file.type,
          width: compressedResult.width,
          height: compressedResult.height,
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error — try again.")
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
        <p className="text-sm text-[#6b7280] mt-1 max-w-2xl">
          Pick any photo to run it through the same <strong>in-browser</strong> compression every upload
          uses — resize to 1200px, re-encode as WebP, search quality for a 100&nbsp;KB target. Real uploads
          only send the compressed file; this page uploads the original too, so you can compare them.
        </p>
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] text-white text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
        {busy ? "Working…" : "Choose an image"}
      </button>

      {error && (
        <p className="text-sm text-rose-600 font-medium" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#e6eaf1] bg-white px-5 py-4 flex flex-wrap items-center gap-x-10 gap-y-3">
            <Stat
              label="Compressed"
              value={result.compressed ? "Yes" : "No — passed through"}
              accent={result.compressed}
            />
            {reduction != null && result.compressed && (
              <Stat label="Size reduction" value={`${reduction}%`} accent />
            )}
            <Stat label="Compress time" value={`${result.compressMs} ms`} />
            <Stat label="Upload time" value={`${result.uploadMs} ms`} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Panel title="Original" side={result.original} />
            <Panel title="Result (what gets uploaded)" side={result.result} />
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
