"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowRight, Building2, Lock, ShieldCheck, X } from "lucide-react"
import { HoldToContinue } from "@/components/public/hold-to-continue"

/**
 * The clickable Trakheesi permit in a project's sidebar.
 *
 * Tapping the QR or the button opens a centred confirmation (a native
 * <dialog>: focus trap, Escape and top layer for free) that shows what is
 * being verified and where the reader is going, with the press-and-hold
 * control that opens the DLD in a new tab. Both triggers are real links to
 * the standalone /verify/permit page, so without JavaScript they still work.
 */
export function PermitVerify({
  projectName,
  developerName,
  permitUrl,
  permitNumber,
  link,
  verifyHref,
}: {
  projectName: string
  developerName: string | null
  permitUrl: string
  permitNumber: string | null
  link: string
  verifyHref: string
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const host = (() => {
    try {
      return new URL(link).hostname
    } catch {
      return "dubailand.gov.ae"
    }
  })()

  const show = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault()
    const d = dialogRef.current
    if (!d) return
    if (typeof d.showModal !== "function") {
      // Very old browser: fall through to the standalone page.
      window.location.assign(verifyHref)
      return
    }
    d.showModal()
    setOpen(true)
  }, [verifyHref])

  const hide = useCallback(() => {
    dialogRef.current?.close()
  }, [])

  useEffect(() => {
    document.body.classList.toggle("overflow-hidden", open)
    return () => document.body.classList.remove("overflow-hidden")
  }, [open])

  return (
    <>
      <a
        href={verifyHref}
        onClick={show}
        className="group mt-4 block border border-[#e5e8ec] bg-white p-3 transition-colors hover:border-[#d6b357]"
        aria-label="Verify this permit with the Dubai Land Department"
      >
        <div className="relative aspect-square w-full">
          <Image
            src={permitUrl}
            alt={`Trakheesi permit QR code for ${projectName}`}
            fill
            unoptimized
            sizes="320px"
            className="object-contain transition-transform duration-500 group-hover:scale-[1.02]"
          />
        </div>
      </a>
      <a
        href={verifyHref}
        onClick={show}
        className="group mt-3 inline-flex w-full items-center justify-center gap-2 bg-[#0d1117] px-5 py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#001f3f]"
      >
        Verify with the DLD
        <ArrowRight className="h-4 w-4 text-[#d6b357] transition-transform group-hover:translate-x-0.5" />
      </a>

      <dialog
        ref={dialogRef}
        className="pv-dialog"
        onClose={() => setOpen(false)}
        onClick={(e) => { if (e.target === dialogRef.current) hide() }}
        aria-labelledby="pv-title"
      >
        <div className="pv-card relative w-[min(92vw,720px)] bg-white text-[#0d1117] shadow-[0_40px_120px_-30px_rgba(0,10,30,0.6)]">
          <button
            type="button"
            onClick={hide}
            aria-label="Close"
            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#f3f4f6] text-[#374151] transition-colors hover:bg-[#e5e8ec]"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-5">
            {/* The permit */}
            <div className="border-b border-[#eef0f3] bg-[#f7f8fa] p-5 sm:col-span-2 sm:border-b-0 sm:border-r">
              <div className="border border-[#e5e8ec] bg-white p-3">
                <div className="relative aspect-square w-full">
                  <Image src={permitUrl} alt={`Trakheesi permit QR code for ${projectName}`} fill unoptimized sizes="280px" className="object-contain" />
                </div>
              </div>
              {permitNumber && (
                <dl className="mt-4">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8913f]">Permit number</dt>
                  <dd className="mt-1 font-['Outfit'] text-[17px] font-bold tabular-nums">{permitNumber}</dd>
                </dl>
              )}
            </div>

            {/* What and where */}
            <div className="p-5 sm:col-span-3 sm:p-7">
              <p className="inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#b8913f]">
                <span className="h-[3px] w-6 bg-[#d6b357]" aria-hidden="true" />
                Permit verification
              </p>
              <h2 id="pv-title" className="mt-3 font-['Outfit'] text-[24px] font-bold leading-[1.1] tracking-tight sm:text-[28px]">
                Verify this permit with <span className="text-[#b8913f]">the Dubai Land Department.</span>
              </h2>
              <div className="mt-4 flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d6b357]/50 bg-[#d6b357]/10"><ShieldCheck className="h-4.5 w-4.5 text-[#b8913f]" /></span>
                <div>
                  <p className="font-['Outfit'] text-[17px] font-bold leading-tight">{projectName}</p>
                  {developerName && (
                    <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-[#6b7280]">
                      <Building2 className="h-3.5 w-3.5 text-[#b8913f]" /> {developerName}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 flex items-start gap-3 border border-[#e5e8ec] bg-[#f7f8fa] p-3.5">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#b8913f]" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7280]">Opens in a new tab</p>
                  <p className="mt-0.5 truncate font-['Outfit'] text-[15px] font-bold">{host}</p>
                  <p className="text-[12px] text-[#6b7280]">The official Dubai Land Department domain.</p>
                </div>
              </div>

              <div className="mt-5">
                <HoldToContinue href={link} label="Hold to open the DLD page" />
              </div>
            </div>
          </div>
        </div>
      </dialog>
    </>
  )
}
