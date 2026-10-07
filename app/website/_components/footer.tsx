// Site footer — the copyright strip under the closing CTA.

import { SITE_URL } from "@/lib/seo"
import { agentDisplayName } from "@/lib/agent-site"
import { INK, SAMPLE_DATA, type WebsiteData } from "../_data"

export function SiteFooter({ data = SAMPLE_DATA }: { data?: WebsiteData }) {
  // The owner as people read it ("Lito Bibon", not the stored "LITO  BIBON"), and no "© ·" when there is no name.
  const owner = agentDisplayName(data.agent.name)
  return (
    <footer className="border-t border-white/10 py-4 text-center text-[11px] text-white/40" style={{ backgroundColor: INK }}>
      {owner ? `© ${owner} · ` : ""}Powered by{" "}
      {/* A real, followed link: these sites are indexed now, and the credit is how they point at the platform. */}
      <a href={SITE_URL} className="underline decoration-white/30 underline-offset-2 hover:text-white/70">
        FHI Global
      </a>
    </footer>
  )
}
