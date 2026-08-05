// Site footer — the copyright strip under the closing CTA.

import { AGENT, INK } from "../_data"

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 py-4 text-center text-[11px] text-white/40" style={{ backgroundColor: INK }}>
      © {AGENT.name} · Powered by FHI Global — sample template with placeholder data
    </footer>
  )
}
