import { TopBar } from "@/components/topbar"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

/**
 * Persistent public chrome. Rendering the top bar, header and footer ONCE
 * here (instead of inside every page) keeps them mounted across client-side
 * navigation — no remount flicker, and header state (auth chip, scroll style)
 * survives page changes.
 */
export default function PublicChromeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      <Header />
      {children}
      <Footer />
    </>
  )
}
