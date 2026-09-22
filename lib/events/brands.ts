/**
 * Brand identities an event can be published under. Logo files live in
 * public/logos (shared with the Reels Maker). `logoIsWhite` logos need a
 * dark chip behind them on light backgrounds.
 */
export type EventBrand = {
  key: string
  name: string
  logo: string
  logoIsWhite: boolean
  /** 2–4 letter mark stamped in the certificate seal. */
  seal: string
}

export const EVENT_BRANDS: EventBrand[] = [
  { key: "fhiglobal", name: "FHI Global Property", logo: "/logos/FHI_Branding Set_PNG Copies-02.png", logoIsWhite: false, seal: "FHI" },
  { key: "filipinohomes", name: "Filipino Homes", logo: "/logos/Filipinohomes-logo-side-left-white.png", logoIsWhite: true, seal: "FH" },
  { key: "homesph", name: "Homes PH", logo: "/logos/homesph-logo.png", logoIsWhite: false, seal: "HPH" },
  { key: "rentph", name: "Rent PH", logo: "/logos/RentPh new colored logo.png", logoIsWhite: false, seal: "RPH" },
  { key: "fhipartners", name: "FH Global Partners", logo: "/logos/global_partner.png", logoIsWhite: false, seal: "FHGP" },
  { key: "rentsouq", name: "Rentsouq AE", logo: "/logos/RENTSOUQ_AE LOGO.png", logoIsWhite: false, seal: "RSQ" },
]

export function eventBrand(key: string | null | undefined): EventBrand {
  return EVENT_BRANDS.find((b) => b.key === key) ?? EVENT_BRANDS[0]
}
