import { SiteHeader } from "./_components/header"
import { SiteFooter } from "./_components/footer"
import { IVORY } from "./_data"

// Shared chrome for every /website/* agent site: the sticky navbar on top,
// the copyright strip at the bottom, ivory page background in between.
export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: IVORY }}>
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  )
}
