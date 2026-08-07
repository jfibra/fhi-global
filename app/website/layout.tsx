import { IVORY } from "./_data"

// Shared chrome for every /website/* agent site: the sticky navbar on top and
// the ivory page background. The footer is rendered by each page — it shows
// the site owner's name, which the layout can't know.
export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: IVORY }}>
      {children}
    </div>
  )
}
