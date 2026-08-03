"use client"

// Shown over the dashboard when the signed-in user has no profile photo.
//
// Over half the directory had no picture because uploading one was optional and
// easy to skip, which makes the account list and every sales report harder to
// read. This asks for one before the dashboard can be used.
//
// Deliberately not dismissible: no close button, no Escape, no backdrop click.
// It does offer Sign out — being unable to leave a page at all is a trap rather
// than a nudge, and someone without a usable photo to hand needs a way out that
// isn't force-quitting the browser.
//
// The tone is an invitation, not a reprimand. Nobody did anything wrong by
// skipping an optional field.

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react"
import Cropper from "react-easy-crop"
import type { Area, Point } from "react-easy-crop"
import { Camera, Check, LogOut, ZoomIn, ZoomOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getCroppedBlob } from "@/lib/crop-image"
import { compressImageForUpload } from "@/lib/upload/compress-image"

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"]

export function ProfilePhotoGate({
  userId,
  displayName,
  onSaved,
}: {
  userId: string
  displayName: string
  /** Hands the saved URL back so the shell can drop the gate without a reload. */
  onSaved: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onCropComplete = useCallback((_: Area, pixels: Area) => setCroppedArea(pixels), [])

  // The backdrop swallows pointer events, but Tab would still walk into the
  // dashboard behind — which is exactly what this is meant to prevent. Keep
  // focus inside, and put it on the primary action to begin with.
  const dialogRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const node = dialogRef.current
    if (!node) return
    const focusables = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null)

    focusables()[0]?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      const items = focusables()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (!node.contains(active)) { e.preventDefault(); first.focus(); return }
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  }, [imageSrc]) // re-anchor when the crop step swaps the controls out

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = "" // let the same file be re-picked after an error
    if (!file) return
    if (!ACCEPTED.includes(file.type)) {
      setError("That file type isn't supported — please choose a JPG, PNG, or WEBP.")
      return
    }
    if (file.size > MAX_BYTES) {
      setError("That image is over 10 MB. Please choose a smaller one.")
      return
    }
    setError(null)
    const reader = new FileReader()
    reader.onload = () => {
      setImageSrc(reader.result as string)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
    }
    reader.onerror = () => setError("That image couldn't be read. Please try another one.")
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!imageSrc || !croppedArea || busy) return
    setBusy(true)
    setError(null)
    try {
      const blob = await getCroppedBlob(imageSrc, croppedArea, "image/jpeg", 0.92)
      const { file } = await compressImageForUpload(
        new File([blob], "avatar.jpg", { type: blob.type || "image/jpeg" }),
      )
      const body = new FormData()
      body.append("file", file, file.name)
      body.append("userId", userId)

      const res = await fetch("/api/upload/avatar", { method: "POST", body })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || "The upload didn't go through.")
      }
      const { url } = (await res.json()) as { url: string }

      // Persist before dismissing: if this fails the photo is in S3 but not on
      // the profile, and closing the gate would look like success.
      const { error: dbError } = await createClient()
        .from("profiles")
        .update({ profile_url: url })
        .eq("id", userId)
      if (dbError) throw new Error(dbError.message || "Your photo uploaded but couldn't be saved.")

      onSaved(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
      setBusy(false) // stay open so the same crop can be retried
    }
  }

  const signOut = async () => {
    await createClient().auth.signOut()
    window.location.href = "/login"
  }

  const initial = (displayName.trim().charAt(0) || "?").toUpperCase()
  const firstName = displayName.trim().split(/\s+/)[0] || ""

  return (
    // aria-modal + role=dialog so assistive tech treats the page behind it as
    // inert, matching the fact that it genuinely is.
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-gate-title"
      ref={dialogRef}
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-[#001f3f]/70 backdrop-blur-sm"
    >
      <div className="w-full max-w-md bg-white rounded-[28px] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="h-[3px] bg-[#d6b357] shrink-0" />

        <div className="px-7 pt-6 pb-5 text-center shrink-0">
          <h2 id="photo-gate-title" className="font-['Outfit'] text-xl font-bold text-[#0d1117]">
            {firstName ? `Welcome, ${firstName}!` : "Welcome!"}
          </h2>
          <p className="text-sm text-[#6b7280] mt-1.5 leading-relaxed">
            Let&rsquo;s add your photo to finish setting up your account. A clear, professional
            headshot helps your team and your clients recognize you.
          </p>
        </div>

        {!imageSrc ? (
          <div className="px-7 pb-7 flex flex-col items-center gap-5">
            <div className="w-28 h-28 rounded-full bg-[#001f3f] flex items-center justify-center text-4xl font-bold text-white shadow-lg">
              {initial}
            </div>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full bg-[#d6b357] text-[#001f3f] text-sm font-bold hover:bg-[#c8a544] transition-colors"
            >
              <Camera className="w-4 h-4" />
              Choose a photo
            </button>

            <p className="text-[11px] text-[#9ca3af] text-center">
              JPG, PNG, or WEBP · up to 10 MB. You can change it any time from your profile.
            </p>

            {error && (
              <p role="alert" className="w-full text-center text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-2.5">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9ca3af] hover:text-[#6b7280] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out instead
            </button>
          </div>
        ) : (
          <>
            <div className="relative w-full bg-[#0d1117] shrink-0" style={{ height: 300 }}>
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                style={{
                  containerStyle: { borderRadius: 0 },
                  cropAreaStyle: {
                    border: "2px solid rgba(214,179,87,0.9)",
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)",
                  },
                }}
              />
            </div>

            <div className="px-7 py-4 border-t border-[#f0f2f5] shrink-0">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Zoom out"
                  onClick={() => setZoom((z) => Math.max(1, +(z - 0.1).toFixed(2)))}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#f4f6f9] hover:bg-[#e8eaed] text-[#6b7280] transition-all"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  aria-label="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none bg-[#e5e5e5] accent-[#001f3f] cursor-pointer"
                />
                <button
                  type="button"
                  aria-label="Zoom in"
                  onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#f4f6f9] hover:bg-[#e8eaed] text-[#6b7280] transition-all"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-[#9ca3af] mt-2 text-center">
                Drag to reposition · scroll or use the slider to zoom
              </p>
            </div>

            {error && (
              <p role="alert" className="mx-7 mb-3 text-center text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-2.5 shrink-0">
                {error}
              </p>
            )}

            <div className="flex gap-3 px-7 pb-6 shrink-0">
              {/* "Pick a different photo", not "Cancel" — there is nothing to
                  cancel out to, and a dead Cancel button reads as a bug. */}
              <button
                type="button"
                disabled={busy}
                onClick={() => { setImageSrc(null); setError(null) }}
                className="flex-1 px-5 py-3 rounded-full font-semibold text-sm border border-[#e5e5e5] text-[#4b5563] hover:bg-[#f7f8fa] transition-all disabled:opacity-50"
              >
                Choose another
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSave()}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full font-bold text-sm bg-[#d6b357] text-[#001f3f] hover:bg-[#c8a544] transition-colors disabled:opacity-60"
              >
                {busy
                  ? <span className="w-4 h-4 rounded-full border-2 border-[#001f3f]/30 border-t-[#001f3f] animate-spin" />
                  : <Check className="w-4 h-4" />}
                {busy ? "Saving…" : "Save photo"}
              </button>
            </div>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
