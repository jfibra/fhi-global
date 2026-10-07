import { TopBar } from "@/components/topbar"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

/**
 * Persistent public chrome. Rendering the top bar, header and footer ONCE
 * here (instead of inside every page) keeps them mounted across client-side
 * navigation — no remount flicker, and header state (auth chip, scroll style)
 * survives page changes.
 *
 * The page content sits in the one <main> landmark. Pages in this group must
 * not render a <main> of their own (use a <div>), and the (landing) group —
 * which has no layout and draws its own chrome — wraps its content itself.
 */
export default function PublicChromeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  )
}
