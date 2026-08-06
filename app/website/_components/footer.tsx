// Site footer — the copyright strip under the closing CTA.

import { INK, SAMPLE_DATA, type WebsiteData } from "../_data"

export function SiteFooter({ data = SAMPLE_DATA }: { data?: WebsiteData }) {
  return (
    <footer className="border-t border-white/10 py-4 text-center text-[11px] text-white/40" style={{ backgroundColor: INK }}>
      © {data.agent.name} · Powered by FHI Global
    </footer>
  )
}
