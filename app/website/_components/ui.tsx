// Small shared primitives for the agent-site template.

import type { Award } from "lucide-react"
import { Star } from "lucide-react"
import { GOLD, GOLD_A60 } from "../_data"

export function Eyebrow({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <p className={`text-[11px] font-bold uppercase tracking-[0.3em] ${center ? "text-center" : ""}`} style={{ color: GOLD }}>
      {children}
    </p>
  )
}

/** Centered section eyebrow flanked by long gold rules with diamond tips:
 *  ◆——— LABEL ———◆ */
export function FancyEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-4">
      <span className="h-1.5 w-1.5 shrink-0 rotate-45" style={{ backgroundColor: GOLD }} />
      <span className="h-px max-w-[180px] flex-1" style={{ backgroundColor: GOLD_A60 }} />
      <span className="shrink-0 text-center text-[13px] font-bold uppercase tracking-[0.35em]" style={{ color: GOLD }}>
        {children}
      </span>
      <span className="h-px max-w-[180px] flex-1" style={{ backgroundColor: GOLD_A60 }} />
      <span className="h-1.5 w-1.5 shrink-0 rotate-45" style={{ backgroundColor: GOLD }} />
    </div>
  )
}

export function GoldRing({ icon: Icon, dark }: { icon: typeof Award; dark?: boolean }) {
  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border"
      style={{ borderColor: GOLD, color: GOLD, backgroundColor: dark ? "rgba(255,255,255,0.04)" : "transparent" }}
    >
      <Icon className="h-5 w-5" strokeWidth={1.6} />
    </span>
  )
}

export function Stars() {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="h-3.5 w-3.5" style={{ color: GOLD, fill: GOLD }} />
      ))}
    </span>
  )
}
