"use client"

/**
 * Ad Branding — put logos and the ad permit on a photo or a video and
 * download the result (for property ads on social media).
 *
 * Nothing leaves the browser: the file and the logos are read with object
 * URLs, edited on screen, and the download is made here — a photo is drawn on
 * a canvas; a video is re-encoded frame by frame with WebCodecs (mediabunny,
 * loaded only when a video is saved), each frame drawn with the logos on top,
 * the sound kept. No upload, no API call, nothing stored.
 *
 * Every logo is kept in media-relative units (centre x/y and width as a
 * fraction of the picture), so the on-screen preview and the full-resolution
 * download place it identically.
 */

import { useEffect, useRef, useState } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import type { Conversion } from "mediabunny"
import {
  ArrowLeftRight, Check, ChevronLeft, ChevronRight, Download, GalleryHorizontal, ImagePlus, LayoutGrid, Loader2,
  Music, Pause, Play, Trash2, Volume2, VolumeX, X,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { ROLES_AD_BRANDING, resolveAppRoleOrMember } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"

type Media = { kind: "image" | "video"; file: File; url: string; name: string; w: number; h: number }

type Logo = {
  id: string
  /** Which logo this is (its file, or "permit") — each can be on the picture only once. */
  key: string
  src: string
  name: string
  /** width / height of the logo image */
  aspect: number
  /** centre, as a fraction of the picture's width / height */
  x: number
  y: number
  /** width as a fraction of the picture's width */
  w: number
  /** Outline strength 0–200 (0 = none; the image is redrawn when it changes), the logo file it is drawn
   *  from (preset logos; the permit is drawn from its text), and whether it is light (→ dark outline). */
  outline?: number
  base?: string
  light?: boolean
}

// `pair`: the light and dark versions of one brand — only one of a pair can be on the picture;
// picking the other swaps it in place.
const PRESET_LOGOS: { src: string; name: string; dark?: boolean; pair?: string }[] = [
  { src: "/logos/FHI_Branding Set_PNG Copies-02.png", name: "FHI Global (dark)", pair: "fhi" },
  { src: "/logos/FHI_Branding_White.png", name: "FHI Global (light)", dark: true, pair: "fhi" },
  { src: "/logos/global_partner.png", name: "Global Partners" },
  { src: "/logos/ad-branding/filipinohomes-dark.png", name: "Filipinohomes (dark)", pair: "filipinohomes" },
  { src: "/logos/ad-branding/filipinohomes-light.png", name: "Filipinohomes (light)", dark: true, pair: "filipinohomes" },
  { src: "/logos/ad-branding/rent-ph.png", name: "Rent.ph" },
  { src: "/logos/ad-branding/homes-ph.png", name: "Homes.ph", pair: "homesph" },
  { src: "/logos/ad-branding/homes-ph-light.png", name: "Homes.ph (light)", dark: true, pair: "homesph" },
  { src: "/logos/ad-branding/rentsouq-ae.png", name: "Rentsouq.ae" },
]

/** The other version (light ↔ dark) of a preset logo that is on the picture, if any. */
const pairedOnMedia = <L extends { key: string }>(p: (typeof PRESET_LOGOS)[number], logos: L[]): L | undefined =>
  p.pair ? logos.find((l) => l.key !== p.src && PRESET_LOGOS.some((q) => q.src === l.key && q.pair === p.pair)) : undefined

/** The company's ad permit line — fixed, not editable — drawn as white text with a dark outline. */
const PERMIT_TEXT = "FHI Global Ad Permit No. 145225"
const PERMIT_OUTLINE = 100
const PERMIT_KEY = "permit"

/**
 * The permit line drawn at high resolution into a transparent PNG, so it
 * moves, resizes and downloads exactly like a logo: white letters with a dark
 * outline round each one and a soft shadow, like the logos' outline.
 * `outline` 0–200 sets the thickness (0 = plain white text). The canvas size
 * doesn't depend on it, so the line keeps its size and place when it changes.
 */
async function textImage(text: string, outline: number): Promise<string> {
  const family = getComputedStyle(document.body).fontFamily || "Arial, Helvetica, sans-serif"
  const size = 160
  const font = `600 ${size}px ${family}`
  await document.fonts?.load(font).catch(() => undefined)
  const pad = Math.round(size * 0.5)
  const t = clamp(outline, 0, 200) / 100
  const measure = document.createElement("canvas").getContext("2d")
  if (!measure) throw new Error("Your browser couldn't draw the text.")
  measure.font = font
  const canvas = document.createElement("canvas")
  canvas.width = Math.ceil(measure.measureText(text).width) + pad * 2
  canvas.height = Math.ceil(size * 1.3) + pad * 2
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Your browser couldn't draw the text.")
  ctx.font = font
  ctx.textBaseline = "middle"
  ctx.lineJoin = "round"
  const y = canvas.height / 2
  if (t > 0) {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.85)"
    ctx.lineWidth = size * 0.1 * t
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)"
    ctx.shadowBlur = size * 0.08 * t
    ctx.strokeText(text, pad, y)
    ctx.shadowColor = "transparent"
    ctx.shadowBlur = 0
  }
  ctx.fillStyle = "#ffffff"
  ctx.fillText(text, pad, y)
  return canvas.toDataURL("image/png")
}

// Preview zoom limits (the slider runs 50%–400%; 100% = the whole picture fits).
const ZOOM_MIN = 0.5
const ZOOM_MAX = 4
// Screen height NOT available to the picture at 100% zoom: the dashboard header
// (~73), the page padding (48) and the panel's padding + border (26) — so the
// whole picture shows without scrolling the page. A video also has its player bar.
const FIT_OFFSET = 150
const PLAYER_BAR = 44
// The jingle bar under the player (when a jingle is chosen).
const JINGLE_BAR = 58
// The shortest part of a jingle that can be chosen (seconds).
const MIN_JINGLE_PART = 1

const MARGIN = 0.04 // of the picture's width, for the quick positions
// iOS Safari refuses canvases over ~16.7 MP; bigger photos are scaled down to fit on download.
const MAX_PIXELS = 16_000_000
// A video smaller than this (short side) is saved at it, so the logos stay sharp.
const MIN_VIDEO_SHORT_SIDE = 1080

// The brand jingles — the same tracks as the Reels Maker (public/reelssounds).
// A jingle can only be used when one of its brand's logos is on the video (`logos` = preset
// logo files); Rent.ph and Rentsouq.ae share the Rent.ph jingle, as in the Reels Maker.
const JINGLES = [
  { src: "/reelssounds/filipinohomes-jingle.mp3", name: "Filipino Homes", brand: "Filipinohomes", logos: ["/logos/ad-branding/filipinohomes-dark.png", "/logos/ad-branding/filipinohomes-light.png"] },
  { src: "/reelssounds/homes-ph-jingle.mp3", name: "Homes.ph", brand: "Homes.ph", logos: ["/logos/ad-branding/homes-ph.png", "/logos/ad-branding/homes-ph-light.png"] },
  { src: "/reelssounds/rent-ph-jingle.mp3", name: "Rent.ph", brand: "Rent.ph or Rentsouq.ae", logos: ["/logos/ad-branding/rent-ph.png", "/logos/ad-branding/rentsouq-ae.png"] },
  { src: "/reelssounds/global-partners.mp3", name: "Global Partners", brand: "Global Partners", logos: ["/logos/global_partner.png"] },
  { src: "/reelssounds/global-partners-instrumental.mp3", name: "FHI", brand: "FHI Global", logos: ["/logos/FHI_Branding Set_PNG Copies-02.png", "/logos/FHI_Branding_White.png"] },
]

/** Whether a jingle's brand logo is on the picture. */
const jingleAllowed = (src: string, logos: { key: string }[]) =>
  !!JINGLES.find((j) => j.src === src)?.logos.some((k) => logos.some((l) => l.key === k))
const DEFAULT_JINGLE_VOLUME = 70
// How long the jingle fades in at the start and out at the end (seconds).
const DEFAULT_EASE_IN = 0
const DEFAULT_EASE_OUT = 3

/** The part of the jingle that plays (start–end, seconds; it repeats if the video is longer) and its eases. */
type JingleShape = { start: number; end: number; easeIn: number; easeOut: number }

/** Where in the jingle the video's moment `t` falls: the chosen part from its start, repeating. */
function jingleTimeAt(t: number, { start, end }: Pick<JingleShape, "start" | "end">) {
  const part = Math.max(MIN_JINGLE_PART, end - start)
  return start + (Math.max(0, t) % part)
}

/** The jingle's volume (0–1) at a moment of the video: its volume, faded in at the start and out at the end. */
function jingleGainAt(t: number, duration: number, volume: number, { easeIn, easeOut }: JingleShape) {
  const g = clamp(volume, 0, 100) / 100
  const fadeIn = easeIn > 0 ? clamp(t / easeIn, 0, 1) : 1
  const fadeOut = easeOut > 0 && duration > 0 ? clamp((duration - t) / easeOut, 0, 1) : 1
  return g * Math.min(fadeIn, fadeOut)
}

/**
 * The saved video's sound, mixed here (OfflineAudioContext): the video's own
 * sound when kept, plus the jingle from the chosen point, looped to the
 * video's length at its volume, eased in at the start and out at the end.
 * Returns one stereo AudioBuffer.
 */
async function mixSound(
  mb: typeof import("mediabunny"),
  own: import("mediabunny").InputAudioTrack | null,
  jingleSrc: string,
  jingleVolume: number,
  duration: number,
  shape: JingleShape,
): Promise<AudioBuffer> {
  const rate = own?.sampleRate || 48_000
  const length = Math.max(1, Math.ceil(duration * rate))
  const ctx = new OfflineAudioContext(2, length, rate)
  // A limiter on the mix, so the video's sound plus the jingle never clips (crackles).
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -3
  limiter.knee.value = 3
  limiter.ratio.value = 20
  limiter.attack.value = 0.003
  limiter.release.value = 0.2
  limiter.connect(ctx.destination)

  if (own) {
    // The video's own sound, laid out sample by sample at its timestamps.
    const left = new Float32Array(length)
    const right = new Float32Array(length)
    const sink = new mb.AudioBufferSink(own)
    for await (const { buffer, timestamp } of sink.buffers(0, duration)) {
      const at = Math.max(0, Math.round(timestamp * rate))
      if (at >= length) break
      const n = Math.min(buffer.length, length - at)
      const l = buffer.getChannelData(0)
      const r = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : l
      left.set(l.subarray(0, n), at)
      right.set(r.subarray(0, n), at)
    }
    const ownBuffer = ctx.createBuffer(2, length, rate)
    ownBuffer.copyToChannel(left, 0)
    ownBuffer.copyToChannel(right, 1)
    const node = ctx.createBufferSource()
    node.buffer = ownBuffer
    node.connect(limiter)
    node.start(0)
  }

  const res = await fetch(jingleSrc)
  if (!res.ok) throw new Error("Couldn't load the jingle.")
  const jingle = await ctx.decodeAudioData(await res.arrayBuffer())
  const node = ctx.createBufferSource()
  node.buffer = jingle
  // Play the chosen part, repeating it if the video is longer.
  const partStart = clamp(shape.start, 0, Math.max(0, jingle.duration - MIN_JINGLE_PART))
  const partEnd = clamp(shape.end, partStart + MIN_JINGLE_PART, jingle.duration)
  node.loop = true
  node.loopStart = partStart
  node.loopEnd = partEnd
  const gain = ctx.createGain()
  const g = clamp(jingleVolume, 0, 100) / 100
  // Same curve as the preview (jingleGainAt): a straight ramp in, a straight ramp out;
  // on a video shorter than both eases together, they meet where they cross.
  const easeIn = Math.min(shape.easeIn, duration)
  const easeOut = Math.min(shape.easeOut, duration)
  const meet = easeIn > 0 && easeOut > 0 ? (duration * easeIn) / (easeIn + easeOut) : null
  const top = meet !== null && easeIn + easeOut > duration ? jingleGainAt(meet, duration, jingleVolume, shape) : g
  if (easeIn > 0) {
    gain.gain.setValueAtTime(0, 0)
    gain.gain.linearRampToValueAtTime(top, easeIn + easeOut > duration && meet !== null ? meet : easeIn)
  } else {
    gain.gain.setValueAtTime(g, 0)
  }
  if (easeOut > 0) {
    const from = Math.max(easeIn + easeOut > duration && meet !== null ? meet : easeIn, duration - easeOut)
    gain.gain.setValueAtTime(top, from)
    gain.gain.linearRampToValueAtTime(0, duration)
  }
  node.connect(gain).connect(limiter)
  node.start(0, partStart)
  node.stop(duration)
  const out = await ctx.startRendering()
  // Then a hard ceiling: if the loudest moment is above -1 dB, the whole mix is turned down to
  // it — the limiter alone lets a few peaks through, and the AAC encoder would clip those.
  const ceiling = 10 ** (-1 / 20)
  let peak = 0
  for (let c = 0; c < out.numberOfChannels; c++) {
    const d = out.getChannelData(c)
    for (let i = 0; i < d.length; i++) {
      const v = Math.abs(d[i])
      if (v > peak) peak = v
    }
  }
  if (peak > ceiling) {
    const k = ceiling / peak
    for (let c = 0; c < out.numberOfChannels; c++) {
      const d = out.getChannelData(c)
      for (let i = 0; i < d.length; i++) d[i] *= k
    }
  }
  return out
}

// Dragging within this many screen pixels of a centre line snaps onto it.
const SNAP_PX = 6
const isCentered = (v: number) => Math.abs(v - 0.5) < 0.0005

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const newId = () => Math.random().toString(36).slice(2, 10)
const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)
const clock = (s: number) => {
  const t = Math.max(0, Math.floor(Number.isFinite(s) ? s : 0))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`
}

const DEFAULT_OUTLINE = 0

/**
 * A logo with an outline round every letter, drawn into a transparent PNG so
 * the preview and the download match: a light logo gets a dark outline with
 * a soft shadow, any other logo a white one. `strength` 0–200 sets the
 * thickness (0 = the plain logo). The padding doesn't depend on it, so the
 * logo keeps its size and place when the outline changes.
 */
async function outlineImage(src: string, light: boolean, strength: number): Promise<string> {
  const img = await loadImage(src)
  const scale = Math.min(1, 1600 / Math.max(1, img.naturalWidth))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const unit = Math.min(h, w / 2) // ≈ the letters' height, also for tall stacked logos
  const pad = Math.ceil(unit * 0.12)
  const t = clamp(strength, 0, 200) / 100
  const r = unit * 0.025 * t
  const color = light ? "#000000" : "#ffffff"

  const canvas = document.createElement("canvas")
  canvas.width = w + pad * 2
  canvas.height = h + pad * 2
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Your browser couldn't draw the logo.")
  ctx.imageSmoothingQuality = "high"
  if (r > 0) {
    // The logo's shape in the outline colour…
    const sil = document.createElement("canvas")
    sil.width = w
    sil.height = h
    const sctx = sil.getContext("2d")
    if (!sctx) throw new Error("Your browser couldn't draw the logo.")
    sctx.drawImage(img, 0, 0, w, h)
    sctx.globalCompositeOperation = "source-in"
    sctx.fillStyle = color
    sctx.fillRect(0, 0, w, h)
    // …stamped all round at the outline's radius (and half of it, so there are no gaps),
    const ring = document.createElement("canvas")
    ring.width = canvas.width
    ring.height = canvas.height
    const rctx = ring.getContext("2d")
    if (!rctx) throw new Error("Your browser couldn't draw the logo.")
    for (const d of [r, r / 2]) {
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2
        rctx.drawImage(sil, pad + Math.cos(a) * d, pad + Math.sin(a) * d)
      }
    }
    // with a soft shadow of the same colour round it, then the logo on top.
    ctx.shadowColor = light ? "rgba(0, 0, 0, 0.6)" : "rgba(255, 255, 255, 0.5)"
    ctx.shadowBlur = r * 1.5
    ctx.globalAlpha = light ? 0.85 : 0.95
    ctx.drawImage(ring, 0, 0)
    ctx.globalAlpha = 1
    ctx.shadowColor = "transparent"
    ctx.shadowBlur = 0
  }
  ctx.drawImage(img, pad, pad, w, h)
  return canvas.toDataURL("image/png")
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Could not read that image."))
    img.src = src
  })
}

/** The video's displayed size (rotation already applied, as the browser shows it). */
function loadVideoSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video")
    v.preload = "metadata"
    v.muted = true
    v.onloadedmetadata = () => (v.videoWidth && v.videoHeight ? resolve({ w: v.videoWidth, h: v.videoHeight }) : reject(new Error("That file has no picture.")))
    v.onerror = () => reject(new Error("This browser can't play that video. Try another file, or Chrome / Safari."))
    v.src = src
  })
}

function saveBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = href
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}

/**
 * The saved video keeps the original's codec, size (videos under 1080p are saved at 1080p), frame rate and sound —
 * only the logos are added. Putting a logo INTO the picture means every frame
 * is encoded again, so the bitrate follows the original's with a little room
 * on top, so the second pass doesn't show:
 *   - +15% over the original (≈10% bigger file, practically invisible pass);
 *   - +50% when this browser can't write the original's codec and falls back
 *     to H.264 (HEVC in Chrome on Windows) — H.264 needs more bits for the same look;
 *   - never below 0.02 bits per pixel per frame (~1.2 Mbps at 1080p30): a
 *     normal phone video (~0.1–0.2) never reaches it; an already squeezed
 *     clip does, because the browser's encoder is weaker than a desktop one at
 *     very low rates (tested 2026-11-23 on a 117 kbps 480p clip: +15% looked
 *     soft, this floor — about 1.5× the file — looked like the original).
 */
async function originalSettings(
  mb: typeof import("mediabunny"),
  track: import("mediabunny").InputVideoTrack,
  width: number,
  height: number,
  sourcePixels: number,
) {
  const same = track.codec && (await mb.canEncodeVideo(track.codec, { width, height }).catch(() => false)) ? track.codec : null
  const codec = same ?? ((await mb.canEncodeVideo("avc", { width, height }).catch(() => false)) ? "avc" : undefined)
  let quality = new mb.Quality("high")
  try {
    const stats = await track.computePacketStats()
    const source = stats.averageBitrate
    if (Number.isFinite(source) && source > 0) {
      const margin = same ? 1.15 : 1.5
      const fps = Number.isFinite(stats.averagePacketRate) && stats.averagePacketRate > 0 ? Math.min(stats.averagePacketRate, 60) : 30
      const floor = 0.02 * sourcePixels * fps
      // Enlarged to 1080p (see saveVideo): ×1.5 — the enlarged picture is smooth and the logos
      // stand still, so this keeps them sharp (tested: ×2 looked the same, 25% bigger).
      const enlarged = width * height > sourcePixels ? 1.5 : 1
      quality = new mb.Quality({ bitrate: Math.round(Math.max(source * margin, floor) * enlarged), bitrateMode: "variable" })
    }
  } catch {
    // keep "high"
  }
  return { codec, quality }
}

/** Standard HD video color (what phones record and players expect): BT.709, TV range. */
const BT709: VideoColorSpaceInit = { primaries: "bt709", transfer: "bt709", matrix: "bt709", fullRange: false }

/**
 * Canvas pixels (RGBA) → I420 video pixels in BT.709 TV range: luma per
 * pixel, colour per 2×2 block. Fixed-point (×65536) for speed. W and H are even.
 */
function rgbaToI420(rgba: Uint8ClampedArray, W: number, H: number): Uint8Array {
  const ySize = W * H
  const cw = W >> 1
  const out = new Uint8Array(ySize + 2 * cw * (H >> 1))
  const u0 = ySize
  const v0 = ySize + cw * (H >> 1)
  for (let i = 0, p = 0; i < ySize; i++, p += 4) {
    out[i] = (11966 * rgba[p] + 40254 * rgba[p + 1] + 4064 * rgba[p + 2] + 1048576 + 32768) >> 16 // 16 + 0.1826R + 0.6142G + 0.0620B
  }
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const a = (y * W + x) * 4
      const b = a + W * 4
      const r = (rgba[a] + rgba[a + 4] + rgba[b] + rgba[b + 4]) >> 2
      const g = (rgba[a + 1] + rgba[a + 5] + rgba[b + 1] + rgba[b + 5]) >> 2
      const bl = (rgba[a + 2] + rgba[a + 6] + rgba[b + 2] + rgba[b + 6]) >> 2
      const c = (y >> 1) * cw + (x >> 1)
      out[u0 + c] = (-6596 * r - 22189 * g + 28785 * bl + 8388608 + 32768) >> 16 // 128 − 0.1006R − 0.3386G + 0.4392B
      out[v0 + c] = (28785 * r - 26145 * g - 2640 * bl + 8388608 + 32768) >> 16 // 128 + 0.4392R − 0.3989G − 0.0403B
    }
  }
  return out
}

type Drag =
  | { kind: "move"; id: string; startX: number; startY: number; x0: number; y0: number }
  | { kind: "resize"; id: string; cx: number; cy: number }

export default function AdBrandingPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(ROLES_AD_BRANDING.includes(resolveAppRoleOrMember(role)))

  const [media, setMedia] = useState<Media | null>(null)
  const [logos, setLogos] = useState<Logo[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Saving a video: 0–1, null otherwise.
  const [progress, setProgress] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // Preview zoom: 1 = the whole picture fits the panel; above it the panel scrolls.
  const [zoom, setZoom] = useState(1)
  // The logo picker: the whole grid (default) or one sliding row.
  const [logoView, setLogoView] = useState<"slide" | "grid">("grid")
  const [error, setError] = useState<string | null>(null)
  // The video preview's player bar.
  const [playing, setPlaying] = useState(false)
  // The preview plays with sound (see onLoadedMetadata for browsers that refuse that).
  const [muted, setMuted] = useState(false)
  // The saved video's sound: keep the video's own sound or remove it, and an optional jingle.
  const [keepSound, setKeepSound] = useState(true)
  const [jingle, setJingle] = useState<string | null>(null)
  const [jingleVolume, setJingleVolume] = useState(DEFAULT_JINGLE_VOLUME)
  // Where in the jingle the video starts, and its ease in / out (seconds).
  const [jingleStart, setJingleStart] = useState(0)
  // End of the chosen part; null = the end of the jingle.
  const [jingleEnd, setJingleEnd] = useState<number | null>(null)
  // Not adjustable: the jingle starts at full volume and fades out over the video's last 3 s.
  const easeIn = DEFAULT_EASE_IN
  const easeOut = DEFAULT_EASE_OUT
  const [jingleLength, setJingleLength] = useState(0)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const stageRef = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const jingleRef = useRef<HTMLAudioElement>(null)
  const lastVideoTime = useRef(0)
  const logoStrip = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const conversion = useRef<Conversion | null>(null)
  // Everything this page made with createObjectURL, revoked on leaving.
  const urls = useRef<Set<string>>(new Set())

  useEffect(() => {
    const made = urls.current
    return () => {
      void conversion.current?.cancel().catch(() => undefined)
      made.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [])

  // Delete / arrows on the selected logo (not while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selected) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        removeLogo(selected)
        return
      }
      const step = e.shiftKey ? 0.02 : 0.004
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
      if (!d) return
      e.preventDefault()
      setLogos((ls) => ls.map((l) => (l.id === selected ? { ...l, x: clamp(l.x + d[0], 0, 1), y: clamp(l.y + d[1], 0, 1) } : l)))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  // While the video plays, follow its time every frame (the browser's timeupdate is only ~4×/s),
  // so the player bar and the jingle bar's playhead move smoothly.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const step = () => {
      const v = videoRef.current
      if (v) setTime(v.currentTime)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  // The jingle plays along with the preview: same play/pause, from the chosen point, the
  // preview's mute — and its volume follows the ease in / out like the saved video (every 50 ms).
  useEffect(() => {
    const a = jingleRef.current
    const v = videoRef.current
    if (!a) return
    const shape = { start: jingleStart, end: jingleEnd ?? (a.duration || Infinity), easeIn, easeOut }
    const tick = () => {
      if (!v) return
      a.volume = jingleGainAt(v.currentTime, v.duration || 0, jingleVolume, shape)
      // Back to the part's start when it reaches its end (the saved video repeats it the same way).
      if (a.duration && a.currentTime >= Math.min(shape.end, a.duration) - 0.03) a.currentTime = shape.start
    }
    a.muted = muted
    if (!(jingle && v && !v.paused)) {
      a.pause()
      if (v && a.duration) a.currentTime = jingleTimeAt(v.currentTime, { start: jingleStart, end: jingleEnd ?? a.duration })
      return
    }
    tick()
    if (a.duration) a.currentTime = jingleTimeAt(v.currentTime, { start: jingleStart, end: jingleEnd ?? a.duration })
    void a.play().catch(() => undefined)
    const timer = window.setInterval(tick, 50)
    return () => window.clearInterval(timer)
  }, [jingle, jingleVolume, muted, playing, jingleStart, jingleEnd, easeIn, easeOut])

  if (!allowed) return null

  /** The saved video's sound — one choice: the video's own ("original", the default), none at
   *  all, or a jingle (which replaces the video's own sound). */
  const pickSound = (choice: "original" | "none" | string) => {
    const src = choice === "original" || choice === "none" ? null : choice
    setKeepSound(choice === "original")
    if (src !== jingle) {
      setJingleStart(0)
      setJingleEnd(null)
      setJingleLength(0)
    }
    setJingle(src)
  }

  const isVideo = media?.kind === "video"
  const noun = isVideo ? "video" : "photo"

  const objectUrl = (f: File) => {
    const u = URL.createObjectURL(f)
    urls.current.add(u)
    return u
  }
  const dropUrl = (u: string) => {
    if (urls.current.has(u)) {
      URL.revokeObjectURL(u)
      urls.current.delete(u)
    }
  }

  const pickFile = async (f: File | undefined) => {
    if (!f || busy) return
    const kind = f.type.startsWith("image/") ? "image" : f.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name) ? "video" : null
    if (!kind) return setError("Choose a photo or a video.")
    setError(null)
    setNotice(null)
    const url = objectUrl(f)
    try {
      const size = kind === "image" ? await loadImage(url).then((img) => ({ w: img.naturalWidth, h: img.naturalHeight })) : await loadVideoSize(url)
      if (media) dropUrl(media.url)
      setZoom(1)
      setTime(0)
      setDuration(0)
      setPlaying(false)
      setMedia({ kind, file: f, url, name: f.name.replace(/\.[^.]+$/, "") || kind, ...size })
    } catch (e) {
      dropUrl(url)
      setError(e instanceof Error ? e.message : "Could not read that file.")
    }
  }

  const isOnMedia = (key: string) => logos.some((l) => l.key === key)

  const addLogo = async (key: string, src: string, name: string, w = 0.25, extra: Partial<Logo> = {}, at: "top-left" | "bottom-center" = "top-left") => {
    if (isOnMedia(key)) return
    setError(null)
    try {
      const img = await loadImage(src)
      const aspect = img.naturalWidth / Math.max(1, img.naturalHeight)
      const ph = media ? media.w / media.h : 16 / 9
      const h = (w / aspect) * ph // height as a fraction of the picture's height
      const id = newId()
      // New logos land top-left, each next one a little lower so they don't stack; the ad permit lands bottom-centre.
      const n = logos.length
      // Checked again here so a quick double-click can't add it twice.
      setLogos((ls) =>
        ls.some((l) => l.key === key)
          ? ls
          : [
              ...ls,
              at === "bottom-center"
                ? { ...extra, key, id, src, name, aspect, w, x: 0.5, y: 1 - MARGIN * ph - h / 2 }
                : { ...extra, key, id, src, name, aspect, w, x: MARGIN + w / 2, y: clamp(MARGIN * ph + h / 2 + n * 0.06, 0, 1 - h / 2) },
            ],
      )
      setSelected(id)
    } catch {
      setError(`Could not read ${name}.`)
    }
  }

  function removeLogo(id: string) {
    setLogos((ls) => ls.filter((l) => l.id !== id))
    setSelected((s) => (s === id ? null : s))
    // The jingle goes with its brand: removing the last matching logo puts the sound back to Original.
    if (jingle && !jingleAllowed(jingle, logos.filter((l) => l.id !== id))) pickSound("original")
  }

  const update = (id: string, patch: Partial<Logo>) => setLogos((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))

  const addPermit = () =>
    textImage(PERMIT_TEXT, PERMIT_OUTLINE)
      .then((src) => addLogo(PERMIT_KEY, src, "Ad permit", 0.5, { outline: PERMIT_OUTLINE, light: true }, "bottom-center"))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not add the permit."))

  const addPreset = (p: (typeof PRESET_LOGOS)[number]) => {
    if (isOnMedia(p.src)) return
    const light = !!p.dark
    const other = pairedOnMedia(p, logos)
    if (other) {
      // Swap light ↔ dark in place: same position, width and outline.
      const outline = other.outline ?? DEFAULT_OUTLINE
      outlineImage(p.src, light, outline)
        .then(async (src) => {
          const img = await loadImage(src)
          const aspect = img.naturalWidth / Math.max(1, img.naturalHeight)
          setLogos((ls) => ls.map((l) => (l.id === other.id ? { ...l, key: p.src, src, name: p.name, base: p.src, light, aspect, outline } : l)))
          setSelected(other.id)
        })
        .catch(() => setError(`Could not read ${p.name}.`))
      return
    }
    outlineImage(p.src, light, DEFAULT_OUTLINE)
      .then((src) => addLogo(p.src, src, p.name, 0.25, { outline: DEFAULT_OUTLINE, base: p.src, light }))
      .catch(() => setError(`Could not read ${p.name}.`))
  }

  /** Redraw a logo or the permit with a new outline; a slower redraw never overwrites a newer value. */
  const setOutline = (l: Logo, outline: number) => {
    const redraw = l.key === PERMIT_KEY ? textImage(PERMIT_TEXT, outline) : l.base ? outlineImage(l.base, !!l.light, outline) : null
    if (!redraw) return
    update(l.id, { outline })
    redraw
      .then((src) => setLogos((ls) => ls.map((v) => (v.id === l.id && v.outline === outline ? { ...v, src } : v))))
      .catch(() => undefined)
  }

  /** Snap to one of six spots (top or bottom row), keeping the margin from the edges. */
  const placeAt = (l: Logo, col: 0 | 1 | 2, row: 0 | 1 | 2) => {
    if (!media) return
    const ratio = media.w / media.h
    const hw = l.w / 2
    const hh = (l.w / l.aspect) * ratio / 2
    const mx = MARGIN
    const my = MARGIN * ratio
    const x = [mx + hw, 0.5, 1 - mx - hw][col]
    const y = [my + hh, 0.5, 1 - my - hh][row]
    update(l.id, { x, y })
  }

  // ─── Drag (move + corner resize) ─────────────────────────────────────────
  const stageRect = () => stageRef.current?.getBoundingClientRect()

  const startMove = (e: ReactPointerEvent, l: Logo) => {
    e.stopPropagation()
    e.preventDefault()
    setSelected(l.id)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { kind: "move", id: l.id, startX: e.clientX, startY: e.clientY, x0: l.x, y0: l.y }
  }

  const startResize = (e: ReactPointerEvent, l: Logo) => {
    e.stopPropagation()
    e.preventDefault()
    const r = stageRect()
    if (!r) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { kind: "resize", id: l.id, cx: r.left + l.x * r.width, cy: r.top + l.y * r.height }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current
    const r = stageRect()
    if (!d || !r) return
    if (d.kind === "move") {
      let x = clamp(d.x0 + (e.clientX - d.startX) / r.width, 0, 1)
      let y = clamp(d.y0 + (e.clientY - d.startY) / r.height, 0, 1)
      // Snap to the centre lines when within a few pixels of them.
      if (Math.abs(x - 0.5) * r.width < SNAP_PX) x = 0.5
      if (Math.abs(y - 0.5) * r.height < SNAP_PX) y = 0.5
      update(d.id, { x, y })
    } else {
      const l = logos.find((v) => v.id === d.id)
      if (!l) return
      // Centre-to-corner distance → width.
      const dist = Math.hypot(e.clientX - d.cx, e.clientY - d.cy)
      const wPx = (2 * dist) / Math.sqrt(1 + 1 / (l.aspect * l.aspect))
      update(d.id, { w: clamp(wPx / r.width, 0.03, 1.5) })
    }
  }

  const endDrag = () => { drag.current = null }

  // ─── Video player bar ────────────────────────────────────────────────────
  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) void v.play().catch(() => undefined)
    else v.pause()
  }
  const seek = (t: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = t
    setTime(t)
  }

  // ─── Download ────────────────────────────────────────────────────────────
  /** Draw every logo onto a canvas the size of the picture. */
  const drawLogos = (ctx: CanvasRenderingContext2D, imgs: HTMLImageElement[], W: number, H: number) => {
    logos.forEach((l, i) => {
      const w = l.w * W
      const h = w / l.aspect
      ctx.drawImage(imgs[i], l.x * W - w / 2, l.y * H - h / 2, w, h)
    })
  }

  const savePhoto = async (m: Media) => {
    const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (m.w * m.h)))
    const W = Math.round(m.w * scale)
    const H = Math.round(m.h * scale)
    const canvas = document.createElement("canvas")
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Your browser couldn't draw the image.")
    ctx.imageSmoothingQuality = "high"
    // JPG has no transparency — a see-through photo gets a white background.
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, W, H)
    ctx.drawImage(await loadImage(m.url), 0, 0, W, H)
    drawLogos(ctx, await Promise.all(logos.map((l) => loadImage(l.src))), W, H)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.92))
    if (!blob) throw new Error("Your browser couldn't save the image.")
    saveBlob(blob, `${m.name}-branded.jpg`)
  }

  const saveVideo = async (m: Media) => {
    if (typeof VideoEncoder === "undefined") {
      throw new Error("This browser can't save videos. Use the latest Chrome, Edge or Safari.")
    }
    videoRef.current?.pause()
    setProgress(0)
    const mb = await import("mediabunny")
    // The original's size (encoders need even numbers) — except a video smaller than 1080p is
    // saved at 1080p: the picture is only enlarged, but the logos and permit are drawn at 1080p,
    // so they stay sharp (at 480p a logo is ~250 px wide and looks blurry played full screen).
    const SW = even(m.w)
    const SH = even(m.h)
    const up = Math.max(1, MIN_VIDEO_SHORT_SIDE / Math.min(m.w, m.h))
    const W = even(m.w * up)
    const H = even(m.h * up)
    const imgs = await Promise.all(logos.map((l) => loadImage(l.src)))
    const canvas = document.createElement("canvas")
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) throw new Error("Your browser couldn't draw the video.")
    ctx.imageSmoothingQuality = "high"

    const input = new mb.Input({ source: new mb.BlobSource(m.file), formats: mb.ALL_FORMATS })
    try {
      const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }), target: new mb.BufferTarget() })
      // Sound: the video's own (copied as it is), none, or our own mix with a jingle — then the
      // conversion only does the picture and we add the mixed track to the output ourselves.
      const mixing = !!jingle
      let mixed: AudioBuffer | null = null
      if (mixing) {
        const videoTrack = await input.getPrimaryVideoTrack()
        const ownTrack = keepSound ? await input.getPrimaryAudioTrack() : null
        const duration = videoTrack ? await videoTrack.computeDuration() : await input.computeDuration()
        const ownDecodable = ownTrack ? await ownTrack.canDecode().catch(() => false) : false
        mixed = await mixSound(mb, ownDecodable ? ownTrack : null, jingle, jingleVolume, duration, { start: jingleStart, end: jingleEnd ?? Infinity, easeIn, easeOut })
      }
      const conv = await mb.Conversion.init({
        input,
        output,
        tracks: "primary",
        showWarnings: false,
        composable: mixing,
        audio: mixing || !keepSound ? { discard: true } : undefined,
        video: async (track) => ({
          ...(await originalSettings(mb, track, W, H, SW * SH)),
          width: SW,
          height: SH,
          fit: "fill",
          // Bake a phone's rotation into the frames, so they come in upright, as on screen.
          allowTransformationMetadata: false,
          forceTranscode: true,
          processedWidth: W,
          processedHeight: H,
          process: (sample) => {
            ctx.fillStyle = "#000000"
            ctx.fillRect(0, 0, W, H)
            sample.draw(ctx, 0, 0, W, H)
            drawLogos(ctx, imgs, W, H)
            // Hand the encoder the frame as standard video pixels at their exact size, not the canvas:
            // Chrome stretches a canvas frame by a pixel or two when the width isn't a round number,
            // and tags it sRGB / full range, which Mac players show flatter and greyer than the original.
            const { data } = ctx.getImageData(0, 0, W, H)
            return new mb.VideoSample(rgbaToI420(data, W, H), {
              format: "I420", codedWidth: W, codedHeight: H, timestamp: sample.timestamp, duration: sample.duration, colorSpace: BT709,
            })
          },
        }),
      })
      if (!conv.isValid || !conv.utilizedTracks.some((t) => t.isVideoTrack())) {
        throw new Error("This browser can't edit that video. Try Chrome or Safari, or save the video as MP4 first.")
      }
      const lostSound = conv.discardedTracks.some((d) => d.track.isAudioTrack() && d.reason !== "discarded_by_user")
      let sound: InstanceType<typeof mb.AudioBufferSource> | null = null
      if (mixing && mixed) {
        const codec = await mb.getFirstEncodableAudioCodec(["aac", "opus"], { numberOfChannels: 2, sampleRate: mixed.sampleRate })
        if (!codec) throw new Error("This browser can't save sound in a video. Try Chrome or Safari.")
        sound = new mb.AudioBufferSource({ codec, bitrate: 192_000 })
        output.addAudioTrack(sound)
        await output.start()
      }
      conversion.current = conv
      conv.onProgress = (p) => setProgress(p)
      try {
        await Promise.all([
          conv.execute(),
          (async () => {
            if (!sound || !mixed) return
            await sound.add(mixed)
            sound.close()
          })(),
        ])
        if (mixing) await output.finalize()
      } catch (e) {
        if (mixing) await output.cancel().catch(() => undefined)
        throw e
      }
      const buffer = (output.target as InstanceType<typeof mb.BufferTarget>).buffer
      if (!buffer) throw new Error("Your browser couldn't save the video.")
      saveBlob(new Blob([buffer], { type: "video/mp4" }), `${m.name}-branded.mp4`)
      if (lostSound && keepSound && !mixing) setNotice("Saved without sound — this browser can't read the video's audio.")
    } catch (e) {
      if (e instanceof mb.ConversionCanceledError) return
      throw e
    } finally {
      conversion.current = null
      input.dispose()
    }
  }

  const download = async () => {
    if (!media || busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (media.kind === "video") await saveVideo(media)
      else await savePhoto(media)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.")
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const cancelSave = () => void conversion.current?.cancel().catch(() => undefined)

  const sel = logos.find((l) => l.id === selected) ?? null
  const label = "mb-2 text-sm font-bold text-[#0d1117]"
  const ratio = media ? media.w / media.h : 1
  const fitOffset = FIT_OFFSET + (isVideo ? PLAYER_BAR : 0) + (isVideo && jingle ? JINGLE_BAR : 0)
  const fitWidth = `min(100cqw, (100dvh - ${fitOffset}px) * ${ratio})`

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <input ref={fileInput} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = "" }} />
      {/* The chosen jingle, played along with the video preview. */}
      <audio ref={jingleRef} src={jingle ?? undefined} loop preload="auto" className="hidden" onLoadedMetadata={(e) => setJingleLength(e.currentTarget.duration || 0)} />

      {error && (
        <p className="flex items-center justify-between gap-2 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss"><X className="h-4 w-4" /></button>
        </p>
      )}
      {notice && (
        <p className="flex items-center justify-between gap-2 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {notice}
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><X className="h-4 w-4" /></button>
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        {/* Stage — stays in view while the controls scroll (lg and up) */}
        <div className="border border-[#e5e8ec] bg-[#f4f5f7] p-3 lg:sticky lg:top-0">
          {media ? (
            <>
            {/* The fit size: as wide as the panel, as tall as the screen allows — whichever
                is smaller (cqw = the panel's width). Zoom scales it; past the fit, it scrolls. */}
            <div className="@container">
            <div className="flex overflow-auto" style={{ height: `calc(${fitWidth} / ${ratio})` }}>
            <div
              className="relative m-auto shrink-0 touch-none select-none"
              style={{ aspectRatio: `${media.w} / ${media.h}`, width: `calc(${fitWidth} * ${zoom})` }}
              ref={stageRef}
              onPointerDown={() => setSelected(null)}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              {media.kind === "video" ? (
                <video
                  key={media.url}
                  ref={videoRef}
                  src={media.url}
                  className="absolute inset-0 h-full w-full bg-black"
                  loop
                  playsInline
                  muted={muted || !keepSound}
                  onPlay={(e) => {
                    setPlaying(true)
                    const a = jingleRef.current
                    if (a && jingle) {
                      if (a.duration) a.currentTime = jingleTimeAt(e.currentTarget.currentTime, { start: jingleStart, end: jingleEnd ?? a.duration })
                      void a.play().catch(() => undefined)
                    }
                  }}
                  onPause={() => {
                    setPlaying(false)
                    jingleRef.current?.pause()
                  }}
                  onTimeUpdate={(e) => {
                    const t = e.currentTarget.currentTime
                    setTime(t)
                    // The jingle plays straight through like in the saved video; it is only put back
                    // in step when the video loops to the start or drifts clearly (> 1 s) away —
                    // correcting small drifts every tick made it skip.
                    const a = jingleRef.current
                    if (a && jingle && a.duration) {
                      const looped = t < lastVideoTime.current - 0.5
                      const want = jingleTimeAt(t, { start: jingleStart, end: jingleEnd ?? a.duration })
                      if (looped || Math.abs(a.currentTime - want) > 1) a.currentTime = want
                    }
                    lastVideoTime.current = t
                  }}
                  onSeeked={(e) => {
                    // After a scrub, start the jingle from the same point the saved video would.
                    const a = jingleRef.current
                    const t = e.currentTarget.currentTime
                    lastVideoTime.current = t
                    if (a && jingle && a.duration) a.currentTime = jingleTimeAt(t, { start: jingleStart, end: jingleEnd ?? a.duration })
                  }}
                  onLoadedMetadata={(e) => {
                    setDuration(e.currentTarget.duration)
                    // Start playing with sound; a browser that blocks sound until you click
                    // (Safari, some Chrome cases) starts it muted instead — the speaker turns it on.
                    const v = e.currentTarget
                    v.play().catch(() => {
                      v.muted = true
                      setMuted(true)
                      void v.play().catch(() => undefined)
                    })
                  }}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={media.url} alt="Your photo" draggable={false} className="absolute inset-0 h-full w-full" />
              )}
              {logos.map((l) => {
                const active = l.id === selected
                return (
                  <div
                    key={l.id}
                    onPointerDown={(e) => startMove(e, l)}
                    className={`absolute cursor-move ${active ? "outline-2 outline-dashed outline-[#d6b357]" : "hover:outline hover:outline-1 hover:outline-white/70"}`}
                    style={{
                      left: `${l.x * 100}%`,
                      top: `${l.y * 100}%`,
                      width: `${l.w * 100}%`,
                      aspectRatio: `${l.aspect}`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={l.src} alt={l.name} draggable={false} className="block h-full w-full" />
                    {active && (
                      <span
                        onPointerDown={(e) => startResize(e, l)}
                        className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize border-2 border-white bg-[#d6b357] shadow"
                        aria-label="Resize"
                      />
                    )}
                  </div>
                )
              })}
              {/* Centre guides for the selected logo / permit */}
              {sel && isCentered(sel.x) && (
                <span aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-0 border-l border-dashed border-[#d6b357]" />
              )}
              {sel && isCentered(sel.y) && (
                <span aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 h-0 border-t border-dashed border-[#d6b357]" />
              )}
              {sel && (isCentered(sel.x) || isCentered(sel.y)) && (
                <span className="pointer-events-none absolute left-2 top-2 bg-[#d6b357] px-1.5 py-0.5 text-[11px] font-bold text-[#001f3f]">
                  {isCentered(sel.x) && isCentered(sel.y) ? "Centered" : isCentered(sel.x) ? "Centered left–right" : "Centered top–bottom"}
                </span>
              )}
            </div>
            </div>
            </div>
            {media.kind === "video" && (
              <div className="mt-2 flex h-9 items-center gap-2 border border-[#e5e8ec] bg-white px-2">
                <button type="button" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className="text-[#001f3f] hover:text-[#d6b357]">
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.01}
                  value={Math.min(time, duration || 0)}
                  onChange={(e) => seek(Number(e.target.value))}
                  aria-label="Position in the video"
                  className="min-w-0 flex-1 accent-[#001f3f]"
                />
                <span className="shrink-0 text-xs tabular-nums text-[#6b7280]">{clock(time)} / {clock(duration)}</span>
                <button type="button" onClick={() => setMuted((v) => !v)} aria-label={muted ? "Sound on" : "Sound off"} className="text-[#001f3f] hover:text-[#d6b357]">
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              </div>
            )}
            {media.kind === "video" && jingle && jingleLength > 0 && (
              <JingleRange
                name={JINGLES.find((j) => j.src === jingle)?.name ?? "Jingle"}
                volume={jingleVolume}
                onVolume={setJingleVolume}
                length={jingleLength}
                start={jingleStart}
                end={jingleEnd ?? jingleLength}
                playhead={jingleTimeAt(time, { start: jingleStart, end: jingleEnd ?? jingleLength })}
                onChange={(s, e) => {
                  setJingleStart(s)
                  setJingleEnd(e >= jingleLength - 0.05 ? null : e)
                }}
                onSeek={(p) => {
                  // The video moves to the moment that plays this point of the jingle, in the
                  // current repeat of the chosen part (the first one if that would pass the end).
                  const v = videoRef.current
                  if (!v) return
                  const s = jingleStart
                  const part = Math.max(MIN_JINGLE_PART, (jingleEnd ?? jingleLength) - s)
                  const offset = clamp(p - s, 0, part)
                  const round = Math.floor(v.currentTime / part)
                  let t = round * part + offset
                  if (t > (v.duration || 0)) t = offset
                  seek(clamp(t, 0, v.duration || 0))
                }}
                onStartSet={() => {
                  // Replay from the video's start, so the new jingle start can be heard in sync.
                  const v = videoRef.current
                  if (!v) return
                  v.currentTime = 0
                  void v.play().catch(() => undefined)
                }}
              />
            )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex h-[360px] w-full flex-col items-center justify-center gap-2 border border-dashed border-[#c9ced6] bg-white text-[#6b7280] transition-colors hover:border-[#001f3f] hover:text-[#001f3f]"
            >
              <ImagePlus className="h-8 w-8" />
              <span className="text-sm font-semibold">Choose a photo or video</span>
              <span className="text-xs text-[#9ca3af]">It stays on your device — nothing is uploaded</span>
            </button>
          )}
        </div>

        {/* Controls — on the left (first on a phone too) */}
        <div className="order-first space-y-5 border border-[#e5e8ec] bg-white p-4">
          <div>
            {media && (
              <div className="mb-3">
                <Slider label={isVideo ? "Video zoom" : "Photo zoom"} value={Math.round(zoom * 100)} min={ZOOM_MIN * 100} max={ZOOM_MAX * 100} unit="%" onChange={(v) => setZoom(v / 100)} />
              </div>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
              className="flex h-10 w-full items-center justify-center gap-2 bg-[#001f3f] text-sm font-bold text-white hover:bg-[#0a3d6b] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ImagePlus className="h-4 w-4" /> {media ? "Change photo or video" : "Choose photo or video"}
            </button>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-[#0d1117]">Add a logo</p>
              <div className="flex" role="group" aria-label="How to show the logos">
                {([
                  { v: "slide", Icon: GalleryHorizontal, title: "Slide" },
                  { v: "grid", Icon: LayoutGrid, title: "Grid" },
                ] as const).map(({ v, Icon, title }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setLogoView(v)}
                    aria-pressed={logoView === v}
                    title={title}
                    aria-label={title}
                    className={`flex h-7 w-8 items-center justify-center border ${logoView === v ? "border-[#001f3f] bg-[#001f3f] text-white" : "border-[#e5e8ec] text-[#6b7280] hover:border-[#001f3f]"}`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
            <div className={logoView === "slide" ? "relative" : ""}>
            {logoView === "slide" && (
              <>
                <button
                  type="button"
                  onClick={() => logoStrip.current?.scrollBy({ left: -(logoStrip.current.clientWidth), behavior: "smooth" })}
                  aria-label="Previous logos"
                  className="absolute inset-y-0 left-0 z-10 flex w-9 items-center justify-start bg-gradient-to-r from-white via-white/80 to-transparent text-[#001f3f] hover:text-[#d6b357]"
                >
                  <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={() => logoStrip.current?.scrollBy({ left: logoStrip.current.clientWidth, behavior: "smooth" })}
                  aria-label="Next logos"
                  className="absolute inset-y-0 right-0 z-10 flex w-9 items-center justify-end bg-gradient-to-l from-white via-white/80 to-transparent text-[#001f3f] hover:text-[#d6b357]"
                >
                  <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
                </button>
              </>
            )}
            <div
              ref={logoStrip}
              className={logoView === "slide"
                ? "flex snap-x snap-mandatory gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>button]:w-[calc((100%-1rem)/3)] [&>button]:shrink-0 [&>button]:snap-start"
                : "grid grid-cols-3 gap-2"}
            >
              {PRESET_LOGOS.map((p) => {
                const added = isOnMedia(p.src)
                const swaps = !added && !!pairedOnMedia(p, logos)
                return (
                  <button
                    key={p.src}
                    type="button"
                    disabled={!media || added || busy}
                    onClick={() => addPreset(p)}
                    title={added ? `${p.name} — already on the ${noun}` : swaps ? `Swap to ${p.name}` : p.name}
                    className={`relative flex h-14 items-center justify-center border border-[#e5e8ec] p-1.5 transition-colors hover:border-[#001f3f] disabled:cursor-not-allowed disabled:opacity-40 ${p.dark ? "bg-[#001f3f]" : "bg-white"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.src} alt={p.name} className="max-h-full max-w-full object-contain" />
                    {added && (
                      <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center bg-[#d6b357]">
                        <Check className="h-3 w-3 text-[#001f3f]" />
                      </span>
                    )}
                    {swaps && (
                      <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center border border-[#d6b357] bg-white" aria-hidden>
                        <ArrowLeftRight className="h-3 w-3 text-[#001f3f]" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            </div>
          </div>

          <div>
            <p className={label}>Add the ad permit</p>
            <div className="flex gap-2">
              <span className="flex h-10 min-w-0 flex-1 items-center truncate border border-[#e5e8ec] bg-[#f4f5f7] px-2 text-sm text-[#374151]">
                {PERMIT_TEXT}
              </span>
              <button
                type="button"
                disabled={!media || isOnMedia(PERMIT_KEY) || busy}
                onClick={() => void addPermit()}
                className="h-10 shrink-0 bg-[#001f3f] px-4 text-sm font-bold text-white hover:bg-[#0a3d6b] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isOnMedia(PERMIT_KEY) ? "Added" : "Add"}
              </button>
            </div>
          </div>

          {logos.length > 0 && (
            <div>
              <p className={label}>Logos on the {noun}</p>
              <div className="space-y-1">
                {logos.map((l) => (
                  <div
                    key={l.id}
                    className={`flex items-center gap-2 border px-2 py-1.5 ${l.id === selected ? "border-[#d6b357] bg-[#fdf8ec]" : "border-[#e5e8ec]"}`}
                  >
                    <button type="button" onClick={() => setSelected(l.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <span className="flex h-7 w-10 shrink-0 items-center justify-center bg-[#c9ced6]/40">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={l.src} alt="" className="max-h-full max-w-full object-contain" />
                      </span>
                      <span className="truncate text-sm text-[#0d1117]">{l.name}</span>
                    </button>
                    <button type="button" disabled={busy} onClick={() => removeLogo(l.id)} aria-label="Remove" title="Remove" className="text-[#6b7280] hover:text-red-600 disabled:opacity-40">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sel && (
            <div className="space-y-3 border-t border-[#e5e8ec] pt-4">
              <p className="text-sm font-bold text-[#0d1117]">Adjust · <span className="font-normal text-[#6b7280]">{sel.name}</span></p>
              <div className="flex gap-4">
                <div className="shrink-0">
                  <p className="mb-1 text-xs font-bold text-[#374151]">Position</p>
                  <div className="grid w-[108px] grid-cols-3 gap-1">
                    {([0, 2] as const).flatMap((row) =>
                      ([0, 1, 2] as const).map((col) => (
                        <button
                          key={`${row}${col}`}
                          type="button"
                          onClick={() => placeAt(sel, col, row)}
                          aria-label={`Move to ${["top", "middle", "bottom"][row]} ${["left", "centre", "right"][col]}`}
                          className="flex h-8 items-center justify-center border border-[#e5e8ec] hover:border-[#001f3f]"
                        >
                          <span className="h-2 w-2 bg-[#001f3f]" />
                        </button>
                      )),
                    )}
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <Slider label="Size" value={Math.round(sel.w * 100)} min={3} max={100} unit="%" onChange={(v) => update(sel.id, { w: v / 100 })} />
                  {sel.outline !== undefined && (
                    <Slider label="Outline" value={sel.outline} min={0} max={200} unit="%" onChange={(v) => setOutline(sel, v)} />
                  )}
                </div>
              </div>
            </div>
          )}

          {isVideo && (
            <div className="space-y-3">
              <div>
                {/* One choice for the saved video's sound: the video's own (default), none, or a jingle. */}
                <p className="mb-2 text-sm font-bold text-[#0d1117]">Video sound</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    { id: "original", name: "Original", Icon: Volume2, on: keepSound && !jingle, pick: () => pickSound("original") },
                    { id: "none", name: "None", Icon: VolumeX, on: !keepSound && !jingle, pick: () => pickSound("none") },
                    ...JINGLES.map((j) => ({
                      id: j.src, name: j.name, Icon: Music, on: jingle === j.src, pick: () => pickSound(j.src),
                      locked: !jingleAllowed(j.src, logos), hint: `Add the ${j.brand} logo to use this jingle`,
                    })),
                  ] as { id: string; name: string; Icon: typeof Music; on: boolean; pick: () => void; locked?: boolean; hint?: string }[]).map(({ id, name, Icon, on, pick, locked, hint }) => (
                    <button
                      key={id}
                      type="button"
                      disabled={busy || locked}
                      onClick={pick}
                      aria-pressed={on}
                      title={locked ? hint : undefined}
                      className={`flex h-9 items-center gap-1.5 border px-2 text-left text-xs font-semibold disabled:opacity-40 ${on ? "border-[#001f3f] bg-[#001f3f] text-white" : "border-[#e5e8ec] text-[#374151] hover:border-[#001f3f]"}`}
                    >
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${on ? "text-[#d6b357]" : "text-[#9ca3af]"}`} />
                      <span className="truncate">{name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2 border-t border-[#e5e8ec] pt-4">
            {progress !== null ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-bold text-[#0d1117]">
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Saving the video… {Math.round(progress * 100)}%</span>
                  <button type="button" onClick={cancelSave} className="text-xs font-semibold text-[#6b7280] hover:text-red-600">Cancel</button>
                </div>
                <div className="h-2 w-full bg-[#e5e8ec]">
                  <div className="h-full bg-[#d6b357] transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
                <p className="text-xs text-[#6b7280]">Keep this tab open until it finishes.</p>
              </div>
            ) : (
              <button
                type="button"
                disabled={!media || busy}
                onClick={() => void download()}
                className="flex h-11 w-full items-center justify-center gap-2 bg-[#d6b357] text-sm font-bold text-[#001f3f] hover:bg-[#c9a548] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * The jingle under the video's player: its whole length as a bar, with the part
 * that plays between two handles — drag either (or use the arrow keys on it).
 */
function JingleRange({ name, volume, onVolume, length, start, end, playhead, onChange, onStartSet, onSeek }: {
  name: string
  /** The jingle's volume, 0–100. */
  volume: number
  onVolume: (v: number) => void
  length: number
  start: number
  end: number
  /** Where in the jingle the video is right now (moves with the video). */
  playhead: number
  onChange: (start: number, end: number) => void
  /** The start handle was let go (or moved with a key) — the page replays the video from 0:00. */
  onStartSet: () => void
  /** The playhead was dragged (or the bar clicked) to this point of the jingle — the page moves the video to match. */
  onSeek: (jingleTime: number) => void
}) {
  const track = useRef<HTMLDivElement>(null)
  const dragging = useRef<"start" | "end" | "playhead" | null>(null)
  const pct = (v: number) => `${(clamp(v, 0, length) / length) * 100}%`
  const set = (which: "start" | "end", v: number) => {
    if (which === "start") onChange(clamp(v, 0, end - MIN_JINGLE_PART), end)
    else onChange(start, clamp(v, start + MIN_JINGLE_PART, length))
  }
  const fromPointer = (clientX: number) => {
    const r = track.current?.getBoundingClientRect()
    return r ? (clamp(clientX - r.left, 0, r.width) / r.width) * length : 0
  }
  const handle = (which: "start" | "end") => (
    <span
      role="slider"
      tabIndex={0}
      aria-label={which === "start" ? "Jingle start" : "Jingle end"}
      aria-valuemin={0}
      aria-valuemax={Math.round(length)}
      aria-valuenow={Math.round(which === "start" ? start : end)}
      aria-valuetext={clock(which === "start" ? start : end)}
      onPointerDown={(e) => {
        e.preventDefault()
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        dragging.current = which
      }}
      onPointerMove={(e) => { if (dragging.current === which) set(which, fromPointer(e.clientX)) }}
      onPointerUp={() => {
        if (dragging.current === "start") onStartSet()
        dragging.current = null
      }}
      onPointerCancel={() => { dragging.current = null }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 5 : 1
        const d = e.key === "ArrowLeft" || e.key === "ArrowDown" ? -step : e.key === "ArrowRight" || e.key === "ArrowUp" ? step : 0
        if (!d) return
        e.preventDefault()
        set(which, (which === "start" ? start : end) + d)
        if (which === "start") onStartSet()
      }}
      className="absolute top-1/2 z-10 h-6 w-3 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none rounded-sm border-2 border-white bg-[#d6b357] shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-[#001f3f]"
      style={{ left: pct(which === "start" ? start : end) }}
    />
  )
  return (
    <div className="mt-2 border border-[#e5e8ec] bg-white px-2 py-1.5">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex min-w-0 items-center gap-1.5 font-bold text-[#0d1117]">
          <Music className="h-3.5 w-3.5 shrink-0 text-[#d6b357]" />
          <span className="truncate">{name}</span>
        </span>
        <label className="ml-3 mr-auto flex min-w-0 items-center gap-1.5 text-[#6b7280]" title="Jingle volume">
          {volume === 0 ? <VolumeX className="h-3.5 w-3.5 shrink-0 text-[#001f3f]" /> : <Volume2 className="h-3.5 w-3.5 shrink-0 text-[#001f3f]" />}
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => onVolume(Number(e.target.value))}
            aria-label="Jingle volume"
            className="w-24 min-w-0 accent-[#001f3f]"
          />
          <span className="w-8 shrink-0 tabular-nums">{volume}%</span>
        </label>
        <span className="shrink-0 tabular-nums text-[#6b7280]">
          <span className="font-semibold text-[#0d1117]">{clock(clamp(playhead, start, end))}</span> · {clock(start)} – {clock(end)}
        </span>
      </div>
      <div className="px-1.5">
        <div ref={track} className="relative h-6 select-none">
          <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-[#e5e8ec]" />
          <div className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-[#001f3f]" style={{ left: pct(start), width: `calc(${pct(end)} - ${pct(start)})` }} />
          {/* What has played of the part so far, and the playhead — in step with the video's bar. */}
          <div className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-[#d6b357]" style={{ left: pct(start), width: `calc(${pct(clamp(playhead, start, end))} - ${pct(start)})` }} />
          {/* Clicking the chosen part moves the playhead (and the video) there. */}
          <div
            className="absolute inset-y-0 cursor-pointer"
            style={{ left: pct(start), width: `calc(${pct(end)} - ${pct(start)})` }}
            onPointerDown={(e) => onSeek(clamp(fromPointer(e.clientX), start, end))}
          />
          {/* The playhead — drag it to move through the jingle; the video follows. */}
          <span
            role="slider"
            tabIndex={0}
            aria-label="Playing position in the jingle"
            aria-valuemin={Math.round(start)}
            aria-valuemax={Math.round(end)}
            aria-valuenow={Math.round(clamp(playhead, start, end))}
            aria-valuetext={clock(clamp(playhead, start, end))}
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
              dragging.current = "playhead"
            }}
            onPointerMove={(e) => { if (dragging.current === "playhead") onSeek(clamp(fromPointer(e.clientX), start, end)) }}
            onPointerUp={() => { dragging.current = null }}
            onPointerCancel={() => { dragging.current = null }}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 5 : 1
              const d = e.key === "ArrowLeft" || e.key === "ArrowDown" ? -step : e.key === "ArrowRight" || e.key === "ArrowUp" ? step : 0
              if (!d) return
              e.preventDefault()
              onSeek(clamp(clamp(playhead, start, end) + d, start, end))
            }}
            className="group absolute top-1/2 z-[5] flex h-6 w-3 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center focus:outline-none"
            style={{ left: pct(clamp(playhead, start, end)) }}
          >
            <span className="h-4 w-[3px] rounded-full bg-white shadow-[0_0_0_1px_#001f3f] group-hover:h-5 group-focus-visible:ring-2 group-focus-visible:ring-[#001f3f]" />
          </span>
          {handle("start")}
          {handle("end")}
        </div>
      </div>
    </div>
  )
}

function Slider({ label, value, min, max, unit = "", step, format, onChange }: {
  label: string
  value: number
  min: number
  max: number
  unit?: string
  step?: number
  format?: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-xs font-bold text-[#374151]">
        {label} <span className="font-normal tabular-nums text-[#6b7280]">{format ? format(value) : `${value}${unit}`}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#001f3f]" />
    </label>
  )
}
