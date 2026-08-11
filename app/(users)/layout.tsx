import { Great_Vibes, Urbanist } from "next/font/google"
import { DashboardAuthGate } from "@/components/dashboard/dashboard-auth-gate"
import { DashboardBodyFonts } from "@/components/dashboard/dashboard-body-fonts"

// Marketing-template fonts, loaded HERE and not in the root layout so public
// pages don't pay for them. The CSS variables inherit from the wrapper div —
// the flyer/poster overlays are in-tree fixed divs, not portals, so every
// consumer under features/dashboard/** and components/dashboard/** sees them.
// Urbanist — the marketing flyer / announcement templates.
const _urbanist = Urbanist({ subsets: ["latin"], weight: ["800", "900"], display: "swap", variable: "--font-urbanist" })
// Great Vibes — script accents on the award posters (Top Seller studio).
const _greatVibes = Great_Vibes({ subsets: ["latin"], weight: ["400"], display: "swap", variable: "--font-script" })

// No force-dynamic and no server-side session read here: proxy.ts already guards
// every /dashboard/* request (auth, inactive, role), so this layout stays static
// and the whole dashboard tree is prefetchable → instant client-side navigation.
// Session/profile is resolved in the browser by DashboardAuthGate, which renders
// the persistent shell (sidebar + header) once, around every page.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={`${_urbanist.variable} ${_greatVibes.variable}`}>
      {/* Portals (Poster Studio's StudioModal) escape this div — mirror the
          variable classes onto <body> so they inherit there too. */}
      <DashboardBodyFonts classNames={`${_urbanist.variable} ${_greatVibes.variable}`} />
      <DashboardAuthGate>{children}</DashboardAuthGate>
    </div>
  )
}
