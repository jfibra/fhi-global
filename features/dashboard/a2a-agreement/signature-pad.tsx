"use client"

// Draw-to-sign pad. Same interaction model as the owner-documents intake pad
// (pointer events so a finger, stylus and mouse all work), squared off to
// match the dashboard's flat style.

import { useEffect, useRef, useState } from "react"
import { PenLine, Undo2 } from "lucide-react"

export function SignaturePad({
  label,
  onChange,
}: {
  label: string
  onChange: (dataUrl: string | null) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const dirty = useRef(false)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Size the backing store to the device ratio, or strokes look furry.
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.max(1, Math.round(rect.width * ratio))
    canvas.height = Math.max(1, Math.round(rect.height * ratio))
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.scale(ratio, ratio)
      ctx.lineWidth = 2.2
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.strokeStyle = "#0d1117"
    }
  }, [])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    drawing.current = true
    last.current = point(e)
    canvasRef.current?.setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx || !last.current) return
    const p = point(e)
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
    if (!dirty.current) {
      dirty.current = true
      setEmpty(false)
    }
  }
  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    if (dirty.current) onChange(canvasRef.current?.toDataURL("image/png") ?? null)
  }
  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    dirty.current = false
    setEmpty(true)
    onChange(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-[#374151]">{label}</span>
        <button
          type="button"
          onClick={clear}
          disabled={empty}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#6b7280] hover:text-[#001f3f] disabled:opacity-40 transition-colors"
        >
          <Undo2 className="w-3.5 h-3.5" /> Clear
        </button>
      </div>
      <div className="relative border border-dashed border-[#cdd2d9] bg-white">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
          className="h-32 w-full touch-none"
        />
        <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-[#eef0f3]" />
        {empty && (
          <span className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 text-[12px] text-[#c4c4c4]">
            <PenLine className="h-3.5 w-3.5" /> Sign here
          </span>
        )}
      </div>
    </div>
  )
}
