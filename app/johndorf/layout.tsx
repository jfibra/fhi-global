import type { Metadata } from "next"
import { Montserrat, Playfair_Display } from "next/font/google"

// Johndorf's own look for the presentation — no FHI branding anywhere under /johndorf.
const serif = Playfair_Display({ subsets: ["latin"], variable: "--font-jd-serif", display: "swap" })
const sans = Montserrat({ subsets: ["latin"], variable: "--font-jd-sans", display: "swap" })

export const metadata: Metadata = {
  title: { absolute: "Johndorf Ventures Corporation", template: "%s · Johndorf Ventures Corporation" },
  description: "Johndorf Ventures Corporation portal.",
  manifest: null,
  icons: { icon: "/johndorf/mark.png", apple: "/johndorf/mark.png" },
  openGraph: {
    title: "Johndorf Ventures Corporation",
    description: "Johndorf Ventures Corporation portal.",
    siteName: "Johndorf Ventures Corporation",
    images: [{ url: "/johndorf/logo.png", width: 391, height: 186, alt: "Johndorf Ventures Corporation" }],
  },
  twitter: { card: "summary", title: "Johndorf Ventures Corporation", images: ["/johndorf/logo.png"] },
  // A private presentation: never in search results.
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}

export default function JohndorfLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${serif.variable} ${sans.variable} min-h-screen bg-[#f7f4f2] font-[family-name:var(--font-jd-sans)] text-[#2a1d1b]`}>
      {children}
    </div>
  )
}
