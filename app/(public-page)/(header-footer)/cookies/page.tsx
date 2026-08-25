import type { Metadata } from "next"
import { createPageMetadata } from "@/lib/seo"
import { LegalPage } from "@/components/public/legal-page"

export const metadata: Metadata = createPageMetadata({
  title: "Cookie Policy",
  description: "The cookies fhiglobal.ae uses — what they do, and how to control them in your browser.",
  pathname: "/cookies",
  keywords: ["FHI Global cookie policy"],
})

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      effective="25 August 2026"
      intro="Cookies are small text files a website stores in your browser. fhiglobal.ae uses a small, boring set of them — here is exactly what they do."
      sections={[
        {
          heading: "Cookies we use",
          bullets: [
            "Essential cookies — keep you signed in to your account and secure the session. The site cannot work without these.",
            "Preference cookies — remember choices like your last-used filters so the site behaves the way you left it.",
            "Analytics cookies — help us understand which pages are used and how the site performs, in aggregate. They do not identify you personally, and we use them to improve the site, not to build advertising profiles.",
          ],
        },
        {
          heading: "What we don't do",
          paragraphs: [
            "We don't sell data collected through cookies, and we don't run third-party advertising trackers on the site.",
          ],
        },
        {
          heading: "Controlling cookies",
          paragraphs: [
            "Every modern browser lets you view, block and delete cookies in its settings (usually under Privacy or Site Data). Blocking essential cookies will sign you out and may break parts of the site; blocking analytics cookies has no effect on functionality.",
          ],
        },
        {
          heading: "More information",
          paragraphs: [
            "How we handle personal information more broadly is covered in our Privacy Policy. If anything here is unclear, ask us — info@fhiglobal.ae.",
          ],
        },
      ]}
    />
  )
}
