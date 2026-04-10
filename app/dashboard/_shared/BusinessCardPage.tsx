"use client"
import { useRouter } from "next/navigation"

import React, {
  useState, useEffect, useRef, useCallback, ChangeEvent,
} from "react"
import { DashboardShell } from "@/components/dashboard/shell"
import { useAuth } from "@/context/auth-context"
import { roleToLabel } from "@/lib/auth"
import { getRoleColor } from "@/components/dashboard/sidebar-config"
import { COUNTRY_CODES } from "@/lib/user-service"
import { PhoneCountrySelect } from "@/components/phone-country-select"
import {
  Phone, Mail, Save, Loader2, CheckCircle2, AlertCircle,
  RefreshCcw, Info, CreditCard, Download,
} from "lucide-react"

// ── Constants ────────────────────────────────────────────────────────────────
const FRONT_URL = "https://hefwmaoborpfuyhbguzv.supabase.co/storage/v1/object/public/fhi_global/business-card-front.png"
const BACK_URL  = "https://hefwmaoborpfuyhbguzv.supabase.co/storage/v1/object/public/fhi_global/business-card-back.png"
const EXPORT_W  = 2100
const EXPORT_H  = 1200
const API_BASE  = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

// ── Phone helpers ────────────────────────────────────────────────────────────
/** Strip any leading 0 from the local number (digits only). */
function stripLocal(raw: string): string {
  let d = raw.replace(/\D/g, "")
  if (d.startsWith("0")) d = d.slice(1)
  return d
}

/** Resolve the dial code string from a country-code value (e.g. "+1-CA" → "+1"). */
function dialFromValue(ccValue: string): string {
  const entry = COUNTRY_CODES.find((c) => c.value === ccValue)
  if (entry) return entry.dial
  // fallback: strip any suffix after a dash (e.g. "+1-CA" → "+1")
  return ccValue.includes("-") ? ccValue.split("-")[0] : ccValue
}

function formatDisplay(dial: string, local: string): string {
  if (!local) return ""
  return `${dial} ${local}`
}

function isPhoneOk(local: string) { return local.length >= 4 }
function toE164(dial: string, local: string) { return `${dial}${local}` }

// ── Image loader ─────────────────────────────────────────────────────────────
function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.onload  = () => resolve(img)
    img.onerror = reject
    img.src     = src
  })
}

// ── Canvas icon drawing ───────────────────────────────────────────────────────
function drawPhoneIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const s = size
  ctx.save()
  ctx.strokeStyle = "#ca9104"
  ctx.lineWidth   = s * 0.12
  ctx.lineCap     = "round"
  ctx.lineJoin    = "round"
  ctx.beginPath()
  // simplified phone handset
  ctx.roundRect(cx - s * 0.3, cy - s * 0.5, s * 0.6, s, s * 0.15)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy - s * 0.25, s * 0.1, 0, Math.PI * 2)
  ctx.fillStyle = "#ca9104"
  ctx.fill()
  ctx.restore()
}

function drawMailIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const s = size
  ctx.save()
  ctx.strokeStyle = "#ca9104"
  ctx.lineWidth   = s * 0.1
  ctx.lineCap     = "round"
  ctx.lineJoin    = "round"
  const x = cx - s * 0.5, y = cy - s * 0.35, w = s, h = s * 0.7
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, s * 0.08)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(cx, cy + s * 0.05)
  ctx.lineTo(x + w, y)
  ctx.stroke()
  ctx.restore()
}

// ── Canvas renderer ───────────────────────────────────────────────────────────
interface CardData { name: string; phoneDial: string; phoneLocal: string; email: string }

async function renderCard(
  side: "front" | "back",
  data: CardData,
  width: number,
  height: number,
): Promise<string> {
  const canvas = document.createElement("canvas")
  canvas.width  = width
  canvas.height = height
  const ctx = canvas.getContext("2d")!

  // background image
  const src = side === "front" ? FRONT_URL : BACK_URL
  try {
    const img = await loadImg(src)
    ctx.drawImage(img, 0, 0, width, height)
  } catch {
    // fallback: solid navy background if image fails
    ctx.fillStyle = "#001f3f"
    ctx.fillRect(0, 0, width, height)
  }

  if (side === "back") return canvas.toDataURL("image/png")

  // ── Front overlay ────────────────────────────────────────────────────────
  // Text region sits in the right ~55% of the card (typical business card layout)
  const textX = width * 0.40
  const maxW  = width * 0.54

  // Name – auto-shrink until it fits
  ctx.fillStyle = "#ffffff"
  ctx.textAlign  = "left"
  ctx.textBaseline = "alphabetic"
  let fontSize = Math.round(height * 0.10)
  ctx.font = `700 ${fontSize}px 'Arial', sans-serif`
  while (ctx.measureText(data.name || "Your Name").width > maxW && fontSize > 24) {
    fontSize -= 2
    ctx.font = `700 ${fontSize}px 'Arial', sans-serif`
  }
  ctx.fillText(data.name || "Your Name", textX, height * 0.44)

  // Subtitle
  const subSize = Math.round(height * 0.055)
  ctx.font = `400 ${subSize}px 'Arial', sans-serif`
  ctx.fillStyle = "#ca9104"
  ctx.fillText("Global Partner Dubai", textX, height * 0.44 + fontSize * 1.25)

  // Divider
  const divY = height * 0.44 + fontSize * 1.25 + subSize * 0.9
  ctx.strokeStyle = "rgba(255,255,255,0.25)"
  ctx.lineWidth   = 1
  ctx.beginPath()
  ctx.moveTo(textX, divY)
  ctx.lineTo(textX + maxW, divY)
  ctx.stroke()

  // Contact rows
  const rowSize   = Math.round(height * 0.046)
  const iconSize  = rowSize * 1.1
  const row1Y     = divY + height * 0.12
  const row2Y     = row1Y + height * 0.09
  const iconX     = textX
  const txtStartX = textX + iconSize * 1.4

  ctx.font = `400 ${rowSize}px 'Arial', sans-serif`
  ctx.fillStyle    = "#ffffff"
  ctx.textBaseline = "middle"

  // Phone row
  drawPhoneIcon(ctx, iconX + iconSize * 0.5, row1Y, iconSize)
  ctx.fillText(data.phoneLocal ? formatDisplay(data.phoneDial, data.phoneLocal) : "+971 5x xxx xxxx", txtStartX, row1Y)

  // Email row
  drawMailIcon(ctx, iconX + iconSize * 0.5, row2Y, iconSize)
  const emailTxt = data.email || "your@email.com"
  ctx.font = `400 ${rowSize}px 'Arial', sans-serif`
  ctx.fillText(emailTxt, txtStartX, row2Y)

  return canvas.toDataURL("image/png")
}

// ── Preview at display size ───────────────────────────────────────────────────
// Display canvas is 700×400 rendered at devicePixelRatio for crispness
const DISP_W = 700
const DISP_H = 400

// ── Main component ────────────────────────────────────────────────────────────
export function BusinessCardPage() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const role = (profile?.role ?? "agent") as string

  const fullName = profile?.fullname ?? user?.email?.split("@")[0] ?? ""

  // phone/email state
  const [countryCode, setCountryCode] = useState("+971") // country-code value (e.g. "+63")
  const [localNumber, setLocalNumber] = useState("")     // local number digits
  const [email,       setEmail]       = useState("")

  // card side
  const [flipped, setFlipped] = useState(false)

  // canvas preview data URLs
  const [frontDataUrl, setFrontDataUrl] = useState("")
  const [backDataUrl,  setBackDataUrl]  = useState("")
  const [previewLoading, setPreviewLoading] = useState(false)

  // save state
  type SaveState = "idle" | "saving" | "success" | "error"
  const [saveState, setSaveState]   = useState<SaveState>("idle")
  const [saveError, setSaveError]   = useState("")

  // pre-fill from profile on mount
  useEffect(() => {
    if (profile?.metadata) {
      const meta = profile.metadata as Record<string, unknown>
      // country code stored as phone_country_code in the metadata JSON column
      const cc = typeof meta.phone_country_code === "string" ? meta.phone_country_code : "+971"
      setCountryCode(cc)
      // local number stored as phone_number in the metadata JSON column
      const raw = typeof meta.phone_number === "string" ? meta.phone_number : ""
      if (raw) {
        setLocalNumber(stripLocal(raw))
      }
    }
    if (user?.email) setEmail(user.email.toLowerCase())
  }, [profile, user])

  // ── phone input handler ──────────────────────────────────────────────────
  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    setLocalNumber(e.target.value.replace(/\D/g, ""))
  }

  // resolved dial code for display (e.g. "+63")
  const phoneDial = dialFromValue(countryCode)

  // ── regenerate canvas preview ────────────────────────────────────────────
  const regeneratePreview = useCallback(async () => {
    setPreviewLoading(true)
    const data: CardData = { name: fullName, phoneDial, phoneLocal: localNumber, email }
    const [f, b] = await Promise.all([
      renderCard("front", data, DISP_W, DISP_H),
      renderCard("back",  data, DISP_W, DISP_H),
    ])
    setFrontDataUrl(f)
    setBackDataUrl(b)
    setPreviewLoading(false)
  }, [fullName, phoneDial, localNumber, email])

  // regenerate whenever inputs change (debounced 400ms)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(regeneratePreview, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [regeneratePreview])

  // ── download ─────────────────────────────────────────────────────────────
  const download = async (side: "front" | "back") => {
    const safeName = fullName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "")
    const filename  = `business-card-${side}-${safeName}-${EXPORT_W}x${EXPORT_H}.png`
    const url = await renderCard(side, { name: fullName, phoneDial, phoneLocal: localNumber, email }, EXPORT_W, EXPORT_H)
    const a = document.createElement("a")
    a.href     = url
    a.download = filename
    a.click()
  }

  // ── save contact info ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user?.id) return
    setSaveState("saving")
    setSaveError("")
    try {
      const res = await fetch(`${API_BASE}/api/me/contact`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: toE164(phoneDial, localNumber),
          phone_country_code: countryCode,
          phone_number: localNumber,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Error ${res.status}`)
      }
      setSaveState("success")
      router.refresh()
      setTimeout(() => setSaveState("idle"), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed")
      setSaveState("error")
    }
  }

  const phoneOk   = isPhoneOk(localNumber)
  const canSave   = phoneOk && saveState !== "saving"
  const inputBase = "w-full px-4 py-3 rounded-xl border text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:ring-4 transition-all duration-200"
  const inputIdle = "border-[#e5e7eb] bg-[#f9fafb] focus:border-[#001f3f] focus:bg-white focus:ring-[#001f3f]/6"
  const inputErr  = "border-rose-300 bg-rose-50 focus:border-rose-500 focus:ring-rose-500/10"
  const inputOk   = "border-emerald-300 bg-white focus:border-emerald-500 focus:ring-emerald-500/10"

  function phoneState()  { if (!localNumber) return "idle"; return phoneOk ? "ok" : "err" }
  function inputCls(st: "idle"|"ok"|"err") {
    if (st === "ok")  return `${inputBase} ${inputOk}`
    if (st === "err") return `${inputBase} ${inputErr}`
    return `${inputBase} ${inputIdle}`
  }

  const shownCard = flipped ? backDataUrl : frontDataUrl

  return (
    <DashboardShell
      role={role}
      roleLabel={roleToLabel(role)}
      roleColor={getRoleColor(role)}
      userName={fullName}
    >
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="mb-7">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#001f3f] flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-[#d6b357]" />
          </div>
          <div>
            <h1 className="font-['Outfit'] text-xl font-bold text-[#0d1117]">My Business Card</h1>
            <p className="text-sm text-[#9ca3af]">Edit your contact details and download your personalised card</p>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ══ LEFT – Contact form ══════════════════════════════════════════ */}
        <div className="space-y-5">

          {/* Contact details card */}
          <div className="bg-white rounded-2xl border border-[#e4e7ec] shadow-[0_2px_16px_-4px_rgba(0,31,63,0.08)] overflow-hidden">
            <div className="px-6 pt-6 pb-2 border-b border-[#f0f2f5]">
              <h2 className="font-['Outfit'] text-base font-bold text-[#0d1117]">Contact Information</h2>
              <p className="text-xs text-[#9ca3af] mt-0.5">Your name is synced from your profile. Phone and email can be updated.</p>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Full name — read-only */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#374151]">Full Name</label>
                <div className="relative">
                  <input
                    readOnly
                    value={fullName}
                    className={`${inputBase} border-[#e5e7eb] bg-[#f4f6f9] text-[#6b7280] cursor-default`}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider text-[#c4c9d4] bg-[#f0f2f5] rounded px-1.5 py-0.5">
                    Read-only
                  </span>
                </div>
                <p className="text-[11px] text-[#9ca3af]">Change your name in Profile settings.</p>
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label htmlFor="bc-phone" className="text-xs font-semibold uppercase tracking-wider text-[#374151]">
                  Phone Number
                </label>
                <div className="flex gap-2">
                  <PhoneCountrySelect
                    value={countryCode}
                    onChange={setCountryCode}
                    ariaLabel="Phone country calling code"
                    className="px-3 py-3"
                    style={{ minWidth: 90 }}
                  />
                  <div className="relative flex-1">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                    <input
                      id="bc-phone"
                      type="tel"
                      inputMode="numeric"
                      value={localNumber}
                      onChange={handlePhoneChange}
                      placeholder="5xxxxxxxx"
                      className={`${inputCls(phoneState())} pl-10`}
                    />
                    {phoneState() === "ok"  && <CheckCircle2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 pointer-events-none" />}
                    {phoneState() === "err" && <AlertCircle  className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-400   pointer-events-none" />}
                  </div>
                </div>
                {phoneState() === "err" && (
                  <p className="text-xs text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Enter at least 4 digits for the local number
                  </p>
                )}
              </div>

              {/* Email — read-only */}
              <div className="space-y-1.5">
                <label htmlFor="bc-email" className="text-xs font-semibold uppercase tracking-wider text-[#374151]">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                  <input
                    id="bc-email"
                    type="email"
                    readOnly
                    value={email}
                    className={`${inputBase} border-[#e5e7eb] bg-[#f4f6f9] text-[#6b7280] cursor-default pl-10`}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider text-[#c4c9d4] bg-[#f0f2f5] rounded px-1.5 py-0.5">
                    Read-only
                  </span>
                </div>
                <p className="text-[11px] text-[#9ca3af]">Contact support to change your email address.</p>
              </div>
            </div>

            {/* Save footer */}
            <div className="px-6 py-4 border-t border-[#f0f2f5] flex items-center justify-between gap-4">
              {saveState === "success" && (
                <span className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Saved successfully
                </span>
              )}
              {saveState === "error" && (
                <span className="text-sm text-rose-600 flex items-center gap-1.5 truncate">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {saveError}
                </span>
              )}
              {(saveState === "idle" || saveState === "saving") && <span />}

              <button
                onClick={handleSave}
                disabled={!canSave}
                className="ml-auto flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#001f3f] hover:bg-[#002952] text-white text-sm font-bold shadow-[0_4px_12px_-2px_rgba(0,31,63,0.35)] hover:shadow-[0_6px_18px_-2px_rgba(0,31,63,0.45)] hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none transition-all duration-200"
              >
                {saveState === "saving"
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  : <><Save className="w-4 h-4" /> Save Changes</>
                }
              </button>
            </div>
          </div>

          {/* Tips panel */}
          <div className="bg-[#fffdf3] border border-[#f0e8c8] rounded-2xl px-5 py-4 flex gap-3">
            <Info className="w-4 h-4 text-[#d6b357] shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-[#374151]">Tips</p>
              <ul className="text-xs text-[#6b7280] space-y-1 list-disc list-inside">
                <li>Click the card on the right to flip it and preview the back.</li>
                <li>The preview updates live as you type — no need to save first.</li>
                <li>Downloads are exported at 2100 × 1200 px (print quality).</li>
                <li>Save your contact details so they're available across devices.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* ══ RIGHT – Card preview ═════════════════════════════════════════ */}
        <div className="space-y-5">

          {/* Flip container */}
          <div className="bg-white rounded-2xl border border-[#e4e7ec] shadow-[0_2px_16px_-4px_rgba(0,31,63,0.08)] overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-[#f0f2f5] flex items-center justify-between">
              <div>
                <h2 className="font-['Outfit'] text-base font-bold text-[#0d1117]">
                  Card Preview — {flipped ? "Back" : "Front"}
                </h2>
                <p className="text-xs text-[#9ca3af] mt-0.5">Click the card or press Flip to see the other side</p>
              </div>
              <button
                onClick={() => setFlipped(f => !f)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#e4e7ec] bg-[#f9fafb] hover:bg-[#f0f4f8] text-sm font-semibold text-[#374151] hover:text-[#001f3f] transition-all"
              >
                <RefreshCcw className="w-4 h-4" /> Flip
              </button>
            </div>

            {/* Perspective scene */}
            <div className="p-5">
              <div
                className="bc-scene w-full cursor-pointer select-none"
                style={{ aspectRatio: "1.75 / 1" }}
                onClick={() => setFlipped(f => !f)}
                role="button"
                aria-label={`Business card, showing ${flipped ? "back" : "front"}. Click to flip.`}
              >
                <div className={`bc-card w-full h-full ${flipped ? "bc-card--flipped" : ""}`}>
                  {/* Front face */}
                  <div className="bc-face bc-face--front w-full h-full rounded-xl overflow-hidden shadow-[0_8px_32px_-4px_rgba(0,31,63,0.20)]">
                    {previewLoading || !frontDataUrl ? (
                      <div className="w-full h-full bg-[#001f3f] rounded-xl flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-[#d6b357] animate-spin" />
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={frontDataUrl} alt="Business card front" className="w-full h-full object-cover rounded-xl" />
                    )}
                  </div>
                  {/* Back face */}
                  <div className="bc-face bc-face--back w-full h-full rounded-xl overflow-hidden shadow-[0_8px_32px_-4px_rgba(0,31,63,0.20)]">
                    {previewLoading || !backDataUrl ? (
                      <div className="w-full h-full bg-[#001428] rounded-xl flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-[#d6b357] animate-spin" />
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={backDataUrl} alt="Business card back" className="w-full h-full object-cover rounded-xl" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Download buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => download("front")}
              disabled={!frontDataUrl}
              className="group flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border-2 border-[#001f3f] text-[#001f3f] text-sm font-bold hover:bg-[#001f3f] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            >
              <Download className="w-4 h-4" />
              Download Front
            </button>
            <button
              onClick={() => download("back")}
              disabled={!backDataUrl}
              className="group flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border-2 border-[#001f3f] text-[#001f3f] text-sm font-bold hover:bg-[#001f3f] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            >
              <Download className="w-4 h-4" />
              Download Back
            </button>
          </div>

          {/* Export quality note */}
          <div className="flex items-start gap-2 bg-[#f8faff] border border-[#e0e7ff] rounded-xl px-4 py-3">
            <Info className="w-4 h-4 text-[#6366f1] shrink-0 mt-0.5" />
            <p className="text-xs text-[#6b7280] leading-relaxed">
              Downloads are exported at <strong className="text-[#374151]">2100 × 1200 px</strong> (print-ready PNG). The preview is lower resolution for performance.
            </p>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
