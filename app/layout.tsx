import type React from "react"
import type { Metadata } from "next"
import { Geist, Outfit } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { GoogleAnalytics } from "@/components/google-analytics"
import { UtmCapture } from "@/components/utm-capture"
import { AppToaster } from "@/components/app-toaster"
import "./globals.css"
import { DEFAULT_PREVIEW_IMAGE_URL, INDEXABLE_ROBOTS } from "@/lib/seo"
import { PageTransitionWrapper } from "@/components/ui/PageTransitionWrapper"

// Geist Mono used to load here too, preloaded on every public page. Only the dashboards use
// `font-mono`, so it now loads in app/(users)/layout.tsx and the public pages fall back to the
// system monospace (globals.css --font-mono).
const _geist = Geist({ subsets: ["latin"], display: "swap", variable: "--font-geist" })
// Outfit font for display headings (matches Figma design). Stays in the root
// layout: public pages reference it via font-['Outfit'] literals.
// Urbanist + Great Vibes (flyer/poster templates) are dashboard-only and load
// from app/(users)/layout.tsx — public pages must not pay for them.
const _outfit = Outfit({ subsets: ["latin"], display: "swap", variable: "--font-outfit" })

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fhiglobal.ae"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "FHI Global Dubai Real Estate",
    template: "%s | FHI Global",
  },
  description: "Discover premium property projects in Dubai from verified developers.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "FHI Global — Dubai Real Estate",
    description: "Discover premium property projects in Dubai from verified developers.",
    siteName: "FHI Global",
    type: "website",
    images: [{ url: DEFAULT_PREVIEW_IMAGE_URL, width: 1200, height: 630, alt: "FHI Global — Dubai Real Estate" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FHI Global — Dubai Real Estate",
    description: "Discover premium property projects in Dubai from verified developers.",
    images: [DEFAULT_PREVIEW_IMAGE_URL],
  },
  // Indexable is the default, so only the snippet / preview limits are stated
  // here (they used to ride on a blanket X-Robots-Tag header, now removed). Left
  // out on purpose: explicit "index, follow" — Next adds its own
  // <meta name="robots" content="noindex"> to not-found pages, and an explicit
  // "index, follow" beside it made every 404 carry two opposing robots tags.
  robots: INDEXABLE_ROBOTS,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        {/* No raw logo preload here: every render goes through next/image's
            /_next/image URLs, so a preload of the original never matches — it
            just downloads 156 KB at high priority on every page and drops it.
            The legacy-Supabase preconnect is gone with the host (HTTP 402). */}
      </head>
      <body className={`${_geist.variable} ${_outfit.variable} font-sans antialiased`}>
        <PageTransitionWrapper>{children}</PageTransitionWrapper>
        <AppToaster />
        <Analytics />
        <GoogleAnalytics />
        <UtmCapture />
      </body>
    </html>
  )
}
