"use client"

/**
 * My Team → "Share top sellers" (boss via Juliecor, 2026-10-14): a preview of
 * the 1080×1350 poster drawn by app/api/my-team/share-image for the selected
 * period, an AED-amounts switch (deals only when off), and Download / Share —
 * Share hands the picture straight to WhatsApp, Facebook etc. on a phone
 * (Web Share with a file), Download saves it everywhere else.
 */

import { useEffect, useState } from "react"
import { Download, Loader2, Share2, X } from "lucide-react"

type Props = {
  /** The poster route — "/api/my-team/share-image", with "?id=" for an admin looking at someone's team. */
  endpoint: string
  period: { from: string | null; to: string | null; label: string }
  onClose: () => void
}

function Preview({ url }: { url: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")
  return (
    <div className="relative aspect-[1080/1350] w-full overflow-hidden rounded-xl bg-[#001f3f]">
      {state !== "ready" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white/70">
          {state === "loading" ? <><Loader2 className="h-6 w-6 animate-spin text-[#d6b357]" /> Drawing your poster…</> : "Couldn't draw the picture. Try again."}
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Top sellers poster" onLoad={() => setState("ready")} onError={() => setState("error")} className={`h-full w-full object-contain transition-opacity duration-300 ${state === "ready" ? "opacity-100" : "opacity-0"}`} />
    </div>
  )
}

export default function ShareDialog({ endpoint, period, onClose }: Props) {
  const [amounts, setAmounts] = useState(true)
  const [busy, setBusy] = useState<"download" | "share" | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const qs = new URLSearchParams({ label: period.label, amounts: amounts ? "1" : "0" })
  if (period.from) qs.set("from", period.from)
  if (period.to) qs.set("to", period.to)
  const url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}${qs}`
  const fileName = `top-sellers-${period.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "team"}.jpg`
  const canShareFiles = typeof navigator !== "undefined" && typeof navigator.canShare === "function"

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const getFile = async () => {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return new File([await res.blob()], fileName, { type: "image/jpeg" })
  }
  const download = async () => {
    setBusy("download")
    setNote(null)
    try {
      const file = await getFile()
      const a = document.createElement("a")
      a.href = URL.createObjectURL(file)
      a.download = fileName
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      setNote("Couldn't download the picture. Try again.")
    } finally {
      setBusy(null)
    }
  }
  const share = async () => {
    setBusy("share")
    setNote(null)
    try {
      const file = await getFile()
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `Top sellers — ${period.label}` })
      else setNote("This browser can't share pictures directly — use Download instead.")
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setNote("Couldn't share the picture. Use Download instead.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Share top sellers">
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default bg-[#0d1117]/55 backdrop-blur-[2px] animate-in fade-in duration-200" />
      <div className="relative flex max-h-[100dvh] w-full max-w-[880px] flex-col overflow-y-auto rounded-t-3xl bg-white shadow-2xl animate-in slide-in-from-bottom-4 duration-200 sm:rounded-3xl md:flex-row">
        <div className="bg-[#f4f6f9] p-4 sm:p-6 md:w-[380px] md:shrink-0">
          <Preview key={url} url={url} />
        </div>
        <div className="flex flex-1 flex-col p-5 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.24em] text-[#b8913f]">Share</p>
              <h2 className="mt-1 font-['Outfit'] text-[22px] font-bold leading-tight text-[#0d1117]">Top sellers · {period.label}</h2>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-[#6b7280] hover:bg-[#f1f3f6] hover:text-[#0d1117]"><X className="h-5 w-5" /></button>
          </div>
          <p className="mt-2 text-sm text-[#6b7280]">A picture sized for Facebook, Instagram and WhatsApp — your team&rsquo;s logo, the top five and the team total. Post it to your group to celebrate the month.</p>

          <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-[#e8eaed] p-3.5">
            <span>
              <span className="block text-sm font-semibold text-[#111827]">Show AED amounts</span>
              <span className="block text-[12px] text-[#6b7280]">Off shows deal counts only.</span>
            </span>
            <button type="button" role="switch" aria-checked={amounts} onClick={() => setAmounts((v) => !v)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${amounts ? "bg-[#001f3f]" : "bg-[#d1d5db]"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${amounts ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </label>

          <div className="mt-auto flex flex-col gap-2 pt-6 sm:flex-row">
            {canShareFiles && (
              <button type="button" onClick={share} disabled={busy !== null} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#d6b357] px-4 text-sm font-bold text-[#001f3f] transition-colors hover:bg-[#c9a449] disabled:opacity-60">
                {busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Share
              </button>
            )}
            <button type="button" onClick={download} disabled={busy !== null} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#001f3f] px-4 text-sm font-bold text-white transition-colors hover:bg-[#00356b] disabled:opacity-60">
              {busy === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download
            </button>
          </div>
          {note && <p className="mt-3 text-[12px] text-rose-600">{note}</p>}
        </div>
      </div>
    </div>
  )
}
