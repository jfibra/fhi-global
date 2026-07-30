"use client"

// Reels Studio — per-project 9:16 video reel generator. Canvas-animated
// (branded intro → Ken Burns photo slides → CTA outro with QR), previewed
// live and exported in-browser via canvas.captureStream + MediaRecorder —
// the same recording pipeline as the listings Reel Maker.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { QRCodeCanvas } from "qrcode.react"
import {
  Clapperboard, Download, Loader2, Pause, Play, RotateCcw, Film, Music,
} from "lucide-react"
import type { Project } from "@/lib/project-service"
import { proxied, formatPrice } from "@/lib/flyer/theme"
import {
  assembleProjectMarketing,
  type ProjectMarketingData,
} from "./marketing/marketing-data"
import {
  REEL_W,
  REEL_H,
  buildReelTimeline,
  reelDuration,
  drawReelFrame,
  loadReelImage,
  type ReelInputs,
  type ReelAssets,
  type ReelCaption,
} from "./marketing/reel-engine"

interface Props {
  project: Project
  showToast: (variant: "success" | "error", message: string) => void
}

const LOGO_WHITE = "/FHI_Branding_White.png"
const MAX_PHOTOS = 8

// Selectable soundtracks (files live in public/reelssounds). There is no
// dedicated FHI jingle yet, so "FHI Global Property" reuses the FH Global
// Partners track — swap its src here when an FHI jingle lands.
type Soundtrack = { key: string; label: string; src: string }
const SOUNDTRACKS: Soundtrack[] = [
  { key: "fhi-global", label: "FHI Global Property", src: "/reelssounds/fh-global-partners-jingle.mp3" },
  { key: "fh-partners", label: "FH Global Partners", src: "/reelssounds/fh-global-partners-jingle.mp3" },
  { key: "homes-ph", label: "Homes PH", src: "/reelssounds/homes-ph-jingle.mp3" },
  { key: "rent-ph", label: "Rent PH", src: "/reelssounds/rent-ph-jingle.mp3" },
  { key: "filipino-homes", label: "Filipino Homes", src: "/reelssounds/filipinohomes-jingle.mp3" },
]

export function ProjectReelsTab({ project, showToast }: Props) {
  const [data, setData] = useState<ProjectMarketingData | null>(null)
  const [loading, setLoading] = useState(true)

  // selection is an ORDERED list of gallery URLs
  const [selectedUrls, setSelectedUrls] = useState<string[]>([])
  const [title, setTitle] = useState("")
  const [priceLine, setPriceLine] = useState("")
  const [locationLine, setLocationLine] = useState("")

  const [playing, setPlaying] = useState(false)
  const [recording, setRecording] = useState(false)
  const [progress, setProgress] = useState(0)

  const [musicOn, setMusicOn] = useState(true)
  const [soundtrackKey, setSoundtrackKey] = useState(SOUNDTRACKS[0].key)
  const soundtrack = useMemo(
    () => SOUNDTRACKS.find((s) => s.key === soundtrackKey) ?? SOUNDTRACKS[0],
    [soundtrackKey],
  )

  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null)
  const [photoImgs, setPhotoImgs] = useState<HTMLImageElement[]>([])
  const [fontFamily, setFontFamily] = useState("Arial, sans-serif")

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const qrBoxRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)
  const playStartRef = useRef(0)
  const pausedAtRef = useRef(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  // ── Data assembly ────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    setLoading(true)
    void assembleProjectMarketing(project).then((d) => {
      if (!alive) return
      setData(d)
      setSelectedUrls(d.gallery.slice(0, 5))
      setTitle(d.name)
      setPriceLine(d.priceFrom ? `From ${formatPrice(d.priceFrom, d.currency)}` : "")
      setLocationLine(d.locationLine)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [project])

  // Resolve the Outfit family next/font registered, for canvas text.
  // next/font puts the CSS variable on <body>, not <html>.
  useEffect(() => {
    const fam = getComputedStyle(document.body).getPropertyValue("--font-outfit").trim()
    if (fam) setFontFamily(`${fam}, Arial, sans-serif`)
    void document.fonts?.ready
  }, [])

  useEffect(() => {
    let alive = true
    void loadReelImage(LOGO_WHITE).then((img) => {
      if (alive) setLogoImg(img)
    })
    return () => {
      alive = false
    }
  }, [])

  // (Re)load selected photos.
  useEffect(() => {
    let alive = true
    void Promise.all(selectedUrls.map((u) => loadReelImage(proxied(u)))).then((imgs) => {
      if (alive) setPhotoImgs(imgs.filter(Boolean) as HTMLImageElement[])
    })
    return () => {
      alive = false
    }
  }, [selectedUrls])

  // ── Reel timeline / inputs / assets ──────────────────────────────────────
  const scenes = useMemo(() => buildReelTimeline(photoImgs.length), [photoImgs.length])
  const totalS = useMemo(() => reelDuration(scenes), [scenes])

  const captions = useMemo<ReelCaption[]>(() => {
    if (!data) return []
    const pool: ReelCaption[] = []
    if (priceLine) pool.push({ title: priceLine, sub: "Starting price" })
    if (data.handoverLabel) pool.push({ title: `Handover ${data.handoverLabel}`, sub: data.statusLabel })
    for (const f of data.features.slice(0, 4)) pool.push({ title: f, sub: "Highlight" })
    if (data.amenities.length) pool.push({ title: data.amenities.slice(0, 3).join("  •  "), sub: "Amenities" })
    if (locationLine) pool.push({ title: locationLine, sub: "Location" })
    if (pool.length === 0) pool.push({ title: title, sub: locationLine })
    return pool
  }, [data, priceLine, locationLine, title])

  const inputs = useMemo<ReelInputs>(
    () => ({
      title,
      statusLine: data
        ? `${data.statusLabel}${data.handoverLabel ? `  •  Handover ${data.handoverLabel}` : ""}`
        : "",
      locationLine,
      priceLine,
      captions,
      contactPhone: data?.contactPhone ?? "",
      contactEmail: data?.contactEmail ?? "",
      developerName: data?.developerName ?? "",
    }),
    [title, locationLine, priceLine, captions, data],
  )

  const assets = useMemo<ReelAssets>(() => {
    const qrCanvas = qrBoxRef.current?.querySelector("canvas") ?? null
    return { logo: logoImg, photos: photoImgs, qr: qrCanvas, font: fontFamily }
  }, [logoImg, photoImgs, fontFamily])

  // ── Playback ─────────────────────────────────────────────────────────────
  const stopPlayback = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    setPlaying(false)
    audioRef.current?.pause()
  }, [])

  // Draw a static frame whenever anything changes while idle. At t=0 the
  // intro hasn't faded in yet, so show a mid-intro frame instead of black.
  useEffect(() => {
    if (playing || recording) return
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    const t = pausedAtRef.current > 0 ? pausedAtRef.current : 2.2
    drawReelFrame(ctx, t, scenes, inputs, assets)
  }, [playing, recording, scenes, inputs, assets])

  const runLoop = useCallback(
    (onDone?: () => void) => {
      const ctx = canvasRef.current?.getContext("2d")
      if (!ctx) return
      const tick = () => {
        const elapsed = (performance.now() - playStartRef.current) / 1000
        if (elapsed >= totalS) {
          drawReelFrame(ctx, totalS, scenes, inputs, assets)
          setProgress(1)
          onDone?.()
          return
        }
        drawReelFrame(ctx, elapsed, scenes, inputs, assets)
        setProgress(elapsed / totalS)
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    },
    [scenes, inputs, assets, totalS],
  )

  const handlePlayPause = useCallback(() => {
    if (recording) return
    if (playing) {
      pausedAtRef.current = (performance.now() - playStartRef.current) / 1000
      stopPlayback()
      return
    }
    const resumeFrom = pausedAtRef.current >= totalS ? 0 : pausedAtRef.current
    playStartRef.current = performance.now() - resumeFrom * 1000
    setPlaying(true)
    if (musicOn) {
      if (!audioRef.current) audioRef.current = new Audio()
      const a = audioRef.current
      if (!a.src.endsWith(soundtrack.src)) a.src = soundtrack.src
      a.loop = true
      a.currentTime = resumeFrom % 60
      void a.play().catch(() => {})
    }
    runLoop(() => {
      pausedAtRef.current = 0
      stopPlayback()
    })
  }, [playing, recording, totalS, musicOn, soundtrack.src, runLoop, stopPlayback])

  const handleRestart = useCallback(() => {
    if (recording) return
    stopPlayback()
    pausedAtRef.current = 0
    setProgress(0)
    const ctx = canvasRef.current?.getContext("2d")
    if (ctx) drawReelFrame(ctx, 0, scenes, inputs, assets)
  }, [recording, stopPlayback, scenes, inputs, assets])

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current)
      audioRef.current?.pause()
      try {
        if (recorderRef.current?.state === "recording") recorderRef.current.stop()
      } catch {
        // already stopped
      }
      void audioCtxRef.current?.close().catch(() => {})
    },
    [],
  )

  // Stop the preview jingle immediately if music is switched off mid-playback.
  useEffect(() => {
    if (!musicOn) audioRef.current?.pause()
  }, [musicOn])

  // ── Export ───────────────────────────────────────────────────────────────
  const handleRecord = useCallback(async () => {
    if (recording) return
    const canvas = canvasRef.current
    if (!canvas) return
    stopPlayback()
    setRecording(true)
    setProgress(0)
    try {
      await document.fonts?.ready
      const stream = canvas.captureStream(30)

      // Mix the selected jingle in via WebAudio (export stays silent on speakers).
      if (musicOn) {
        try {
          const actx = new AudioContext()
          audioCtxRef.current = actx
          const res = await fetch(soundtrack.src)
          const buf = await actx.decodeAudioData(await res.arrayBuffer())
          const src = actx.createBufferSource()
          src.buffer = buf
          src.loop = true
          const dest = actx.createMediaStreamDestination()
          src.connect(dest)
          src.start()
          for (const track of dest.stream.getAudioTracks()) stream.addTrack(track)
        } catch {
          // No audio if the jingle fails to decode — video still exports.
        }
      }

      const candidates = [
        "video/mp4;codecs=avc1",
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm",
      ]
      const mime = candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? ""
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 9_000_000 } : undefined)
      recorderRef.current = recorder
      const chunks: BlobPart[] = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      const done = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve()
      })
      recorder.start(250)

      playStartRef.current = performance.now()
      await new Promise<void>((resolve) => {
        runLoop(() => resolve())
      })

      recorder.stop()
      await done
      for (const track of stream.getTracks()) track.stop()
      void audioCtxRef.current?.close().catch(() => {})
      audioCtxRef.current = null

      const ext = mime.startsWith("video/mp4") ? "mp4" : "webm"
      const blob = new Blob(chunks, { type: mime || "video/webm" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${project.slug}-reel.${ext}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      showToast("success", `Reel exported (${ext.toUpperCase()})`)
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Recording failed — try Chrome or Edge.")
    } finally {
      setRecording(false)
      setProgress(0)
      pausedAtRef.current = 0
    }
  }, [recording, stopPlayback, runLoop, musicOn, soundtrack.src, project.slug, showToast])

  // ── Photo selection ──────────────────────────────────────────────────────
  const togglePhoto = (url: string) => {
    if (recording) return
    stopPlayback()
    pausedAtRef.current = 0
    setProgress(0)
    setSelectedUrls((prev) =>
      prev.includes(url)
        ? prev.filter((u) => u !== url)
        : prev.length >= MAX_PHOTOS
          ? prev
          : [...prev, url],
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading || !data) {
    return (
      <div className="max-w-5xl space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`rounded-2xl bg-[#f3f4f6] animate-pulse ${i === 0 ? "h-24" : "h-52"}`} />
        ))}
      </div>
    )
  }

  const inputCls =
    "w-full border border-[#e5e5e5] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f]"
  const labelCls = "block text-xs font-semibold text-[#6b7280] mb-1.5"

  return (
    <div className="max-w-6xl space-y-5">
      {/* hidden QR source for the outro scene */}
      <div ref={qrBoxRef} className="absolute -left-[9999px] top-0" aria-hidden>
        <QRCodeCanvas value={data.publicUrl} size={512} fgColor="#001428" bgColor="#ffffff" level="M" />
      </div>

      {/* heading */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-['Outfit'] text-lg font-bold text-[#001f3f] flex items-center gap-2">
            <Clapperboard className="w-5 h-5 text-[#d6b357]" /> Reels Studio
          </h3>
          <p className="text-xs text-[#9ca3af] mt-0.5">
            A branded 9:16 video reel from this project&apos;s photos — preview live, then export ({Math.round(totalS)}s, 1080 × 1920).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleRecord()}
          disabled={recording || photoImgs.length === 0}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#001f3f]/90 transition-all disabled:opacity-50 flex-shrink-0"
        >
          {recording ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
          {recording ? `Recording… ${Math.round(progress * 100)}%` : "Export Reel"}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-5 items-start">
        {/* ── Controls ────────────────────────────────────────────────────── */}
        <div className="space-y-5 min-w-0">
          {/* Photo selection */}
          <div className="bg-white rounded-2xl border border-[#e5e5e5] p-5">
            <p className={labelCls}>
              Slides — tap to include (order = tap order, max {MAX_PHOTOS})
            </p>
            {data.gallery.length === 0 ? (
              <p className="text-sm text-[#9ca3af] py-3">
                No images yet — add photos in the Images tab and they will appear here.
              </p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
                {data.gallery.slice(0, 18).map((url) => {
                  const order = selectedUrls.indexOf(url)
                  const active = order >= 0
                  return (
                    <button
                      key={url}
                      type="button"
                      onClick={() => togglePhoto(url)}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                        active ? "border-[#d6b357] shadow-md" : "border-transparent hover:border-[#c4c9d4] opacity-80"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={proxied(url)} alt="" className="w-full h-16 object-cover" />
                      {active && (
                        <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#d6b357] text-[#001f3f] text-[11px] font-black flex items-center justify-center shadow">
                          {order + 1}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Copy */}
          <div className="bg-white rounded-2xl border border-[#e5e5e5] p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="reel-title" className={labelCls}>Title</label>
              <input id="reel-title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="reel-price" className={labelCls}>Price line</label>
              <input id="reel-price" value={priceLine} onChange={(e) => setPriceLine(e.target.value)} placeholder="From AED …" className={inputCls} />
            </div>
            <div>
              <label htmlFor="reel-location" className={labelCls}>Location line</label>
              <input id="reel-location" value={locationLine} onChange={(e) => setLocationLine(e.target.value)} className={inputCls} />
            </div>
            <p className="sm:col-span-2 text-[11px] text-[#9ca3af]">
              Slide captions rotate automatically through price, handover, features and amenities pulled from the project.
              The outro carries a QR code to the public project page{data.contactPhone || data.contactEmail ? " plus the sales contact" : ""}.
            </p>
          </div>

          {/* Soundtrack */}
          <div className="bg-white rounded-2xl border border-[#e5e5e5] p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className={labelCls}>Music</span>
              <button
                type="button"
                onClick={() => setMusicOn((v) => !v)}
                disabled={recording}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors disabled:opacity-50 ${
                  musicOn
                    ? "border-[#001f3f] bg-[#001f3f]/5 text-[#001f3f]"
                    : "border-[#e5e5e5] text-[#6b7280]"
                }`}
              >
                <Music className="w-4 h-4" />
                Brand jingle: {musicOn ? "On" : "Off"}
              </button>
            </div>
            <div>
              <label htmlFor="reel-soundtrack" className={labelCls}>Soundtrack</label>
              <select
                id="reel-soundtrack"
                value={soundtrackKey}
                onChange={(e) => setSoundtrackKey(e.target.value)}
                disabled={!musicOn || recording}
                className={`${inputCls} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {SOUNDTRACKS.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
            <p className="sm:col-span-2 text-[11px] text-[#9ca3af]">
              The chosen jingle plays under the live preview and is mixed into the exported video.
            </p>
          </div>
        </div>

        {/* ── Preview ─────────────────────────────────────────────────────── */}
        <div className="mx-auto xl:mx-0 w-[320px]">
          <div className="relative rounded-3xl overflow-hidden shadow-[0_12px_48px_-12px_rgba(0,31,63,0.5)] border border-[#e5e5e5] bg-[#001428]">
            <canvas
              ref={canvasRef}
              width={REEL_W}
              height={REEL_H}
              className="w-full h-auto block"
            />
            {recording && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-rose-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> REC
              </div>
            )}
          </div>

          {/* transport */}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handlePlayPause}
              disabled={recording || photoImgs.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full border-2 border-[#001f3f] text-[#001f3f] text-sm font-bold hover:bg-[#001f3f] hover:text-white transition-all disabled:opacity-40"
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {playing ? "Pause" : "Preview"}
            </button>
            <button
              type="button"
              onClick={handleRestart}
              disabled={recording}
              className="w-11 h-11 flex items-center justify-center rounded-full border border-[#e5e5e5] text-[#6b7280] hover:text-[#001f3f] hover:border-[#001f3f] transition-all disabled:opacity-40"
              aria-label="Restart"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* progress */}
          <div className="mt-2 h-1.5 rounded-full bg-[#f3f4f6] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#d6b357] to-[#ca9104] transition-[width] duration-150"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="text-center text-[11px] text-[#9ca3af] mt-2 flex items-center justify-center gap-1">
            <Download className="w-3 h-3" />
            Exports as MP4 (or WebM) — ready for Instagram & TikTok
          </p>
        </div>
      </div>
    </div>
  )
}
