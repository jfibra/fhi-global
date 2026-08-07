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

/** WhatsApp brand glyph — lucide has no brand icon for it. */
export function WhatsAppIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className} style={style}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.668-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  )
}

/** Facebook Messenger brand glyph — lucide has no brand icon for it. */
export function MessengerIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className} style={style}>
      <path d="M12 0C5.24 0 0 4.952 0 11.64c0 3.499 1.434 6.522 3.769 8.61a.96.96 0 0 1 .323.683l.065 2.135a.961.961 0 0 0 1.347.849l2.381-1.051a.957.957 0 0 1 .641-.047 13.07 13.07 0 0 0 3.474.464c6.76 0 12-4.952 12-11.64C24 4.951 18.76 0 12 0Zm7.207 8.955-3.525 5.592a1.8 1.8 0 0 1-2.604.48l-2.804-2.102a.72.72 0 0 0-.868.002l-3.786 2.874c-.505.384-1.165-.221-.826-.758l3.525-5.592a1.8 1.8 0 0 1 2.604-.48l2.803 2.102a.72.72 0 0 0 .868-.002l3.787-2.874c.505-.384 1.165.221.826.758Z" />
    </svg>
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
