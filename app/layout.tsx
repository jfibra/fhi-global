import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono, Outfit } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { DEFAULT_PREVIEW_IMAGE_URL } from "@/lib/seo"
import { PageTransitionWrapper } from "@/components/ui/PageTransitionWrapper"
import { NavigationLoader } from "@/components/ui/NavigationLoader"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })
// Outfit font for display headings (matches Figma design)
const _outfit = Outfit({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: {
    default: "FHI Global â€” Dubai Real Estate",
    template: "%s | FHI Global",
  },
  description: "Discover premium property projects in Dubai from verified developers.",
  generator: "v0.app",
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
    title: "FHI Global â€” Dubai Real Estate",
    description: "Discover premium property projects in Dubai from verified developers.",
    type: "website",
    images: [{ url: DEFAULT_PREVIEW_IMAGE_URL }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FHI Global â€” Dubai Real Estate",
    description: "Discover premium property projects in Dubai from verified developers.",
    images: [DEFAULT_PREVIEW_IMAGE_URL],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <PageTransitionWrapper>
          {children}
        </PageTransitionWrapper>
        <NavigationLoader />
        <Analytics />
      </body>
    </html>
  )
}
